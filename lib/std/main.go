package std

import (
	"github.com/comoland/como/js"
)

func Register(ctx *js.Context) {
	registerTimers(ctx)
	registerExec(ctx)
	registerSystem(ctx)
}
