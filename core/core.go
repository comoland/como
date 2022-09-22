package core

import (
	"runtime"

	"github.com/comoland/como/js"
)

func Como(filename string) (func(func()), *js.Context) {
	runtime.LockOSThread()
	var rt = js.NewRuntime()
	ctx := rt.NewContext()
	global := ctx.GlobalObject()
	Init(ctx)

	return func(fn func()) {
		if len(filename) > 0 {
			ctx.LoadModule(filename, 1)
		}

		ctx.Loop()

		defer func() {
			fn()
			global.Free()
			ctx.Free()
		}()
	}, ctx
}
