package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	"sync"
)

type asyncIterator struct {
	ctx      *Context
	iterator Value
	resolve  Value
}

func (ctx *Context) AsyncIterator(close func()) asyncIterator {
	a := C.JS_Call(ctx.c, ctx.asyncIterator, C.JS_NewUndefined(), 0, nil)
	iterator := Value{ctx: ctx, c: a}
	resolve := iterator.GetValue("pushValue")
	var clean *Function
	clean = ctx.Function(func(_ Arguments) interface{} {
		close()
		defer func() {
			clean.Free()
			resolve.Free()
			iterator.Free()
			defer ctx.UnRef()
		}()
		return nil
	})

	iterator.Set("clean", clean)
	ctx.Ref()
	iterator.Dup()
	return asyncIterator{
		ctx:      ctx,
		iterator: iterator,
		resolve:  resolve,
	}
}

func (a asyncIterator) Next(value interface{}) *sync.WaitGroup {
	ctx := a.ctx
	var wg sync.WaitGroup
	wg.Add(1)
	ctx.Channel <- func() {
		if ctx.refs <= 0 {
			panic("refs <= 0")
		}

		jsVal := ctx.goToJSValue(value)
		result := C.JS_Call(ctx.c, a.resolve.c, a.iterator.c, 1, &jsVal)
		ctx.FreeValue(jsVal)
		ctx.FreeValue(result)
		wg.Done()
	}
	return &wg
}
