package node

import (
	"embed"
	_ "embed"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/comoland/como/js"
	"github.com/fsnotify/fsnotify"
	"golang.org/x/sys/unix"
)

// FileHandleStore manages file descriptors with unique string IDs
type FileHandleStore struct {
	handles sync.Map // map[string]*os.File
	counter int64
	mutex   sync.Mutex
}

var fileHandleStore = &FileHandleStore{}

func (store *FileHandleStore) createHandle(file *os.File) string {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.counter++
	id := fmt.Sprintf("fh_%d", store.counter)
	store.handles.Store(id, file)
	return id
}

func (store *FileHandleStore) getHandle(id string) (*os.File, error) {
	val, ok := store.handles.Load(id)
	if !ok {
		return nil, os.ErrInvalid
	}
	file, ok := val.(*os.File)
	if !ok {
		return nil, os.ErrInvalid
	}
	return file, nil
}

func (store *FileHandleStore) closeHandle(id string) error {
	val, ok := store.handles.LoadAndDelete(id)
	if !ok {
		return os.ErrInvalid
	}
	file, ok := val.(*os.File)
	if !ok {
		return os.ErrInvalid
	}
	return file.Close()
}

// getFileFromArg gets *os.File from either a string (handle ID) or int64 (raw fd)
func getFileFromArg(ctx *js.Context, arg interface{}) (*os.File, error) {
	// Check if it's a string (handle ID)
	if idStr, ok := arg.(string); ok {
		file, err := fileHandleStore.getHandle(idStr)
		if err != nil {
			return nil, fmt.Errorf("EBADF: Invalid FileHandle")
		}
		return file, nil
	}

	// Check if it's a number (raw file descriptor)
	if fd, ok := arg.(int64); ok {
		file := os.NewFile(uintptr(fd), "")
		if file == nil {
			return nil, fmt.Errorf("EBADF: Bad file descriptor")
		}
		return file, nil
	}

	// Invalid type
	return nil, fmt.Errorf("TypeError: First argument must be file descriptor (number) or FileHandle ID (string)")
}

