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
	exportList map[string]Value
}

var Modules = make(map[string]Module)

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
	for key, value := range module.exportList {
		exportName := C.CString(key)
		defer C.free(unsafe.Pointer(exportName))
		C.JS_SetModuleExport(c, m, exportName, value.c)
		// defer C.JS_FreeValue(ctx, value.c)
	}

	return 0
}

func (ctx *Context) NewModule(name string) Module {
	cnamestr := C.CString(name)
	defer C.free(unsafe.Pointer(cnamestr))

	r := C.como_init_module(ctx.c, cnamestr)
	m := (*C.JSModuleDef)(unsafe.Pointer(r))

	exportList := make(map[string]Value)
	module := Module{ctx, m, exportList}
	ctx.modules[name] = module
	return module
}

func (m *Module) Export(name string, v interface{}) {
	value := m.ctx.GoToJSValue(v)
	cnamestr := C.CString(name)
	defer C.free(unsafe.Pointer(cnamestr))
	C.JS_AddModuleExport(m.ctx.c, m.m, cnamestr)
	m.exportList[name] = value
}

func (ctx *Context) FreeModules() {
	for _, module := range ctx.modules {
		for _, value := range module.exportList {
			value.Free()
		}
	}
}
