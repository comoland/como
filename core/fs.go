package core

import (
	_ "embed"
	"os"

	"github.com/comoland/como/js"
)

//go:embed js/filesystem.js
var fsJs string

func filesystem(ctx *js.Context, global js.Value) {
	filesystem := ctx.EvalFunction("filesystem", fsJs)
	defer filesystem.Free()
	exp := ctx.Object()
	exp.Dup().AutoFree()

	exp.Set("exports", ctx.Object())

	exp.Set("read", func(args js.Arguments) interface{} {
		file, isString := args.Get(0).(string)

		if !isString {
			return ctx.Throw("TypeError: First argument to read must be a string")
		}

		body, err := os.ReadFile(file)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return body
	})

	ret := filesystem.Call(exp)

	m := ctx.NewModule("fs")
	m.Exports(ret)
	m.Export("default", ret)
}