func goFileSystem(ctx *js.Context, global js.Value, fs embed.FS) {
	m := ctx.NewModule("fs.go")

	m.Export("constants", func(args js.Arguments) interface{} {
		return map[string]interface{}{
			// File access constants (for fs.access) - POSIX standard values
			"F_OK": syscall.F_OK, // Test for existence of file
			"R_OK": unix.R_OK,    // Test for read permission
			"W_OK": unix.W_OK,    // Test for write permission
			"X_OK": unix.X_OK,    // Test for execute permission

			// Open flags (from os package, which wraps syscall)
			"O_RDONLY": int64(os.O_RDONLY), // Open read-only
			"O_WRONLY": int64(os.O_WRONLY), // Open write-only
			"O_RDWR":   int64(os.O_RDWR),   // Open read-write
			"O_APPEND": int64(os.O_APPEND), // Append on each write
			"O_CREAT":  int64(os.O_CREATE), // Create file if it doesn't exist (note: Go uses O_CREATE not O_CREAT)
			"O_EXCL":   int64(os.O_EXCL),   // Used with O_CREATE, file must not exist
			"O_SYNC":   int64(os.O_SYNC),   // Open for synchronous I/O
			"O_TRUNC":  int64(os.O_TRUNC),  // Truncate file when opened

			// File mode bits (from syscall)
			"S_IRUSR": int64(syscall.S_IRUSR), // User read permission
			"S_IWUSR": int64(syscall.S_IWUSR), // User write permission
			"S_IXUSR": int64(syscall.S_IXUSR), // User execute permission
			"S_IRGRP": int64(syscall.S_IRGRP), // Group read permission
			"S_IWGRP": int64(syscall.S_IWGRP), // Group write permission
			"S_IXGRP": int64(syscall.S_IXGRP), // Group execute permission
			"S_IROTH": int64(syscall.S_IROTH), // Others read permission
			"S_IWOTH": int64(syscall.S_IWOTH), // Others write permission
			"S_IXOTH": int64(syscall.S_IXOTH), // Others execute permission

			// Additional mode bits (from syscall)
			"S_ISUID": int64(syscall.S_ISUID), // Set user ID on execution
			"S_ISGID": int64(syscall.S_ISGID), // Set group ID on execution
			"S_ISVTX": int64(syscall.S_ISVTX), // Sticky bit

			// File type bits (for checking file type from mode)
			"S_IFMT":   int64(syscall.S_IFMT),   // File type mask
			"S_IFDIR":  int64(syscall.S_IFDIR),  // Directory
			"S_IFCHR":  int64(syscall.S_IFCHR),  // Character device
			"S_IFBLK":  int64(syscall.S_IFBLK),  // Block device
			"S_IFREG":  int64(syscall.S_IFREG),  // Regular file
			"S_IFIFO":  int64(syscall.S_IFIFO),  // FIFO
			"S_IFLNK":  int64(syscall.S_IFLNK),  // Symbolic link
			"S_IFSOCK": int64(syscall.S_IFSOCK), // Socket
		}
	})

	// Unified read operation (accepts file descriptor or FileHandle ID)
	m.Export("read", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("TypeError: read requires at least 2 arguments")
		}

		// First arg can be int64 (fd) or string (handle ID)
		fdOrId := args.Get(0)

		// Get buffer argument
		bufferValue := args.GetValue(1).Dup()

		// Get buffer data
		bufferData, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("TypeError: Second argument to read must be a Buffer: " + err.Error())
		}

		// Get optional arguments: offset, length, position
		offset := 0
		length := len(bufferData)
		position := int64(-1) // -1 means current position

		if args.Len() > 2 {
			if o, ok := args.Get(2).(int64); ok {
				offset = int(o)
			}
		}
		if args.Len() > 3 {
			if l, ok := args.Get(3).(int64); ok {
				length = int(l)
			}
		}
		if args.Len() > 4 {
			if p, ok := args.Get(4).(int64); ok {
				position = p
			}
		}

		// Validate offset and length
		if offset < 0 || offset >= len(bufferData) {
			return ctx.Throw("RangeError: Offset out of bounds")
		}
		if length < 0 {
			return ctx.Throw("RangeError: Length must be non-negative")
		}
		if offset+length > len(bufferData) {
			length = len(bufferData) - offset
		}

		return ctx.Async(func(async js.Promise) {
			// Get file from either fd or handle ID
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			// Read into buffer slice
			buf := make([]byte, length)
			var n int
			var readErr error

			if position >= 0 {
				// Read at specific position
				n, readErr = file.ReadAt(buf, position)
			} else {
				// Read from current position
				n, readErr = file.Read(buf)
			}

			if readErr != nil && readErr != io.EOF {
				async.Reject(readErr.Error())
				return
			}

			// Copy read data into the provided buffer at offset
			copy(bufferData[offset:offset+n], buf[:n])

			async.Resolve(func() interface{} {
				return map[string]interface{}{
					"buffer":    bufferValue,
					"bytesRead": n,
				}
			})
		})
	})

	// Unified write operation (accepts file descriptor or FileHandle ID)
	m.Export("write", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("TypeError: write requires at least 2 arguments")
		}

		// First arg can be int64 (fd) or string (handle ID)
		fdOrId := args.Get(0)

		// Get buffer argument
		bufferValue := args.GetValue(1).Dup()

		// Get buffer data
		bufferData, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("TypeError: Second argument to write must be a Buffer: " + err.Error())
		}

		// Get optional arguments: offset, length, position
		offset := 0
		length := len(bufferData)
		position := int64(-1) // -1 means current position

		if args.Len() > 2 {
			if o, ok := args.Get(2).(int64); ok {
				offset = int(o)
			}
		}
		if args.Len() > 3 {
			if l, ok := args.Get(3).(int64); ok {
				length = int(l)
			}
		}
		if args.Len() > 4 {
			if p, ok := args.Get(4).(int64); ok {
				position = p
			}
		}

		// Validate offset and length
		if offset < 0 || offset >= len(bufferData) {
			return ctx.Throw("RangeError: Offset out of bounds")
		}

		if length < 0 {
			return ctx.Throw("RangeError: Length must be non-negative")
		}

		if offset+length > len(bufferData) {
			length = len(bufferData) - offset
		}

		return ctx.Async(func(async js.Promise) {
			// Get file from either fd or handle ID
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			// Get the slice to write
			writeData := bufferData[offset : offset+length]
			var n int
			var writeErr error

			if position >= 0 {
				// Write at specific position
				n, writeErr = file.WriteAt(writeData, position)
			} else {
				// Write at current position
				n, writeErr = file.Write(writeData)
			}

			if writeErr != nil {
				async.Reject(writeErr.Error())
				return
			}

			async.Resolve(func() interface{} {
				return map[string]interface{}{
					"buffer":       bufferValue,
					"bytesWritten": n,
				}
			})
		})
	})

	m.Export("append", func(args js.Arguments) interface{} {
		file, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to append must be a string")
		}

		data, err := args.GetSafeBuffer(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return ctx.Async(func(async js.Promise) {
			f, err := os.OpenFile(file, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			defer f.Close()
			_, err = f.Write(data)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// Directory operations
	m.Export("mkdir", func(args js.Arguments) interface{} {
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
		return ctx.Async(func(async js.Promise) {
			err := os.MkdirAll(path, mode)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("readdir", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readdir must be a string")
		}

		// Get options if provided
		var opts map[string]interface{}
		if args.Len() > 1 {
			if o, ok := args.Get(1).(map[string]interface{}); ok {
				opts = o
			}
		}

		return ctx.Async(func(async js.Promise) {
			// Handle recursive mode
			if opts != nil && opts["recursive"] == true {
				var entries []map[string]interface{}
				err := filepath.Walk(path, func(p string, info os.FileInfo, err error) error {
					if err != nil {
						return err
					}

					// Skip the root directory
					if p == path {
						return nil
					}

					entry := map[string]interface{}{
						"name":        info.Name(),
						"path":        p,
						"isDirectory": info.IsDir(),
						"size":        info.Size(),
						"mode":        info.Mode().String(),
						"modTime":     info.ModTime().UnixNano() / int64(time.Millisecond),
					}

					entries = append(entries, entry)
					return nil
				})

				if err != nil {
					async.Reject(err.Error())
					return
				}

				async.Resolve(entries)
				return
			}

			// Non-recursive mode
			entries, err := os.ReadDir(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			// Handle withFileTypes option
			if opts != nil && opts["withFileTypes"] == true {
				fileTypes := make([]map[string]interface{}, len(entries))
				for i, entry := range entries {
					info, err := entry.Info()
					if err != nil {
						async.Reject(err.Error())
						return
					}

					fileTypes[i] = map[string]interface{}{
						"name":        entry.Name(),
						"isDirectory": entry.IsDir(),
						"isFile":      !entry.IsDir(),
						"size":        info.Size(),
						"mode":        info.Mode(),
						"modTime":     info.ModTime().UnixNano() / int64(time.Millisecond),
					}
				}
				async.Resolve(fileTypes)
				return
			}

			// Default behavior - just return names
			names := make([]string, len(entries))
			for i, entry := range entries {
				names[i] = entry.Name()
			}
			async.Resolve(names)
		})
	})

	// File info operations
	m.Export("stat", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to stat must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			info, err := os.Stat(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(map[string]interface{}{
				"size":    info.Size(),
				"mode":    info.Mode(),
				"modTime": info.ModTime().UnixNano() / int64(time.Millisecond),
				"isDir":   info.IsDir(),
			})
		})
	})

	m.Export("lstat", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to lstat must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			info, err := os.Lstat(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(map[string]interface{}{
				"size":    info.Size(),
				"mode":    info.Mode(),
				"modTime": info.ModTime().UnixNano() / int64(time.Millisecond),
				"isDir":   info.IsDir(),
			})
		})
	})

	// File manipulation
	m.Export("unlink", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to unlink must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Remove(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("rmdir", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to rmdir must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.RemoveAll(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("rename", func(args js.Arguments) interface{} {
		oldPath, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to rename must be a string")
		}
		newPath, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to rename must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Rename(oldPath, newPath)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("copyFile", func(args js.Arguments) interface{} {
		src, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to copyFile must be a string")
		}
		dst, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to copyFile must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			data, err := os.ReadFile(src)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			err = os.WriteFile(dst, data, 0644)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// File permissions
	m.Export("chmod", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to chmod must be a string")
		}
		mode, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to chmod must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Chmod(path, os.FileMode(mode))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("chown", func(args js.Arguments) interface{} {
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
		return ctx.Async(func(async js.Promise) {
			err := os.Chown(path, int(uid), int(gid))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// File times
	m.Export("utimes", func(args js.Arguments) interface{} {
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
		return ctx.Async(func(async js.Promise) {
			err := os.Chtimes(path, time.Unix(atime, 0), time.Unix(mtime, 0))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// Path operations
	m.Export("realpath", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to realpath must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			realPath, err := filepath.EvalSymlinks(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(realPath)
		})
	})

	// File existence
	m.Export("exists", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to exists must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			_, err := os.Stat(path)
			async.Resolve(err == nil)
		})
	})

	// File access
	m.Export("access", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to access must be a string")
		}
		mode, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to access must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			err := syscall.Access(path, uint32(mode))
			async.Resolve(err == nil)
		})
	})

	// Symbolic links
	m.Export("readlink", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readlink must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			target, err := os.Readlink(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(target)
		})
	})

	m.Export("symlink", func(args js.Arguments) interface{} {
		target, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to symlink must be a string")
		}
		path, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to symlink must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Symlink(target, path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// File truncation
	m.Export("truncate", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to truncate must be a string")
		}
		size, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to truncate must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Truncate(path, size)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// File descriptor operations
	m.Export("open", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to open must be a string")
		}

		// Flags default to O_RDONLY (read-only)
		var flags int = os.O_RDONLY
		if args.Len() > 1 {
			if f, ok := args.Get(1).(int64); ok {
				flags = int(f)
			}
		}

		// Mode defaults to 0o666
		var mode os.FileMode = 0o666
		if args.Len() > 2 {
			if m, ok := args.Get(2).(int64); ok {
				mode = os.FileMode(m)
			}
		}

		return ctx.Async(func(async js.Promise) {
			// Convert os.FileMode to uint32 for syscall
			var modeUint uint32 = uint32(mode)
			fd, err := syscall.Open(path, flags, modeUint)
			if err != nil {
				async.Reject(err.Error() + ", open " + path)
				return
			}
			async.Resolve(fd)
		})
	})

	m.Export("close", func(args js.Arguments) interface{} {
		fd, isInt := args.Get(0).(int64)
		if !isInt {
			return ctx.Throw("TypeError: First argument to close must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			err := syscall.Close(int(fd))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// High-level file operations
	m.Export("readFile", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to readFile must be a string")
		}

		return ctx.Async(func(async js.Promise) {
			body, err := os.ReadFile(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(body)
		})
	})

	m.Export("writeFile", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to writeFile must be a string")
		}

		a := args.GetValue(1).Dup()
		data, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		// Get options if provided
		var opts map[string]interface{}
		if args.Len() > 2 {
			if o, ok := args.Get(2).(map[string]interface{}); ok {
				opts = o
			}
		}

		prom := ctx.Async(func(async js.Promise) {
			// Open file with appropriate flags
			var flags int = os.O_WRONLY | os.O_CREATE | os.O_TRUNC
			if opts != nil {
				if flag, ok := opts["flag"].(string); ok {
					switch flag {
					case "a":
						flags = os.O_WRONLY | os.O_CREATE | os.O_APPEND
					case "ax":
						flags = os.O_WRONLY | os.O_CREATE | os.O_EXCL | os.O_APPEND
					case "a+":
						flags = os.O_RDWR | os.O_CREATE | os.O_APPEND
					case "ax+":
						flags = os.O_RDWR | os.O_CREATE | os.O_EXCL | os.O_APPEND
					case "as":
						flags = os.O_WRONLY | os.O_CREATE | os.O_APPEND | os.O_SYNC
					case "as+":
						flags = os.O_RDWR | os.O_CREATE | os.O_APPEND | os.O_SYNC
					case "r":
						flags = os.O_RDONLY
					case "r+":
						flags = os.O_RDWR
					case "w":
						flags = os.O_WRONLY | os.O_CREATE | os.O_TRUNC
					case "wx":
						flags = os.O_WRONLY | os.O_CREATE | os.O_EXCL | os.O_TRUNC
					case "w+":
						flags = os.O_RDWR | os.O_CREATE | os.O_TRUNC
					case "wx+":
						flags = os.O_RDWR | os.O_CREATE | os.O_EXCL | os.O_TRUNC
					}
				}
			}

			// Get mode from options or use default
			mode := os.FileMode(0644)
			if opts != nil {
				if m, ok := opts["mode"].(int64); ok {
					mode = os.FileMode(m)
				}
			}

			// Open file
			f, err := os.OpenFile(path, flags, mode)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			defer f.Close()

			// Write data
			_, err = f.Write(data)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			// Handle flush if specified
			if opts != nil {
				if flush, ok := opts["flush"].(bool); ok && flush {
					err = f.Sync()
					if err != nil {
						async.Reject(err.Error())
						return
					}
				}
			}

			async.Resolve(data)
		})

		prom.Finally(func(args js.Arguments) interface{} {
			a.Free()
			return nil
		})

		return prom
	})

	m.Export("appendFile", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to appendFile must be a string")
		}

		data, err := args.GetSafeBuffer(1)

		if err != nil {
			return ctx.Throw(err.Error())
		}

		return ctx.Async(func(async js.Promise) {
			f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			defer f.Close()
			_, err = f.Write(data)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// Temporary directory
	m.Export("mkdtemp", func(args js.Arguments) interface{} {
		prefix, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to mkdtemp must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			dir, err := os.MkdirTemp("", prefix)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(dir)
		})
	})

	m.Export("watch", func(args js.Arguments) interface{} {
		// arg0: path string
		// arg1: callback function (event, filename)
		pathArg, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("fs.watch: first arg must be path string")
		}

		cb := ctx.Writer(args.GetValue(1)) // adapt to your js.Value extraction helper if different
		if cb == nil {
			return ctx.Throw("fs.watch: second arg must be a function")
		}

		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			cb.Close()
			return ctx.Throw(err.Error())
		}

		if err := watcher.Add(pathArg); err != nil {
			watcher.Close()
			cb.Close()
			return ctx.Throw(err.Error())
		}

		// returned watcher object with close method
		wobj := ctx.Object()
		wobj.Set("close", func(_ js.Arguments) interface{} {
			cb.Close()
			_ = watcher.Close()
			ctx.UnRef()
			return nil
		})

		ctx.Ref()
		// forward events to JS callback
		go func() {
			debounceTimer := time.NewTimer(time.Millisecond * 100) // Adjust debounce duration
			debounceTimer.Stop()
			lastEventTime := make(map[string]time.Time)
			defer watcher.Close()
			for {
				select {
				case ev, ok := <-watcher.Events:
					if !ok {
						return
					}

					if ev.Op&fsnotify.Chmod != 0 {
						continue
					}

					if lastTime, exists := lastEventTime[ev.Name]; exists && time.Since(lastTime) < (time.Millisecond*50) {
						continue // Skip if within debounce window
					}

					lastEventTime[ev.Name] = time.Now()
					cbArgs := ctx.NewArguments(ev.Op.String(), ev.Name)
					_ = cb.Call(cbArgs)
				case err, ok := <-watcher.Errors:
					if !ok {
						return
					}

					_ = cb.Call(err.Error())
				}
			}
		}()

		return wobj
	})

	// Unified file descriptor operations (accept file descriptor or FileHandle ID)
	m.Export("fstat", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("TypeError: fstat requires at least 1 argument")
		}
		fdOrId := args.Get(0)
		return ctx.Async(func(async js.Promise) {
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			info, err := file.Stat()
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(map[string]interface{}{
				"size":    info.Size(),
				"mode":    info.Mode(),
				"modTime": info.ModTime().UnixNano() / int64(time.Millisecond),
				"isDir":   info.IsDir(),
			})
		})
	})

	m.Export("fchmod", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("TypeError: fchmod requires at least 2 arguments")
		}
		fdOrId := args.Get(0)
		mode, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to fchmod must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			err = file.Chmod(os.FileMode(mode))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("fchown", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("TypeError: fchown requires at least 3 arguments")
		}
		fdOrId := args.Get(0)
		uid, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to fchown must be a number")
		}
		gid, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to fchown must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			err = file.Chown(int(uid), int(gid))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("futimes", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("TypeError: futimes requires at least 3 arguments")
		}
		fdOrId := args.Get(0)
		atime, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to futimes must be a number")
		}
		mtime, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to futimes must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			// Get file from either fd or handle ID
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			// futimes needs actual fd for syscall
			fd := int(file.Fd())
			atimeVal := syscall.Timeval{
				Sec:  atime,
				Usec: 0,
			}
			mtimeVal := syscall.Timeval{
				Sec:  mtime,
				Usec: 0,
			}
			err = syscall.Futimes(fd, []syscall.Timeval{atimeVal, mtimeVal})
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("ftruncate", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("TypeError: ftruncate requires at least 2 arguments")
		}
		fdOrId := args.Get(0)
		size, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to ftruncate must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			err = file.Truncate(size)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("fsync", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("TypeError: fsync requires at least 1 argument")
		}
		fdOrId := args.Get(0)
		return ctx.Async(func(async js.Promise) {
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			err = file.Sync()
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("fdatasync", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("TypeError: fdatasync requires at least 1 argument")
		}
		fdOrId := args.Get(0)
		return ctx.Async(func(async js.Promise) {
			file, err := getFileFromArg(ctx, fdOrId)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			// On Linux, fdatasync is available via syscall
			// On other platforms, fall back to fsync
			fd := int(file.Fd())
			err = syscall.Fdatasync(fd)
			if err != nil {
				// Fallback to fsync if fdatasync not available
				err = file.Sync()
				if err != nil {
					async.Reject(err.Error())
					return
				}
			}
			async.Resolve(nil)
		})
	})

	// Scatter/Gather operations
	m.Export("readv", func(args js.Arguments) interface{} {
		fd, isInt := args.Get(0).(int64)
		if !isInt {
			return ctx.Throw("TypeError: First argument to readv must be a file descriptor (number)")
		}
		// Get array of buffers
		if args.Len() < 2 {
			return ctx.Throw("TypeError: Second argument to readv must be an array of Buffers")
		}
		buffersValue := args.GetValue(1)
		if !buffersValue.IsArray() {
			return ctx.Throw("TypeError: Second argument to readv must be an array of Buffers")
		}

		return ctx.Async(func(async js.Promise) {
			file := os.NewFile(uintptr(fd), "")
			if file == nil {
				async.Reject("EBADF: Bad file descriptor")
				return
			}

			// Read each buffer sequentially
			length := buffersValue.Length()
			results := make([]map[string]interface{}, length)
			totalBytes := 0

			for i := 0; i < int(length); i++ {
				bufValue := buffersValue.GetInt(uint(i))
				// Create temporary arguments to get typed array
				tempArgs := ctx.NewArguments(bufValue)
				bufData, err := tempArgs.GetTypedArray(0)
				if err != nil {
					async.Reject(err.Error())
					return
				}

				n, err := file.Read(bufData)
				if err != nil && err != io.EOF {
					async.Reject(err.Error())
					return
				}

				totalBytes += n
				results[i] = map[string]interface{}{
					"bytesRead": n,
					"buffer":    bufValue,
				}
			}

			result := ctx.Object()
			result.Set("bytesRead", totalBytes)
			result.Set("buffers", results)

			async.Resolve(func() interface{} {
				return result
			})
		})
	})

	m.Export("writev", func(args js.Arguments) interface{} {
		fd, isInt := args.Get(0).(int64)
		if !isInt {
			return ctx.Throw("TypeError: First argument to writev must be a file descriptor (number)")
		}
		// Get array of buffers
		if args.Len() < 2 {
			return ctx.Throw("TypeError: Second argument to writev must be an array of Buffers")
		}
		buffersValue := args.GetValue(1)
		if !buffersValue.IsArray() {
			return ctx.Throw("TypeError: Second argument to writev must be an array of Buffers")
		}

		return ctx.Async(func(async js.Promise) {
			file := os.NewFile(uintptr(fd), "")
			if file == nil {
				async.Reject("EBADF: Bad file descriptor")
				return
			}

			// Write each buffer sequentially
			length := buffersValue.Length()
			totalBytes := 0

			for i := 0; i < int(length); i++ {
				bufValue := buffersValue.GetInt(uint(i))
				// Create temporary arguments to get typed array
				tempArgs := ctx.NewArguments(bufValue)
				bufData, err := tempArgs.GetTypedArray(0)
				if err != nil {
					async.Reject(err.Error())
					return
				}

				n, err := file.Write(bufData)
				if err != nil {
					async.Reject(err.Error())
					return
				}

				totalBytes += n
			}

			result := ctx.Object()
			result.Set("bytesWritten", totalBytes)

			async.Resolve(func() interface{} {
				return result
			})
		})
	})

	// Path operations
	m.Export("link", func(args js.Arguments) interface{} {
		existingPath, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to link must be a string")
		}
		newPath, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to link must be a string")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Link(existingPath, newPath)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("lchown", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to lchown must be a string")
		}
		uid, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to lchown must be a number")
		}
		gid, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to lchown must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			err := os.Lchown(path, int(uid), int(gid))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	m.Export("lutimes", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to lutimes must be a string")
		}
		atime, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to lutimes must be a number")
		}
		mtime, isInt := args.Get(2).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Third argument to lutimes must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			// lutimes requires syscall on most systems
			err := os.Chtimes(path, time.Unix(atime, 0), time.Unix(mtime, 0))
			// Note: os.Chtimes follows symlinks, but lutimes shouldn't
			// For proper lutimes, would need platform-specific syscall
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// Note: lchmod is platform-specific (mainly macOS/BSD)
	// We'll implement it but it may not work on all platforms
	m.Export("lchmod", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to lchmod must be a string")
		}
		mode, isInt := args.Get(1).(int64)
		if !isInt {
			return ctx.Throw("TypeError: Second argument to lchmod must be a number")
		}
		return ctx.Async(func(async js.Promise) {
			// lchmod requires syscall - may not be available on all platforms
			err := os.Chmod(path, os.FileMode(mode))
			// Note: os.Chmod follows symlinks, but lchmod shouldn't
			// For proper lchmod, would need platform-specific syscall
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// Recursive copy operation
	m.Export("cp", func(args js.Arguments) interface{} {
		src, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to cp must be a string")
		}
		dest, isString := args.Get(1).(string)
		if !isString {
			return ctx.Throw("TypeError: Second argument to cp must be a string")
		}

		var opts map[string]interface{}
		if args.Len() > 2 {
			if o, ok := args.Get(2).(map[string]interface{}); ok {
				opts = o
			}
		}

		recursive := false
		if opts != nil {
			if r, ok := opts["recursive"].(bool); ok {
				recursive = r
			}
		}

		return ctx.Async(func(async js.Promise) {
			if recursive {
				err := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
					if err != nil {
						return err
					}

					relPath, err := filepath.Rel(src, path)
					if err != nil {
						return err
					}

					destPath := filepath.Join(dest, relPath)

					if info.IsDir() {
						return os.MkdirAll(destPath, info.Mode())
					}

					srcData, err := os.ReadFile(path)
					if err != nil {
						return err
					}

					return os.WriteFile(destPath, srcData, info.Mode())
				})
				if err != nil {
					async.Reject(err.Error())
					return
				}
			} else {
				// Non-recursive: just copy the file/dir
				srcInfo, err := os.Stat(src)
				if err != nil {
					async.Reject(err.Error())
					return
				}

				if srcInfo.IsDir() {
					async.Reject("EISDIR: Source is a directory (use recursive: true)")
					return
				}

				data, err := os.ReadFile(src)
				if err != nil {
					async.Reject(err.Error())
					return
				}
				err = os.WriteFile(dest, data, srcInfo.Mode())
				if err != nil {
					async.Reject(err.Error())
					return
				}
			}
			async.Resolve(nil)
		})
	})

	// Recursive remove operation
	m.Export("rm", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to rm must be a string")
		}

		var opts map[string]interface{}
		if args.Len() > 1 {
			if o, ok := args.Get(1).(map[string]interface{}); ok {
				opts = o
			}
		}

		recursive := false
		force := false
		if opts != nil {
			if r, ok := opts["recursive"].(bool); ok {
				recursive = r
			}
			if f, ok := opts["force"].(bool); ok {
				force = f
			}
		}

		return ctx.Async(func(async js.Promise) {
			info, err := os.Stat(path)
			if err != nil {
				if os.IsNotExist(err) && force {
					async.Resolve(nil)
					return
				}
				async.Reject(err.Error())
				return
			}

			if info.IsDir() {
				if !recursive {
					async.Reject("EISDIR: Path is a directory (use recursive: true)")
					return
				}
				err = os.RemoveAll(path)
			} else {
				err = os.Remove(path)
			}

			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

	// Open directory stream
	m.Export("opendir", func(args js.Arguments) interface{} {
		path, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to opendir must be a string")
		}

		var opts map[string]interface{}
		if args.Len() > 1 {
			if o, ok := args.Get(1).(map[string]interface{}); ok {
				opts = o
			}
		}

		return ctx.Async(func(async js.Promise) {
			entries, err := os.ReadDir(path)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			withFileTypes := false
			if opts != nil {
				if wft, ok := opts["withFileTypes"].(bool); ok {
					withFileTypes = wft
				}
			}

			if withFileTypes {
				fileTypes := make([]map[string]interface{}, len(entries))
				for i, entry := range entries {
					info, err := entry.Info()
					if err != nil {
						async.Reject(err.Error())
						return
					}

					fileTypes[i] = map[string]interface{}{
						"name":        entry.Name(),
						"isDirectory": entry.IsDir(),
						"isFile":      !entry.IsDir(),
						"size":        info.Size(),
						"mode":        info.Mode(),
						"modTime":     info.ModTime().UnixNano() / int64(time.Millisecond),
					}
				}
				async.Resolve(fileTypes)
				return
			}

			names := make([]string, len(entries))
			for i, entry := range entries {
				names[i] = entry.Name()
			}
			async.Resolve(names)
		})
	})

	// FileHandle operations
	m.Export("createFileHandle", func(args js.Arguments) interface{} {
		fd, isInt := args.Get(0).(int64)
		if !isInt {
			return ctx.Throw("TypeError: First argument to createFileHandle must be a file descriptor (number)")
		}
		file := os.NewFile(uintptr(fd), "")
		if file == nil {
			return ctx.Throw("EBADF: Bad file descriptor")
		}
		id := fileHandleStore.createHandle(file)
		return id // Returns string ID
	})

	m.Export("fileHandleClose", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("TypeError: fileHandleClose requires at least 1 argument")
		}
		id, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("TypeError: First argument to fileHandleClose must be a string (FileHandle ID)")
		}
		return ctx.Async(func(async js.Promise) {
			err := fileHandleStore.closeHandle(id)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(nil)
		})
	})

}
