package core

import (
	_ "embed"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/comoland/como/js"
)

//go:embed js/fs.js
var fsJs string

func filesystem(ctx *js.Context, global js.Value) {
	filesystem := ctx.EvalFunction("filesystem", fsJs)
	defer filesystem.Free()
	exp := ctx.Object()
	exp.Dup().AutoFree()

	exp.Set("_exports", ctx.Object())

	// Basic file operations
	exp.Set("read", func(args js.Arguments) interface{} {
		file, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to read must be a string")
		}
		body, err := os.ReadFile(file)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return body
	})

	exp.Set("write", func(args js.Arguments) interface{} {
		file, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to write must be a string")
		}
		data, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		err = os.WriteFile(file, data, 0644)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("append", func(args js.Arguments) interface{} {
		file, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to append must be a string")
		}
		data, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		f, err := os.OpenFile(file, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		defer f.Close()
		_, err = f.Write(data)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// Directory operations
	exp.Set("mkdir", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to mkdir must be a string")
		}
		mode := os.ModePerm
		if args.Len() > 1 {
			if m, ok := args.Get(1).(int64); ok {
				mode = os.FileMode(m)
			}
		}
		err := os.MkdirAll(path, mode)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("readdir", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readdir must be a string")
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		names := make([]string, len(entries))
		for i, entry := range entries {
			names[i] = entry.Name()
		}
		return names
	})

	// File info operations
	exp.Set("stat", func(args js.Arguments) interface{} {
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

	exp.Set("lstat", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to lstat must be a string")
		}
		info, err := os.Lstat(path)
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

	// File manipulation
	exp.Set("unlink", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to unlink must be a string")
		}
		err := os.Remove(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("rmdir", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to rmdir must be a string")
		}
		err := os.RemoveAll(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("rename", func(args js.Arguments) interface{} {
		oldPath, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to rename must be a string")
		}
		newPath, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to rename must be a string")
		}
		err := os.Rename(oldPath, newPath)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("copyFile", func(args js.Arguments) interface{} {
		src, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to copyFile must be a string")
		}
		dst, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to copyFile must be a string")
		}
		data, err := os.ReadFile(src)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		err = os.WriteFile(dst, data, 0644)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// File permissions
	exp.Set("chmod", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to chmod must be a string")
		}
		mode, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to chmod must be a number")
		}
		err := os.Chmod(path, os.FileMode(mode))
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("chown", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to chown must be a string")
		}
		uid, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to chown must be a number")
		}
		gid, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to chown must be a number")
		}
		err := os.Chown(path, int(uid), int(gid))
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// File times
	exp.Set("utimes", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to utimes must be a string")
		}
		atime, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to utimes must be a number")
		}
		mtime, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to utimes must be a number")
		}
		err := os.Chtimes(path, time.Unix(atime, 0), time.Unix(mtime, 0))
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// Path operations
	exp.Set("realpath", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to realpath must be a string")
		}
		realPath, err := filepath.EvalSymlinks(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return realPath
	})

	// File existence
	exp.Set("exists", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to exists must be a string")
		}
		_, err := os.Stat(path)
		return err == nil
	})

	// File access
	exp.Set("access", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to access must be a string")
		}
		mode, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to access must be a number")
		}
		err := syscall.Access(path, uint32(mode))
		return err == nil
	})

	// Symbolic links
	exp.Set("readlink", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readlink must be a string")
		}
		target, err := os.Readlink(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return target
	})

	exp.Set("symlink", func(args js.Arguments) interface{} {
		target, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to symlink must be a string")
		}
		path, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to symlink must be a string")
		}
		err := os.Symlink(target, path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// File truncation
	exp.Set("truncate", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to truncate must be a string")
		}
		size, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to truncate must be a number")
		}
		err := os.Truncate(path, size)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// File descriptor operations
	exp.Set("open", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to open must be a string")
		}
		flags, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to open must be a number")
		}
		mode, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to open must be a number")
		}
		fd, err := syscall.Open(path, int(flags), uint32(mode))
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return fd
	})

	exp.Set("close", func(args js.Arguments) interface{} {
		fd, isInt := args.Get(0).(int64)
		if !isInt {
			return ctx.Throw("TypeError: First argument to close must be a number")
		}
		err := syscall.Close(int(fd))
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// High-level file operations
	exp.Set("readFile", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readFile must be a string")
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return body
	})

	exp.Set("writeFile", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to writeFile must be a string")
		}
		data, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		err = os.WriteFile(path, data, 0644)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	exp.Set("appendFile", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to appendFile must be a string")
		}
		data, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		defer f.Close()
		_, err = f.Write(data)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return nil
	})

	// Temporary directory
	exp.Set("mkdtemp", func(args js.Arguments) interface{} {
		prefix, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to mkdtemp must be a string")
		}
		dir, err := os.MkdirTemp("", prefix)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return dir
	})

	ret := filesystem.Call(exp)

	m := ctx.NewModule("fs")
	m.Export("default", ret)
	m.Exports(ret)
}
