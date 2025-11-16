package node

import (
	"fmt"

	"github.com/comoland/como/js"
)

func ContainsString(slice []string, target string) bool {
	for _, element := range slice {
		if element == target {
			return true
		}
	}
	return false
}

func registerModule(ctx *js.Context) {
	mod := ctx.NewModule("node:module.go")

	// external modules will include both core modules and previously bundled modules
	mod.Export("core_modules", func(args js.Arguments) interface{} {
		return ctx.Externals()
	})

	mod.Export("is_core_module", func(args js.Arguments) interface{} {
		id := args.GetString(0)
		externals := ctx.Externals()

		if ContainsString(externals, id) {
			return true
		}

		f, err := ctx.FSEmbedder.IsEmbedded(id)
		if err == nil {
			return f
		}

		// rr := ctx.ResolveFileName("", id)
		// fmt.Println(rr)
		// if rr != id {
		// 	return true
		// }

		return false
	})

	mod.Export("load_mjs_module", func(args js.Arguments) interface{} {
		global := ctx.GlobalObject()
		defer global.Free()

		filename, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("Filename must be a string")
		}

		code := fmt.Sprintf(`
			import * as all from '%s';
			globalThis.__ex = {...all, ...all.default};
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
