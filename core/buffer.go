package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

//go:embed js/polyfills.js
var bufferJs string

func buffer(ctx *js.Context, _ js.Value) {
	buf, _ := ctx.EvalFile("bufferxxx", bufferJs)

	// vv := ctx.Await(buf)
	// defer vv.Free()
	// fmt.Println("xxxxxxxxx ", vv)
	defer buf.Free()
}
