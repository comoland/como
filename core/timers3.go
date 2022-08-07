package core

import (
	_ "embed"
	"fmt"
	"time"

	"github.com/comoland/como/js"
)

//go:embed js/timers3.js
var timers3Js string

func timers3(ctx *js.Context, global js.Value) {
	timers := ctx.EvalFunction("timers", timers3Js)
	defer timers.Free()

	var callback js.Function

	interval := int64(1)
	ticker := time.NewTicker(time.Duration(interval) * time.Millisecond)
	go func() {
		// counter := 1.0
		for range ticker.C {
			fmt.Println("ticker accelerating to " + fmt.Sprint(interval) + " ms")

			// fmt.Println("ticker accelerating to " + fmt.Sprint(interval/counter) + " ms")
			ctx.Channel <- func() {
				callback.Call(interval)
			}
		}
		fmt.Println("stopped")
	}()

	ref := ctx.Function(func(args js.Arguments) interface{} {
		ctx.Ref()
		return nil
	})

	unref := ctx.Function(func(args js.Arguments) interface{} {
		ctx.UnRef()
		return nil
	})

	timeout := ctx.Function(func(args js.Arguments) interface{} {
		interval = args.Get(0).(int64)
		// fmt.Println("reset timers timeout " + fmt.Sprint(interval))
		ticker.Reset(time.Duration(interval) * time.Millisecond)
		return nil
	})

	callback = timers.Call(ref, unref, timeout).(js.Function)
	// callback.Call()
	// fmt.Println("timers3 callback", callback)
	// defer c.Free()
}
