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
		if err != nil {
			panic(err)
		}
		defer cache.Close(wctx)

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

		module := ctx.Object()
		cacheObj := ctx.Object()
		module.Set("__fn", cacheObj)

		var hostFunctions = make(map[string]map[string]M)

		importedFns := compiled.ImportedFunctions()
		for _, fn := range importedFns {
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
				jsCall := func(_ context.Context, mod api.Module, stack []uint64) {
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
								a.Append(api.DecodeF64(v))
							default:
								a.Append(v)
							}
						} else {
							a.Append(v)
							panic("invalid parameter type")
						}
					}

					switch ret := jsFn.CallArgs(a).(type) {
					case uint64:
						stack[0] = ret
					case int64:
						stack[0] = api.EncodeI64(ret)
					case float64:
						stack[0] = api.EncodeF64(ret)
					}
				}

				f.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(jsCall), paramTypes, resultTypes).Export(k2)
			}

			_, err = f.Instantiate(wctx)
			if err != nil {
				module.Free()
				return ctx.Throw(err.Error())
			}
		}

		mod, err := r.InstantiateModule(wctx, compiled, moduleConfig)
		if err != nil {
			module.Free()
			return ctx.Throw(err.Error())
		}

		instance := ctx.ClassObject(func() {
			defer mod.Close(wctx)
		})

		module.Set("instance", instance)

		fn := make(map[string]interface{}, len(mod.ExportedFunctionDefinitions())+len(mod.ExportedMemoryDefinitions()))
		for k := range mod.ExportedFunctionDefinitions() {
			key := k
			fn[k] = func(args js.Arguments) interface{} {
				bindValues := make([]uint64, args.Len())
				for i := 0; i < args.Len(); i++ {
					switch val := ctx.JsToGoValue(args.GetValue(i)).(type) {
					case uint64:
						bindValues[i] = val
					case int64:
						bindValues[i] = api.EncodeI64(val)
					case float64:
						bindValues[i] = api.EncodeF64(val)
					case js.Value:
						if val.IsBigInt() {
							var bignum, _ = new(big.Int).SetString(val.String(), 0)
							bindValues[i] = bignum.Uint64()
						} else {
							return ctx.Throw("not implemented")
						}
					default:
						return ctx.Throw(fmt.Sprintf("invalid arg type %T!\n", val))
					}
				}

				ret, err := mod.ExportedFunction(key).Call(wctx, bindValues...)

				if err != nil {
					return ctx.Throw(err.Error())
				}

				if len(ret) == 1 {
					// fmt.Println("calling ", key, ret[0] > math.MaxUint32, ret[0])
					// val := ret[0]

					// fn := ctx.EvalFunction("ret", `(str) => {

					// 	if (BigInt(str) > BigInt(Number.MAX_SAFE_INTEGER)) {
					// 		return BigInt(str)
					// 	}
					// 	return Number(str)
					// }`)

					// // defer fn.Free()
					// dd := ret[0]

					// return dd

					// if ret[0] < 0 {
					// 	return int64(ret[0])
					// }

					// if ret[0] > math.MaxUint32 {
					// 	return uint64(ret[0])
					// }
					// // if ret[0] > math.MaxInt32 {
					// // 	return int64(ret[0])
					// // }
					return api.DecodeI32(ret[0])
				}

				results := make([]interface{}, len(ret))
				for i, v := range ret {
					results[i] = api.DecodeI32(v)
				}

				return results
			}
		}

		// fmt.Println(buf)

		memory := mod.Memory()
		if !reflect.ValueOf(memory).IsNil() {
			buf, _ := mod.Memory().Read(0, 0)
			fn["memory"] = map[string]interface{}{
				"buffer": buf,
				"read": func(args js.Arguments) interface{} {
					offset, ok := args.GetNumber(0)
					if !ok {
						return ctx.Throw("args must be a number")
					}

					count, ok := args.GetNumber(1)
					if !ok {
						return ctx.Throw("args must be a number")
					}

					buf, ok := memory.Read(uint32(uint64(offset)), uint32(uint64(count)))
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

		instance.Set("exports", fn)
		return module
	})
}
