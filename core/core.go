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
	initCoreModels(ctx)

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

func ComoStr(filename string, codeStr string) (func(func()), *js.Context) {
	runtime.LockOSThread()
	var rt = js.NewRuntime()
	ctx := rt.NewContext()
	global := ctx.GlobalObject()
	initCoreModels(ctx)

	return func(fn func()) {
		if len(filename) > 0 {
			ctx.LoadModuleStr(filename, codeStr, 1)
		}

		ctx.Loop()

		defer func() {
			fn()
			global.Free()
			ctx.Free()
		}()
	}, ctx
}

func ComoStr2(filename string, codeStr string) *js.Context {
	runtime.LockOSThread()
	var rt = js.NewRuntime()
	ctx := rt.NewContext()
	global := ctx.GlobalObject()
	initCoreModels(ctx)

	func() {
		global.Free()
		// ctx.Free()
	}()

	if len(filename) > 0 {
		ctx.LoadModuleStr(filename, codeStr, 1)
	}

	return ctx
}
