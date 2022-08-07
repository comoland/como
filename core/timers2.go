package core

import (
	_ "embed"
	"time"

	"github.com/comoland/como/js"
)

//go:embed js/timers.js
var timersJs string

func timers2(ctx *js.Context, global js.Value) {
	timers := ctx.EvalFunction("timers", timersJs)
	defer timers.Free()

	timeout := ctx.Function(func(args js.Arguments) interface{} {
		callback, ok := args.Get(0).(js.Function)
		if !ok {
			return ctx.Throw("timers arg(0) must be a function")
		}

		timeout, ok := args.Get(1).(int64)
		if !ok {
			timeout = 0
		}

		callback.Dup()
		// ctx.Ref()

		go func() {
			time.Sleep(time.Duration(timeout) * time.Millisecond)
			ctx.Channel <- func() {
				// might be freed in celar timeout
				if !callback.IsFunction() {
					return
				}

				defer callback.Free()
				callback.Call()
			}
		}()

		return ctx.Function(func(args js.Arguments) interface{} {
			go func() {
				time.Sleep(time.Duration(timeout) * time.Millisecond)
				ctx.Channel <- func() {
					// might be freed in celar timeout
					if !callback.IsFunction() {
						return
					}

					callback.Call()
				}
			}()

			return nil
		})
	})

	unref := ctx.Function(func(args js.Arguments) interface{} {
		ctx.UnRef()
		return nil
	})

	ref := ctx.Function(func(args js.Arguments) interface{} {
		ctx.Ref()
		return nil
	})

	timers.Call(timeout, ref, unref)
}
