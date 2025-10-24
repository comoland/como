package js

/*
	#include "quickjs.h"
	#include "quickjs-libc.h"

	static void *como_get_value_ptr(JSValue val) {
		return JS_VALUE_GET_PTR(val);
	}
*/
import "C"

import (
	"embed"
	"fmt"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	s "strings"
	"sync"
	"unsafe"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/go-sourcemap/sourcemap"
)

var lock sync.Mutex

var internalModules = map[string]string{
	// "@como": "./js/como.ts",
}

var sourceMaps = map[string][]byte{
	// "@xxx": "./js/como.ts",
}

//export moduleLoader
func moduleLoader(c *C.JSContext, module_name *C.char, opque unsafe.Pointer) *C.JSModuleDef {
	ctx := GetContextOpaque(c)
	filename := C.GoString(module_name)
	m := ctx.LoadModule(filename, 0)
	return m
}

func fileExists(ctx *Context, filename string) (string, bool) {
	if ctx.Embed != nil {
		rel, _ := os.Getwd()
		newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
		file, er := ctx.Embed.Open(newFile)

		if er == nil {
			defer file.Close()
			return newFile, true
		}
	}

	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return filename, false
	}
	return filename, !info.IsDir()
}

//export moduleNormalizeName
func moduleNormalizeName(c *C.JSContext, base_name *C.char, name *C.char, opque unsafe.Pointer) *C.char {
	lock.Lock()
	defer lock.Unlock()

	ctx := GetContextOpaque(c)

	basename := C.GoString(base_name)
	filename := C.GoString(name)
	dirname := filepath.Dir(basename)

	resolvedFile := filename

	_, ok := ctx.CoreModules[filename]
	if ok {
		goto ret
	}

	// start by resolving internal registered module aliases
	// Como has a process.registerAlias method
	// this can register namespaces ex:
	// process.registerAlias('@como', './src')
	// this will replace all occurances with @como/.. to ./src/..
	for key, element := range internalModules {
		m1 := regexp.MustCompile("^" + key)
		newResolvedName := m1.ReplaceAllString(resolvedFile, element)

		if resolvedFile != newResolvedName {
			filename, _ = filepath.Abs(newResolvedName)
			resolvedFile = filename
		}
	}

	// file system resolver
	if s.HasPrefix(filename, ".") || s.HasPrefix(filename, "/") {
		if !filepath.IsAbs(filename) {
			resolvedFile = filepath.Join(dirname, filename)
		}

		tryPaths := []string{
			"/",
			"/index",
		}

		tryExts := []string{
			"ts",
			"tsx",
			"js",
			"mjs",
			"jsx",
		}

		// if the file doesn't end with an extension
		// we trys a set of options just like node.js
		// until we find first match
		if filepath.Ext(resolvedFile) == "" {
		out:
			for _, path := range tryPaths {
				tryPath := filepath.Join(resolvedFile, path)
				for _, ext := range tryExts {
					fileWithExt := s.Join([]string{tryPath, ext}, ".")
					fname, ok := fileExists(ctx, fileWithExt)
					if ok {
						resolvedFile = fname
						break out
					}
				}
			}
		}
	} else {
		if val, ok := internalModules[filename]; ok {
			resolvedFile = val
		}
	}

	// fileExtension := filepath.Ext(resolvedFile)
	if s.HasPrefix(filename, ".") || s.HasPrefix(filename, "/") {
		resolvedFile, _ = filepath.Abs(resolvedFile)
	} else {
		// cwd, _ := os.Getwd()
		// resolver := NewResolver(cwd)
		// fmt.Println("basename ==> ", basename)
		// fmt.Println("filename ==> ", filename)

		// pp, err := resolver.Resolve(filename, dirname)
		// if err != nil {
		// 	fmt.Println("Errrorroror ===> ", err.Error())
		// } else {
		// 	resolvedFile = pp.Path
		// }

		// PrintResolveResult(pp)
	}
ret:
	cstr := C.CString(resolvedFile)
	return cstr
}

