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

	go func() {
		ctx := ComoStr2("test.js", `
			globalThis.onmessage = function(msg) {
				(async () => {
					setTimeout(() => {
						console.log("got message from parent ", msg)
						// throw new Error('ss xxxxxxxxxxxxxxxxxxxxxx')
						postMessage("hi")
					}, 1)
				})();
			};

			console.log('from child')
		`)

		global := ctx.GlobalObject()
		onmessage := global.GetValue("onmessage")

		callback := ctx.Function(func(args js.Arguments) interface{} {
			arg := args.Get(0).(string)
			if arg == "exit" {
				ctx.Terminate()
				return nil
			}

			if onmessage.IsFunction() {
				onmessage.CallArgs(args)
			}

			return nil
		})

		global.SetFunction("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			parent <- arg
			return nil
		})

		dupped := callback.Dup().AutoFree()
		callback.Free()

		child = *ctx.NewRPC(callback)
		wg.Done()

		ctx.Loop()
		dupped.Free()
		child.Close()
		callback.Free()
		onmessage.Free()
		global.Free()
		ctx.Free()
	}()

	return &child
}

func worker2(ctx *js.Context, global js.Value) {
	global.Set("worker2", func(args js.Arguments) interface{} {
		workerFile, isFile := args.Get(0).(string)
		callback := args.GetValue(1).Dup().AutoFree()

		fmt.Println(workerFile)

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
			go child.Send(arg)
			return nil
		})

		obj.Set("terminate", func(args js.Arguments) interface{} {
			go child.Send("exit")
			callback.Free()
			close(parent)
			go ctx.UnRef()
			return nil
		})

		go func() {
			for ret := range parent {
				ctx.Channel <- func() {
					callback.Call(ret)
				}
			}
		}()

		return obj
	})
}
