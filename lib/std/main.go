package std

import (
	"github.com/comoland/como/js"
)

func Register(ctx *js.Context) {
	registerTimers(ctx)
	registerIo(ctx)
	registerExec(ctx)
	registerSystem(ctx)
	registerServer(ctx)
}
