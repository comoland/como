package core

import (
	_ "embed"
	"fmt"
	"sync"

	"github.com/comoland/como/js"
)

var wg = &sync.WaitGroup{}

func createChild(parent *js.RPC) *js.RPC {
	var child js.RPC

	go func() {
		ctx := ComoStr2("test.js", `
			globalThis.onmessage = function(msg) {
				(async () => {
					setTimeout(() => {
						// throw new Error('ss')
						postmessage("hi")
					}, 1)
				})();
			};



			console.log('from child')
		`)

		global := ctx.GlobalObject()
		onmessage := global.GetValue("onmessage")

		callback := ctx.Function(func(args js.Arguments) interface{} {

			arg := args.Get(0).(string)
			fmt.Println("why? ", arg)

			if arg == "exit" {
				ctx.Terminate()
				return nil
			}

			if onmessage.IsFunction() {
				onmessage.CallArgs(args)
			}

			return nil
		})

		global.SetFunction("postmessage", func(args js.Arguments) interface{} {
			fmt.Println("message to parent")
			arg := args.Get(0)
			go parent.Send(arg)
			return nil
		})

		dupped := callback.Dup().AutoFree()
		callback.Free()

		child = *ctx.NewRPC(callback)
		wg.Done()

		ctx.Loop()
		dupped.Free()
		child.Close()
		fmt.Println("child closed!")
		callback.Free()
		onmessage.Free()
		global.Free()
		ctx.Free()

		// close parent
		go parent.Close()
	}()

	return &child
}

func worker2(ctx *js.Context, global js.Value) {
	global.Set("worker2", func(args js.Arguments) interface{} {
		workerFile, isFile := args.Get(0).(string)
		callback, isFunc := args.Get(1).(js.Function)

		callback.Dup().AutoFree()
		// defer callback.Free()

		fmt.Println(workerFile)

		if !isFile {
			return ctx.Throw("Worker arg(0) must be a file path to worker script")
		}

		if !isFunc {
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

		parent := ctx.NewRPC(&callback)
		wg.Add(1)
		child := createChild(parent)
		wg.Wait()

		obj := ctx.Object()

		obj.Set("postMessage", func(args js.Arguments) interface{} {
			arg := args.Get(0)
			go child.Send(arg)
			return nil
		})

		obj.Set("terminate", func(args js.Arguments) interface{} {
			go child.Send("exit")
			// defer parent.Close()
			// callback.Free()
			return nil
		})

		return obj
	})
}
