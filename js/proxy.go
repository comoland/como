package js

// #include "quickjs.h"
import "C"

type proxy struct {
	ctx   *Context
	proxy Value
}

func (ctx *Context) Proxy(arg interface{}) proxy {
	p := proxy{
		ctx: ctx,
	}

	fn, isFunc := arg.(func(key string) interface{})
	obj, isObject := arg.(map[string]interface{})

	if !isFunc && !isObject {
		obj = make(map[string]interface{})
	}

	jsVal := ctx.GoToJSValue(func(args Arguments) interface{} {
		key, ok := args.Get(0).(string)
		if !ok {
			key = ""
		}

		if isFunc {
			return fn(key)
		}

		v, found := obj[key]
		if !found {
			return ctx.Undefined()
		}

		return ctx.goToJSValue(v)
	})

	jsProxy := Value{ctx: ctx, c: C.JS_Call(ctx.c, ctx.proxy, ctx.Undefined().c, 1, &jsVal.c)}
	defer func() {
		jsProxy.Free()
		jsVal.Free()
	}()

	jsProxy.Dup()
	p.proxy = jsProxy
	return p
}
