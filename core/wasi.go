package core

import (
	"context"
	"crypto/rand"
	_ "embed"
	"fmt"
	"math/big"
	"os"
	"reflect"

	"github.com/comoland/como/js"
	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

//go:embed js/webassembly.js
var webassemblyJs string

func wasi(ctx *js.Context, global js.Value) {
	webassembly := ctx.Object()
	global.Set("WebAssembly", webassembly)

	webassembly.Set("instantiate", func(args js.Arguments) interface{} {
		b, err := args.GetBuffer(0)

		if err != nil {
			return ctx.Throw(err.Error())
		}

		var exportObject map[string]map[string]*js.Function
		err = args.GetMap(1, &exportObject)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		wctx := context.Background()
		// r := wazero.NewRuntime(wctx)

		fsConfig := wazero.NewFSConfig()
		fsConfig = fsConfig.WithDirMount("./", "./")

		cache, err := wazero.NewCompilationCacheWithDir("./cache")
		defer cache.Close(wctx)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		runtimeConfig := wazero.NewRuntimeConfig().WithCompilationCache(cache)

		r := wazero.NewRuntimeWithConfig(wctx, runtimeConfig)
		wasi_snapshot_preview1.MustInstantiate(wctx, r)

		moduleConfig := wazero.NewModuleConfig().
			WithArgs("cowsay", "wazero is awesome!").
			WithStdout(os.Stdout).
			WithStderr(os.Stderr).
			WithStdin(os.Stdin).WithRandSource(rand.Reader).
			WithFSConfig(fsConfig).
			WithSysNanosleep().
			WithSysNanotime().
			WithSysWalltime()

		compiled, err := r.CompileModule(wctx, b)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		type M struct {
			paramTypes  []byte
			resultTypes []byte
		}

		cacheObj := ctx.Object()

		var hostFunctions = make(map[string]map[string]M)

		for _, fn := range compiled.ImportedFunctions() {
			n, m, _ := fn.Import()
			resultTypes := fn.ResultTypes()
			paramTypes := fn.ParamTypes()

			jsObj := exportObject[n]

			if jsObj != nil {
				jsFn := jsObj[m]
				if jsFn != nil && jsFn.IsFunction() {
					cacheObj.Set(n+m, *jsFn)
					if hostFunctions[n] == nil {
						hostFunctions[n] = make(map[string]M)
					}

					hostFunctions[n][m] = M{
						paramTypes,
						resultTypes,
					}
				}
			}
		}

		// initialization of host functions
		for k, v := range hostFunctions {
			f := r.NewHostModuleBuilder(k)

			for k2, m := range v {
				var resultTypes = make([]api.ValueType, len(m.resultTypes))
				for i, m := range m.resultTypes {
					resultTypes[i] = m
				}

				var paramTypes = make([]api.ValueType, len(m.paramTypes))
				for i, m := range m.paramTypes {
					paramTypes[i] = m
				}

				fnName := k + k2
				hostFn := func(_ context.Context, mod api.Module, stack []uint64) {
					jsFn := cacheObj.GetValue(fnName)
					defer jsFn.Free()

					a := ctx.NewArguments()
					pLength := len(paramTypes)

					for i, v := range stack {
						if pLength > i {
							switch paramTypes[i] {
							case api.ValueTypeF32:
								a.Append(api.DecodeF32(v))
							case api.ValueTypeI32:
								a.Append(api.DecodeI32(v))
							case api.ValueTypeF64:
								a.Append(api.DecodeF64(v))
							case api.ValueTypeI64:
								a.Append(int64(v))
							default:
								a.Append(v)
							}
						} else {
							a.Append(v)
						}
					}

					ret := jsFn.Call(a)
					if len(stack) > 0 {
						switch rr := ret.(type) {
						case uint64:
							stack[0] = rr
						case int64:
							stack[0] = api.EncodeI64(rr)
						case float64:
							stack[0] = api.EncodeF64(rr)
						}
					}
				}

				f.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(hostFn), paramTypes, resultTypes).Export(k2)
			}

			_, err = f.Instantiate(wctx)
			if err != nil {
				cacheObj.Free()
				return ctx.Throw(err.Error())
			}
		}

		mod, err := r.InstantiateModule(wctx, compiled, moduleConfig)
		if err != nil {
			cacheObj.Free()
			return ctx.Throw(err.Error())
		}

		module := ctx.ClassObject(func() {
			mod.Close(wctx)
		})

		module.Set("__fn", cacheObj)

		// exported functions
		fn := make(map[string]interface{}, len(mod.ExportedFunctionDefinitions())+len(mod.ExportedMemoryDefinitions()))
		for k, b := range mod.ExportedFunctionDefinitions() {
			key := k
			def := b
			fn[k] = func(args js.Arguments) interface{} {
				bindValues := make([]uint64, args.Len())
				// paramTypes := def.ParamTypes()
				for i := 0; i < args.Len(); i++ {
					arg := args.GetValue(i)
					// ptype := paramTypes[i]

					if !arg.IsNumber() && !arg.IsBigInt() {
						return ctx.Throw("Expected number")
					}

					var num, _ = new(big.Int).SetString(arg.String(), 10)

					if num.IsInt64() {
						bindValues[i] = api.EncodeI64(num.Int64())
					} else {
						bindValues[i] = num.Uint64()
					}
				}

				ret, err := mod.ExportedFunction(key).Call(wctx, bindValues...)

				if err != nil {
					return ctx.Throw(err.Error())
				}

				retLen := len(ret)
				results := make([]interface{}, retLen)
				rTypes := def.ResultTypes()
				for i, v := range ret {
					rType := rTypes[0]
					if rType == api.ValueTypeI64 {
						results[i] = int64(v)
					} else if rType == api.ValueTypeI32 {
						results[i] = api.DecodeI32(v)
					} else if rType == api.ValueTypeF64 {
						results[i] = api.DecodeF64(v)
					} else {
						results[i] = v
					}
				}

				if retLen == 1 {
					return results[0]
				}

				return results
			}
		}

		// memory function
		memory := mod.Memory()
		if !reflect.ValueOf(memory).IsNil() {
			buf, _ := mod.Memory().Read(0, 1)
			fn["memory"] = map[string]interface{}{
				"buffer": buf,
				"read": func(args js.Arguments) interface{} {
					var offset, ok = new(big.Int).SetString(args.GetValue(0).String(), 10)
					if !ok {
						return ctx.Throw("args must be a number")
					}

					count, ok := new(big.Int).SetString(args.GetValue(1).String(), 10)
					if !ok {
						return ctx.Throw("args must be a number")
					}

					buf, ok := memory.Read(uint32(offset.Uint64()), uint32(count.Uint64()))
					if !ok {
						return ctx.Throw(fmt.Sprintf("Memory.Read(%f, %f) out of range", offset, count))
					}

					return buf
				},
				"write": func(args js.Arguments) interface{} {
					offset := args.Get(0).(int64)

					buf, err := args.GetBuffer(1)
					if err != nil {
						return ctx.Throw(err.Error())
					}

					ok := memory.Write(uint32(offset), buf)
					if !ok {
						return ctx.Throw(fmt.Sprintf("Memory.Write out of range of memory size %d", memory.Size()))
					}

					return buf
				},
			}
		}

		instance := ctx.Object()
		module.Set("instance", instance)
		instance.Set("exports", fn)
		return module
	})
}
