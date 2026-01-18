package como

import (
	"fmt"
	"os"
	"time"

	"github.com/comoland/como/js"
)

func Register(ctx *js.Context) {
	path := comoPathImpl(ctx)
	var defaults = map[string]any{
		"path": path,
		"print": func(args js.Arguments) any {
			request := args.JsValueToString(0)
			fmt.Print(request)
			return nil
		},
		"statSync": func(args js.Arguments) interface{} {
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
		},
		"finalizer": func(args js.Arguments) interface{} {
			cb := args.GetValue(0).Dup()
			f := ctx.ClassObject(func() {
				if cb.IsFunction() {
					cb.Call()
					defer cb.Free()
				}
			})

			return f
		},
		"readFileSync": func(args js.Arguments) interface{} {
			path, isString := args.Get(0).(string)
			if !isString {
				return ctx.Throw("TypeError: First argument to readFile must be a string")
			}
			body, err := os.ReadFile(path)
			if err != nil {
				return ctx.Throw(err.Error())
			}

			return string(body)
		},
		"requireResolve": func(args js.Arguments) interface{} {
			request, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("path must be a string")
			}

			fromPath, ok := args.Get(1).(string)
			if !ok {
				cwd, _ := os.Getwd()
				fromPath = cwd
			}

			rr := js.NewResolver(fromPath)
			result, err := rr.Resolve(request, fromPath)

			if err != nil {
				return ctx.Throw(err.Error())
			}

			return result
			// return filepath.Dir(path)
		},
		"GC": func(args js.Arguments) interface{} {
			// runtime.GC()
			ctx.GC()
			return nil
		},
	}

	mod := ctx.NewModule("como")
	mod.Export("default", defaults)
	mod.Exports(defaults)

	registerBuild(ctx)
	registerSQLite(ctx)
}
