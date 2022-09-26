package core

import (
	"fmt"

	"github.com/comoland/como/js"
	"github.com/evanw/esbuild/pkg/api"
)

type plugin struct {
	Name  string
	Setup js.Function
}

type buildOptions struct {
	Plugins   []plugin
	Define    map[string]string
	Splitting bool
	Minify    bool
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
	})

	// build.bundle
	build.Set("bundle", func(args1 js.Arguments) interface{} {
		// var buildOptions = api.BuildOptions{}
		filename := args1.GetString(0)

		var plugins = []api.Plugin{}
		var rpcList = []*js.RPC{}

		var options buildOptions
		err := args1.GetMap(1, &options)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		for _, plugin := range options.Plugins {
			plugin.Setup.Dup()
			buildObject := ctx.ClassObject(func() {
				plugin.Setup.Free()
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
								var onResolve struct {
									api.OnResolveResult `mapstructure:",squash"`
								}

								ret := rpc.Send(map[string]interface{}{
									"path":       resolveArgs.Path,
									"importer":   resolveArgs.Importer,
									"mamespace":  resolveArgs.Namespace,
									"resolveDir": resolveArgs.ResolveDir,
								})

								err := ctx.GetMap(ret, &onResolve)
								if err != nil {
									return api.OnResolveResult{}, err
								}

								return api.OnResolveResult{
									Path:       onResolve.Path,
									PluginName: onResolve.PluginName,
									Namespace:  onResolve.Namespace,
									External:   onResolve.External,
								}, nil
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
								var onLoad struct {
									api.OnLoadResult `mapstructure:",squash"`
									Contents         string
								}

								ret := rpc.Send(map[string]interface{}{
									"path":      loadArgs.Path,
									"namespace": loadArgs.Namespace,
								})

								err := ctx.GetMap(ret, &onLoad)
								if err != nil {
									return api.OnLoadResult{}, err
								}

								return api.OnLoadResult{
									Contents:   &onLoad.Contents,
									Loader:     onLoad.Loader,
									PluginName: onLoad.PluginName,
								}, nil
							},
						)
						return nil
					})

					ctx.WaitCall(func() {
						plugin.Setup.Call(buildObject)
					}).Wait()

				},
			})
		}

		promise := ctx.NewPromise()
		go func() {
			result := api.Build(api.BuildOptions{
				EntryPoints:       []string{filename},
				Platform:          api.PlatformBrowser,
				Define:            options.Define,
				Bundle:            true,
				Outdir:            "/",
				Write:             false,
				MinifySyntax:      options.Minify,
				MinifyWhitespace:  options.Minify,
				MinifyIdentifiers: options.Minify,
				Splitting:         options.Splitting,
				Format:            api.FormatESModule,
				Target:            api.ES2015,
				// Engines: []api.Engine{
				// 	{Name: api.EngineEdge, Version: "16"},
				// 	{Name: api.EngineChrome, Version: "58"},
				// },
				// Sourcemap: api.SourceMapInline,
				Plugins: plugins,
			})

			for _, rpc := range rpcList {
				rpc.Close()
			}

			if len(result.Errors) > 0 {
				fmt.Println("bundle error ", result.Errors[0].Text)
				promise.Reject(ctx.Error(result.Errors[0].Text))
			} else {
				var array = []interface{}{}
				for _, output := range result.OutputFiles {
					array = append(array, map[string]interface{}{
						"path":    output.Path,
						"content": string(output.Contents),
					})
				}

				promise.Resolve(array)
			}
		}()

		return promise
	})
}
