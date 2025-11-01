package node

import (
	"embed"

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
		ret := ctx.Await(fn)

		if ret.IsError() {
			return ctx.Throw(ret)
		}

		return ret
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
	module(ctx, global)
}
