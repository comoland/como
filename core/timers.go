package core

import (
	"time"

	"github.com/comoland/como/js"
)

func timers(ctx *js.Context, global js.Value) {
	var timerFn *js.Function

	// globalThis.setTimeout
	timerFn = global.SetFunction("setTimeout", func(args js.Arguments) interface{} {
		callback, ok := args.Get(0).(js.Function)
		if !ok {
			return ctx.Throw("timers arg(0) muct be a function")
		}

		timeout, ok := args.Get(1).(int64)
		if !ok {
			timeout = 0
		}

		hasArgs := args.Len() > 2
		var callBackArgs js.Arguments
		if hasArgs {
			callBackArgs = args.Slice(2, -1).Dup()
		} else {
			callBackArgs = ctx.NewArguments(nil)
		}

		callBackArgs.This = callback.Dup()
		ctx.Ref()

		go func() {
			time.Sleep(time.Duration(timeout) * time.Millisecond)
			ctx.Channel <- func() {
				// might be freed in celar timeout
				if !callback.IsFunction() {
					return
				}

				if callback.Get("__repeat") == true && callback.Get("__refed") != false {
					timerFn.Call(args)
				}

				ctx.UnRef()
				callback.Call(callBackArgs)
				defer callback.Free()
				defer callBackArgs.Free()
			}
		}()

		return callback
	})

	// globalThis.setInterval
	global.Set("setInterval", ctx.Function(func(args js.Arguments) interface{} {
		callback := args.GetValue(0)
		callback.Set("__repeat", true)
		timerFn.Call(args.Dup())
		return callback
	}))

	ctx.Eval(`
		globalThis.setImmediate = function(cb, ...args) {
			return setTimeout(cb, 0, ...args)
		}
	`)

	// clear timers
	clear := ctx.Function(func(args js.Arguments) interface{} {
		callback := args.GetValue(0)
		if !callback.IsFunction() {
			defer callback.Free()
			return nil
			// return ctx.Throw("clear timers arg(0) muct be a a timer function")
		}

		callback.Set("__refed", false)
		ctx.UnRef()
		defer callback.Free()
		return nil
	})

	clear.Dup()
	// clear.Dup()
	global.Set("clearTimeout", clear)
	global.Set("clearInterval", clear)
	global.Set("clearImmediate", clear.Dup())
}
