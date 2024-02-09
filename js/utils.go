package js

/*
	#include "quickjs.h"
	#include "quickjs-libc.h"
*/
import "C"
import (
	"fmt"
	"os"
	"unsafe"

	"github.com/mattn/go-pointer"
)

func debug(args ...interface{}) {
	fmt.Println(args...)
}

func isException(v C.JSValue) bool { return C.JS_IsException(v) == 1 }

func evalFile(ctx *C.JSContext, filename string, code string, evalType int) C.JSValue {
	codePtr := C.CString(code)
	defer C.free(unsafe.Pointer(codePtr))

	filenamePtr := C.CString(filename)
	defer C.free(unsafe.Pointer(filenamePtr))

	val := C.JS_Eval(ctx, codePtr, C.size_t(len(code)), filenamePtr, C.int(evalType))

	if isException(val) {
		defer C.JS_FreeValue(ctx, val)
		C.js_std_dump_error(ctx)
		os.Exit(1)
	}

	return val
}

func SetContextOpaque(ctx *C.JSContext, context *Context) {
	C.JS_SetContextOpaque(ctx, pointer.Save(context))
}

func GetContextOpaque(ctx *C.JSContext) *Context {
	ref := pointer.Restore(C.JS_GetContextOpaque(ctx)).(*Context)
	return ref
}

func GetRuntimeOpaque(rt *C.JSRuntime) *JSRunTime {
	p := pointer.Restore(C.JS_GetRuntimeOpaque(rt)).(*JSRunTime)
	return p
}
