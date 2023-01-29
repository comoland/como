package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

// Promise is the interface that describes a javascript promise.
type Promise struct {
	ctx     *Context
	Promise Value
	resolve Value
	reject  Value
}

// NewPromise creates a new prmise
func (ctx *Context) NewPromise() Promise {
	p := C.JS_Call(ctx.c, ctx.promise, C.JS_NewUndefined(), 0, nil)

	promise := Value{ctx: ctx, c: C.JS_DupValue(ctx.c, p)}
	resolve := promise.GetValue("resolve")
	reject := promise.GetValue("reject")

	// each promise increase ref count
	ctx.Ref()
	return Promise{
		ctx:     ctx,
		Promise: promise,
		resolve: resolve,
		reject:  reject,
	}
}

func (ctx *Context) Async(fn func(async Promise)) Promise {
	async := ctx.NewPromise()
	go func() {
		fn(async)
	}()
	return async
}

// Free frees promise resourses
func (p Promise) Free() {
	p.resolve.Free()
	p.reject.Free()
	p.Promise.Free()
}

func (p Promise) settlePromise(value interface{}, reject int) {
	ctx := p.ctx

	// on resolve/reject promise should be dispatched to the main thread
	// we tell js ctx channel we have data to handle
	// ctx refs should be decreased
	ctx.Channel <- func() {
		ctx.UnRef()
		jsVal := ctx.GoToJSValue(value)
		defer func() {
			p.Free()
			jsVal.Free()
		}()

		dispatch := p.reject.c
		if reject == 0 {
			dispatch = p.resolve.c
		}

		C.JS_Call(ctx.c, dispatch, C.JS_NewUndefined(), 1, &jsVal.c)
	}
}

// Resolve resolves javascript promise class and free it's resources
// accepts an interface which must be one of the types that can be converted to js value
func (p Promise) Resolve(value interface{}) {
	p.settlePromise(value, 0)
}

// Reject rejects javascript promise class and free it's resources
// accepts an interface which must be one of the types that can be converted to js value
func (p Promise) Reject(value interface{}) {
	p.settlePromise(value, 1)
}
