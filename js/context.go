package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	"embed"
	"errors"
	"fmt"
	"log"
	"os"
	"runtime"
	"sync"
	"time"
	"unsafe"

	"github.com/mattn/go-pointer"
)

// Context is the interface that describes javascript context.
type Context struct {
	// js main context
	rt           *C.JSRuntime
	c            *C.JSContext
	wg           *sync.WaitGroup
	mutex        *sync.Mutex
	isTerminated bool

	// modules
	modules map[string]Module

	//values
	values map[string]Value

	// this will hold already processed modules as externals
	// if esbuild handled a file
	externals []string

	// functions list to be called when the context is terminated
	onExit []func()

	// pass embed.FS to js ctx
	// if Embed is set then module resolution will be searched
	// from the embedded embed.FS
	// this will enable you to build a stand alone executable
	//
	// ex:
	//  //go:embed src/*
	//  var src embed.FS
	//  ctx.Embed = &src
	Embed *embed.FS

	// InitWorkerContext called when a new worker created
	// this will enable you initiate go modules on workers separately
	//
	// ex:
	//  ctx.InitWorkerContext = func(workerCtx *js.Context, filename string) {
	//     initModels(threadCtx)
	//  }
	InitWorkerContext func(ctx *Context, filename string)

	// Channel: go -> js communication channel
	// used to send go values to js context, interface{}
	// will be converted to js values
	// interface{} also can hold a function that executed
	// on js main thread
	Channel chan interface{}

	// promise holds js promise class, that will be used to
	// manage creating promises in go land
	promise C.JSValue

	// asyncIterator holds asyncIterator promise class, that will be used to
	// manage creating asyncIterator in go land
	asyncIterator C.JSValue
	proxy         C.JSValue

	StackFormatter func(string) string

	// internal refs count, javascript loop exit
	// if this refs count == 0
	refs uint64
}

