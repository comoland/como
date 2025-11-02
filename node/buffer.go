package node

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/comoland/como/js"
)

func goBuffer(ctx *js.Context, _ js.Value) {
	mod := ctx.NewModule("buffer.go")

	// Constants (conservative defaults)
	mod.Export("kMaxLength", int64(0x7fffffff))
	mod.Export("kStringMaxLength", int64(0x7fffffff))

	// byteLengthUtf8: returns number of bytes for given JS string
	mod.Export("byteLengthUtf8", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return int64(0)
		}
		s, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("byteLengthUtf8: first argument must be a string")
		}
		return int64(len([]byte(s)))
	})

	// atob: base64 decode -> []byte
	mod.Export("atob", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("atob requires 1 argument")
		}
		s, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("atob: argument must be a string")
		}
		data, err := base64.StdEncoding.DecodeString(s)
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return data
	})

	// btoa: accept bytes or string, return base64 string
	mod.Export("btoa", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("btoa requires 1 argument")
		}
		v := args.Get(0)
		switch vv := v.(type) {
		case []byte:
			return base64.StdEncoding.EncodeToString(vv)
		case string:
			return base64.StdEncoding.EncodeToString([]byte(vv))
		default:
			return ctx.Throw("btoa: argument must be a string or buffer")
		}
	})

	// isUtf8
	mod.Export("isUtf8", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return false
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			// if not a buffer, try string
			if s, ok := args.Get(0).(string); ok {
				return utf8.ValidString(s)
			}
			return false
		}
		return utf8.Valid(b)
	})

	// isAscii
	mod.Export("isAscii", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return false
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			if s, ok := args.Get(0).(string); ok {
				for i := 0; i < len(s); i++ {
					if s[i] > 127 {
						return false
					}
				}
				return true
			}
			return false
		}
		for _, c := range b {
			if c > 127 {
				return false
			}
		}
		return true
	})

	// copy: (targetBuffer, sourceBuffer, targetStart?, sourceStart?, length?) -> bytesCopied
	mod.Export("copy", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("copy requires at least 2 arguments (target, source)")
		}
		target, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("copy: first argument must be a buffer")
		}
		source, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("copy: second argument must be a buffer")
		}
		targetStart := 0
		sourceStart := 0
		toCopy := len(source)
		if args.Len() > 2 {
			if v, ok := args.Get(2).(int64); ok {
				targetStart = int(v)
			}
		}
		if args.Len() > 3 {
			if v, ok := args.Get(3).(int64); ok {
				sourceStart = int(v)
			}
		}
		if args.Len() > 4 {
			if v, ok := args.Get(4).(int64); ok {
				toCopy = int(v)
			}
		}
		if targetStart < 0 || sourceStart < 0 || toCopy < 0 {
			return ctx.Throw("copy: negative indices")
		}
		if sourceStart > len(source) {
			return int64(0)
		}
		if sourceStart+toCopy > len(source) {
			toCopy = len(source) - sourceStart
		}
		if targetStart > len(target) {
			return int64(0)
		}
		if targetStart+toCopy > len(target) {
			toCopy = len(target) - targetStart
		}

		if toCopy <= 0 {
			return int64(0)
		}

		n := copy(target[targetStart:targetStart+toCopy], source[sourceStart:sourceStart+toCopy])
		return int64(n)
	})

	// fill: keep as a simple implementation for now
	mod.Export("fill", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("fill requires at least 2 arguments (buffer, value)")
		}
		target, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("fill: first argument must be a buffer")
		}
		// value can be number or buffer or string
		v := args.Get(1)
		switch vv := v.(type) {
		case int64:
			b := byte(vv)
			for i := range target {
				target[i] = b
			}
			return target
		case []byte:
			// repeat pattern
			if len(vv) == 0 {
				return ctx.Throw("fill: buffer value length must be > 0")
			}
			for i := range target {
				target[i] = vv[i%len(vv)]
			}
			return target
		case string:
			bs := []byte(vv)
			if len(bs) == 0 {
				return ctx.Throw("fill: string value length must be > 0")
			}
			for i := range target {
				target[i] = bs[i%len(bs)]
			}
			return target
		default:
			return ctx.Throw("fill: unsupported value type")
		}
	})

	// simple indexOfString implementation
	mod.Export("indexOfString", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("indexOfString requires at least 2 arguments (buffer, string)")
		}
		buf, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("indexOfString: first argument must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("indexOfString: second argument must be a string")
		}
		idx := bytes.Index(buf, []byte(s))
		return int64(idx)
	})

	// compare: lexicographical comparison of two buffers
	mod.Export("compare", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("compare requires two buffers")
		}
		a, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("compare: first argument must be a buffer")
		}
		b, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("compare: second argument must be a buffer")
		}
		minLen := len(a)
		if len(b) < minLen {
			minLen = len(b)
		}
		for i := 0; i < minLen; i++ {
			if a[i] < b[i] {
				return int64(-1)
			}
			if a[i] > b[i] {
				return int64(1)
			}
		}
		if len(a) < len(b) {
			return int64(-1)
		}
		if len(a) > len(b) {
			return int64(1)
		}
		return int64(0)
	})

	// compareOffset: simple wrapper that compares slices with offsets/lengths
	mod.Export("compareOffset", func(args js.Arguments) interface{} {
		if args.Len() < 4 {
			return ctx.Throw("compareOffset requires (a, aStart, b, bStart)")
		}
		a, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("compareOffset: first arg must be a buffer")
		}
		aStart := 0
		if v, ok := args.Get(1).(int64); ok {
			aStart = int(v)
		}
		b, err := args.GetBuffer(2)
		if err != nil {
			return ctx.Throw("compareOffset: third arg must be a buffer")
		}
		bStart := 0
		if v, ok := args.Get(3).(int64); ok {
			bStart = int(v)
		}

		if aStart < 0 || bStart < 0 || aStart > len(a) || bStart > len(b) {
			return ctx.Throw("compareOffset: invalid offsets")
		}

		a2 := a[aStart:]
		b2 := b[bStart:]
		minLen := len(a2)
		if len(b2) < minLen {
			minLen = len(b2)
		}
		for i := 0; i < minLen; i++ {
			if a2[i] < b2[i] {
				return int64(-1)
			}
			if a2[i] > b2[i] {
				return int64(1)
			}
		}
		if len(a2) < len(b2) {
			return int64(-1)
		}
		if len(a2) > len(b2) {
			return int64(1)
		}
		return int64(0)
	})

	// indexOfBuffer: find sub-buffer inside buffer
	mod.Export("indexOfBuffer", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("indexOfBuffer requires (buffer, sub)")
		}
		buf, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("indexOfBuffer: first arg must be a buffer")
		}
		sub, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("indexOfBuffer: second arg must be a buffer")
		}
		if len(sub) == 0 {
			return int64(0)
		}
		idx := bytes.Index(buf, sub)
		return int64(idx)
	})

	// indexOfNumber: find a single byte value in buffer
	mod.Export("indexOfNumber", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("indexOfNumber requires (buffer, number [, from])")
		}
		buf, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("indexOfNumber: first arg must be a buffer")
		}
		num, ok := args.Get(1).(int64)
		if !ok {
			return ctx.Throw("indexOfNumber: second arg must be a number")
		}
		from := 0
		if args.Len() > 2 {
			if v, ok := args.Get(2).(int64); ok {
				from = int(v)
			}
		}
		if from < 0 || from >= len(buf) {
			return int64(-1)
		}
		b := byte(num)
		for i := from; i < len(buf); i++ {
			if buf[i] == b {
				return int64(i)
			}
		}
		return int64(-1)
	})

	// swap helpers: perform in-place byte swaps
	mod.Export("swap16", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("swap16 requires a buffer")
		}
		buf, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("swap16: arg must be a buffer")
		}
		if len(buf)%2 != 0 {
			return ctx.Throw("swap16: Buffer size must be a multiple of 2")
		}
		for i := 0; i < len(buf); i += 2 {
			buf[i], buf[i+1] = buf[i+1], buf[i]
		}
		return buf
	})

	mod.Export("swap32", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("swap32 requires a buffer")
		}
		buf, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("swap32: arg must be a buffer")
		}
		if len(buf)%4 != 0 {
			return ctx.Throw("swap32: Buffer size must be a multiple of 4")
		}
		for i := 0; i < len(buf); i += 4 {
			buf[i], buf[i+3] = buf[i+3], buf[i]
			buf[i+1], buf[i+2] = buf[i+2], buf[i+1]
		}
		return buf
	})

	mod.Export("swap64", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("swap64 requires a buffer")
		}
		buf, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("swap64: arg must be a buffer")
		}
		if len(buf)%8 != 0 {
			return ctx.Throw("swap64: Buffer size must be a multiple of 8")
		}
		for i := 0; i < len(buf); i += 8 {
			buf[i], buf[i+7] = buf[i+7], buf[i]
			buf[i+1], buf[i+6] = buf[i+6], buf[i+1]
			buf[i+2], buf[i+5] = buf[i+5], buf[i+2]
			buf[i+3], buf[i+4] = buf[i+4], buf[i+3]
		}
		return buf
	})

	// asciiSlice: mask high bit (0x7F) per Node.js spec - only 7-bit ASCII
	asciiSlice := func(b []byte, start, end int) string {
		if start < 0 {
			start = 0
		}
		if end > len(b) {
			end = len(b)
		}
		buf := make([]rune, end-start)
		for i := start; i < end; i++ {
			buf[i-start] = rune(b[i] & 0x7F)
		}
		return string(buf)
	}

	mod.Export("asciiSlice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("asciiSlice requires (buffer [, start [, end]])")
		}

		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("asciiSlice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}

		str := asciiSlice(b, start, end)
		return ctx.ByteToString([]byte(string(str)))
	})

	mod.Export("latin1Slice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("latin1Slice requires (buffer [, start [, end]])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("latin1Slice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}
		if start < 0 {
			start = 0
		}
		if end > len(b) {
			end = len(b)
		}
		// Latin1 is direct one-to-one mapping of bytes to codepoints 0-255.
		runes := make([]rune, end-start)
		for i := start; i < end; i++ {
			runes[i-start] = rune(b[i])
		}

		return ctx.ByteToString([]byte(string(runes)))
	})

	// utf8Slice: decode bytes to UTF-8 string
	mod.Export("utf8Slice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("utf8Slice requires (buffer [, start [, end]])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("utf8Slice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}
		if start < 0 {
			start = 0
		}
		if end > len(b) {
			end = len(b)
		}

		return ctx.ByteToString(b[start:end])
	})

	// base64Slice / base64urlSlice / hexSlice
	mod.Export("base64Slice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("base64Slice requires (buffer [, start [, end]])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("base64Slice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}
		return base64.StdEncoding.EncodeToString(b[start:end])
	})

	mod.Export("base64urlSlice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("base64urlSlice requires (buffer [, start [, end]])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("base64urlSlice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}
		return base64.URLEncoding.EncodeToString(b[start:end])
	})

	mod.Export("hexSlice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("hexSlice requires (buffer [, start [, end]])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("hexSlice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}
		return hex.EncodeToString(b[start:end])
	})

	// utf16leSlice: interpret bytes as UTF-16LE and return string
	mod.Export("utf16leSlice", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("utf16leSlice requires (buffer [, start [, end]])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("utf16leSlice: first arg must be a buffer")
		}
		start := 0
		end := len(b)
		if v, ok := args.Get(1).(int64); ok {
			start = int(v)
		}
		if v, ok := args.Get(2).(int64); ok {
			end = int(v)
		}
		if start < 0 {
			start = 0
		}
		if end > len(b) {
			end = len(b)
		}
		if (end-start)%2 != 0 {
			end--
		}
		u16 := make([]uint16, 0, (end-start)/2)
		for i := start; i < end; i += 2 {
			lo := uint16(b[i])
			hi := uint16(b[i+1])
			u16 = append(u16, lo|hi<<8)
		}

		runes := utf16.Decode(u16)
		return ctx.ByteToString([]byte(string(runes)))
	})

	// asciiWriteStatic, latin1WriteStatic, utf8WriteStatic: write string into buffer at offset
	mod.Export("asciiWriteStatic", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("asciiWriteStatic requires (buffer, string [, offset])")
		}

		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("asciiWriteStatic: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("asciiWriteStatic: second arg must be a string")
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("asciiWriteStatic: invalid offset")
		}

		// Node.js ASCII encoding: iterate over runes, take low byte of code point, mask with 0x7F
		written := 0
		for _, r := range s {
			if offset+written >= len(b) {
				break
			}
			// Get Unicode code point's low byte and mask with 0x7F (7-bit ASCII)
			// r & 0x7F gets low 7 bits (since 0x7F < 0xFF, this effectively gets low byte too)
			b[offset+written] = byte(r & 0x7F)
			written++
		}
		return int64(written)
	})

	mod.Export("latin1WriteStatic", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("latin1WriteStatic requires (buffer, string [, offset])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("latin1WriteStatic: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("latin1WriteStatic: second arg must be a string")
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("latin1WriteStatic: invalid offset")
		}
		n := 0
		for i := offset; i < len(b) && n < len(s); i++ {
			b[i] = byte(s[n])
			n++
		}
		return int64(n)
	})

	mod.Export("utf8WriteStatic", func(args js.Arguments) interface{} {
		ctx.Lock()
		defer ctx.Unlock()
		if args.Len() < 2 {
			return ctx.Throw("utf8WriteStatic requires (buffer, string [, offset])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("utf8WriteStatic: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("utf8WriteStatic: second arg must be a string")
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("utf8WriteStatic: invalid offset")
		}

		// fmt.Println("string ", s)
		written := copy(b[offset:], []byte(s))
		// fmt.Println(s, " === ", written)
		return int64(written)
	})

	// hexWrite: decode hex string and copy into buffer at offset
	mod.Export("hexWrite", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("hexWrite requires (buffer, string [, offset])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("hexWrite: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("hexWrite: second arg must be a string")
		}
		data, err := hex.DecodeString(strings.TrimSpace(s))
		if err != nil {
			return ctx.Throw("hexWrite: invalid hex string")
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("hexWrite: invalid offset")
		}
		n := copy(b[offset:], data)
		return int64(n)
	})

	// base64Write / base64urlWrite
	mod.Export("base64Write", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("base64Write requires (buffer, string [, offset])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("base64Write: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("base64Write: second arg must be a string")
		}
		data, err := base64.StdEncoding.DecodeString(s)
		if err != nil {
			return ctx.Throw("base64Write: invalid base64 string")
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("base64Write: invalid offset")
		}
		n := copy(b[offset:], data)
		return int64(n)
	})

	mod.Export("base64urlWrite", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("base64urlWrite requires (buffer, string [, offset])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("base64urlWrite: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("base64urlWrite: second arg must be a string")
		}
		// try URL encoding first, fall back to raw URL without padding
		data, err := base64.URLEncoding.DecodeString(s)
		if err != nil {
			data, err = base64.RawURLEncoding.DecodeString(s)
			if err != nil {
				return ctx.Throw("base64urlWrite: invalid base64url string")
			}
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("base64urlWrite: invalid offset")
		}
		n := copy(b[offset:], data)
		return int64(n)
	})

	// ucs2Write: write UTF-16LE encoded bytes for given string
	mod.Export("ucs2Write", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("ucs2Write requires (buffer, string [, offset])")
		}
		b, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("ucs2Write: first arg must be a buffer")
		}
		s, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("ucs2Write: second arg must be a string")
		}
		offset := 0
		if v, ok := args.Get(2).(int64); ok {
			offset = int(v)
		}
		if offset < 0 || offset > len(b) {
			return ctx.Throw("ucs2Write: invalid offset")
		}
		u16 := utf16.Encode([]rune(s))
		// write little-endian uint16
		written := 0
		for i := 0; i < len(u16); i++ {
			if offset+written+1 >= len(b) {
				break
			}
			val := u16[i]
			b[offset+written] = byte(val & 0xff)
			b[offset+written+1] = byte(val >> 8)
			written += 2
		}
		return int64(written)
	})

	// getZeroFillToggle: return numeric toggle (0/1) for now
	mod.Export("getZeroFillToggle", func(args js.Arguments) interface{} {
		return int64(0)
	})

	// copyArrayBuffer: alias to copy but accepts array buffers as source
	mod.Export("copyArrayBuffer", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("copyArrayBuffer requires (target, source)")
		}
		target, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("copyArrayBuffer: first argument must be a buffer")
		}
		// source might be an ArrayBuffer view, but GetBuffer handles that
		source, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("copyArrayBuffer: second argument must be a buffer or view")
		}
		targetStart := 0
		sourceStart := 0
		toCopy := len(source)
		if args.Len() > 2 {
			if v, ok := args.Get(2).(int64); ok {
				targetStart = int(v)
			}
		}
		if args.Len() > 3 {
			if v, ok := args.Get(3).(int64); ok {
				sourceStart = int(v)
			}
		}
		if args.Len() > 4 {
			if v, ok := args.Get(4).(int64); ok {
				toCopy = int(v)
			}
		}
		if targetStart < 0 || sourceStart < 0 || toCopy < 0 {
			return ctx.Throw("copyArrayBuffer: negative indices")
		}
		if sourceStart > len(source) {
			return int64(0)
		}
		if sourceStart+toCopy > len(source) {
			toCopy = len(source) - sourceStart
		}
		if targetStart > len(target) {
			return int64(0)
		}
		if targetStart+toCopy > len(target) {
			toCopy = len(target) - targetStart
		}
		if toCopy <= 0 {
			return int64(0)
		}
		n := copy(target[targetStart:targetStart+toCopy], source[sourceStart:sourceStart+toCopy])
		return int64(n)
	})
}
