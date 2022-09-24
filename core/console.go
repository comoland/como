package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

//go:embed js/console.js
var consoleJs string

// TODO: port this to go!
func console(ctx *js.Context, global js.Value) {
	process := ctx.EvalFunction("console", consoleJs)
	defer process.Free()
	process.Call()
}
