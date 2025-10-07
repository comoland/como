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

	goBuffer(ctx, global)
	goBindings(ctx, global)
	goOS(ctx, global)
	goFileSystem(ctx, global, jsFiles)
}
