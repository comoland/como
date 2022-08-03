package core

import (
	"bytes"
	"fmt"
	"log"
	"sync"

	"github.com/comoland/como/js"
	"github.com/evanw/esbuild/pkg/api"
	"github.com/valyala/fasthttp"
)

func http(ctx *js.Context, Como js.Value) {
	var filesHandler = fasthttp.FSHandler("./files", 0)

	Como.Set("http", ctx.Function(func(args js.Arguments) interface{} {
		port := args.Get(0).(string)

		server := &fasthttp.Server{
			// Concurrency: 10,
		}

		async := ctx.AsyncIterator(func() {
			server.Shutdown()
		})

		go func() {
			server.Handler = func(req *fasthttp.RequestCtx) {
				fmt.Println("new request added ===> ", req.ID())
				var response = &req.Response
				path := req.Path()

				if bytes.HasSuffix(path, []byte(".html")) || bytes.HasSuffix(path, []byte(".tsx")) || bytes.HasSuffix(path, []byte("/favicon.ico")) {
					if bytes.HasSuffix(path, []byte(".tsx")) {
						response.Header.Set("Content-Type", "text/javascript; charset=utf-8")
					}
					filesHandler(req)
					return
				}

				wg := &sync.WaitGroup{}
				wg.Add(1)
				async.Next(func() interface{} {
					response.Header.Set("Content-Type", "text/html; charset=utf-8")

					length := req.QueryArgs().Len()
					queryArgs := make(map[string]interface{}, length)
					req.QueryArgs().VisitAll(func(key, value []byte) {
						queryArgs[string(key)] = string(value)
					})

					length = req.PostArgs().Len()
					postArgs := make(map[string]interface{}, length)
					req.PostArgs().VisitAll(func(key, value []byte) {
						postArgs[string(key)] = string(value)
					})

					return map[string]interface{}{
						"req": map[string]interface{}{
							"id":       int64(req.ID()),
							"method":   string(req.Method()),
							"uri":      string(req.RequestURI()),
							"path":     string(req.Path()),
							"query":    queryArgs,
							"postArgs": postArgs,
							"cookie": func(args js.Arguments) interface{} {
								key, ok := args.Get(0).(string)
								if !ok {
									return ctx.Throw("cookie arg(0) must be a string")
								}
								return string(req.Request.Header.Cookie(key))
							},
							"body": func(args js.Arguments) interface{} {
								return string(req.PostBody())
							},
						},
						"res": map[string]interface{}{
							"header": func(args js.Arguments) interface{} {
								key, ok := args.Get(0).(string)
								if !ok {
									return ctx.Throw("header key must be a string")
								}

								value, ok := args.Get(1).(string)
								if !ok {
									return ctx.Throw("header value must be a string")
								}

								response.Header.Set(key, value)
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

								// type cookieOptions struct {
								// 	Plugins  []plugin
								// 	Define   map[string]string
								// 	HTTPOnly bool
								// 	Minify   bool
								// }

								authCookie := fasthttp.Cookie{}
								authCookie.SetKey(key)
								authCookie.SetValue(value)
								authCookie.SetDomain("")
								authCookie.SetPath("/")
								// authCookie.SetMaxAge(expire)
								authCookie.SetHTTPOnly(true)
								// authCookie.SetSameSite(fasthttp.CookieSameSiteLaxMode)

								response.Header.SetCookie(&authCookie)
								return nil
							},
							"body": func(args js.Arguments) interface{} {
								defer wg.Done()

								// if bodyStr, ok := args.Get(0).(string); ok {
								// 	response.SetBodyString(bodyStr)
								// }

								switch val := args.Get(0).(type) {
								case []byte:
									fmt.Println("image res")
									response.SetBody(val)
								case string:
									response.SetBodyString(val)
								default:
									fmt.Println("body accepts buffer or string only")
								}

								return nil
							},
							"serve": func(args js.Arguments) interface{} {
								defer wg.Done()
								filename, ok := args.Get(0).(string)
								if !ok {
									return ctx.Throw("path must be a string")
								}

								result := api.Build(api.BuildOptions{
									EntryPoints: []string{filename},
									Platform:    api.PlatformBrowser,
									Define:      map[string]string{"process.env.NODE_ENV": "'development'"},
									Bundle:      true,
									External:    []string{"app/api/getUsers.ts", "app/api/getUsers", "/home/mamod/go_modules/src/github.com/comoland/como/app/api/getUsers", "/home/mamod/go_modules/src/github.com/comoland/como/app/api/getUsers.ts"},
									Write:       false,
									Target:      api.ESNext,
									Format:      api.FormatESModule,
									Sourcemap:   api.SourceMapInline,
								})

								response.Header.Set("Content-Type", "text/javascript; charset=utf-8")
								if len(result.Errors) > 0 {
									fmt.Println("error ==> ", result.Errors[0])
									return fmt.Sprintf(`(function(){
										var message = "%s";
										console.log(message);
									})()`, result.Errors[0].Text)
								}

								codeStr := string(result.OutputFiles[0].Contents)
								response.SetBodyString(codeStr)
								return nil
							},
						},
					}
				})
				wg.Wait()
			}

			if err := server.ListenAndServe(port); err != nil {
				log.Fatalf("Error in ListenAndServe: %s", err)
			}
		}()

		return async
	}))
}
