package core

import (
	_ "embed"
	"time"

	"github.com/comoland/como/js"
)

func worker(ctx *js.Context, global js.Value) {
	global.Set("worker", func(args js.Arguments) interface{} {
		workerFile, ok := args.Get(0).(string)
		callback, isFunc := args.Get(1).(js.Function)

		if !ok {
			return ctx.Throw("Worker arg(0) must be a file path to worker script")
		}

		if !isFunc {
			return ctx.Throw("Worker arg(1) must be a callback function")
		}

		parent := ctx.NewRPC(&callback)
		var child = &js.RPC{}

		ctx.Ref()

		obj := ctx.ClassObject(func() {
			// fmt.Println("finalized")
		})

		obj.Set("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			go func() {
				time.Sleep(5 * time.Millisecond)
				ctx.Channel <- func() {
					postMessage := obj.GetValue("postMessage")
					defer postMessage.Free()
					postMessage.Call(arg)
				}
			}()
			return nil
		})

		obj.Set("terminate", func(args js.Arguments) interface{} {
			go func() {
				time.Sleep(5 * time.Millisecond)
				ctx.Channel <- func() {
					terminate := obj.GetValue("terminate")
					defer terminate.Free()
					terminate.Call(nil)
				}
			}()
			return nil
		})

		obj.Dup()

		initWorkerContext := ctx.InitWorkerContext
		go func() {
			Loop, threadCtx := Como(workerFile)
			global := threadCtx.GlobalObject()
			como := global.GetValue("Como")
			if initWorkerContext != nil {
				initWorkerContext(threadCtx, workerFile)
				threadCtx.InitWorkerContext = initWorkerContext
			}

			threadCtx.Ref()
			ctx.Channel <- func() {
				obj.Set("terminate", func(args js.Arguments) interface{} {
					// to.Close()

					go func() {
						threadCtx.Channel <- func() {
							threadCtx.Terminate()
						}
					}()

					return nil
				})
			}

			como.Set("onMessage", func(args js.Arguments) interface{} {
				cb, ok := args.Get(0).(js.Function)

				if !ok {
					return threadCtx.Throw("Worker arg must be a function to worker file location")
				}

				child = threadCtx.NewRPC(&cb)
				ctx.Channel <- func() {
					obj.Set("postMessage", func(args js.Arguments) interface{} {
						arg := args.Get(0)
						go func() {
							child.Send(arg)
						}()

						return nil
					})
				}

				return nil
			})

			como.Set("postMessage", func(args js.Arguments) interface{} {
				arg := args.Get(0)
				go func() {
					parent.Send(arg)
				}()
				return nil
			})

			Loop(func() {
				global.Free()
				como.Free()
			})

			ctx.Channel <- func() {
				obj.Free()
				parent.Close()
				ctx.UnRef()
			}
		}()

		return obj
	})
}
