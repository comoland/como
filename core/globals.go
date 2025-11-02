package core

import (
	"fmt"
	"os"
	"time"

	"github.com/comoland/como/js"
)

func initCoreModels(ctx *js.Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	// Como global object
	comoObj := ctx.Object()
	global.Set("Como", comoObj)

	// global methods
	// timers(ctx, global)
	// process(ctx, global)
	// console(ctx, global)
	// buffer(ctx, global)
	// fetch(ctx, global)
	// wasi(ctx, global)
	// httpModule(ctx, global)
	// cryptoModule(ctx, global)
	// readline(ctx, global)
	// system(ctx, comoObj)

	// // Como methods
	path(ctx, comoObj)
	// embedFs(ctx, comoObj)
	// build(ctx, comoObj)
	// sql(ctx, comoObj)
	// worker(ctx, comoObj)
	// worker2(ctx, comoObj)

	comoObj.Set("print", func(args js.Arguments) interface{} {
		request := args.JsValueToString(0)
		fmt.Print(request)
		return nil
	})

	comoObj.Set("resolve", func(args js.Arguments) interface{} {
		request, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("path must be a string")
		}

		path, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("path must be a string")
		}

		rr := js.NewResolver(path)
		result, err := rr.Resolve(request, path)

		if err != nil {
			return ctx.Throw(err.Error())
		}

		return result

		// return filepath.Dir(path)
	})

	comoObj.Set("statSync", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to stat must be a string")
		}

		info, err := os.Stat(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return map[string]interface{}{
			"size":    info.Size(),
			"mode":    info.Mode(),
			"modTime": info.ModTime().UnixNano() / int64(time.Millisecond),
			"isDir":   info.IsDir(),
		}
	})

	comoObj.Set("readFileSync", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readFile must be a string")
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return string(body)
	})
}
