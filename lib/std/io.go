package std

import (
	"errors"
	"io"
	"os"
	"strings"

	"github.com/comoland/como/js"
	iohandle "github.com/comoland/como/lib/internal"
)

func registerIo(ctx *js.Context) {
	mod := ctx.NewModule("std:io.go")

	exports := map[string]any{}

	exports["op_registerReader"] = func(args js.Arguments) interface{} {
		handleID := args.GetString(0)
		if handleID == "" {
			return ctx.Throw("reader handle id must be a non-empty string")
		}

		_, err := iohandle.GetReader(handleID)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return handleID
	}

	exports["op_registerWriter"] = func(args js.Arguments) interface{} {
		handleID := args.GetString(0)
		if handleID == "" {
			return ctx.Throw("writer handle id must be a non-empty string")
		}

		_, err := iohandle.GetWriter(handleID)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return handleID
	}

	exports["op_readerFromCallback"] = func(args js.Arguments) interface{} {
		cb := ctx.Writer(args.GetValue(0))
		if cb == nil {
			return ctx.Throw("callback must be a function")
		}

		// reader := iohandle.NewCallbackReader(ctx, cb)
		// return iohandle.NewHandle(reader, nil, reader)
		return iohandle.NewHandle(cb, nil, cb)
	}

	exports["op_writerFromCallback"] = func(args js.Arguments) interface{} {
		cb := ctx.Writer(args.GetValue(0))
		if cb == nil {
			return ctx.Throw("callback must be a function")
		}

		// writer := iohandle.NewCallbackWriter(ctx, cb)
		return iohandle.NewHandle(nil, cb, cb)
	}

	exports["op_writerFromFile"] = func(args js.Arguments) interface{} {
		path := args.GetString(0)
		file, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0644)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return iohandle.NewWriterHandle(file)
	}

	exports["op_readerFromStdin"] = func(args js.Arguments) interface{} {
		return iohandle.NewReaderHandle(os.Stdin)
	}

	exports["op_readerFromString"] = func(args js.Arguments) interface{} {
		str := args.GetString(0)
		return iohandle.NewReaderHandle(strings.NewReader(str))
	}

	exports["op_readerFromFile"] = func(args js.Arguments) interface{} {
		path := args.GetString(0)
		file, err := os.Open(path)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return iohandle.NewReaderHandle(file)
	}

	exports["op_readerRead"] = func(args js.Arguments) interface{} {
		handleID := args.GetString(0)
		if handleID == "" {
			return ctx.Throw("reader handle id must be a non-empty string")
		}

		size := iohandle.DefaultChunkSize
		if args.Len() > 1 {
			switch v := args.Get(1).(type) {
			case int64:
				if v > 0 {
					size = int(v)
				}
			case float64:
				if v > 0 {
					size = int(v)
				}
			}
		}

		return ctx.Async(func(async js.Promise) {
			reader, err := iohandle.GetReader(handleID)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			buf := make([]byte, size)
			n, readErr := reader.Read(buf)
			if n > 0 {
				buf = buf[:n]
			} else {
				buf = nil
			}

			if readErr != nil && !errors.Is(readErr, io.EOF) {
				async.Reject(readErr.Error())
				return
			}

			result := map[string]any{
				"chunk":     buf,
				"bytesRead": n,
				"done":      errors.Is(readErr, io.EOF),
			}

			async.Resolve(result)
		})
	}

	exports["op_writerWrite"] = func(args js.Arguments) interface{} {
		handleID := args.GetString(0)
		if handleID == "" {
			return ctx.Throw("writer handle id must be a non-empty string")
		}

		data, err := args.GetTypedArray(1)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		payload := make([]byte, len(data))
		copy(payload, data)

		return ctx.Async(func(async js.Promise) {
			writer, getErr := iohandle.GetWriter(handleID)
			if getErr != nil {
				async.Reject(getErr.Error())
				return
			}

			n, writeErr := writer.Write(payload)
			if writeErr != nil {
				async.Reject(writeErr.Error())
				return
			}

			async.Resolve(n)
		})
	}

	exports["op_readerPipe"] = func(args js.Arguments) interface{} {
		srcID := args.GetString(0)
		dstID := args.GetString(1)

		chunkSize := iohandle.DefaultChunkSize
		if args.Len() > 2 {
			switch v := args.Get(2).(type) {
			case int64:
				if v > 0 {
					chunkSize = int(v)
				}
			case float64:
				if v > 0 {
					chunkSize = int(v)
				}
			}
		}

		return ctx.Async(func(async js.Promise) {
			reader, err := iohandle.GetReader(srcID)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			writer, err := iohandle.GetWriter(dstID)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			var buf []byte
			if chunkSize > 0 {
				buf = make([]byte, chunkSize)
			}

			n, copyErr := io.CopyBuffer(writer, reader, buf)
			if copyErr != nil && !errors.Is(copyErr, io.EOF) {
				async.Reject(copyErr.Error())
				return
			}

			async.Resolve(map[string]any{
				"bytesCopied": n,
				"done":        errors.Is(copyErr, io.EOF),
			})
		})
	}

	exports["op_closeHandle"] = func(args js.Arguments) interface{} {
		handleID := args.GetString(0)
		if handleID == "" {
			return ctx.Throw("handle id must be a non-empty string")
		}

		if err := iohandle.ReleaseIOHandle(handleID); err != nil {
			return ctx.Throw(err.Error())
		}

		return true
	}

	mod.Exports(exports)
	mod.Export("default", exports)
}
