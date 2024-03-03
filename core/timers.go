package core

import (
	"context"
	_ "embed"
	"time"

	"github.com/comoland/como/js"
)

//go:embed js/timers.js
var timersJs string

func timers(ctx *js.Context, global js.Value) {
	timers := ctx.EvalFunction("timers", timersJs)
	defer timers.Free()

	timeout := ctx.Function(func(args js.Arguments) interface{} {
		this := args.GetValue(0)
		callback := this.GetValue("trigger")
		timeout, okIsNumber := this.Get("timeout").(int64)

		if !okIsNumber {
			timeout = 0
		}

		ctx.Ref()
		isFreed := false
		timerCxt, cancel := context.WithCancel(context.Background())

		tick := func() {
			go func() {
				select {
				case <-timerCxt.Done():
					return
				case <-time.After(time.Duration(timeout) * time.Millisecond):
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

					return
				}
			}()
		}

		tick()
		this.Set("unref", func(args js.Arguments) interface{} {
			if isFreed {
				return nil
			}

			isFreed = true
			callback.Free()
			ctx.UnRef()
			cancel()

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
