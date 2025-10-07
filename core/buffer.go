package core

import (
	_ "embed"
	"fmt"

	"github.com/comoland/como/js"
)

//go:embed js/polyfills.js
var bufferJs string

func buffer(ctx *js.Context, _ js.Value) {
	buf, _ := ctx.EvalFile("bufferxxx", bufferJs)
	ctx.STDLoop()
	fmt.Println("xxxxxxxxx ", buf)
	defer buf.Free()
}
