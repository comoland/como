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

	m := ctx.NewModule("xxx.go")
	m.Export("default", map[string]string{
		"xxx": "path.js",
	})

	ctx.RegisterCoreModules(jsFiles, map[string]string{
		"primordials": "primordials.js",
	})
}
