package node

import (
	"fmt"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/comoland/como/js"
)

// Encoding constants
const (
	EncodingUTF8    = "utf-8"
	EncodingUTF16LE = "utf-16le"
	EncodingUTF16BE = "utf-16be"
)

// BOM constants
const (
	UTF8BOM    = "\uFEFF"
	UTF16LEBOM = "\xFF\xFE"
	UTF16BEBOM = "\xFE\xFF"
)

// normalizeEncodingLabel normalizes encoding labels to standard names
func normalizeEncodingLabel(label string) string {
	label = strings.ToLower(strings.TrimSpace(label))

	switch label {
	case "utf8", "utf-8", "unicode-1-1-utf-8":
		return EncodingUTF8
	case "utf-16le", "utf16le", "utf-16":
		return EncodingUTF16LE
	case "utf-16be", "utf16be":
		return EncodingUTF16BE
	default:
		return EncodingUTF8 // Default to UTF-8
	}
}

// encodeUTF8 encodes a string to UTF-8 bytes
func encodeUTF8(input string) []byte {
	return []byte(input)
}

// encodeUTF8Into encodes a string to UTF-8 bytes into an existing buffer
func encodeUTF8Into(input string, buffer []byte) (read, written int) {
	inputBytes := []byte(input)

	// Calculate how much we can write
	maxWrite := len(buffer)
	actualWrite := len(inputBytes)
	if actualWrite > maxWrite {
		actualWrite = maxWrite
	}

	// Copy bytes
	copy(buffer[:actualWrite], inputBytes[:actualWrite])

	// Calculate characters read (approximate)
	read = len(input)
	written = actualWrite

	return read, written
}

// encodeUTF16LE encodes a string to UTF-16LE bytes
func encodeUTF16LE(input string) []byte {
	runes := []rune(input)
	utf16Bytes := utf16.Encode(runes)

	result := make([]byte, len(utf16Bytes)*2)
	for i, codeUnit := range utf16Bytes {
		// Little-endian: low byte first
		result[i*2] = byte(codeUnit & 0xFF)
		result[i*2+1] = byte(codeUnit >> 8)
	}

	return result
}

// encodeUTF16BE encodes a string to UTF-16BE bytes
func encodeUTF16BE(input string) []byte {
	runes := []rune(input)
	utf16Bytes := utf16.Encode(runes)

	result := make([]byte, len(utf16Bytes)*2)
	for i, codeUnit := range utf16Bytes {
		// Big-endian: high byte first
		result[i*2] = byte(codeUnit >> 8)
		result[i*2+1] = byte(codeUnit & 0xFF)
	}

	return result
}

// decodeUTF8 decodes UTF-8 bytes to a string with error handling
func decodeUTF8(input []byte, fatal bool) (string, error) {
	if fatal && !utf8.Valid(input) {
		return "", fmt.Errorf("invalid UTF-8 sequence")
	}

	// Replace invalid sequences with replacement character
	return string(input), nil
}

// decodeUTF16LE decodes UTF-16LE bytes to a string
func decodeUTF16LE(input []byte) string {
	if len(input)%2 != 0 {
		// Odd length, truncate last byte
		input = input[:len(input)-1]
	}

	utf16Bytes := make([]uint16, len(input)/2)
	for i := 0; i < len(input); i += 2 {
		// Little-endian: low byte first
		utf16Bytes[i/2] = uint16(input[i]) | uint16(input[i+1])<<8
	}

	runes := utf16.Decode(utf16Bytes)
	return string(runes)
}

// decodeUTF16BE decodes UTF-16BE bytes to a string
func decodeUTF16BE(input []byte) string {
	if len(input)%2 != 0 {
		// Odd length, truncate last byte
		input = input[:len(input)-1]
	}

	utf16Bytes := make([]uint16, len(input)/2)
	for i := 0; i < len(input); i += 2 {
		// Big-endian: high byte first
		utf16Bytes[i/2] = uint16(input[i])<<8 | uint16(input[i+1])
	}

	runes := utf16.Decode(utf16Bytes)
	return string(runes)
}

// detectBOM detects and removes BOM from input
func detectBOM(input []byte) ([]byte, string, bool) {
	if len(input) >= 3 && string(input[:3]) == UTF8BOM {
		return input[3:], EncodingUTF8, true
	}
	if len(input) >= 2 && string(input[:2]) == UTF16LEBOM {
		return input[2:], EncodingUTF16LE, true
	}
	if len(input) >= 2 && string(input[:2]) == UTF16BEBOM {
		return input[2:], EncodingUTF16BE, true
	}
	return input, "", false
}