func (ctx *Context) RegisterModuleAlias(name string, alias string) {
	lock.Lock()
	defer lock.Unlock()
	internalModules[name] = alias
}

func stripPath(p string) (stripped, ext string) {
	// Normalize path
	p = filepath.ToSlash(filepath.Clean(p))

	// Drop first segment
	parts := s.SplitN(p, "/", 2)
	if len(parts) < 2 {
		return "", filepath.Ext(p) // nothing to strip, just return ext
	}
	rest := parts[1]

	// Get extension
	ext = filepath.Ext(rest)

	// Remove extension
	stripped = s.TrimSuffix(rest, ext)
	return stripped, ext
}

func (ctx *Context) RegisterCoreModules(embededFs embed.FS, files map[string]string) {
	lock.Lock()
	defer lock.Unlock()

	fs.WalkDir(embededFs, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		name, _ := stripPath(path)
		_, ok := ctx.CoreModules[name]
		if ok {
			panic(fmt.Sprintf("core module %s already registered at %s", name, path))
		}

		// append core module to externals
		ctx.externals = append(ctx.externals, name)
		ctx.CoreModules[name] = struct {
			Path string
			FS   *embed.FS
		}{
			Path: path,
			FS:   &embededFs,
		}

		return nil
	})

	// coreModules := ctx.CoreModules

	// for name, path := range files {
	// 	_, ok := coreModules[name]
	// 	if ok {
	// 		panic(fmt.Sprintf("core module %s already registered at %s", name, path))
	// 	}

	// 	ctx.externals = append(ctx.externals, name)
	// 	sub, err := fs.Sub(embededFs, "js")
	// 	if err != nil {
	// 		panic(err.Error())
	// 	}

	// 	ctx.CoreModules[name] = sub
	// }
}