// convert js values to their go equivalent
func (ctx *Context) JsToGoValue(value interface{}) interface{} {
	var v C.JSValue
	switch valueType := value.(type) {
	case Value:
		v = valueType.c
	case C.JSValue:
		v = valueType
	default:
		return value
	}

	if C.JS_IsBool(v) == 1 {
		if C.como_get_val_int(v) == 1 {
			return true
		}
		return false
	}

	valueTag := C.como_js_type(v)

	if valueTag == C.JS_TAG_FLOAT64 {
		val := C.double(0)
		C.JS_ToFloat64(ctx.c, &val, v)
		return float64(val)
	}

	if valueTag == C.JS_TAG_INT {
		val := C.int64_t(0)
		C.JS_ToInt64(ctx.c, &val, v)
		return int64(val)
	}

	if valueTag == C.JS_TAG_STRING {
		ptr := C.JS_ToCString(ctx.c, v)
		defer C.JS_FreeCString(ctx.c, ptr)
		return C.GoString(ptr)
	}

	if valueTag == C.JS_TAG_NULL {
		return nil
	}

	if valueTag == C.JS_TAG_EXCEPTION {
		// fall through
	} else if valueTag == C.JS_TAG_OBJECT {
		len := C.size_t(0)
		buf := C.JS_GetArrayBuffer(ctx.c, &len, v)
		if buf != nil {
			// b := unsafe.Slice(buf, len)
			b := (*[1 << 30]byte)(unsafe.Pointer(buf))[:len:len]
			var s = make([]byte, len)
			copy(s, b)
			return s
		}
		if C.JS_IsFunction(ctx.c, v) == 1 {
			return ctx.JsFunction(v)
		} else if C.JS_IsArray(ctx.c, v) == 1 {
			arr := Value{ctx: ctx, c: v}
			len := arr.Length()
			var values = make([]interface{}, len)

			for i := 0; i < int(len); i++ {
				val := C.JS_GetPropertyUint32(ctx.c, arr.c, C.uint32_t(uint(i)))
				ret := ctx.JsToGoValue(val)

				values[i] = ret
				if _, ok := ret.(Value); !ok {
					defer ctx.FreeValue(val)
				}
			}

			return values
		} else {
			len := C.uint32_t(0)
			var tab *C.JSPropertyEnum
			if C.JS_GetOwnPropertyNames(ctx.c, &tab, &len, v, C.JS_GPN_STRING_MASK|C.JS_GPN_ENUM_ONLY) >= 0 {
				tab := (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[:len:len]
				var values = make(map[string]interface{}, len)

				for i := 0; i < int(len); i++ {
					keyPtr := C.JS_AtomToCString(ctx.c, tab[i].atom)
					defer C.JS_FreeCString(ctx.c, keyPtr)

					key := C.GoString(keyPtr)
					val := C.JS_GetProperty(ctx.c, v, tab[i].atom)

					ret := ctx.JsToGoValue(val)
					values[key] = ret
					if _, ok := ret.(Value); !ok {
						defer ctx.FreeValue(val)
					}
				}
				return values
			}
		}
	}

	// if valueTag == JS_TAG_BIG_INT {
	// 	val := C.int64_t(0)
	// 	C.JS_ToInt64(ctx, &val, value)
	// 	return int64(val)
	// }

	// if valueTag == C.JS_CLASS_ARRAY_BUFFER {
	// 	ptr := C.JS_ToCString(ctx, value)
	// 	defer C.JS_FreeCString(ctx, ptr)
	// 	return C.GoString(ptr)
	// }

	js, ok := value.(C.JSValue)
	if ok {
		return Value{ctx: ctx, c: js}
	}

	return value
}

func (ctx *Context) goToJSValue(value interface{}) C.JSValue {
	jsValue := ctx.GoToJSValue(value)
	return jsValue.c
}

// convert go values to their js equivalent
func (ctx *Context) GoToJSValue(value interface{}) Value {
	var jsValue C.JSValue

	fn, ok := value.(func() interface{})
	if ok {
		value = fn()
	}

	switch val := value.(type) {
	case Value:
		return val
	case C.JSValue:
		jsValue = val
	case Promise:
		return val.Promise
	case asyncIterator:
		return val.iterator
	case proxy:
		return val.proxy
	case Function:
		val.Dup()
		jsValue = val.c
	case *Function:
		jsValue = val.c
	case Arguments:
		jsValue = *(*C.JSValueConst)(unsafe.Pointer(&val.argv[0]))
	case func(args Arguments) interface{}:
		jsValue = ctx.Function(val).c
	case bool:
		if val == true {
			jsValue = C.JS_True()
		} else {
			jsValue = C.JS_False()
		}
	case []byte:
		if len(val) == 0 {
			jsValue = C.JS_NewNull()
		} else {
			s := unsafe.Pointer(&val[0])
			b := (*C.uchar)(s)
			jsValue = C.JS_NewArrayBufferCopy(ctx.c, b, C.size_t(len(val)))
		}
	case int:
		jsValue = C.JS_NewInt32(ctx.c, C.int32_t(val))
	case int32:
		jsValue = C.JS_NewInt32(ctx.c, C.int32_t(val))
	case uint32:
		jsValue = C.JS_NewUint32(ctx.c, C.uint32_t(val))
	case int64:
		jsValue = C.JS_NewInt64(ctx.c, C.int64_t(val))
	case uint64:
		jsValue = C.JS_NewBigUint64(ctx.c, C.uint64_t(val))
	case string:
		ptr := C.CString(val)
		defer C.free(unsafe.Pointer(ptr))
		jsValue = C.JS_NewString(ctx.c, ptr)
	case nil:
		jsValue = C.JS_NewNull()
	case time.Time:
		time := val.UnixNano() / int64(time.Millisecond)
		jsValue = C.JS_NewInt64(ctx.c, C.int64_t(time))
	case map[string]interface{}:
		o := ctx.Object()
		for k, v := range val {
			o.Set(k, v)
		}
		return o
	case []interface{}:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case []string:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case []int:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case float64:
		jsValue = C.JS_NewFloat64(ctx.c, C.double(val))
	default:
		log.Fatalf("I don't know about type %T!\n", value)
	}

	return ctx.Value(jsValue)
}

func (ctx *Context) Null() Value {
	return Value{ctx: ctx, c: C.JS_NewNull()}
}

func (ctx *Context) Undefined() Value {
	return Value{ctx: ctx, c: C.JS_NewUndefined()}
}

func (ctx *Context) Exception() error {
	val := Value{ctx: ctx, c: C.JS_GetException(ctx.c)}
	defer val.Free()
	return val.Error()
}

// String creates a js string
// returns a js.Value
func (ctx *Context) String(v string) Value {
	ptr := C.CString(v)
	defer C.free(unsafe.Pointer(ptr))
	return Value{ctx: ctx, c: C.JS_NewString(ctx.c, ptr)}
}

func (ctx *Context) EvalFile(filename string, code string) (Value, error) {
	codePtr := C.CString(code)
	defer C.free(unsafe.Pointer(codePtr))

	filenamePtr := C.CString(filename)
	defer C.free(unsafe.Pointer(filenamePtr))

	val := C.JS_Eval(ctx.c, codePtr, C.size_t(len(code)), filenamePtr, C.int(C.JS_EVAL_TYPE_MODULE))
	defer ctx.FreeValue(val)

	if val.IsException() {
		defer ctx.FreeValue(val)
		C.js_std_dump_error(ctx.c)
		return Value{c: val, ctx: ctx}, ctx.Exception()
	}

	return Value{c: val, ctx: ctx}, nil
}

func (ctx *Context) EvalBinary(code []byte) {
	// cCode := (*C.uint8_t)(unsafe.Pointer(&code[0]))
	// C.js_std_eval_binary(ctx.c, cCode, C.size_t(len(code)), 1)
	ctx.Eval(string(code))
	// fmt.Println(len(code), cCode)
	// return Value{c: val, ctx: ctx}, nil
}

func (ctx *Context) EvalFunction(filename string, code string) Value {
	codePtr := C.CString(code)
	defer C.free(unsafe.Pointer(codePtr))

	filenamePtr := C.CString(filename)
	defer C.free(unsafe.Pointer(filenamePtr))

	val := C.JS_Eval(ctx.c, codePtr, C.size_t(len(code)), filenamePtr, C.int(C.JS_EVAL_FLAG_COMPILE_ONLY))

	if val.IsException() {
		defer C.JS_FreeValue(ctx.c, val)
		ctx.ThrowStackError()
	}

	return Value{c: C.JS_EvalFunction(ctx.c, val), ctx: ctx}
}

func (ctx *Context) Eval(code string) (Value, error) {
	return ctx.EvalFile("<eval>", code)
}

// GlobalObject returns javascript globalThis object
// returns js Value
func (ctx *Context) GlobalObject() Value {
	val := C.JS_GetGlobalObject(ctx.c)
	return Value{c: val, ctx: ctx}
}

// Object creates a new javascript object
// returns js Value
func (ctx *Context) Object() Value {
	val := C.JS_NewObject(ctx.c)
	return ctx.Value(val)
}

// Array creates a new javascript array
// returns js Value
func (ctx *Context) Array() Value {
	val := C.JS_NewArray(ctx.c)
	return Value{c: val, ctx: ctx}
}

// Dup dups js main context
func (ctx *Context) Dup() *Context {
	return &Context{c: C.JS_DupContext(ctx.c)}
}

// DupValue dups c js value
// returns C.JSValue
func (ctx *Context) DupValue(v C.JSValue) C.JSValue {
	return C.JS_DupValue(ctx.c, v)
}

// FreeValue frees c js value
func (ctx *Context) FreeValue(v C.JSValue) {
	C.JS_FreeValue(ctx.c, v)
}

// Ref ref js loop by 1
// js run loop will exist when ctx.refs == 0
func (ctx *Context) Ref() {
	ctx.mutex.Lock()
	ctx.refs = ctx.refs + 1
	ctx.mutex.Unlock()
}

// UnRef unrefs js loop by 1
// panic if refs <= 0
func (ctx *Context) UnRef() {
	ctx.mutex.Lock()
	if ctx.refs <= 0 {
		panic("refs <= 0")
	}
	ctx.refs = ctx.refs - 1
	ctx.mutex.Unlock()
}

// Terminate terminates js loop unconditionally
// this will reset refs to 0 and exit
// it will not run runtime Free checks
func (ctx *Context) Terminate() {
	ctx.mutex.Lock()
	ctx.isTerminated = true
	ctx.refs = 0
	ctx.mutex.Unlock()
}

func (ctx *Context) Go(callback func() func()) {
	ctx.Ref()
	go func() {
		js := callback()
		ctx.Channel <- func() {
			defer ctx.UnRef()
			js()
		}
	}()
}

// runPendingJobs run async pending jobs
func (ctx *Context) runPendingJobs() uint64 {
	C.como_js_loop(ctx.c)
	return ctx.refs
}

// WaitCall wait js execution until func is resolved
func (ctx *Context) WaitCall(fn func()) *sync.WaitGroup {
	var wg sync.WaitGroup
	wg.Add(1)
	ctx.Ref()
	go func() {
		ctx.Channel <- func() {
			fn()
			defer ctx.UnRef()
			defer wg.Done()
		}
	}()
	return &wg
}

// Suspense suspend js until unsuspense callback is called
// this is an extreme blocking method and should be used in rare cases
func (ctx *Context) Suspense(fn Value) {
	ctx.runPendingJobs()
	i := 1

	unsuspence := ctx.Function(func(args Arguments) interface{} {
		i = 0
		return nil
	})

	args := ctx.NewArguments(unsuspence)
	defer args.Free()

	if fn.IsFunction() {
		fn.CallArgs(args)
	}

	ctx.runPendingJobs()

	for i == 1 {
		pending := <-ctx.Channel
		switch val := pending.(type) {
		case func():
			val()
		}

		ctx.runPendingJobs()
	}
}

// Loop runs js loop, this should be called after creating
// js context
func (ctx *Context) Loop() {
	refs := ctx.runPendingJobs()

	for refs > 0 {
		pending := <-ctx.Channel
		switch val := pending.(type) {
		case func():
			val()
		case *RPC:
			ret := val.fn.Call(val.args)
			val.in <- ret
		}

		refs = ctx.runPendingJobs()
	}
}

func (ctx *Context) Free() {
	for _, cb := range ctx.onExit {
		cb()
	}

	for _, value := range ctx.values {
		value.Free()
	}

	pointer.Unref(C.JS_GetContextOpaque(ctx.c))

	ctx.DeleteModulesList()
	ctx.FreeValue(ctx.asyncIterator)
	ctx.FreeValue(ctx.promise)
	ctx.FreeValue(ctx.proxy)
	C.JS_FreeContext(ctx.c)

	defer ctx.rt.Free()
	// fmt.Println("TO DO! the free below should be enabled")
	runtime.GC()
}

func (ctx *Context) Error(v interface{}) Value {
	err := Value{ctx: ctx, c: C.JS_NewError(ctx.c)}
	err.Set("message", v)
	return err
}

func (ctx *Context) Throw(v interface{}) Value {
	err := Value{ctx: ctx, c: C.JS_NewError(ctx.c)}
	stack := err.GetValue("stack")
	err.Set("message", v)
	defer stack.Free()
	return Value{ctx: ctx, c: C.JS_Throw(ctx.c, err.c)}
}

func (ctx *Context) Throw2(v interface{}) {
	// err := Value{ctx: ctx, c: C.JS_NewError(ctx.c)}
	// stack := err.GetValue("stack")
	// err.Set("message", v)
	// defer stack.Free()
	// ctx.ThrowStackError()
	fn := ctx.EvalFunction("<native>", `(msg) => {
		throw new Error(msg)
	}`)

	defer fn.Free()
	fn.Call(v)
}

func (ctx *Context) CheckError(err error) {
	if err != nil {
		var evalErr *Error
		if errors.As(err, &evalErr) {
			fmt.Println(evalErr.Cause)
			fmt.Println(evalErr.Stack)
		}
		fmt.Println(fmt.Sprintf("%v", err))
		os.Exit(2)
	}
}

func (ctx *Context) Wait() {
	ctx.wg.Wait()
}

func (ctx *Context) OnExit(cb func()) {
	ctx.onExit = append(ctx.onExit, cb)
}
