package http

import (
	"bytes"
	"github.com/comoland/como/js"
	"github.com/valyala/fasthttp"
	"log"
	"sync"
)

func Init(ctx *js.Context, comoObj js.Value) {
	var filesHandler = fasthttp.FSHandler("./files", 0)

	comoObj.Set("http", ctx.Function(func(arg js.Arguments) interface{} {
		async := ctx.AsyncIterator()

		go func() {
			h := func(req *fasthttp.RequestCtx) {
				var response = &req.Response
				path := req.Path()

				if bytes.HasSuffix(path, []byte(".html")) || bytes.HasSuffix(path, []byte(".tsx")) || bytes.HasSuffix(path, []byte("/favicon.ico")) {
					if bytes.HasSuffix(path, []byte(".tsx")) {
						response.Header.Set("Content-Type", "text/javascript; charset=utf-8")
					}
					filesHandler(req)
					return
				}

				var wg sync.WaitGroup
				wg.Add(1)
				async.Next(func() interface{} {
					return map[string]interface{}{
						"method": string(req.Method()),
						"uri":    string(req.RequestURI()),
						"path":   string(req.Path()),
						"query": ctx.Function(func(args js.Arguments) interface{} {
							queryArg, ok := args.Get(0).(string)
							if ok {
								return string(req.QueryArgs().Peek(queryArg))
							}

							len := req.QueryArgs().Len()
							queryArgs := make(map[string]interface{}, len)
							req.QueryArgs().VisitAll(func(key, value []byte) {
								queryArgs[string(key)] = string(value)
							})

							return queryArgs
						}),
						"body": ctx.Function(func(args js.Arguments) interface{} {
							response.Header.Set("Content-Type", "text/html; charset=utf-8")
							if bodyStr, ok := args.Get(0).(string); ok {
								response.SetBodyString(bodyStr)
							}

							defer wg.Done()
							return string(req.Path())
						}),
					}
				})

				wg.Wait()
			}

			s := &fasthttp.Server{
				Handler:     h,
				Concurrency: 1000,
				// TCPKeepalive: true,
			}

			if err := s.ListenAndServe(":8080"); err != nil {
				log.Fatalf("Error in ListenAndServe: %s", err)
			}
		}()

		return async
	}))
}
