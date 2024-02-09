package js

/*
	#include "quickjs.h"
	#include "quickjs-libc.h"

	JSValue _js_proxy_call();
	void _go_js_object_finalizer();
	void _go_js_function_finalizer();

	__attribute__((weak))
	JSClassDef JS_Function_Struct = {
		"Function",
		.finalizer = NULL,
		.call = NULL
	};

	__attribute__((weak))
	JSClassDef JS_Object_Struct = {
		"Object",
		.finalizer = NULL,
		.call = NULL
	};
*/
import "C"

import (
	"sync"
	"unsafe"

	"github.com/mattn/go-pointer"
)

var (
	mutex             sync.Mutex
	function_class_id C.JSClassID
)

type callBackFn func(args Arguments) interface{}

type Function struct {
	Value
	goFunc    callBackFn
	finalizer *func()
	id        C.JSClassID
	this      *Value
}

func (ctx *Context) JsFunction(val C.JSValue) Function {
	o := Function{}
	o.ctx = ctx
	o.c = val
	return o
}

func (fn *Function) AutoFree() *Function {
	if fn.this != nil {
		fn.this.AutoFree()
	}

	fn.Value = fn.Value.AutoFree()
	return fn
}

// TODO: implement js class constructor
// func (ctx *Context) Class(fn callBackFn) *Function {
// 	o := ctx.Function(fn)
// 	C.JS_SetConstructorBit(ctx.c, o.js.c, 1)
// 	// obj := ctx.Object()
// 	// C.JS_SetConstructor(ctx.c, o.js.c, obj.c)
// 	return o
// }

//export _go_js_object_finalizer
func _go_js_object_finalizer(rt *C.JSRuntime, val C.JSValue) {
	runtime := GetRuntimeOpaque(rt)
	op := C.JS_GetOpaque(val, C.uint(runtime.classObjectId))
	ref, isFn := pointer.Restore(op).(*Function)

	if !isFn {
		return
	}

	if ref.finalizer != nil {
		fin := *ref.finalizer
		fin()
	}

	ref.Free()
	pointer.Unref(op)
}

func (ctx *Context) ClassObject(finalizer func()) *Function {
	// initialize the class object only once
	runtime := ctx.runtime
	if runtime.classObjectId == 0 {
		s := &C.JS_Object_Struct
		s.finalizer = (*C.JSClassFinalizer)(C._go_js_object_finalizer)
		id := C.JS_NewClassID((*C.uint)(&runtime.classObjectId))
		i := C.JS_NewClass(C.JS_GetRuntime(ctx.c), id, s)
		if i != 0 {
			panic("error creating class object")
		}
	}

	o := &Function{
		finalizer: &finalizer,
	}

	obj := C.JS_NewObjectClass(ctx.c, C.int(runtime.classObjectId))
	C.JS_SetOpaque(obj, pointer.Save(o))

	o.ctx = ctx
	o.c = obj
	return o
}

//export _js_proxy_call
func _js_proxy_call(ctx *C.JSContext, fn C.JSValue, thisValue C.JSValueConst, argc int, argvP *C.JSValueConst, flags int) C.JSValue {
	rt := C.JS_GetRuntime(ctx)
	runtime := GetRuntimeOpaque(rt)

	op := C.JS_GetOpaque(fn, C.uint(runtime.classFunctionId))
	ref := pointer.Restore(op).(*Function)
	argv := (*[1 << 30]C.JSValueConst)(unsafe.Pointer(argvP))[:argc:argc]

	var jsVal Value
	if ref != nil {
		ref.Dup()
		args := Arguments{Ctx: ref.ctx, This: Value{ctx: ref.ctx, c: thisValue}, argc: argc, argv: argv}
		value := ref.goFunc(args)
		jsVal = ref.ctx.GoToJSValue(value)
		defer ref.Free()
	} else {
		jsVal = ref.ctx.Throw("Not a function")
	}

	return jsVal.c
}

//export _go_js_function_finalizer
func _go_js_function_finalizer(rt *C.JSRuntime, val C.JSValue) {
	runtime := GetRuntimeOpaque(rt)
	op := C.JS_GetOpaque(val, C.uint(runtime.classFunctionId))
	ref, isFn := pointer.Restore(op).(*Function)

	if !isFn {
		return
	}

	if ref.finalizer != nil {
		fin := *ref.finalizer
		fin()
	}

	ref.Free()
	pointer.Unref(op)
}

func (ctx *Context) Function(fn callBackFn) *Function {
	runtime := ctx.runtime
	if runtime.classFunctionId == 0 {
		s := &C.JS_Function_Struct
		s.finalizer = (*C.JSClassFinalizer)(C._go_js_function_finalizer)
		s.call = (*C.JSClassCall)(C._js_proxy_call)
		id := C.JS_NewClassID((*C.uint)(&runtime.classFunctionId))
		i := C.JS_NewClass(C.JS_GetRuntime(ctx.c), id, s)
		if i != 0 {
			panic("error creating class object")
		}
	}

	o := &Function{
		goFunc: fn,
	}

	obj := C.JS_NewObjectClass(ctx.c, C.int(runtime.classFunctionId))
	C.JS_SetOpaque(obj, pointer.Save(o))

	o.ctx = ctx
	o.c = obj
	return o
}
