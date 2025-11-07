package node

import (
	"github.com/comoland/como/js"
)

func Register(ctx *js.Context) {
	registerProcess(ctx)
	registerOS(ctx)
	registerBuffer(ctx)
	registerModule(ctx)
	registerFS(ctx)
}
