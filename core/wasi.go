package core

import (
	"context"
	"crypto/rand"
	_ "embed"
	"os"

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
		r := wazero.NewRuntime(wctx)

		wasi_snapshot_preview1.MustInstantiate(wctx, r)

		fsConfig := wazero.NewFSConfig()
		fsConfig = fsConfig.WithDirMount("./", "./")

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
		cache := ctx.Object()
		module.Set("__fn", cache)

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
					cache.Set(n+m, *jsFn)
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
					jsFn := cache.GetValue(fnName)

					defer jsFn.Free()

					a := ctx.NewArguments()
					pLength := len(paramTypes)

					// fmt.Println(fnName, paramTypes, resultTypes, pLength)

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

		fn := make(map[string]interface{}, len(mod.ExportedFunctionDefinitions()))
		for k := range mod.ExportedFunctionDefinitions() {
			key := k
			fn[k] = func(args js.Arguments) interface{} {
				bindValues := make([]uint64, args.Len())
				for i := 0; i < args.Len(); i++ {
					switch val := args.Get(i).(type) {
					case uint64:
						bindValues[i] = val
					case int64:
						bindValues[i] = api.EncodeI64(val)
					case float64:
						bindValues[i] = api.EncodeF64(val)
					default:
						return ctx.Throw("unknown argument type")
					}
				}

				ret, err := mod.ExportedFunction(key).Call(wctx, bindValues...)
				if err != nil {
					return ctx.Throw(err.Error())
				}

				if len(ret) == 1 {
					return api.DecodeI32(ret[0])
				}

				results := make([]interface{}, len(ret))
				for i, v := range ret {
					results[i] = api.DecodeI32(v)
				}

				return results
			}
		}

		instance.Set("exports", fn)
		return module
	})
}
