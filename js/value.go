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
	isFree      bool
	id          string
	ctx         *Context
	c           C.JSValue
}

var num1 = 0

func int64FromValue(value interface{}) int64 {
	switch v := value.(type) {
	case int:
		return int64(v)
	case int8:
		return int64(v)
	case int16:
		return int64(v)
	case int32:
		return int64(v)
	case int64:
		return v
	case uint:
		return int64(v)
	case uint8:
		return int64(v)
	case uint16:
		return int64(v)
	case uint32:
		return int64(v)
	case uint64:
		if v > uint64(^uint64(0)>>1) {
			return int64(^uint64(0) >> 1)
		}
		return int64(v)
	case float32:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return 0
	}
}

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
	ctx.Lock()
	num1 = num1 + 1
	id := strconv.Itoa(num1)
	val = Value{ctx: val.ctx, c: val.c, AutoRelease: true, id: id}
	ctx.values[id] = val
	ctx.Unlock()
	return val
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

func (fn Value) SafeCall(args ...interface{}) interface{} {
	var a Arguments
	i := len(args)

	ctx := fn.ctx

	if i == 1 {
		if argType, ok := args[0].(Arguments); ok {
			a = argType.Dup()
		} else {
			a = fn.ctx.NewArguments(args[0])
		}
	} else if i > 1 {
		a = ctx.NewArguments(args...)
	} else {
		a = ctx.NewArguments(nil)
	}

	defer a.Free()
	cArgs := (*C.JSValueConst)(unsafe.Pointer(&a.argv[0]))
	ret := C.JS_Call(ctx.c, fn.c, a.This.c, C.int(len(a.argv)), cArgs)
	defer ctx.FreeValue(ret)

	var goRet = ctx.JsToGoValue(ret)
	return goRet
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

func (v Value) JsCall(args Value) Value {
	if !v.IsFunction() {
		panic("only works on function value")
	}

	ctx := v.ctx
	fn := v.c
	cArgs := (*C.JSValueConst)(unsafe.Pointer(&args.c))
	ret := C.JS_Call(ctx.c, fn, args.c, C.int(1), cArgs)
	return ctx.Value(ret)
}

func (v Value) ToGo() any {
	ctx := v.ctx
	return ctx.JsToGoValue(v)
}

func (v Value) Set(name string, value interface{}) Value {
	ctx := v.ctx
	obj := v.c

	namePtr := C.CString(name)
	defer C.free(unsafe.Pointer(namePtr))

	jsVal := ctx.goToJSValue(value)
	C.JS_SetPropertyStr(ctx.c, obj, namePtr, jsVal)
	return ctx.Value(jsVal)
}

func (v Value) SetInt(i uint, value interface{}) Value {
	ctx := v.ctx
	arr := v.c

	jsVal := ctx.goToJSValue(value)
	C.JS_SetPropertyUint32(ctx.c, arr, C.uint32_t(i), jsVal)
	return ctx.Value(jsVal)
}

func (v Value) Push(value interface{}) Value {
	ctx := v.ctx
	arr := v.c

	len := v.Get("length").(int64)
	jsVal := ctx.goToJSValue(value)
	C.JS_SetPropertyUint32(ctx.c, arr, C.uint32_t(uint(len)), jsVal)
	return ctx.Value(jsVal)
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

func (val Value) GetBuffer() ([]byte, error) {
	if val.IsObject() {
		buf, ok := val.Get("buffer").([]byte)
		if !ok {
			buf, isBuf := val.ToGo().([]byte)
			if !isBuf {
				return nil, &Error{Cause: "not a buffer"}
			}

			return buf, nil
		}

		return buf, nil
	}

	return nil, &Error{Cause: "not a buffer"}
}

func (val Value) GetSafeBuffer() ([]byte, error) {
	buf, err := val.GetBuffer()

	if buf != nil {
		s := make([]byte, len(buf))
		copy(s, buf)
		return s, err
	}

	return buf, err
}

// GetTypedArray gets a TypedArray (Uint8Array, etc.) respecting its view bounds
// Unlike GetBuffer, this returns only the bytes the TypedArray view represents,
// not the entire underlying ArrayBuffer
func (val Value) GetTypedArray() ([]byte, error) {
	if !val.IsObject() {
		return nil, &Error{Cause: "not a typed array"}
	}

	rawBuf, ok := val.Get("buffer").([]byte)
	if !ok {
		// Fallback: attempt to convert the typed array itself directly into a []byte
		fallback, isBuf := val.ToGo().([]byte)
		if !isBuf {
			return nil, &Error{Cause: "not a typed array"}
		}
		rawBuf = fallback
	}

	if len(rawBuf) == 0 {
		return []byte{}, nil
	}

	byteOffset := int64FromValue(val.Get("byteOffset"))

	if byteOffset < 0 {
		byteOffset = 0
	}
	if byteOffset > int64(len(rawBuf)) {
		byteOffset = int64(len(rawBuf))
	}

	byteLength := int64FromValue(val.Get("byteLength"))

	if byteLength <= 0 {
		lengthElems := int64FromValue(val.Get("length"))
		if lengthElems > 0 {
			bytesPerElem := int64FromValue(val.Get("BYTES_PER_ELEMENT"))
			if bytesPerElem <= 0 {
				bytesPerElem = 1
			}
			byteLength = lengthElems * bytesPerElem
		}
	}

	if byteLength <= 0 || byteOffset+byteLength > int64(len(rawBuf)) {
		byteLength = int64(len(rawBuf)) - byteOffset
	}

	if byteLength <= 0 {
		return []byte{}, nil
	}

	start := int(byteOffset)
	end := start + int(byteLength)
	if end > len(rawBuf) {
		end = len(rawBuf)
	}

	view := rawBuf[start:end]
	result := make([]byte, len(view))
	copy(result, view)
	return result, nil
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

func (v Value) SetConstructor(name string, fn func(args Arguments) interface{}) *Function {
	ctx := v.ctx
	val := ctx.Function(fn)
	v.Set(name, val)

	args := ctx.NewArguments(v, name, val)
	constructor := ctx.EvalFunction("<constructor>", `(obj, name, fn) => {
		const _old = obj[name];
		obj[name] = function (...init) {
			const _this = this;
			Object.assign(_this, _old(...init));
			return _this;
		}
	}`)

	defer constructor.Free()
	constructor.Call(args)
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

func (val Value) Free() Value {
	if val.isFree {
		return val
	}

	val.isFree = true
	if val.AutoRelease == true {
		_, ok := val.ctx.values[val.id]
		if ok {
			delete(val.ctx.values, val.id)
			val.ctx.FreeValue(val.c)
		}
	} else {
		val.ctx.FreeValue(val.c)
	}

	return val
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

func (v Value) IsPromise() bool {
	state := C.JS_PromiseState(v.ctx.c, v.c)
	pending := C.GetPromisePending()
	fulfilled := C.GetPromiseFulfilled()
	rejected := C.GetPromiseRejected()

	return C.int(state) == pending || C.int(state) == fulfilled || C.int(state) == rejected
}

func (v Value) IsNumber() bool        { return C.JS_IsNumber(v.c) == 1 }
func (v Value) IsBigInt() bool        { return C.JS_IsBigInt(v.ctx.c, v.c) == 1 }
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
