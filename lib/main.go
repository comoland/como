package lib

import (
	"embed"

	"github.com/comoland/como/js"
	"github.com/comoland/como/lib/como"
	"github.com/comoland/como/lib/node"
	"github.com/comoland/como/lib/std"
	"github.com/comoland/como/lib/web"
)

//go:embed **/js/* main.js
var jsFiles embed.FS

func Register(ctx *js.Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	global.SetFunction("op_sync", func(args js.Arguments) interface{} {
		fn := args.GetValue(0)
		ret := ctx.Await(fn)

		if ret.IsError() {
			return ctx.Throw(ret)
		}

		return ret
	})

	ctx.RegisterCoreModules(jsFiles, map[string]string{
		"primordials": "primordials.js",
	})

	node.Register(ctx)
	std.Register(ctx)
	web.Register(ctx)
	como.Register(ctx)
}
