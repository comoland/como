package node

import (
	"bufio"
	_ "embed"
	"os"
	"runtime"
	"strings"

	"github.com/comoland/como/js"
)

func worker(ctx *js.Context, Como js.Value) {
	mod := ctx.NewModule("worker.go")

	mod.Export("worker", func(args js.Arguments) interface{} {
		// thread := core.ComoContext()

		return nil
	})

	mod.Export("stdout", func(args js.Arguments) interface{} {
		arg := args.GetValue(0).ToString()
		os.Stdout.Write([]byte(arg))

		return nil
	})

	mod.Export("args", func(args js.Arguments) interface{} {
		argsWithProg := os.Args
		return argsWithProg
	})

	mod.Export("stdin", func(args js.Arguments) interface{} {
		writer := ctx.Writer(args.GetValue(0))
		if writer == nil {
			return ctx.Throw("must has a writer callback")
		}

		async := ctx.Async(func(async js.Promise) {
			reader := bufio.NewReader(os.Stdin)
			input, err := reader.ReadString('\n')

			if err != nil {
				async.Reject(err.Error())
				return
			}

			writer.Call(input)
			async.Resolve(nil)
		})

		async.Finally(func(args js.Arguments) interface{} {
			writer.Close()
			return nil
		})

		return async
	})

	mod.Export("env", func(args js.Arguments) interface{} {
		transaction := ctx.Object()
		for _, e := range os.Environ() {
			pair := strings.Split(e, "=")
			transaction.Set(pair[0], pair[1])
		}

		return transaction
	})

	mod.Export("setEnv", func(args js.Arguments) interface{} {
		key := args.Get(0).(string)
		val := args.Get(1).(string)
		os.Setenv(key, val)
		return nil
	})

	mod.Export("registerAlias", func(args js.Arguments) interface{} {
		alias := args.Get(0).(string)
		location := args.Get(1).(string)
		ctx.RegisterModuleAlias(alias, location)
		return nil
	})

	mod.Export("cwd", func(args js.Arguments) interface{} {
		path, err := os.Getwd()
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return path
	})

	mod.Export("suspense", func(args js.Arguments) interface{} {
		fn := args.GetValue(0)
		ctx.Suspense(fn)
		return nil
	})

	mod.Export("platform", func(args js.Arguments) interface{} {
		return runtime.GOOS
	})
}
