package node

import (
	"fmt"

	"github.com/comoland/como/js"
)

func registerModule(ctx *js.Context) {
	mod := ctx.NewModule("node:module.go")

	mod.Export("op_load_mjs_module", func(args js.Arguments) interface{} {
		global := ctx.GlobalObject()
		defer global.Free()

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
