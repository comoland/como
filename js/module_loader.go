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
	"fmt"
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
	ctx := c.getOpaque()
	filename := C.GoString(module_name)
	m := ctx.LoadModule(filename, 0)
	return m
}

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

//export moduleNormalizeName
func moduleNormalizeName(c *C.JSContext, base_name *C.char, name *C.char, opque unsafe.Pointer) *C.char {
	lock.Lock()
	defer lock.Unlock()

	basename := C.GoString(base_name)
	filename := C.GoString(name)
	dirname := filepath.Dir(basename)

	resolvedFile := filename

	for key, element := range internalModules {
		m1 := regexp.MustCompile("^" + key)
		newResolvedName := m1.ReplaceAllString(resolvedFile, element)

		if resolvedFile != newResolvedName {
			filename, _ = filepath.Abs(newResolvedName)
			resolvedFile = filename
		}
	}

	if s.HasPrefix(filename, ".") || s.HasPrefix(filename, "/") {
		if !filepath.IsAbs(filename) {
			resolvedFile = filepath.Join(dirname, filename)
		}

		ext := filepath.Ext(resolvedFile)

		tryPaths := []string{
			"/",
			"/index",
		}

		tryExts := []string{
			"ts",
			"tsx",
			"js",
			"mjs",
		}

		if ext == "" {
		out:
			for _, path := range tryPaths {
				tryPath := filepath.Join(resolvedFile, path)
				for _, ext := range tryExts {
					fileWithExt := s.Join([]string{tryPath, ext}, ".")
					if fileExists(fileWithExt) {
						resolvedFile = fileWithExt
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

	fileExtension := filepath.Ext(resolvedFile)
	if fileExtension != "" && fileExtension != ".go" {
		resolvedFile, _ = filepath.Abs(resolvedFile)
	}

	cstr := C.CString(resolvedFile)
	return cstr
}

func (ctx *Context) RegisterModuleAlias(name string, alias string) {
	lock.Lock()
	defer lock.Unlock()
	internalModules[name] = alias
}

func (ctx *Context) LoadModule(filename string, isMain int) *C.JSModuleDef {
	if s.HasSuffix(filename, ".go") {
		ctx.externals = append(ctx.externals, filename)
	}

	codeStr := ""
	code, err := ioutil.ReadFile(filename)

	if s.Contains(filename, "mod.ts") {
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
			debug(result.Errors[0])
			os.Exit(1)
		}

		codeStr = string(result.OutputFiles[0].Contents)
	} else {
		if err != nil {
			contents := fmt.Sprintf(`
				import * as EE from '%s'
				Object.keys(EE).forEach((key) => {
					module.exports[key] = EE[key]
				});

				globalThis['%s'] = EE;
				globalThis.require = function(f) {
					return globalThis[f]
				};
		`, filename, filename)

			result := api.Build(api.BuildOptions{
				Stdin: &api.StdinOptions{
					Contents:   contents,
					ResolveDir: "./",
					Sourcefile: filename,
					Loader:     api.LoaderTSX,
				},
				External:  ctx.externals,
				Platform:  api.PlatformBrowser,
				Define:    map[string]string{"process.env.NODE_ENV": "'development'"},
				Bundle:    true,
				Target:    api.ESNext,
				Format:    api.FormatESModule,
				Outdir:    "/",
				Write:     false,
				Sourcemap: api.SourceMapExternal,
			})

			if len(result.Errors) > 0 {
				debug(result.Errors[0])
				os.Exit(1)
			}

			codeStr = string(result.OutputFiles[1].Contents)
			// fmt.Println(result.OutputFiles[1])
			codeStr = s.Replace(codeStr, "export default ", "var XX = ", 1)

			trans := api.Transform(codeStr, api.TransformOptions{
				Loader:     api.LoaderTSX,
				Sourcemap:  api.SourceMapExternal,
				Target:     api.ESNext,
				Format:     api.FormatCommonJS,
				Sourcefile: filename,
			})

			codeStr = string(trans.Code)

			fn := ctx.EvalFunction(filename, codeStr+`
		() => {
			return Object.keys(XX)
		};`)

			defer fn.Free()
			ret := fn.Call().([]interface{})

			nStr := ""
			for _, plugin := range ret {
				name := plugin.(string)
				if name == "default" {
					nStr = nStr + "export " + name + " XX['default']" + `;
			`
				} else {
					nStr = nStr + "export var " + name + " = XX['" + name + "']" + `;
				`
				}
			}

			ctx.externals = append(ctx.externals, filename)
			codeStr = codeStr + nStr
			// lock.Lock()
			// sourceMaps[filename] = result.OutputFiles[0].Contents
			// lock.Unlock()
		} else {
			codeStr = string(code)
			result := api.Transform(codeStr, api.TransformOptions{
				Loader:     api.LoaderTSX,
				Sourcemap:  api.SourceMapExternal,
				Target:     api.ESNext,
				Format:     api.FormatESModule,
				Sourcefile: filename,
				JSXMode:    api.JSXModeAutomatic,
			})

			codeStr = string(result.Code)
			lock.Lock()
			sourceMaps[filename] = result.Map
			lock.Unlock()
		}
	}

	ctx.StackFormatter = func(stack string) string {
		lines := s.Split(stack, "\n")

		for idx, line := range lines {
			regex := regexp.MustCompile(`(.*?)\((.*):(\d+)\)`)
			matches := regex.FindStringSubmatch(line)
			if len(matches) == 4 {
				if sourceMapStr, ok := sourceMaps[matches[2]]; ok {
					smap, err := sourcemap.Parse(matches[2], sourceMapStr)
					if err != nil {
						debug("error parsing source-map")
						os.Exit(1)
					}

					lineNo, err := strconv.Atoi(matches[3])
					if err == nil {
						file, _, line, _, ok := smap.Source(lineNo, 0)
						if ok {
							lines[idx] = matches[1] + "(" + file + ":" + strconv.Itoa(line) + ")"
						}
					}
				}
			}
		}

		return s.Join(lines, "\n")
	}

	evalType := C.JS_EVAL_TYPE_MODULE | C.JS_EVAL_FLAG_COMPILE_ONLY
	val := ctx.c.evalFile(filename, codeStr, evalType)
	r := C.como_get_value_ptr(val)
	m := (*C.JSModuleDef)(unsafe.Pointer(r))

	if m != nil {
		C.js_module_set_import_meta(ctx.c, val, 1, C.int(isMain))
	}

	meta_obj := Value{ctx: ctx, c: C.JS_GetImportMeta(ctx.c, m)}
	defer meta_obj.Free()

	dirname := filepath.Dir(filename)
	meta_obj.Set("dir", dirname)

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
