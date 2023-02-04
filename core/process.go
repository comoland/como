package core

import (
	_ "embed"
	"os"
	"runtime"
	"strings"

	"github.com/comoland/como/js"
)

//go:embed js/process.js
var processJs string

func process(ctx *js.Context, Como js.Value) {

	p := ctx.NewModule("process.go")
	p.Export("exit", func(args js.Arguments) interface{} {
		num := args.Get(0).(int64)
		os.Exit(int(num))
		return nil
	})

	p.Export("stdout", func(args js.Arguments) interface{} {
		arg := args.GetValue(0).ToString()
		os.Stdout.Write([]byte(arg))

		return nil
	})

	p.Export("env", func(args js.Arguments) interface{} {
		// var envMap = map[string]interface{}
		transaction := ctx.Object()
		for _, e := range os.Environ() {
			pair := strings.Split(e, "=")
			transaction.Set(pair[0], pair[1])
		}

		return transaction
	})

	obj := ctx.Object()
	obj.Set("args", func(args js.Arguments) interface{} {
		argsWithProg := os.Args
		return argsWithProg
	})

	obj.Set("stdout", func(args js.Arguments) interface{} {
		arg := args.GetValue(0).ToString()
		os.Stdout.Write([]byte(arg))

		return nil
	})

	obj.Set("exit", func(args js.Arguments) interface{} {
		num := args.Get(0).(int64)
		os.Exit(int(num))
		return nil
	})

	obj.Set("env", func(args js.Arguments) interface{} {
		transaction := ctx.Object()
		for _, e := range os.Environ() {
			pair := strings.Split(e, "=")
			transaction.Set(pair[0], pair[1])
		}

		return transaction
	})

	obj.Set("registerAlias", func(args js.Arguments) interface{} {
		alias := args.Get(0).(string)
		location := args.Get(1).(string)
		ctx.RegisterModuleAlias(alias, location)
		return nil
	})

	obj.Set("cwd", func(args js.Arguments) interface{} {
		path, err := os.Getwd()
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return path
	})

	obj.Set("suspense", func(args js.Arguments) interface{} {
		fn := args.GetValue(0)
		ctx.Suspense(fn)
		return nil
	})

	obj.Set("platform", func(args js.Arguments) interface{} {
		return runtime.GOOS
	})

	process := ctx.EvalFunction("process", processJs)
	defer process.Free()
	process.Call(obj)
}
