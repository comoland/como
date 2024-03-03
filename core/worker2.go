package core

import (
	_ "embed"
	"sync"

	"github.com/comoland/como/js"
)

// type workerOptions struct {
// 	IsCode   bool
// 	Filename string
// 	IsLite   bool
// }

type Child struct {
	isClose   bool
	rpc       *js.RPC
	close     func()
	terminate func()
}

var wg = &sync.WaitGroup{}

func createChild(parent chan interface{}, parentCtx *js.Context, options workerOptions) *Child {
	var child = &Child{isClose: false}
	child.close = func() {
		if child.isClose {
			return
		}
	}

	var ctx *js.Context
	go func() {
		ctx = ComoContext()

		parentCtx.RegisterWorkerModules(ctx)

		// inherit parent context embed options
		ctx.Embed = parentCtx.Embed

		global := ctx.GlobalObject()

		global.SetFunction("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			parent <- arg
			return nil
		})

		if options.IsCode == true {
			ctx.LoadMainModuleString(options.Filename, options.Code)
		} else {
			ctx.LoadMainModule(options.Filename)
		}

		child.terminate = func() {
			child.isClose = true
			ctx.Channel <- func() { ctx.Throw2("exit2") }
		}

		onmessage := global.GetValue("onmessage")
		callback := ctx.Function(func(args js.Arguments) interface{} {
			if onmessage.IsFunction() {
				onmessage.Call(args)
			}

			return nil
		})

		dupped := callback.Dup().AutoFree()
		callback.Free()

		child.rpc = ctx.NewRPC(callback)
		wg.Done()

		if !onmessage.IsFunction() {
			if !child.isClose {
				child.isClose = true
				ctx.UnRef()
			}
		}

		ctx.Loop()
		dupped.Free()
		child.rpc.Close()
		callback.Free()
		onmessage.Free()
		global.Free()
		ctx.Free()
		child.isClose = true

		go func() {
			parent <- "exit"
		}()
	}()

	return child
}

func worker2(ctx *js.Context, global js.Value) {
	// var mx sync.Mutex
	// var wg = &sync.WaitGroup{}
	global.Set("thread", func(args js.Arguments) interface{} {
		fn := args.GetValue(0)
		if !fn.IsFunction() {
			return ctx.Throw("ddddddd")
		}

		toStringFn := ctx.EvalFunction(`<>`, `(fn) => {
			return fn.toString()
		}`)

		defer toStringFn.Free()
		fnString := toStringFn.Call(fn).(string)

		var childWriter *js.Writer
		var parentWriter *js.Writer
		return ctx.Async(func(async js.Promise) {
			wg.Add(1)
			go func() {
				thread := ComoContext()
				main := thread.EvalFunction("<native>", fnString)

				// parent object
				parent := thread.Object()
				parent.Set("on", func(args js.Arguments) interface{} {
					childWriter = thread.Writer(args.GetValue(1))
					return nil
				})

				parent.Set("send", func(args js.Arguments) interface{} {
					arg := args.Get(0)
					if parentWriter != nil {
						go func() {
							parentWriter.Call(arg)
						}()
					}

					return nil
				})

				main.Call(parent)
				thread.Ref()
				wg.Done()

				thread.Loop()
				// main.Free()
				// onData.Free()
				// childWriter.Close()
				// thread.Free()
			}()

			wg.Wait()

			// child object
			child := ctx.Object()
			child.Set("on", func(args js.Arguments) interface{} {
				parentWriter = ctx.Writer(args.GetValue(1))
				return nil
			})

			child.Set("send", func(args js.Arguments) interface{} {
				arg := args.Get(0)
				if childWriter != nil {
					go func() {
						childWriter.Call(arg)
					}()
				}

				return nil
			})

			async.Resolve(child)
		})
	})

	global.Set("worker2", func(args js.Arguments) interface{} {
		workerFile, isFile := args.Get(0).(string)
		callback := args.GetValue(1).Dup().AutoFree()

		if !isFile {
			return ctx.Throw("Worker arg(0) must be a file path to worker script")
		}

		if !callback.IsFunction() {
			return ctx.Throw("Worker arg(1) must be a callback function")
		}

		var options = workerOptions{
			IsCode:   false,
			IsLite:   false,
			Filename: "",
		}

		err := args.GetMap(2, &options)

		if options.IsCode {
			options.Code = workerFile
		} else {
			options.Filename = workerFile
		}

		if err != nil {
			return ctx.Throw(err.Error())
		}

		ctx.Ref()
		parent := make(chan interface{}, 1)

		wg.Add(1)
		child := createChild(parent, ctx, options)
		wg.Wait()

		obj := ctx.Object()

		obj.Set("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			child.rpc.Send(arg)
			return nil
		})

		obj.Set("terminate", func(args js.Arguments) interface{} {
			if !child.isClose {
				child.terminate()
			}

			return nil
		})

		go func() {
			for ret := range parent {
				ctx.Channel <- func() {
					msg, isString := ret.(string)
					if isString && msg == "exit" {
						if parent != nil {
							close(parent)
							parent = nil
						}

						callback.Free()
						ctx.UnRef()
					} else {
						callback.Call(ret)
					}
				}
			}
		}()

		return obj
	})
}