func (ctx *Context) LoadModule(filename string, isMain int) *C.JSModuleDef {
	ext := filepath.Ext(filename)

	if ext == ".go" {
		ctx.externals = append(ctx.externals, filename)
	}

	codeStr := ""

	var err error
	var code []byte

	resolvedFromEmded := false

	coreFs, ok := ctx.CoreModules[filename]
	if ok && isMain == 0 {
		code, err = fs.ReadFile(coreFs.FS, coreFs.Path)
		if err != nil {
			panic(err.Error())
		}

		resolvedFromEmded = true
		ext = filepath.Ext(coreFs.Path)

		codeStr = string(code)
		if s.Contains(codeStr, "globalThis.NamedExports") {
			v, err := ctx.EvalModule(filename, codeStr)
			defer v.Free()
			if err != nil {
				panic(err.Error())
			}

			global := ctx.GlobalObject()
			defer global.Free()
			exp := global.Get("NamedExports").(map[string]interface{})

			nStr := "\n"
			for name, _ := range exp {
				nStr = nStr + "export var " + name + " = _exports['" + name + "'] \n"
			}

			codeStr = codeStr + nStr
			code = []byte(codeStr)
			global.Set("NamedExports", nil)
		}
	} else {
		// if embedder enabled try to read files from embedding files system
		code, err = ctx.FSEmbedder.ReadJsFile(filename)
		if err == nil {
			resolvedFromEmded = true
		}

		if err != nil {
			code, err = ioutil.ReadFile(filename)
		}
	}

	if s.Contains(filename, "mod.ts") && !resolvedFromEmded {
		result := api.Build(api.BuildOptions{
			EntryPoints: []string{filename},
			External:    ctx.externals,
			Platform:    api.PlatformBrowser,
			Define:      map[string]string{"process.env.NODE_ENV": "'production'"},
			Bundle:      true,
			Target:      api.ESNext,
			Format:      api.FormatESModule,
		})

		if len(result.Errors) > 0 {
			ctx.Throw2(map[string]interface{}{
				"message": result.Errors[0].Text,
			})

			os.Exit(6)
		}

		ctx.FSEmbedder.tryToWriteBundleToModulesLib(filename, result.OutputFiles[0].Contents)
		codeStr = string(result.OutputFiles[0].Contents)

	} else {
		// error reading file normally, it's most likely a node_module
		// Como doesn't has a module loader so we will let esbuild load that
		if err != nil {
			result := api.Build(api.BuildOptions{
				EntryPoints:      []string{filename},
				MinifyWhitespace: true,
				MinifySyntax:     true,
				External:         ctx.externals,
				Platform:         api.PlatformBrowser,
				Define:           map[string]string{"process.env.NODE_ENV": "'development'"},
				Bundle:           true,
				Target:           api.ESNext,
				Format:           api.FormatESModule,
				Outdir:           "./",
				Write:            false,
				Sourcemap:        api.SourceMapExternal,
			})

			if len(result.Errors) > 0 {
				ctx.Throw2(map[string]interface{}{
					"message": result.Errors[0].Text,
				})

				os.Exit(1)
			}

			codeStr = string(result.OutputFiles[1].Contents)

			if s.Contains(codeStr, "export default ") {
				codeStr = s.Replace(codeStr, "export default ", "var _COMO_EXPORT = ", 1)
				contents := fmt.Sprintf(`
					%s

					// globalThis["modules_exports"] = globalThis["modules_exports"] ?? {};
					// globalThis["modules_exports"]['%s'] = _COMO_EXPORT;
					// globalThis.require = function(f) {
					// 	return globalThis["modules_exports"][f]
					// };
			`, codeStr, filename)

				trans := api.Transform(contents, api.TransformOptions{
					Loader:           api.LoaderTSX,
					Sourcemap:        api.SourceMapExternal,
					Target:           api.ESNext,
					Format:           api.FormatCommonJS,
					Sourcefile:       filename,
					JSX:              api.JSXAutomatic,
					MinifyWhitespace: true,
					MinifySyntax:     true,
				})

				codeStr = string(trans.Code)

				fn := ctx.EvalFunction(filename, fmt.Sprintf(`() => {
				%s

				return Object.keys(_COMO_EXPORT)
			};
			`, codeStr))

				defer fn.Free()
				ret := fn.Call().([]interface{})

				nStr := "export default _COMO_EXPORT;"
				for _, plugin := range ret {
					name := plugin.(string)
					if name == "default" {
						nStr = nStr + "export " + name + " _COMO_EXPORT['default']" + `;
							`
					} else {
						nStr = nStr + "export var " + name + " = _COMO_EXPORT['" + name + "']" + `;
							`
					}
				}

				ctx.externals = append(ctx.externals, filename)
				codeStr = codeStr + nStr
			}

			ctx.FSEmbedder.tryToWriteBundleToModulesLib(filename, []byte(codeStr))
		} else if ext == ".json" {
			codeStr = string(code)
			result := api.Transform(codeStr, api.TransformOptions{
				Loader:     api.LoaderJSON,
				Sourcemap:  api.SourceMapNone,
				Target:     api.ESNext,
				Format:     api.FormatESModule,
				Sourcefile: filename,
			})

			codeStr = string(result.Code)
		} else if ext == ".txt" {
			codeStr = string(code)
			result := api.Transform(codeStr, api.TransformOptions{
				Loader:     api.LoaderText,
				Sourcemap:  api.SourceMapNone,
				Target:     api.ESNext,
				Format:     api.FormatESModule,
				Sourcefile: filename,
			})

			codeStr = string(result.Code)
		} else if ext == ".svg" {
			codeStr = string(code)
			result := api.Transform(codeStr, api.TransformOptions{
				Loader:     api.LoaderText,
				Sourcemap:  api.SourceMapNone,
				Target:     api.ESNext,
				Format:     api.FormatESModule,
				Sourcefile: filename,
			})

			codeStr = string(result.Code)
		} else if ext == ".ts" || ext == ".tsx" {
			codeStr = string(code)
			result := api.Transform(codeStr, api.TransformOptions{
				Loader:     api.LoaderTSX,
				Sourcemap:  api.SourceMapExternal,
				Target:     api.ESNext,
				Format:     api.FormatDefault,
				Sourcefile: filename,
				JSX:        api.JSXAutomatic,
			})

			codeStr = string(result.Code)

			// codeStr = `
			// 	const { createModule } = await import("module");
			// 	const module = createModule(import.meta.filename, globalThis.module);
			// 	globalThis.module = module;
			// 	const exports = module.exports;
			// 	const require = module.require;
			// ` + codeStr

			_, ok := ctx.CoreModules[filename]
			if !ok {
				codeStr = `const { createModule } = await import("module");const module = createModule(import.meta.filename, globalThis.module); globalThis.module = module; const exports = module.exports; const require = module.require;` + codeStr
			}

			lock.Lock()
			sourceMaps[filename] = result.Map
			lock.Unlock()
		} else {
			codeStr = string(code)
			_, ok := ctx.CoreModules[filename]
			if !ok {
				codeStr = `const { createModule } = await import("module");const module = createModule(import.meta.filename, globalThis.module); globalThis.module = module; const exports = module.exports;const require = module.require;` + codeStr
			}
		}
	}

	ctx.StackFormatter = func(stack string) string {
		lines := s.Split(stack, "\n")

		lock.Lock()
		defer lock.Unlock()
		for idx, line := range lines {
			regex := regexp.MustCompile(`(.*?)\((.*):(\d+):(\d+)\)`)
			matches := regex.FindStringSubmatch(line)
			if len(matches) == 5 {
				if sourceMapStr, ok := sourceMaps[matches[2]]; ok {
					smap, err := sourcemap.Parse(matches[2], sourceMapStr)
					if err != nil {
						debug("error parsing source-map")
						os.Exit(1)
					}

					lineNo, err := strconv.Atoi(matches[3])
					colNum, err2 := strconv.Atoi(matches[4])
					if err2 == nil {
						colNum = 0
					}

					if err == nil {
						file, _, line, col, ok := smap.Source(lineNo, colNum)
						if ok {
							lines[idx] = matches[1] + "(" + file + ":" + strconv.Itoa(line) + ":" + strconv.Itoa(col+1) + ")"
						}
					}
				}
			}
		}

		return s.Join(lines, "\n")
	}

	return ctx.LoadModuleStr(filename, codeStr, isMain)
}

