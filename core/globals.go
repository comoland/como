package core

import (
	"github.com/comoland/como/js"
)

func Init(ctx *js.Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	// initiate globals methods
	// timers(ctx, global)

	fetch(ctx, global)
	timers(ctx, global)

	// initiate Como core methods
	comoObj := ctx.Object()
	global.Set("Como", comoObj)

	process(ctx, comoObj)

	console(ctx, global)

	path(ctx, comoObj)
	build(ctx, comoObj)

	http(ctx, comoObj)
	sql(ctx, comoObj)
	worker(ctx, comoObj)
}
