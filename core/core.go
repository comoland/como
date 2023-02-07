package core

import (
	"runtime"

	"github.com/comoland/como/js"
)

func ComoContext() *js.Context {
	runtime.LockOSThread()
	var rt = js.NewRuntime()
	ctx := rt.NewContext()
	initCoreModels(ctx)

	return ctx
}

func Como(filename string) (func(func()), *js.Context) {
	ctx := ComoContext()

	return func(fn func()) {
		if len(filename) > 0 {
			ctx.LoadModule(filename, 1)
		}

		ctx.Loop()

		defer func() {
			fn()
			ctx.Free()
		}()
	}, ctx
}

func ComoStr(filename string, codeStr string) (func(func()), *js.Context) {
	ctx := ComoContext()

	return func(fn func()) {
		if len(filename) > 0 {
			ctx.LoadModuleStr(filename, codeStr, 1)
		}

		ctx.Loop()

		defer func() {
			fn()
			ctx.Free()
		}()
	}, ctx
}

func ComoStr2(filename string, codeStr string) *js.Context {
	ctx := ComoContext()
	if len(filename) > 0 {
		ctx.LoadModuleStr(filename, codeStr, 1)
	}

	return ctx
}