func (ctx *Context) LoadModuleStr(filename string, codeStr string, isMain int) *C.JSModuleDef {
	evalType := C.JS_EVAL_TYPE_MODULE | C.JS_EVAL_FLAG_COMPILE_ONLY
	val := evalFile(ctx.c, filename, codeStr, evalType)
	r := C.como_get_value_ptr(val)
	m := (*C.JSModuleDef)(unsafe.Pointer(r))

	if m != nil {
		C.js_module_set_import_meta(ctx.c, val, 1, C.int(isMain))
	}

	meta_obj := ctx.Value(C.JS_GetImportMeta(ctx.c, m))
	defer meta_obj.Free()

	dirname := filepath.Dir(filename)
	meta_obj.Set("dir", dirname)
	meta_obj.Set("dirname", dirname)
	meta_obj.Set("filename", filename)

	if isMain == 1 {
		v := C.JS_EvalFunction(ctx.c, val)
		defer ctx.FreeValue(v)
		if C.JS_IsException(v) == 1 {
			ctx.ThrowStackError()
		}
	} else {
		defer ctx.FreeValue(val)
	}

	return m
}

func (ctx *Context) LoadMainModule(filename string) *C.JSModuleDef {
	return ctx.LoadModule(filename, 1)
}

func (ctx *Context) LoadMainModuleString(filename string, code string) *C.JSModuleDef {
	return ctx.LoadModuleStr(filename, code, 1)
}
