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
		this := args.GetValue(0)
		callback := this.Get("trigger").(js.Function)
		timeout, okIsNumber := this.Get("timeout").(int64)

		if !okIsNumber {
			timeout = 0
		}

		callback.Dup()
		ctx.Ref()
		isFreed := false

		tick := func() {
			go func() {
				time.Sleep(time.Duration(timeout) * time.Millisecond)
				if isFreed {
					return
				}

				ctx.Channel <- func() {
					// might be freed in celar timeout
					if !callback.IsFunction() {
						return
					}

					callback.Call()
				}
			}()
		}

		tick()
		this.Set("unref", func(args js.Arguments) interface{} {
			if isFreed {
				return nil
			}

			isFreed = true
			ctx.UnRef()
			callback.Free()
			return nil
		})

		this.Set("ref", func(args js.Arguments) interface{} {
			ctx.Ref()
			return nil
		})

		return ctx.Function(func(args js.Arguments) interface{} {
			tick()
			return nil
		})
	})

	timers.Call(timeout)
}
