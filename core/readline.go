package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

//go:embed js/readline.js
var readlineJs string

func readline(ctx *js.Context, global js.Value) {
	readline := ctx.EvalFunction("readline", readlineJs)

	exp := ctx.Object()
	defer exp.Free()
	defer readline.Free()

	ret := readline.JsCall(exp)
	ret.Dup().AutoFree()

	m := ctx.NewModule("readline")
	m.Export("default", ret)
}
