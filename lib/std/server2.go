package std

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/comoland/como/js"
)

func readUserIP2(r *http.Request) string {
	IPAddress := r.Header.Get("X-Real-Ip")
	if IPAddress == "" {
		IPAddress = r.Header.Get("X-Forwarded-For")
	}

	if IPAddress == "" {
		IPAddress = r.RemoteAddr
	}

	return IPAddress
}

func initHTTP(ctx *js.Context) {
	var err error

	p := ctx.NewModule("server.go")
	p.Export("http", func(args js.Arguments) interface{} {
		ctx.Ref()
		port := args.Get(0).(string)
		fn := args.GetValue(1).Dup().AutoFree()

		mux := http.NewServeMux()
		var mx sync.Mutex
		mux.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
			mx.Lock()
			flusher, ok := w.(http.Flusher)
			if !ok {
				panic("no flusher")
			}

			resEnded := false
			isBodyRead := false

			readBody := func() ([]byte, error) {
				var bosyData []byte
				if isBodyRead {
					return nil, errors.New("Request body already consumed")
				}

				isBodyRead = true
				defer req.Body.Close()
				bosyData, err = io.ReadAll(req.Body)
				return bosyData, err
			}

			message := make(chan []byte, 1)
			var httpReq = map[string]any{
				"ip":     readUserIP2(req),
				"method": req.Method,
				"uri":    req.RequestURI,
				"path":   req.URL.Path,
				"host":   req.Host,
			}

			ctx.Channel <- func() {
				// var ret = map[string]any{}

				// http request
				httpReq["header"] = func(args js.Arguments) any {
					key, ok := args.Get(0).(string)
					if !ok {
						return ctx.Throw("header arg(0) must be a string")
					}

					c := req.Header.Get(key)
					return c
				}

				httpReq["headers"] = func(args js.Arguments) any {
					headers := map[string]interface{}{}
					for name, values := range req.Header {
						for _, value := range values {
							headers[name] = value
						}
					}

					return headers
				}

				httpReq["query"] = func(args js.Arguments) any {
					key := args.Get(0).(string)
					queries := req.URL.Query()
					return queries.Get(key)
				}

				httpReq["cookie"] = func(args js.Arguments) interface{} {
					key, ok := args.Get(0).(string)
					if !ok {
						return ctx.Throw("cookie arg(0) must be a string")
					}

					c, err := req.Cookie(key)

					if err != nil {
						return nil
					}

					return c.Value
				}

				httpReq["cookies"] = func(args js.Arguments) interface{} {
					cookies := req.Cookies()
					raw, err := json.Marshal(&cookies)
					if err != nil {
						return ctx.Throw(err.Error())
					}

					return ctx.ParseJSON(string(raw))
				}

				httpReq["form"] = func(args js.Arguments) interface{} {
					maxMemory, ok := args.GetNumber(0)
					if !ok {
						maxMemory = 10 << 20
					}

					return ctx.Async(func(async js.Promise) {
						err := req.ParseMultipartForm(int64(maxMemory))
						if err != nil {
							async.Reject(err.Error())
							return
						}

						async.Resolve(map[string]interface{}{
							"headers": func(args js.Arguments) interface{} {
								for _, fheaders := range req.MultipartForm.File {
									for _, hdr := range fheaders {
										fmt.Println("files size ==> ", hdr.Size)
										fmt.Println("files mime ==> ", hdr.Header.Get("Content-Type"))
										file, _ := hdr.Open()
										defer file.Close()
									}
								}

								for _, fheaders := range req.MultipartForm.Value {
									for _, hdr := range fheaders {
										fmt.Println("values ===> ", hdr)
									}
								}

								return nil
							},
							"fromFile": func(args js.Arguments) interface{} {
								file, ok := args.Get(0).(string)
								if !ok {
									return ctx.Throw("file arg(0) must be a string")
								}

								return ctx.Async(func(async js.Promise) {
									file, handler, err := req.FormFile(file)
									if err != nil {
										async.Reject(err.Error())
										return
									}

									defer file.Close()

									ret, err := io.ReadAll(file)
									if err != nil {
										async.Reject(err.Error())
										return
									}

									async.Resolve(map[string]interface{}{
										"size": handler.Size,
										"mime": handler.Header.Get("Content-Type"),
										"name": handler.Filename,
										"data": ret,
									})
								})
							},
							"fromValue": func(args js.Arguments) interface{} {
								val, ok := args.Get(0).(string)
								if !ok {
									return ctx.Throw("arg(0) must be a string - name of form value")
								}

								return ctx.Async(func(async js.Promise) {
									value := req.FormValue(val)
									async.Resolve([]byte(value))
								})
							},
						})
					})
				}

				httpReq["body"] = func(args js.Arguments) interface{} {
					writer := ctx.Writer(args.GetValue(0))
					var bytesRead = int64(0)
					prom := ctx.Async(func(async js.Promise) {
						if writer != nil {
							defer req.Body.Close()
							n, err := io.Copy(writer, req.Body)
							bytesRead = bytesRead + n
							if err != nil {
								async.Reject(err.Error())
								return
							}
						} else {
							b, err := readBody()
							if err != nil {
								async.Reject(err.Error())
								return
							}
							async.Resolve(string(b))
							return
						}

						async.Resolve(nil)

					})

					prom.Finally(func(args js.Arguments) interface{} {
						if writer != nil {
							writer.Close()
							if bytesRead > 32*1000 {
								bytesRead = 0
								ctx.GC()
							}
						}
						return nil
					})

					return prom
				}

				httpReq["file"] = func(args js.Arguments) interface{} {
					file, ok := args.Get(0).(string)
					if !ok {
						return ctx.Throw("file arg(0) must be a string")
					}

					promise := ctx.NewPromise()

					go func() {
						err := req.ParseMultipartForm(10 << 20)
						if err != nil {
							promise.Reject(err.Error())
							return
						}

						file, handler, err := req.FormFile(file)
						if err != nil {
							promise.Reject(err.Error())
							return
						}

						defer file.Close()

						// scanner := bufio.NewScanner(file)
						// // optionally, resize scanner's capacity for lines over 64K, see next example
						// for scanner.Scan() {
						// 	fmt.Println(scanner.Bytes())
						// }

						// if err := scanner.Err(); err != nil {
						// 	log.Fatal(err)
						// }

						ret, err := io.ReadAll(file)
						if err != nil {
							promise.Reject(err.Error())
							return
						}

						promise.Resolve(map[string]interface{}{
							"size": handler.Size,
							"mime": handler.Header.Get("Content-Type"),
							"name": handler.Filename,
							"data": ret,
						})
					}()

					return promise
				}

				httpReq["on"] = func(args js.Arguments) interface{} {
					event, ok := args.Get(0).(string)
					if !ok {
						return ctx.Throw("event key must be a string")
					}

					promise := ctx.NewPromise()
					if event == "data" {
						// go func() {
						// 	for {
						// 		b := make([]byte, 1024)
						// 		n, err := req.Body.Read(b)
						// 		if err != nil {
						// 			break
						// 		}
						// 		message <- b[:n]
						// 	}
						// }()
					} else if event == "disconnect" {
						go func() {
							<-req.Context().Done()
							promise.Resolve(true)
						}()
					}
					return promise
				}

				// http res

				// ret["req"] = httpReq

				m := map[string]interface{}{
					"req": httpReq,
					"res": map[string]interface{}{
						"redirect": func(args js.Arguments) interface{} {
							url := args.GetString(0)

							code, ok := args.GetNumber(1)
							if !ok {
								code = 303
							}

							http.Redirect(w, req, url, int(code))
							message <- []byte("")
							return nil
						},
						"status": func(args js.Arguments) interface{} {
							key, ok := args.Get(0).(int64)
							if !ok {
								return ctx.Throw("res status must be a number: ex re.status(301)")
							}

							w.WriteHeader(int(key))
							return nil
						},
						"header": func(args js.Arguments) interface{} {
							key, ok := args.Get(0).(string)
							if !ok {
								return ctx.Throw("header key must be a string")
							}

							value, ok := args.Get(1).(string)
							if !ok {
								return ctx.Throw("header value must be a string")
							}

							w.Header().Add(key, value)
							return nil
						},
						"cookie": func(args js.Arguments) interface{} {
							key, ok := args.Get(0).(string)
							if !ok {
								return ctx.Throw("header key must be a string")
							}

							value, ok := args.Get(1).(string)
							if !ok {
								return ctx.Throw("header value must be a string")
							}

							cookie := http.Cookie{
								Path:     "/",
								Name:     key,
								Value:    value,
								SameSite: http.SameSiteLaxMode,
							}

							err := args.GetMap(2, &cookie)
							if err != nil {
								return ctx.Throw(err.Error())
							}

							http.SetCookie(w, &cookie)
							return nil
						},
						"flush": func(args js.Arguments) interface{} {
							defer flusher.Flush()
							return nil
						},
						"write": func(args js.Arguments) interface{} {
							if resEnded {
								return nil
							}

							switch val := args.Get(0).(type) {
							case []byte:
								w.Write(val)
							case string:
								w.Write([]byte(val))
							default:
								panic("stream accepts buffer or string only")
							}

							defer flusher.Flush()
							return nil
						},
						"body": func(args js.Arguments) interface{} {
							if resEnded {
								return nil
							}

							switch val := args.Get(0).(type) {
							case []byte:
								message <- val
							case string:
								message <- []byte(val)
							default:
								go func() { message <- []byte("") }()
								return ctx.Throw("Response Body type unknown")
							}
							return nil
						},
						"body2": func(args js.Arguments) interface{} {
							if resEnded {
								return nil
							}

							val := args.Get(0)

							return ctx.Async(func(async js.Promise) {
								switch val2 := val.(type) {
								case []byte:
									w.Write(val2)
								case string:
									w.Write([]byte(val2))
								default:
									go func() { message <- []byte("") }()
								}

								flusher.Flush()
								async.Resolve(nil)
							})
						},
						"end": func(args js.Arguments) interface{} {
							if resEnded {
								return nil
							}
							message <- []byte("")
							return nil
						},
					},
				}

				fn.Call(m)
				mx.Unlock()
			}

			res := <-message
			resEnded = true
			if len(res) > 0 {
				w.Write(res)
			}
		})

		dir := http.Dir("./static")
		fs := http.FileServer(dir)
		mux.Handle("/static/", http.StripPrefix("/static/", fs))

		server := &http.Server{Addr: port, Handler: mux}
		go func() {
			err := server.ListenAndServe()
			if err != nil {
				server.Close()
				ctx.Channel <- func() {
					ctx.UnRef()
					ctx.Throw2(err.Error())
				}
			}
		}()

		return map[string]interface{}{
			"close": func(args js.Arguments) interface{} {
				ctx.UnRef()
				server.Close()
				return nil
			},
		}
	})
}
