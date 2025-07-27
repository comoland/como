package core

import (
	"io"
	"io/fs"
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

	// path.walkFS same as path.walk except it runs on embedded files/directories
	path.Set("walkFS", func(args js.Arguments) interface{} {
		dir, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("path must be a string")
		}

		callback := args.GetValue(1)
		if !callback.IsFunction() {
			return ctx.Throw("callback must be a function")
		}

		fileSystem := os.DirFS(dir)

		err := fs.WalkDir(fileSystem, ".", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			args := ctx.NewArguments(path, map[string]interface{}{
				"isDir": d.IsDir(),
				"name":  d.Name(),
			})

			defer args.Free()

			ret := callback.Call(args)
			if ret == false {
				return fs.SkipDir
			}

			return nil
		})

		if err != nil {
			return ctx.Throw(err.Error())
		}

		return nil
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

			ret := callback.Call(args)
			if ret == false {
				return filepath.SkipDir
			}

			return nil
		})

		if err != nil {
			return ctx.Throw(err.Error())
		}

		return nil
	})
}

func embedFs(ctx *js.Context, Como js.Value) {
	embedFs := func(args js.Arguments) interface{} {
		dir, ok := args.Get(0).(string)
		if !ok {
			dir = "."
		}

		embedDir, err := fs.Sub(ctx.Embed, dir)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		embedFsProps := ctx.Object()

		embedFsProps.Set("basename", func(args js.Arguments) interface{} {
			path, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("path must be a string")
			}

			return filepath.Dir(path)
		})

		embedFsProps.Set("readFile", func(args js.Arguments) interface{} {
			path, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("path must be a string")
			}

			b, err := fs.ReadFile(embedDir, path)
			if err != nil {
				return ctx.Throw(err.Error())
			}

			return b
		})

		embedFsProps.Set("walkFS", func(args js.Arguments) interface{} {
			callback := args.GetValue(0)
			if !callback.IsFunction() {
				return ctx.Throw("callback must be a function")
			}

			err := fs.WalkDir(embedDir, ".", func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}

				args := ctx.NewArguments(path, map[string]interface{}{
					"isDir": d.IsDir(),
					"name":  d.Name(),
				})

				defer args.Free()

				ret := callback.Call(args)
				if ret == false {
					return fs.SkipDir
				}

				return nil
			})

			if err != nil {
				return ctx.Throw(err.Error())
			}

			return nil
		})

		embedFsProps.Set("extract", func(args js.Arguments) interface{} {
			outputPath := "extracted_data"
			err = os.MkdirAll(outputPath, 0755) // Create output directory if it doesn't exist
			if err != nil {
				return ctx.Throwf("Failed to create output directory: %v", err)
			}

			// Recursively extract files
			err = fs.WalkDir(embedDir, ".", func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}

				targetPath := filepath.Join(outputPath, path)

				if d.IsDir() {
					return os.MkdirAll(targetPath, 0755)
				}

				// Open embedded file
				srcFile, err := embedDir.Open(path)
				if err != nil {
					return err
				}
				defer srcFile.Close()

				// Create destination file
				dstFile, err := os.Create(targetPath)
				if err != nil {
					return err
				}

				defer dstFile.Close()

				// Copy content
				_, err = io.Copy(dstFile, srcFile)
				return err
			})

			if err != nil {
				return ctx.Throwf("Error extracting files: %v", err)
			}

			return nil
		})

		return embedFsProps
	}

	Como.Set("embedFs", embedFs)
}
