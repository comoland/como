package node

import (
	"runtime"

	"github.com/comoland/como/js"
)

func goBindings(ctx *js.Context, _ js.Value) {
	mod := ctx.NewModule("bindings.go")

	mod.Export("osType", func(args js.Arguments) interface{} {
		return runtime.GOOS
	})
}
