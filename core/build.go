package core

import (
	"github.com/comoland/como/js"
	"github.com/evanw/esbuild/pkg/api"
)

type plugin struct {
	Name  string
	Setup js.Function
}

type StdinOptions struct {
	api.StdinOptions `mapstructure:",squash"`
}

type buildOptions struct {
	Plugins     []plugin
	Define      map[string]string
	EntryPoints []string
	External    []string
	Stdin       StdinOptions
	Splitting   bool
	Minify      bool
	Bundle      bool
	Target      api.Target
	Loader      map[string]api.Loader
	SourceMap   api.SourceMap
}

func build(ctx *js.Context, Como js.Value) {
	build := ctx.Object()
	Como.Set("build", build)

	build.Set("platform", map[string]interface{}{
		"browser": int(api.PlatformBrowser),
		"node":    int(api.PlatformNode),
	})

	build.Set("loader", map[string]interface{}{
		"ts":     int(api.LoaderTS),
		"tsx":    int(api.LoaderTSX),
		"js":     int(api.LoaderJS),
		"base64": int(api.LoaderBase64),
		"file":   int(api.LoaderFile),
		"copy":   int(api.LoaderCopy),
		"css":    int(api.LoaderCSS),
		"text":   int(api.LoaderText),
		"json":   int(api.LoaderJSON),
	})

	build.Set("sourceMap", map[string]interface{}{
		"external": int(api.SourceMapExternal),
		"inline":   int(api.SourceMapInline),
		"linked":   int(api.SourceMapLinked),
		"none":     int(api.SourceMapNone),
	})

	build.Set("target", map[string]interface{}{
		"ESNext": int(api.ESNext),
		"es2015": int(api.ES2015),
		"es2016": int(api.ES2016),
		"es5":    int(api.ES5),
	})

	// build.bundle
	build.Set("bundle", func(args1 js.Arguments) interface{} {
		rpcList := []*js.RPC{}
		plugins := []api.Plugin{}
		options := buildOptions{
			SourceMap: api.SourceMapNone,
			Target:    api.ESNext,
		}

		err := args1.GetMap(1, &options)

		if err != nil {
			return ctx.Throw(err.Error())
		}

		for _, plugin := range options.Plugins {
			v := ctx.GoToJSValue(plugin.Setup)
			defer v.Free()
			writer := ctx.Writer(v)

			// plugin.Setup.Dup()
			buildObject := ctx.ClassObject(func() {
				// FIX ME: with multiple plugins it will crash
				writer.Close()
				// plugin.Setup.Free()
			})

			plugins = append(plugins, api.Plugin{
				Name: plugin.Name,
				Setup: func(build api.PluginBuild) {
					buildObject.Set("onResolve", func(args js.Arguments) interface{} {
						var OnResolveOptions api.OnResolveOptions
						er := args.GetMap(0, &OnResolveOptions)
						if er != nil {
							ctx.Throw(er.Error())
						}

						fn, ok := args.Get(1).(js.Function)
						if !ok {
							ctx.Throw("second argument must be a function")
						}

						rpc := ctx.NewRPC(&fn)
						rpcList = append(rpcList, rpc)

						build.OnResolve(
							OnResolveOptions,
							func(resolveArgs api.OnResolveArgs) (api.OnResolveResult, error) {
								var _error error
								var onResolve struct {
									api.OnResolveResult `mapstructure:",squash"`
								}

								ctx.WaitCall(func() {
									ret := fn.Call(map[string]interface{}{
										// to do
										"resolve": func(args js.Arguments) interface{} {
											result := build.Resolve("./env2", api.ResolveOptions{
												Kind:       api.ResolveJSImportStatement,
												ResolveDir: ".",
											})

											if len(result.Errors) > 0 {
												return args.Ctx.Error(result.Errors[0].Text)
											}

											return result.Path
										},
										"path":       resolveArgs.Path,
										"importer":   resolveArgs.Importer,
										"mamespace":  resolveArgs.Namespace,
										"resolveDir": resolveArgs.ResolveDir,
										"pluginData": resolveArgs.PluginData,
									})

									ctx.GetMap(ret, &onResolve)
									if err != nil {
										_error = err
									}
								}).Wait()

								return api.OnResolveResult{
									Path:       onResolve.Path,
									PluginName: onResolve.PluginName,
									Namespace:  onResolve.Namespace,
									External:   onResolve.External,
									PluginData: onResolve.PluginData,
								}, _error
							},
						)
						return nil
					})

					buildObject.Set("onLoad", func(args js.Arguments) interface{} {
						var OnLoadOptions api.OnLoadOptions
						er := args.GetMap(0, &OnLoadOptions)
						if er != nil {
							ctx.Throw(er.Error())
						}

						fn, ok := args.Get(1).(js.Function)
						if !ok {
							return ctx.Throw("second argument must be a function")
						}

						rpc := ctx.NewRPC(&fn)
						rpcList = append(rpcList, rpc)
						build.OnLoad(OnLoadOptions,
							func(loadArgs api.OnLoadArgs) (api.OnLoadResult, error) {
								var _error error
								var onLoad struct {
									api.OnLoadResult `mapstructure:",squash"`
									Contents         string
								}

								ctx.WaitCall(func() {
									ret := fn.Call(map[string]interface{}{
										"path":       loadArgs.Path,
										"namespace":  loadArgs.Namespace,
										"pluginData": loadArgs.PluginData,
										"suffix":     loadArgs.Suffix,
									})

									err := ctx.GetMap(ret, &onLoad)
									if err != nil {
										_error = err
									}
								}).Wait()

								return api.OnLoadResult{
									Contents:   &onLoad.Contents,
									Loader:     onLoad.Loader,
									PluginName: onLoad.PluginName,
									PluginData: onLoad.PluginData,
									ResolveDir: onLoad.ResolveDir,
								}, _error
							},
						)
						return nil
					})

					writer.Call(buildObject)

					// ctx.WaitCall(func() {
					// 	plugin.Setup.Call(buildObject)
					// }).Wait()

				},
			})
		}

		promise := ctx.NewPromise()
		go func() {
			// Create a channel to receive the build result
			resultChan := make(chan struct {
				result api.BuildResult
				err    error
			})

			// Run esbuild in a separate goroutine
			go func() {
				opt := api.BuildOptions{
					EntryPoints:       options.EntryPoints,
					Platform:          api.PlatformBrowser,
					Define:            options.Define,
					Bundle:            options.Bundle,
					Outdir:            "/",
					Write:             false,
					MinifySyntax:      options.Minify,
					MinifyWhitespace:  options.Minify,
					MinifyIdentifiers: options.Minify,
					Splitting:         options.Splitting,
					External:          options.External,
					Format:            api.FormatESModule,
					Target:            options.Target,
					Loader:            options.Loader,
					Sourcemap:         options.SourceMap,
					Plugins:           plugins,
				}

				if len(options.Stdin.Contents) > 0 {
					opt.Stdin = &api.StdinOptions{
						Contents:   options.Stdin.Contents,
						ResolveDir: options.Stdin.ResolveDir,
						Sourcefile: options.Stdin.Sourcefile,
						Loader:     api.LoaderTSX,
					}
				}

				result := api.Build(opt)
				resultChan <- struct {
					result api.BuildResult
					err    error
				}{result: result, err: nil}
			}()

			// Wait for the build result
			buildResult := <-resultChan

			if buildResult.err != nil {
				promise.Reject(buildResult.err.Error())
				return
			}

			if len(buildResult.result.Errors) > 0 {
				promise.Reject(buildResult.result.Errors[0].Text)
				return
			}

			outputs := make([]map[string]interface{}, len(buildResult.result.OutputFiles))
			for i, file := range buildResult.result.OutputFiles {
				outputs[i] = map[string]interface{}{
					"path":    file.Path,
					"content": string(file.Contents),
				}
			}

			promise.Resolve(outputs)
		}()

		return promise
	})
}
