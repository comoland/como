package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

//go:embed js/buffer.js
var bufferJs string

func buffer(ctx *js.Context, _ js.Value) {
	buf, _ := ctx.EvalFile("buffer", bufferJs)
	defer buf.Free()
}
