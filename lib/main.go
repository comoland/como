package lib

import (
	"github.com/comoland/como/js"
	"github.com/comoland/como/lib/std"
)

func Register(ctx *js.Context) {
	std.Register(ctx)
}
