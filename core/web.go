package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

//go:embed js/web/stream.js
var streamPolyfill string

func webPolyfills(ctx *js.Context, global js.Value) {
	stream := ctx.EvalFunction("stream-polyfill", streamPolyfill)
	stream.Call()
	defer stream.Free()
}
