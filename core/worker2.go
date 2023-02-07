package core

import (
	_ "embed"
	"fmt"
	"sync"

	"github.com/comoland/como/js"
)

// type workerOptions struct {
// 	IsCode   bool
// 	Filename string
// 	IsLite   bool
// }

var wg = &sync.WaitGroup{}

func createChild(parent chan interface{}, parentCtx *js.Context, options workerOptions) *js.RPC {
	var child js.RPC

	var ctx *js.Context
	go func() {
		ctx = ComoContext()
		if options.IsCode == true {
			ctx.LoadMainModuleString(options.Filename, options.Code)
		} else {
			ctx.LoadMainModule(options.Filename)
		}

		fmt.Println("passed to here")

		parentCtx.RegisterWorkerModules(ctx)

		// inherit parent context embed options
		ctx.Embed = parentCtx.Embed

		global := ctx.GlobalObject()
		onmessage := global.GetValue("onmessage")

		callback := ctx.Function(func(args js.Arguments) interface{} {
			arg, isString := args.Get(0).(string)

			if isString && arg == "exit" {
				ctx.Terminate()
				return nil
			}

			if onmessage.IsFunction() {
				onmessage.CallArgs(args)
			}

			return nil
		})

		fmt.Println("setGlobal postMessage")
		global.SetFunction("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			parent <- arg
			return nil
		})

		dupped := callback.Dup().AutoFree()
		callback.Free()

		child = *ctx.NewRPC(callback)
		wg.Done()

		if !onmessage.IsFunction() {
			ctx.UnRef()
			// ctx.Terminate()
		}

		ctx.Loop()
		dupped.Free()
		child.Close()
		callback.Free()
		onmessage.Free()
		global.Free()
		ctx.Free()
		fmt.Println("exited")

		go func() {
			parent <- "exit"
		}()
	}()

	return &child
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

		fmt.Println("wait done")

		obj := ctx.Object()

		obj.Set("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			child.Send(arg)
			return nil
		})

		obj.Set("terminate", func(args js.Arguments) interface{} {
			child.Send("exit")
			return nil
		})

		go func() {
			for ret := range parent {
				fmt.Println(" got exit message from child", ret)
				ctx.Channel <- func() {
					msg, isString := ret.(string)
					if isString && msg == "exit" {
						fmt.Println("worker exit")
						callback.Free()
						close(parent)
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
