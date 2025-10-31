package node

import (
	"embed"
	"fmt"

	"github.com/comoland/como/js"
)

//go:embed js/*
var jsFiles embed.FS

func InitNode(ctx *js.Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	ctx.RegisterCoreModules(jsFiles, map[string]string{
		"primordials": "primordials.js",
	})

	global.SetFunction("op_sync", func(args js.Arguments) interface{} {
		fn := args.GetValue(0)

		ff := ctx.EvalFunction("<waiter>", `async (fn) => {
			await fn();
		}`)

		ret := ff.JsCall(fn)
		b := ctx.Fulfill(ret)
		fmt.Println(" ====? ", b.ToString())
		if ret.IsFunction() {
			panic("should not")
		}
		ctx.Await(ret)
		return nil
	})

	global.SetFunction("op_load_mjs_module", func(args js.Arguments) interface{} {
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
		// defer ctx.GC()
		return global.GetValue("__ex")
	})

	process(ctx, global)
	timers(ctx, global)
	goBuffer(ctx, global)

	goBindings(ctx, global)
	goOS(ctx, global)
	goFileSystem(ctx, global, jsFiles)
	goBlob(ctx, global)
	goURL(ctx, global)
	goTextEncoder(ctx, global)
	build(ctx, global)
}
