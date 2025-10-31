package node

import (
	"fmt"

	"github.com/comoland/como/js"
)

func module(ctx *js.Context, global js.Value) {
	mod := ctx.NewModule("module.go")

	mod.Export("op_load_mjs_module", func(args js.Arguments) interface{} {
		filename, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("Filename must be a string")
		}

		code := fmt.Sprintf(`
			import * as all from '%s';
			globalThis.__ex = all;
		`, filename)

		ret, err := ctx.EvalModule("<importer>", code)
		if err != nil {
			panic(err.Error())
		}

		defer ret.Free()
		defer global.Set("__ex", nil)
		return global.GetValue("__ex")
	})
}