func goTextEncoder(ctx *js.Context, _ js.Value) {
	mod := ctx.NewModule("textencoder.go")

	// op_encode: Encode string to bytes based on encoding
	mod.Export("op_encode", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("op_encode requires 2 arguments (string, encoding)")
		}

		input, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string")
		}

		encoding, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("Second argument must be string (encoding)")
		}

		encoding = normalizeEncodingLabel(encoding)

		switch encoding {
		case EncodingUTF8:
			return encodeUTF8(input)
		case EncodingUTF16LE:
			return encodeUTF16LE(input)
		case EncodingUTF16BE:
			return encodeUTF16BE(input)
		default:
			return ctx.Throw("Unsupported encoding: " + encoding)
		}
	})

	// op_encode_into: Encode string into existing buffer
	mod.Export("op_encode_into", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("op_encode_into requires 3 arguments (string, buffer, encoding)")
		}

		input, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string")
		}

		buffer, bufferErr := args.GetBuffer(1)
		if bufferErr != nil {
			return ctx.Throw("Second argument must be buffer")
		}

		encoding, ok := args.Get(2).(string)
		if !ok {
			return ctx.Throw("Third argument must be string (encoding)")
		}

		encoding = normalizeEncodingLabel(encoding)

		var read, written int
		switch encoding {
		case EncodingUTF8:
			read, written = encodeUTF8Into(input, buffer)
		case EncodingUTF16LE:
			encoded := encodeUTF16LE(input)
			read = len(input)
			written = copy(buffer, encoded)
		case EncodingUTF16BE:
			encoded := encodeUTF16BE(input)
			read = len(input)
			written = copy(buffer, encoded)
		default:
			return ctx.Throw("Unsupported encoding: " + encoding)
		}

		return map[string]interface{}{
			"read":    read,
			"written": written,
		}
	})

	// op_decode: Decode bytes to string with encoding and options
	mod.Export("op_decode", func(args js.Arguments) interface{} {
		if args.Len() < 4 {
			return ctx.Throw("op_decode requires 4 arguments (buffer, encoding, fatal, ignoreBOM)")
		}

		input, err := args.GetBuffer(0)
		if err != nil {
			return ctx.Throw("First argument must be buffer")
		}

		encoding, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("Second argument must be string (encoding)")
		}

		fatal, ok := args.Get(2).(bool)
		if !ok {
			return ctx.Throw("Third argument must be boolean (fatal)")
		}

		ignoreBOM, ok := args.Get(3).(bool)
		if !ok {
			return ctx.Throw("Fourth argument must be boolean (ignoreBOM)")
		}

		// Detect BOM if not ignoring it
		var actualEncoding string
		var data []byte
		if !ignoreBOM {
			var hasBOM bool
			data, actualEncoding, hasBOM = detectBOM(input)
			if hasBOM {
				encoding = actualEncoding
			}
		} else {
			data = input
		}

		encoding = normalizeEncodingLabel(encoding)

		var result string
		var decodeErr error

		switch encoding {
		case EncodingUTF8:
			result, decodeErr = decodeUTF8(data, fatal)
		case EncodingUTF16LE:
			result = decodeUTF16LE(data)
		case EncodingUTF16BE:
			result = decodeUTF16BE(data)
		default:
			return ctx.Throw("Unsupported encoding: " + encoding)
		}

		if decodeErr != nil {
			return ctx.Throw(decodeErr.Error())
		}

		return result
	})

	// op_get_encoding_length: Get byte length for encoding a string
	mod.Export("op_get_encoding_length", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("op_get_encoding_length requires 2 arguments (string, encoding)")
		}

		input, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string")
		}

		encoding, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("Second argument must be string (encoding)")
		}

		encoding = normalizeEncodingLabel(encoding)

		switch encoding {
		case EncodingUTF8:
			return len([]byte(input))
		case EncodingUTF16LE, EncodingUTF16BE:
			runes := []rune(input)
			utf16Bytes := utf16.Encode(runes)
			return len(utf16Bytes) * 2
		default:
			return ctx.Throw("Unsupported encoding: " + encoding)
		}
	})
}
