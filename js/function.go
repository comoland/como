package js

/*
	#include "quickjs.h"
	#include "quickjs-libc.h"

	JSValue proxy_call();
	void finalizer();
	static JSClassID go_class_id;

	static void como_go_finalizer(JSRuntime *rt, JSValue val) {
		void *op = JS_GetOpaque(val, go_class_id);
		finalizer(op, rt, val);
	}

	static JSValue como_class_caller(JSContext *ctx, JSValue func_obj, JSValue this_val, int argc, JSValue *argv, int flags) {
		void *op = JS_GetOpaque(func_obj, go_class_id);
		return proxy_call(ctx, this_val, argc, argv, op);
	}

	static JSValue como_new_class_function(JSContext *ctx, void *op) {
		JSClassDef go_function = {
    		"Function",
			.finalizer = como_go_finalizer,
			.call = como_class_caller
		};

		JS_NewClassID(&go_class_id);
        JS_NewClass(JS_GetRuntime(ctx), go_class_id, &go_function);
		JSValue obj = JS_NewObjectClass(ctx, go_class_id);
		JS_SetOpaque(obj, op);
		return obj;
	}

	static JSValue como_new_class_object(JSContext *ctx, void *op) {
		JSClassDef go_function = {
    		"Object",
			.finalizer = como_go_finalizer,
		};

		JS_NewClassID(&go_class_id);
        JS_NewClass(JS_GetRuntime(ctx), go_class_id, &go_function);
		JSValue obj = JS_NewObjectClass(ctx, go_class_id);
		JS_SetOpaque(obj, op);
		return obj;
	}
*/
import "C"

import (
	"fmt"
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

func (ctx *Context) Function(fn callBackFn) *Function {
	o := &Function{
		goFunc: fn,
	}

	o.ctx = ctx
	o.c = C.como_new_class_function(ctx.c, pointer.Save(o))
	return o
}

func (fn *Function) AutoFree() *Function {
	fmt.Println("called AutoFree")

	if fn.this != nil {
		fn.this.AutoFree()
	}

	fn.Value = fn.Value.AutoFree()

	// fn.this = fn.th.Value.AutoFree().Dup()
	// v.Free()

	// fmt.Println("changed id", fn.Value.id)
	return fn
}

//export finalizer
func finalizer(op unsafe.Pointer, rt *C.JSRuntime, val C.JSValue) {
	ref := pointer.Restore(op).(*Function)
	if ref.finalizer != nil {
		fin := *ref.finalizer
		fin()
	}

	ref.Free()
	pointer.Unref(op)
}

//export proxy_call
func proxy_call(ctx *C.JSContext, thisValue C.JSValueConst, argc int, argvP *C.JSValueConst, op unsafe.Pointer) C.JSValue {
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

// TODO: implement js class constructor
// func (ctx *Context) Class(fn callBackFn) *Function {
// 	o := ctx.Function(fn)
// 	C.JS_SetConstructorBit(ctx.c, o.js.c, 1)
// 	// obj := ctx.Object()
// 	// C.JS_SetConstructor(ctx.c, o.js.c, obj.c)
// 	return o
// }

// ClassObject create an object with a finalizer function,
// finalizer will run when the object is out of scope,
// returns a js object value
func (ctx *Context) ClassObject(finalizer func()) *Function {
	o := &Function{
		finalizer: &finalizer,
	}

	o.ctx = ctx
	o.c = C.como_new_class_object(ctx.c, pointer.Save(o))
	return o
}
