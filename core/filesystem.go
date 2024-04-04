package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

func gofilesystem(ctx *js.Context, Como js.Value) {
	path := ctx.Object()
	Como.Set("path", path)

}
