package core

import (
	"os"
	"path/filepath"
	s "strings"

	"github.com/comoland/como/js"
)

func join(args js.Arguments) string {
	paths := make([]string, args.Len())
	args.ForEach(func(arg interface{}, i int) {
		path, ok := arg.(string)
		if !ok {
			paths[i] = ""
		} else {
			paths[i] = path
		}
	})

	return filepath.Join(paths...)
}

func path(ctx *js.Context, Como js.Value) {
	path := ctx.Object()
	Como.Set("path", path)

	// path.basename
	path.Set("basename", func(args js.Arguments) interface{} {
		path, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("path must be a string")
		}

		return filepath.Dir(path)
	})

	// path.join
	path.Set("join", func(args js.Arguments) interface{} {
		return join(args)
	})

	// path.resolve
	path.Set("resolve", func(args js.Arguments) interface{} {
		path := join(args)
		cwd, err := os.Getwd()
		if err != nil {
			cwd = ""
		}

		if !s.HasPrefix(path, "/") {
			return filepath.Join(cwd, path)
		}

		return path
	})

	// path.walk
	path.Set("walk", func(args js.Arguments) interface{} {
		dir, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("path must be a string")
		}

		callback := args.GetValue(1)
		if !callback.IsFunction() {
			return ctx.Throw("callback must be a function")
		}

		err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			// fmt.Println("got here", path, info, err.Error())
			args := ctx.NewArguments(path, map[string]interface{}{
				"isDir": info.IsDir(),
				"name":  info.Name(),
			})

			defer args.Free()

			ret := callback.CallArgs(args)
			if ret == false {
				return filepath.SkipDir
			}

			return nil
		})

		if err != nil {
			ctx.Throw2(err.Error())
		}

		return nil
	})
}
