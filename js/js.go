package js

/*
#cgo CFLAGS: -I.
#cgo LDFLAGS: -L.
#cgo CFLAGS: -D_GNU_SOURCE
#cgo CFLAGS: -DCONFIG_BIGNUM
#cgo LDFLAGS: -lquickjs -lm -lpthread -ldl
#include "bridge.c"
*/
import "C"

import (
	"os"
	"unsafe"

	"github.com/mattn/go-pointer"
)

func (ctx *C.JSContext) setOpaque(context *Context) {
	C.JS_SetContextOpaque(ctx, pointer.Save(context))
}

func (ctx *C.JSContext) getOpaque() *Context {
	ref := pointer.Restore(C.JS_GetContextOpaque(ctx)).(*Context)
	return ref
}

func (ctx *C.JSContext) evalFile(filename string, code string, evalType int) C.JSValue {
	codePtr := C.CString(code)
	defer C.free(unsafe.Pointer(codePtr))

	filenamePtr := C.CString(filename)
	defer C.free(unsafe.Pointer(filenamePtr))

	val := C.JS_Eval(ctx, codePtr, C.size_t(len(code)), filenamePtr, C.int(evalType))

	if val.IsException() {
		defer C.JS_FreeValue(ctx, val)
		C.js_std_dump_error(ctx)
		os.Exit(1)
	}

	return val
}

type Error struct {
	Cause string
	Stack string
}

func (err Error) Error() string       { return err.Cause }
func (v C.JSValue) IsException() bool { return C.JS_IsException(v) == 1 }
