package core

import (
	"github.com/comoland/como/js"
)

func initCoreModels(ctx *js.Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	// Como global object
	comoObj := ctx.Object()
	global.Set("Como", comoObj)

	// global methods
	timers(ctx, global)
	process(ctx, global)
	console(ctx, global)
	buffer(ctx, global)
	fetch(ctx, global)

	// Como methods
	path(ctx, comoObj)
	build(ctx, comoObj)
	sql(ctx, comoObj)
	worker(ctx, comoObj)
	worker2(ctx, comoObj)
}
