package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	// "fmt"

	"strconv"
	"unsafe"
)

type Value struct {
	AutoRelease bool
	id          string
	ctx         *Context
	c           C.JSValue
}

var num1 = 0

func (ctx *Context) Value(v C.JSValue) Value {
	val := Value{c: v, ctx: ctx}
	return val
}

func (val Value) AutoFree() Value {
	if val.AutoRelease == true {
		return val
	}

	// for _, value := range val.ctx.values {
	// 	if value.c == val.c {
	// 		fmt.Println("found no auto free value")
	// 		return val
	// 	}
	// }

	ctx := val.ctx
	ctx.mutex.Lock()
	num1 = num1 + 1
	id := strconv.Itoa(num1)
	val = Value{ctx: val.ctx, c: val.c, AutoRelease: true, id: id}
	ctx.values[id] = val
	ctx.mutex.Unlock()
	return val
}

func (val Value) FreeAuto() {
	val.Free()
}

func (f Value) Call(args ...interface{}) interface{} {
	var a Arguments
	i := len(args)

	if i == 1 {
		if argType, ok := args[0].(Arguments); ok {
			a = argType.Dup()
		} else {
			a = f.ctx.NewArguments(args[0])
		}
	} else if i > 1 {
		a = f.ctx.NewArguments(args...)
	} else {
		a = f.ctx.NewArguments(nil)
	}

	defer a.Free()
	return f.CallArgs(a)
}

func (v Value) CallArgs(args Arguments) interface{} {
	if !v.IsFunction() {
		panic("only works on function value")
	}

	ctx := v.ctx
	fn := v.c
	cArgs := (*C.JSValueConst)(unsafe.Pointer(&args.argv[0]))
	ret := C.JS_Call(ctx.c, fn, args.This.c, C.int(len(args.argv)), cArgs)
	defer ctx.FreeValue(ret)

	var goRet = ctx.JsToGoValue(ret)
	goVal, ok := goRet.(Value)
	if ok && goVal.IsException() {
		ctx.ThrowStackError()
	}

	return goRet
}

func (v Value) Set(name string, value interface{}) Value {
	ctx := v.ctx
	obj := v.c

	namePtr := C.CString(name)
	defer C.free(unsafe.Pointer(namePtr))

	jsVal := ctx.goToJSValue(value)
	C.JS_SetPropertyStr(ctx.c, obj, namePtr, jsVal)
	return Value{ctx: ctx, c: jsVal}
}

func (v Value) SetInt(i uint, value interface{}) Value {
	ctx := v.ctx
	arr := v.c

	jsVal := ctx.goToJSValue(value)
	C.JS_SetPropertyUint32(ctx.c, arr, C.uint32_t(i), jsVal)
	return Value{ctx: ctx, c: jsVal}
}

func (v Value) Get(name string) interface{} {
	namePtr := C.CString(name)
	defer C.free(unsafe.Pointer(namePtr))
	jsVal := C.JS_GetPropertyStr(v.ctx.c, v.c, namePtr)
	defer v.ctx.FreeValue(jsVal)
	return v.ctx.JsToGoValue(jsVal)
}

func (v Value) ToString() string {
	jsVal := C.JS_ToString(v.ctx.c, v.c)
	defer v.ctx.FreeValue(jsVal)
	return v.ctx.JsToGoValue(jsVal).(string)
}

func (v Value) GetValue(name string) Value {
	namePtr := C.CString(name)
	defer C.free(unsafe.Pointer(namePtr))
	return Value{ctx: v.ctx, c: C.JS_GetPropertyStr(v.ctx.c, v.c, namePtr)}
}

func (v Value) GetInt(i uint) interface{} {
	ctx := v.ctx
	arr := v.c

	jsVal := C.JS_GetPropertyUint32(ctx.c, arr, C.uint32_t(i))
	defer v.ctx.FreeValue(jsVal)
	return v.ctx.JsToGoValue(jsVal)
}

func (v Value) Length() int64 {
	return v.Get("length").(int64)
}

func (v Value) SetFunction(name string, fn func(args Arguments) interface{}) *Function {
	ctx := v.ctx
	val := ctx.Function(fn)
	v.Set(name, val)
	return val
}

func (v Value) String() string {
	ptr := C.JS_ToCString(v.ctx.c, v.c)
	defer C.JS_FreeCString(v.ctx.c, ptr)
	return C.GoString(ptr)
}

func (v Value) Dup() Value {
	if v.AutoRelease == true {
		return Value{ctx: v.ctx, c: v.ctx.DupValue(v.c)}.AutoFree()
	}

	return Value{ctx: v.ctx, c: v.ctx.DupValue(v.c)}
}

func (val Value) Free() {
	if val.AutoRelease == true {
		_, ok := val.ctx.values[val.id]
		if ok {
			delete(val.ctx.values, val.id)
			val.ctx.FreeValue(val.c)
		}
	} else {
		val.ctx.FreeValue(val.c)
	}
}

func (v Value) Error() error {
	if !v.IsError() {
		return nil
	}
	cause := v.String()

	stack := v.GetValue("stack")
	defer stack.Free()

	if stack.IsUndefined() {
		return &Error{Cause: cause}
	}
	return &Error{Cause: cause, Stack: stack.String()}
}

func (v Value) IsNumber() bool        { return C.JS_IsNumber(v.c) == 1 }
func (v Value) IsBigInt() bool        { return C.JS_IsBigInt(v.ctx.c, v.c) == 1 }
func (v Value) IsBigFloat() bool      { return C.JS_IsBigFloat(v.c) == 1 }
func (v Value) IsBigDecimal() bool    { return C.JS_IsBigDecimal(v.c) == 1 }
func (v Value) IsBool() bool          { return C.JS_IsBool(v.c) == 1 }
func (v Value) IsNull() bool          { return C.JS_IsNull(v.c) == 1 }
func (v Value) IsUndefined() bool     { return C.JS_IsUndefined(v.c) == 1 }
func (v Value) IsException() bool     { return C.JS_IsException(v.c) == 1 }
func (v Value) IsUninitialized() bool { return C.JS_IsUninitialized(v.c) == 1 }
func (v Value) IsString() bool        { return C.JS_IsString(v.c) == 1 }
func (v Value) IsSymbol() bool        { return C.JS_IsSymbol(v.c) == 1 }
func (v Value) IsObject() bool        { return C.JS_IsObject(v.c) == 1 }
func (v Value) IsArray() bool         { return C.JS_IsArray(v.ctx.c, v.c) == 1 }
func (v Value) IsError() bool         { return C.JS_IsError(v.ctx.c, v.c) == 1 }
func (v Value) IsFunction() bool      { return C.JS_IsFunction(v.ctx.c, v.c) == 1 }
func (v Value) IsConstructor() bool   { return C.JS_IsConstructor(v.ctx.c, v.c) == 1 }
