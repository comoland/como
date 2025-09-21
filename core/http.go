package core

import (
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/comoland/como/js"
)

//go:embed js/http.js
var httpJs string

func httpModule(ctx *js.Context, _ js.Value) {
	jsHttp := ctx.EvalFunction("http", httpJs)
	defer jsHttp.Free()
	exp := ctx.Object()
	exp.Dup().AutoFree()

	exp.Set("_exports", ctx.Object())

	// HTTP Methods
	exp.Set("METHODS", []string{
		"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS",
	})

	// HTTP Status Codes
	exp.Set("STATUS_CODES", map[string]interface{}{
		"200": "OK",
		"201": "Created",
		"204": "No Content",
		"301": "Moved Permanently",
		"302": "Found",
		"304": "Not Modified",
		"400": "Bad Request",
		"401": "Unauthorized",
		"403": "Forbidden",
		"404": "Not Found",
		"500": "Internal Server Error",
	})

	// Create HTTP Server
	exp.Set("createServer", func(args js.Arguments) interface{} {
		requestListener := args.GetValue(0).Dup().AutoFree()
		if !requestListener.IsFunction() {
			return ctx.Throw("TypeError: requestListener must be a function")
		}

		server := ctx.Object()
		server.Set("listening", false)

		// Start server
		server.Set("listen", func(args js.Arguments) interface{} {
			port, isInt := args.Get(0).(int64)
			if !isInt {
				return ctx.Throw("TypeError: port must be a number")
			}

			callback := args.GetValue(1)
			if !callback.IsUndefined() && !callback.IsFunction() {
				return ctx.Throw("TypeError: callback must be a function")
			}

			// Create HTTP server
			httpServer := &http.Server{
				Addr: fmt.Sprintf(":%d", port),
			}

			// Set up request handler
			httpServer.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Create response object
				var statusCode int = 200
				var headersWritten bool
				var responseBuffer bytes.Buffer
				var wg sync.WaitGroup
				wg.Add(1)

				ctx.Channel <- func() {
					defer wg.Done()

					headers := map[string]interface{}{}
					for name, values := range r.Header {
						for _, value := range values {
							headers[name] = value
						}
					}

					req := ctx.Object()
					req.Set("method", r.Method)
					req.Set("url", r.URL.String())
					req.Set("httpVersion", r.Proto)
					req.Set("headers", headers)

					res := ctx.Object()
					res.Set("writeHead", func(args js.Arguments) interface{} {
						if headersWritten {
							return ctx.Throw("Error: headers already written")
						}

						code, isInt := args.Get(0).(int64)
						if !isInt {
							return ctx.Throw("TypeError: statusCode must be a number")
						}
						statusCode = int(code)

						headers := make(map[string]string)
						if args.Len() > 1 {
							if h, ok := args.Get(1).(map[string]interface{}); ok {
								for k, v := range h {
									if s, ok := v.(string); ok {
										headers[k] = s
									}
								}
							}
						}

						// Set headers
						for k, v := range headers {
							w.Header().Set(k, v)
						}

						headersWritten = true
						return nil
					})

					res.Set("write", func(args js.Arguments) interface{} {
						buf, err := args.GetBuffer(0)

						if err != nil {
							switch data := args.Get(0).(type) {
							case []byte:
								responseBuffer.Write(data)
							case string:
								responseBuffer.WriteString(data)
							default:
								fmt.Println(data)
								panic("stream accepts buffer or string only")
							}
						} else {
							responseBuffer.Write(buf)
						}

						return nil
					})

					res.Set("end", func(args js.Arguments) interface{} {
						if args.Len() > 0 {
							switch data := args.Get(0).(type) {
							case []byte:
								responseBuffer.Write(data)
							case string:
								responseBuffer.WriteString(data)
							default:
								panic("stream accepts buffer or string only")
							}
						}

						// Write headers and body
						if !headersWritten {
							w.WriteHeader(statusCode)
							headersWritten = true
						}

						w.Write(responseBuffer.Bytes())
						return nil
					})

					args := ctx.NewArguments(req, res)
					requestListener.Call(args)
					req.Free()
					res.Free()
					// defer args.Free()
				}

				wg.Wait()
			})

			// Start server
			ctx.Ref()
			go func() {
				err := httpServer.ListenAndServe()
				if err != nil && err != http.ErrServerClosed {
					if !callback.IsUndefined() {
						callback.Call(err.Error())
					}
				}
			}()

			server.Set("listening", true)

			if !callback.IsUndefined() {
				callback.Call()
			}

			return nil
		})

		// Close server
		server.Set("close", func(args js.Arguments) interface{} {
			callback := args.GetValue(0)
			if !callback.IsUndefined() && !callback.IsFunction() {
				return ctx.Throw("TypeError: callback must be a function")
			}

			// Get server instance
			serverVal := server.Get("_server")
			if serverVal, ok := serverVal.(*http.Server); ok {
				err := serverVal.Close()
				if err != nil {
					if !callback.IsUndefined() {
						callback.Call(err.Error())
					}
					return nil
				}
			}

			server.Set("listening", false)
			ctx.UnRef()

			if !callback.IsUndefined() {
				callback.Call()
			}

			return nil
		})

		return server
	})

	// Create HTTP request
	exp.Set("request", func(args js.Arguments) interface{} {
		options, isObject := args.Get(0).(map[string]interface{})
		if !isObject {
			return ctx.Throw("TypeError: options must be an object")
		}

		callback := args.GetValue(1)
		if !callback.IsFunction() {
			return ctx.Throw("TypeError: callback must be a function")
		}

		// Create request
		req := ctx.Object()

		// Set up request
		method := "GET"
		if m, ok := options["method"].(string); ok {
			method = m
		}

		urlStr := ""
		if u, ok := options["url"].(string); ok {
			urlStr = u
		}

		headers := make(map[string]string)
		if h, ok := options["headers"].(map[string]interface{}); ok {
			for k, v := range h {
				if s, ok := v.(string); ok {
					headers[k] = s
				}
			}
		}

		// Create HTTP request
		httpReq, err := http.NewRequest(method, urlStr, nil)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		// Set headers
		for k, v := range headers {
			httpReq.Header.Set(k, v)
		}

		// Set up request methods
		req.Set("write", func(args js.Arguments) interface{} {
			data, err := args.GetBuffer(0)
			if err != nil {
				return ctx.Throw(err.Error())
			}

			httpReq.Body = io.NopCloser(bytes.NewReader(data))
			return nil
		})

		req.Set("end", func(args js.Arguments) interface{} {
			if args.Len() > 0 {
				data, err := args.GetBuffer(0)
				if err != nil {
					return ctx.Throw(err.Error())
				}
				httpReq.Body = io.NopCloser(bytes.NewReader(data))
			}

			// Send request
			client := &http.Client{}
			resp, err := client.Do(httpReq)
			if err != nil {
				return ctx.Throw(err.Error())
			}
			defer resp.Body.Close()

			// Create response object
			res := ctx.Object()
			res.Set("statusCode", resp.StatusCode)
			res.Set("statusMessage", resp.Status)
			res.Set("headers", resp.Header)

			// Read response body
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return ctx.Throw(err.Error())
			}

			res.Set("body", body)

			// Call callback
			callback.Call(res)

			return nil
		})

		return req
	})

	// Create HTTP GET request
	exp.Set("get", func(args js.Arguments) interface{} {
		options, isObject := args.Get(0).(map[string]interface{})
		if !isObject {
			return ctx.Throw("TypeError: options must be an object")
		}

		callback := args.GetValue(1)
		if !callback.IsFunction() {
			return ctx.Throw("TypeError: callback must be a function")
		}

		// Set method to GET
		options["method"] = "GET"

		// Create request
		requestFn := exp.Get("request")
		if requestFn, ok := requestFn.(js.Value); ok && requestFn.IsFunction() {
			return requestFn.Call(options, callback)
		}
		return ctx.Throw("TypeError: request function not found")
	})

	ret := jsHttp.Call(exp)

	m := ctx.NewModule("http")
	m.Export("default", ret)
	m.Exports(ret)
}
