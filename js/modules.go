package js

/*
#include "quickjs.h"
#include "quickjs-libc.h"

int set_module_exports();
static JSModuleDef *como_init_module(JSContext *ctx, const char *module_name) {
    JSModuleDef *m = JS_NewCModule(ctx, module_name, set_module_exports);
    if (!m) {
        return NULL;
    }

    return m;
}
*/
import "C"

import (
	"unsafe"
)

type Module struct {
	ctx        *Context
	m          *C.JSModuleDef
	exportList map[string]interface{}
}

//export set_module_exports
func set_module_exports(c *C.JSContext, m *C.JSModuleDef) C.int {
	ctx := c.getOpaque()
	moduleNameAtom := C.JS_GetModuleName(c, m)

	moduleName := C.JS_AtomToCString(c, moduleNameAtom)
	defer C.JS_FreeCString(c, moduleName)

	module, found := ctx.modules[C.GoString(moduleName)]
	if !found {
		return 1
	}

	// loop through exports and register them
	for key, val := range module.exportList {
		exportName := C.CString(key)
		defer C.free(unsafe.Pointer(exportName))
		fn, isFn := val.(func(args Arguments) interface{})
		if isFn {
			value := ctx.Function(fn).AutoFree()
			C.JS_SetModuleExport(c, m, exportName, ctx.GoToJSValue(value).Dup().c)
		} else {
			value := ctx.GoToJSValue(val)
			C.JS_SetModuleExport(c, m, exportName, value.c)
		}
	}

	// for key := range module.exportList {
	// 	delete(module.exportList, key)
	// }

	return 0
}

func (ctx *Context) NewModule(name string) Module {
	cnamestr := C.CString(name)
	defer C.free(unsafe.Pointer(cnamestr))

	r := C.como_init_module(ctx.c, cnamestr)
	m := (*C.JSModuleDef)(unsafe.Pointer(r))

	exportList := make(map[string]interface{})
	module := Module{ctx, m, exportList}
	ctx.modules[name] = module
	return module
}

func (m *Module) Export(name string, v interface{}) {
	cnamestr := C.CString(name)
	defer C.free(unsafe.Pointer(cnamestr))
	C.JS_AddModuleExport(m.ctx.c, m.m, cnamestr)
	m.exportList[name] = v
}

func (ctx *Context) DeleteModulesList() {
	for _, module := range ctx.modules {
		for key := range module.exportList {
			delete(module.exportList, key)
		}
	}
}

func (ctx *Context) RegisterWorkerModules(wCtx *Context) {
	for name, module := range ctx.modules {
		wModule := wCtx.NewModule(name)
		for name, value := range module.exportList {
			wModule.Export(name, value)
		}
	}
}
