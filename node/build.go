package node

import (
	"runtime"

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
	Format      api.Format
	Platform    api.Platform
	Loader      map[string]api.Loader
	SourceMap   api.SourceMap
}

func build(ctx *js.Context, Como js.Value) {
	mod := ctx.NewModule("build.go")

	mod.Export("platform", map[string]interface{}{
		"browser": int(api.PlatformBrowser),
		"node":    int(api.PlatformNode),
	})

	mod.Export("loader", map[string]interface{}{
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

	mod.Export("sourceMap", map[string]interface{}{
		"external": int(api.SourceMapExternal),
		"inline":   int(api.SourceMapInline),
		"linked":   int(api.SourceMapLinked),
		"none":     int(api.SourceMapNone),
	})

	mod.Export("format", map[string]interface{}{
		"commonjs": int(api.FormatCommonJS),
		"default":  int(api.FormatDefault),
		"esm":      int(api.FormatESModule),
		"iife":     int(api.FormatIIFE),
	})

	mod.Export("target", map[string]interface{}{
		"ESNext": int(api.ESNext),
		"es2015": int(api.ES2015),
		"es2016": int(api.ES2016),
		"es5":    int(api.ES5),
	})

	// build.bundle
	mod.Export("build", func(args1 js.Arguments) interface{} {
		plugins := []api.Plugin{}
		freeList := []js.Function{}
		var jsError *js.Value

		options := buildOptions{
			SourceMap: api.SourceMapNone,
			Target:    api.ESNext,
			Format:    api.FormatESModule,
			Platform:  api.PlatformDefault,
		}

		err := args1.GetMap(0, &options)

		if err != nil {
			return ctx.Throw(err.Error())
		}

		for _, plugin := range options.Plugins {
			plugin.Setup.Dup()

			plugins = append(plugins, api.Plugin{
				Name: plugin.Name,
				Setup: func(build api.PluginBuild) {

					obj := map[string]interface{}{}
					obj["onResolve"] = func(args js.Arguments) any {
						OnResolveOptions := api.OnResolveOptions{}
						er := args.GetMap(0, &OnResolveOptions)
						if er != nil {
							ctx.Throw(er.Error())
						}

						fn, ok := args.Get(1).(js.Function)
						if !ok {
							ctx.Throw("second argument must be a function")
						}

						fn.Dup()
						freeList = append(freeList, fn)

						build.OnResolve(
							OnResolveOptions,
							func(resolveArgs api.OnResolveArgs) (api.OnResolveResult, error) {
								var _error error
								var onResolve struct {
									api.OnResolveResult `mapstructure:",squash"`
								}

								ctx.WaitCall(func() {
									ret := fn.SafeCall(map[string]interface{}{
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

									if ctx.IsException(ret) {
										stackErr := ctx.GetException()
										jsError = &stackErr
										err := stackErr.Error()
										_error = err
									} else {
										err := ctx.GetMap(ret, &onResolve)
										_error = err
									}

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
					}

					obj["onLoad"] = func(args js.Arguments) any {
						OnLoadOptions := api.OnLoadOptions{}
						er := args.GetMap(0, &OnLoadOptions)
						if er != nil {
							ctx.Throw(er.Error())
						}

						fn, ok := args.Get(1).(js.Function)
						if !ok {
							return ctx.Throw("second argument must be a function")
						}

						fn.Dup()
						freeList = append(freeList, fn)

						build.OnLoad(OnLoadOptions,
							func(loadArgs api.OnLoadArgs) (api.OnLoadResult, error) {
								var _error error
								var onLoad struct {
									api.OnLoadResult `mapstructure:",squash"`
									Contents         string
								}

								ctx.WaitCall(func() {
									ret := fn.SafeCall(map[string]interface{}{
										"path":       loadArgs.Path,
										"namespace":  loadArgs.Namespace,
										"pluginData": loadArgs.PluginData,
										"suffix":     loadArgs.Suffix,
									})

									if ctx.IsException(ret) {
										stackErr := ctx.GetException()
										jsError = &stackErr
										err := stackErr.Error()
										_error = err
									} else {
										err := ctx.GetMap(ret, &onLoad)
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
					}

					ctx.WaitCall(func() {
						plugin.Setup.Call(obj)
						plugin.Setup.Free()
					}).Wait()
				},
			})
		}

		promise := ctx.Async(func(async js.Promise) {
			resultChan := make(chan struct {
				result api.BuildResult
				err    error
			})

			go func() {
				opt := api.BuildOptions{
					EntryPoints:       options.EntryPoints,
					Define:            options.Define,
					Bundle:            options.Bundle,
					Outdir:            "/",
					Write:             false,
					MinifySyntax:      options.Minify,
					MinifyWhitespace:  options.Minify,
					MinifyIdentifiers: options.Minify,
					Splitting:         options.Splitting,
					External:          options.External,
					Platform:          options.Platform,
					Format:            options.Format,
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
			runtime.GC()

			if jsError != nil {
				async.Reject(jsError)
				return
			}

			if len(buildResult.result.Errors) > 0 {
				async.Reject(ctx.Error(buildResult.result.Errors[0].Text))
				return
			}

			outputs := make([]map[string]interface{}, len(buildResult.result.OutputFiles))
			for i, file := range buildResult.result.OutputFiles {
				outputs[i] = map[string]interface{}{
					"path":    file.Path,
					"content": string(file.Contents),
				}
			}

			async.Resolve(outputs)

		})

		promise.Finally(func(args js.Arguments) interface{} {
			for _, fn := range freeList {
				fn.Free()
			}

			return nil
		})

		return promise
	})
}
