package core

import (
	_ "embed"

	"github.com/comoland/como/js"
)

//go:embed js/crypto.js
var cryptoJs string

// cryptoModule initializes the crypto module
func cryptoModule(ctx *js.Context, global js.Value) {
	crypto := ctx.EvalFunction("crypto", cryptoJs)
	defer crypto.Free()
	exp := ctx.Object()
	exp.Dup().AutoFree()

	exp.Set("_exports", ctx.Object())

	// Create crypto backend
	backend := NewCryptoBackend(ctx)

	// Generate key function
	exp.Set("generateKey", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("generateKey requires at least 3 arguments")
		}

		algorithm, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("First argument must be a string")
		}

		extractable, isBool := args.Get(1).(bool)
		if !isBool {
			return ctx.Throw("Second argument must be a boolean")
		}

		keyUsages := make([]string, 0)
		if args.Len() > 2 {
			if usages, ok := args.Get(2).([]interface{}); ok {
				for _, usage := range usages {
					if usageStr, ok := usage.(string); ok {
						keyUsages = append(keyUsages, usageStr)
					}
				}
			}
		}

		return ctx.Async(func(async js.Promise) {
			result, err := backend.GenerateKey(algorithm, extractable, keyUsages, args.GetValue(3))
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(result)
		})
	})

	// Sign function
	exp.Set("sign", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("sign requires at least 3 arguments")
		}

		algorithm, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("First argument must be a string")
		}

		key := args.Get(1)
		data, err := args.GetBuffer(2)
		if err != nil {
			return ctx.Throw("Third argument must be a buffer")
		}

		return ctx.Async(func(async js.Promise) {
			result, err := backend.Sign(algorithm, key, data)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(result)
		})
	})

	// Verify function
	exp.Set("verify", func(args js.Arguments) interface{} {
		if args.Len() < 4 {
			return ctx.Throw("verify requires at least 4 arguments")
		}

		algorithm, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("First argument must be a string")
		}

		key := args.Get(1)
		signature, err := args.GetBuffer(2)
		if err != nil {
			return ctx.Throw("Third argument must be a buffer")
		}

		data, err := args.GetBuffer(3)
		if err != nil {
			return ctx.Throw("Fourth argument must be a buffer")
		}

		return ctx.Async(func(async js.Promise) {
			result, _ := backend.Verify(algorithm, key, signature, data)
			// if err != nil {
			// 	async.Reject(err.Error())
			// 	return
			// }
			async.Resolve(result)
		})
	})

	// Encrypt function
	exp.Set("encrypt", func(args js.Arguments) interface{} {
		if args.Len() < 4 {
			return ctx.Throw("encrypt requires at least 4 arguments")
		}

		algorithm, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("First argument must be a string")
		}

		key := args.Get(1)
		data, err := args.GetBuffer(2)
		if err != nil {
			return ctx.Throw("Third argument must be a buffer")
		}

		iv, err := args.GetBuffer(3)
		if err != nil {
			return ctx.Throw("Fourth argument must be a buffer")
		}

		return ctx.Async(func(async js.Promise) {
			result, err := backend.Encrypt(algorithm, key, data, iv)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(result)
		})
	})

	// Decrypt function
	exp.Set("decrypt", func(args js.Arguments) interface{} {
		if args.Len() < 4 {
			return ctx.Throw("decrypt requires at least 4 arguments")
		}

		algorithm, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("First argument must be a string")
		}

		key := args.Get(1)
		data, err := args.GetBuffer(2)
		if err != nil {
			return ctx.Throw("Third argument must be a buffer")
		}

		iv, err := args.GetBuffer(3)
		if err != nil {
			return ctx.Throw("Fourth argument must be a buffer")
		}

		return ctx.Async(func(async js.Promise) {
			result, err := backend.Decrypt(algorithm, key, data, iv)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(result)
		})
	})

	// Digest function
	exp.Set("digest", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("digest requires at least 2 arguments")
		}

		algorithm, isString := args.Get(0).(string)
		if !isString {
			return ctx.Throw("First argument must be a string")
		}

		data, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("Second argument must be a buffer")
		}

		return ctx.Async(func(async js.Promise) {
			result, err := backend.Digest(algorithm, data)
			if err != nil {
				async.Reject(err.Error())
				return
			}
			async.Resolve(result)
		})
	})

	// GetRandomValues function
	exp.Set("getRandomValues", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("getRandomValues requires at least 1 argument")
		}

		// Get the array argument
		arrayArg := args.Get(0)
		if arrayArg == nil {
			return ctx.Throw("First argument must be a buffer")
		}

		// Try to get as buffer first
		array, err := args.GetBuffer(0)
		if err != nil {
			// If not a buffer, try to get as interface{} and convert
			if arr, ok := arrayArg.([]byte); ok {
				array = arr
			} else {
				// Try to get as a slice of interface{}
				if arr, ok := arrayArg.([]interface{}); ok {
					array = make([]byte, len(arr))
					for i, v := range arr {
						if num, ok := v.(int64); ok {
							array[i] = byte(num)
						} else if num, ok := v.(float64); ok {
							array[i] = byte(num)
						} else {
							return ctx.Throw("Array elements must be numbers")
						}
					}
				} else {
					// Try to get as a Uint8Array-like object
					if obj, ok := arrayArg.(map[string]interface{}); ok {
						if buffer, ok := obj["buffer"].([]byte); ok {
							array = buffer
						} else {
							return ctx.Throw("First argument must be a buffer or array")
						}
					} else {
						return ctx.Throw("First argument must be a buffer or array")
					}
				}
			}
		}

		// If we still don't have a valid array, try to create one
		if array == nil {
			// Try to get the length and create a new array
			if obj, ok := arrayArg.(map[string]interface{}); ok {
				if length, ok := obj["length"].(int64); ok {
					array = make([]byte, length)
				} else {
					return ctx.Throw("Could not determine array length")
				}
			} else {
				return ctx.Throw("First argument must be a buffer or array")
			}
		}

		err = backend.GetRandomValues(array)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return array
	})

	// will set globalThis.crypto from js file
	crypto.Call(exp)
}
