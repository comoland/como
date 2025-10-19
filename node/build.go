package node

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
	Format      api.Format
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

	mod.Export("target", map[string]interface{}{
		"ESNext": int(api.ESNext),
		"es2015": int(api.ES2015),
		"es2016": int(api.ES2016),
		"es5":    int(api.ES5),
	})

	// build.bundle
	mod.Export("build", func(args1 js.Arguments) interface{} {
		plugins := []api.Plugin{}
		options := buildOptions{
			SourceMap: api.SourceMapNone,
			Target:    api.ESNext,
			Format:    api.FormatESModule,
		}

		err := args1.GetMap(0, &options)

		if err != nil {
			return ctx.Throw(err.Error())
		}

		for _, plugin := range options.Plugins {
			v := ctx.GoToJSValue(plugin.Setup)
			defer v.Free()
			writer := ctx.Writer(v)

			// plugin.Setup.Dup()
			buildObject := ctx.Object()

			plugins = append(plugins, api.Plugin{
				Name: plugin.Name,
				Setup: func(build api.PluginBuild) {
					buildObject.Set("onResolve", func(args js.Arguments) interface{} {
						var OnResolveOptions api.OnResolveOptions
						er := args.GetMap(0, &OnResolveOptions)
						if er != nil {
							ctx.Throw(er.Error())
						}

						fnWriter := ctx.Writer(args.GetValue(1))
						if fnWriter == nil {
							ctx.Throw("second argument must be a function")
						}

						build.OnResolve(
							OnResolveOptions,
							func(resolveArgs api.OnResolveArgs) (api.OnResolveResult, error) {
								var _error error
								var onResolve struct {
									api.OnResolveResult `mapstructure:",squash"`
								}

								fnWriter.Call(map[string]interface{}{
									// to do
									// "resolve": func(args js.Arguments) interface{} {
									// 	result := build.Resolve("./env2", api.ResolveOptions{
									// 		Kind:       api.ResolveJSImportStatement,
									// 		ResolveDir: ".",
									// 	})

									// 	if len(result.Errors) > 0 {
									// 		return args.Ctx.Error(result.Errors[0].Text)
									// 	}

									// 	return result.Path
									// },
									"path":       resolveArgs.Path,
									"importer":   resolveArgs.Importer,
									"mamespace":  resolveArgs.Namespace,
									"resolveDir": resolveArgs.ResolveDir,
									"pluginData": resolveArgs.PluginData,
								})

								ctx.GetMap(fnWriter.Data(), &onResolve)
								// fnWriter.Close()
								if err != nil {
									_error = err
								}

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

						fnWriter := ctx.Writer(args.GetValue(1))
						if fnWriter == nil {
							ctx.Throw("second argument must be a function")
						}

						build.OnLoad(OnLoadOptions,
							func(loadArgs api.OnLoadArgs) (api.OnLoadResult, error) {
								var _error error
								var onLoad struct {
									api.OnLoadResult `mapstructure:",squash"`
									Contents         string
								}

								fnWriter.Call(map[string]interface{}{
									"path":       loadArgs.Path,
									"namespace":  loadArgs.Namespace,
									"pluginData": loadArgs.PluginData,
									"suffix":     loadArgs.Suffix,
								})

								err := ctx.GetMap(fnWriter.Data(), &onLoad)
								if err != nil {
									_error = err
								}

								return api.OnLoadResult{
									Contents:   &onLoad.Contents,
									Loader:     onLoad.Loader,
									PluginName: onLoad.PluginName,
									PluginData: onLoad.PluginData,
									ResolveDir: onLoad.ResolveDir,
								}, _error
							},
						)
						// fnWriter.Close()
						return nil
					})

					writer.Call(buildObject)
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
					Platform:          api.PlatformBrowser,
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

			if buildResult.err != nil {
				async.Reject(buildResult.err.Error())
				return
			}

			if len(buildResult.result.Errors) > 0 {
				async.Reject(buildResult.result.Errors[0].Text)
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
			// free all writers
			// fnWriter.Free()
			return nil
		})

		return promise
	})
}
