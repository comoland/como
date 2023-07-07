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
