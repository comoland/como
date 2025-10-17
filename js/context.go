package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"math"
	"os"
	"path/filepath"
	"runtime"
	s "strings"
	"sync"
	"time"
	"unsafe"

	"github.com/mattn/go-pointer"
)

type MapValue struct {
	Path string
	FS   fs.FS
}

// Context is the interface that describes javascript context.
type Context struct {
	// js main context
	rt           *C.JSRuntime
	runtime      *JSRunTime
	c            *C.JSContext
	wg           *sync.WaitGroup
	mutex        *sync.Mutex
	isTerminated bool

	// modules
	modules map[string]*Module

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
	Embed      *embed.FS
	FSEmbedder *Embedder

	NodeModulesLib fs.FS
	CoreModules    map[string]struct {
		Path string
		FS   *embed.FS
	}

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

type Embedder struct {
	// js main context
	ctx *Context

	// pass embed.FS to js ctx
	// if Embed is set then module resolution will be searched
	// from the embedded embed.FS
	// this will enable you to build a stand alone executable
	//
	// ex:
	//  //go:embed src/*
	//  var src embed.FS
	//  ctx.Embed = &src
	Embed      *embed.FS
	modulesLib string
}

func (ctx *Context) SetNodeModulesLib(value string) {
	if ctx.Embed != nil {
		f, err := fs.Sub(ctx.Embed, value)
		if err != nil {
			ctx.NodeModulesLib = f
		}
	}
}

func (ctx *Context) Embedder(f embed.FS) *Embedder {
	ctx.Embed = &f
	em := &Embedder{
		ctx:        ctx,
		Embed:      &f,
		modulesLib: "",
	}

	ctx.FSEmbedder = em
	return em
}

func (em *Embedder) ReadFile(filename string) ([]byte, error) {
	if em.ctx.Embed == nil {
		return nil, fmt.Errorf("embed is not enabled")
	}

	rel, _ := os.Getwd()
	newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
	return em.Embed.ReadFile(newFile)
}

func (em *Embedder) SetModulesLib(path string) {
	ctx := em.ctx
	if ctx.Embed == nil {
		return
	}

	dirFS, err := fs.Sub(ctx.Embed, path)
	if err == nil {
		f, err2 := dirFS.Open(".")
		if err2 == nil {
			em.modulesLib = path
			defer f.Close()
		}
	}
}

func (em *Embedder) hasModulesLib() bool {
	if em.modulesLib != "" {
		return true
	}

	return false
}

func (em *Embedder) tryToWriteBundleToModulesLib(filename string, code []byte) {
	if em.hasModulesLib() {
		rel, _ := os.Getwd()
		newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
		dir := filepath.Dir(newFile)
		// 2. Create the directory (and any necessary parent directories)
		moduleBasePath := s.Join([]string{"./", em.modulesLib, "/"}, "")
		err := os.MkdirAll(moduleBasePath+dir, 0755)
		if err != nil {
			fmt.Printf("Error creating directory: %s = %v\n", "./public/"+dir, err)
		}

		err = os.WriteFile(s.Join([]string{moduleBasePath, newFile, ".js"}, ""), code, 0644)
		if err != nil {
			fmt.Printf("Error creating file: %s = %v\n", filename, err)
		}
	}
}

func (em *Embedder) ReadJsFile(filename string) ([]byte, error) {
	if em.ctx.Embed == nil {
		return nil, fmt.Errorf("embed is not enabled")
	}

	rel, _ := os.Getwd()
	newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
	c, err := em.ctx.Embed.ReadFile(newFile)

	// try to Read from embedded lib\
	if (err != nil || s.Contains(filename, "mod.ts")) && em.hasModulesLib() {
		c, err = em.ctx.Embed.ReadFile(em.modulesLib + "/" + newFile + ".js")
	}

	return c, err
}

func (ctx *Context) GetOwnPropertyNames(v C.JSValue) (map[string]interface{}, error) {
	var len C.uint32_t
	var tab *C.JSPropertyEnum
	if C.JS_GetOwnPropertyNames(ctx.c, &tab, &len, v, C.JS_GPN_STRING_MASK|C.JS_GPN_ENUM_ONLY) < 0 {
		return nil, fmt.Errorf("failed to get property names")
	}
	// Ensure tab and its atoms are freed when done
	defer func() {
		if tab != nil {
			for i := 0; i < int(len); i++ {
				C.JS_FreeAtom(ctx.c, (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[i].atom)
			}
			C.js_free(ctx.c, unsafe.Pointer(tab))
		}
	}()

	values := make(map[string]interface{}, len)
	for i := 0; i < int(len); i++ {
		prop := (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[i]

		// Convert atom to C string
		keyPtr := C.JS_AtomToCString(ctx.c, prop.atom)
		if keyPtr == nil {
			return nil, fmt.Errorf("failed to convert atom to string at index %d", i)
		}
		key := C.GoString(keyPtr)
		C.JS_FreeCString(ctx.c, keyPtr)

		// Get the property value
		val := C.JS_GetProperty(ctx.c, v, prop.atom)
		// if C.JS_IsException(val) {
		//     return nil, fmt.Errorf("exception occurred while getting property at index %d", i)
		// }

		ret := ctx.JsToGoValue(val)
		values[key] = ret

		// Free the JSValue if not managed by JsToGoValue
		if _, ok := ret.(Value); !ok {
			C.JS_FreeValue(ctx.c, val)
		}
	}

	return values, nil
}

func (ctx *Context) JsToGoValue2(value interface{}) (interface{}, error) {
	var v C.JSValue
	switch valueType := value.(type) {
	case Value:
		v = valueType.c
	case C.JSValue:
		v = valueType
	default:
		return value, nil
	}

	// Check for exceptions early
	if C.JS_IsException(v) == 1 {
		C.JS_FreeValue(ctx.c, v)
		return nil, fmt.Errorf("JSValue is an exception")
	}

	if C.JS_IsBool(v) == 1 {
		return C.como_get_val_int(v) == 1, nil
	}

	valueTag := C.como_js_type(v)

	if valueTag == C.JS_TAG_FLOAT64 {
		var val C.double
		if err := C.JS_ToFloat64(ctx.c, &val, v); err != 0 {
			C.JS_FreeValue(ctx.c, v)
			return nil, fmt.Errorf("failed to convert to float64")
		}
		return float64(val), nil
	}

	if valueTag == C.JS_TAG_INT {
		var val C.int64_t
		if err := C.JS_ToInt64(ctx.c, &val, v); err != 0 {
			C.JS_FreeValue(ctx.c, v)
			return nil, fmt.Errorf("failed to convert to int64")
		}
		return int64(val), nil
	}

	if valueTag == C.JS_TAG_STRING {
		ptr := C.JS_ToCString(ctx.c, v)
		if ptr == nil {
			C.JS_FreeValue(ctx.c, v)
			return nil, fmt.Errorf("failed to convert string")
		}
		s := C.GoString(ptr)
		C.JS_FreeCString(ctx.c, ptr)
		return s, nil
	}

	if valueTag == C.JS_TAG_NULL {
		return nil, nil
	}

	if valueTag == C.JS_TAG_OBJECT {
		len := C.size_t(0)
		buf := C.JS_GetArrayBuffer(ctx.c, &len, v)
		if buf != nil {
			if len > 1<<30 {
				C.JS_FreeValue(ctx.c, v)
				return nil, fmt.Errorf("ArrayBuffer length exceeds maximum safe size")
			}
			b := (*[1 << 30]byte)(unsafe.Pointer(buf))[:len:len]
			s := make([]byte, len)
			copy(s, b)
			return s, nil
		}

		if C.JS_IsFunction(ctx.c, v) == 1 {
			return ctx.JsFunction(v), nil
		}

		if C.JS_IsArray(ctx.c, v) == 1 {
			arr := Value{ctx: ctx, c: v}
			len := arr.Length()
			if len > 1<<30 {
				C.JS_FreeValue(ctx.c, v)
				return nil, fmt.Errorf("array length exceeds maximum safe size")
			}
			values := make([]interface{}, len)

			for i := 0; i < int(len); i++ {
				val := C.JS_GetPropertyUint32(ctx.c, arr.c, C.uint32_t(i))
				if C.JS_IsException(val) == 1 {
					C.JS_FreeValue(ctx.c, val)
					C.JS_FreeValue(ctx.c, v)
					return nil, fmt.Errorf("exception getting array element at index %d", i)
				}
				ret, err := ctx.JsToGoValue2(val)
				C.JS_FreeValue(ctx.c, val) // Always free val, assuming JsToGoValue duplicates if needed
				if err != nil {
					C.JS_FreeValue(ctx.c, v)
					return nil, fmt.Errorf("failed to convert array element at index %d: %w", i, err)
				}
				values[i] = ret
			}
			return values, nil
		}

		var propLen C.uint32_t
		var tab *C.JSPropertyEnum
		if C.JS_GetOwnPropertyNames(ctx.c, &tab, &propLen, v, C.JS_GPN_STRING_MASK|C.JS_GPN_ENUM_ONLY) < 0 {
			C.JS_FreeValue(ctx.c, v)
			return nil, fmt.Errorf("failed to get object property names")
		}
		defer func() {
			if tab != nil {
				for i := 0; i < int(propLen); i++ {
					C.JS_FreeAtom(ctx.c, (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[i].atom)
				}
				C.js_free(ctx.c, unsafe.Pointer(tab))
			}
		}()

		if propLen > 1<<30 {
			C.JS_FreeValue(ctx.c, v)
			return nil, fmt.Errorf("property enum length exceeds maximum safe size")
		}
		values := make(map[string]interface{}, propLen)

		for i := 0; i < int(propLen); i++ {
			prop := (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[i]
			keyPtr := C.JS_AtomToCString(ctx.c, prop.atom)
			if keyPtr == nil {
				C.JS_FreeValue(ctx.c, v)
				return nil, fmt.Errorf("failed to convert property name at index %d", i)
			}
			key := C.GoString(keyPtr)
			C.JS_FreeCString(ctx.c, keyPtr)

			val := C.JS_GetProperty(ctx.c, v, prop.atom)
			if C.JS_IsException(val) == 1 {
				C.JS_FreeValue(ctx.c, val)
				C.JS_FreeValue(ctx.c, v)
				return nil, fmt.Errorf("exception getting property %s", key)
			}
			ret, err := ctx.JsToGoValue2(val)
			C.JS_FreeValue(ctx.c, val) // Always free val, assuming JsToGoValue duplicates if needed
			if err != nil {
				C.JS_FreeValue(ctx.c, v)
				return nil, fmt.Errorf("failed to convert property %s: %w", key, err)
			}
			values[key] = ret
		}

		return values, nil
	}

	// Fallback: treat as Value if it's a JSValue
	js, ok := value.(C.JSValue)
	if ok {
		return Value{ctx: ctx, c: js}, nil
	}

	return value, nil
}

// convert js values to their go equivalent
func (ctx *Context) JsToGoValue(value interface{}) interface{} {
	// v2, e2 := ctx.JsToGoValue2(value)

	// if e2 != nil {
	// 	panic(e2.Error())

	// }

	// return v2

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

	if C.JS_IsString(v) == 1 {
		ptr := C.JS_ToCString(ctx.c, v)
		defer C.JS_FreeCString(ctx.c, ptr)
		return C.GoString(ptr)
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

	// if C.JS_IsBigInt(ctx.c, v) == 1 {
	// 	val := C.uint64_t(0)
	// 	C.Js(ctx.c, &val, v)
	// }

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
			// var s = make([]byte, len)
			// copy(s, b)
			return b
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
				var values = make(map[string]interface{}, len)

				defer func() {
					if tab != nil {
						for i := 0; i < int(len); i++ {
							C.JS_FreeAtom(ctx.c, (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[i].atom)
						}
						C.js_free(ctx.c, unsafe.Pointer(tab))
					}
				}()

				for i := 0; i < int(len); i++ {
					prop := (*[1 << 30]C.JSPropertyEnum)(unsafe.Pointer(tab))[i]
					keyPtr := C.JS_AtomToCString(ctx.c, prop.atom)
					defer C.JS_FreeCString(ctx.c, keyPtr)

					key := C.GoString(keyPtr)
					val := C.JS_GetProperty(ctx.c, v, prop.atom)

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
	case *Value:
		return *val
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
		if val > math.MaxInt32 || val < math.MinInt32 {
			jsValue = C.JS_NewInt64(ctx.c, C.int64_t(val))
		} else {
			jsValue = C.JS_NewInt32(ctx.c, C.int32_t(val))
		}
	case int8:
		jsValue = C.JS_NewInt32(ctx.c, C.int32_t(val))
	case int16:
		jsValue = C.JS_NewInt32(ctx.c, C.int32_t(val))
	case int32:
		jsValue = C.JS_NewInt32(ctx.c, C.int32_t(val))
	case int64:
		jsValue = C.JS_NewInt64(ctx.c, C.int64_t(val))
	case uint8:
		jsValue = C.JS_NewUint32(ctx.c, C.uint32_t(val))
	case uint16:
		jsValue = C.JS_NewUint32(ctx.c, C.uint32_t(val))
	case uint32:
		jsValue = C.JS_NewUint32(ctx.c, C.uint32_t(val))
	case uint64:
		if val <= 0xFFFFFFFF {
			jsValue = C.JS_NewUint32(ctx.c, C.uint32_t(val))
		} else {
			jsValue = C.JS_NewBigUint64(ctx.c, C.uint64_t(val))
		}
	case float32:
		jsValue = C.JS_NewFloat64(ctx.c, C.double(val))
	case float64:
		jsValue = C.JS_NewFloat64(ctx.c, C.double(val))
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
	case []string:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case [][]string:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), ctx.GoToJSValue(v))
		}
		return a
	case []map[string]interface{}:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), ctx.GoToJSValue(v))
		}
		return a
	case []int:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case []uint64:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case []interface{}:
		a := ctx.Array()
		for i, v := range val {
			a.SetInt(uint(i), v)
		}
		return a
	case *interface{}:
		return ctx.GoToJSValue(*val)
	default:
		var payload = map[string]interface{}{}
		payload["_safe"] = val
		str, err := ctx.ToSafeJSONString(payload)
		if err != nil {
			log.Fatalf("I don't know about type %T!\n", value)
		}

		vjs := ctx.ParseJSON(str)
		defer vjs.Free()
		return vjs.GetValue("_safe")

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

func (ctx *Context) eval(filename string, code string, evalType int) (Value, error) {
	codePtr := C.CString(code)
	defer C.free(unsafe.Pointer(codePtr))

	filenamePtr := C.CString(filename)
	defer C.free(unsafe.Pointer(filenamePtr))

	val := C.JS_Eval(ctx.c, codePtr, C.size_t(len(code)), filenamePtr, C.int(evalType))
	// defer ctx.FreeValue(val)

	if isException(val) {
		defer ctx.FreeValue(val)
		C.js_std_dump_error(ctx.c)
		return Value{c: val, ctx: ctx}, ctx.Exception()
	}

	return Value{c: val, ctx: ctx}, nil
}

func (ctx *Context) EvalFile(filename string, code string) (Value, error) {
	return ctx.eval(filename, code, int(C.JS_EVAL_TYPE_GLOBAL))
}

func (ctx *Context) EvalModule(filename string, code string) (Value, error) {
	return ctx.eval(filename, code, C.JS_EVAL_TYPE_MODULE)
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

	if isException(val) {
		defer C.JS_FreeValue(ctx.c, val)
		ctx.ThrowStackError()
	}

	return Value{c: C.JS_EvalFunction(ctx.c, val), ctx: ctx}
}

func (ctx *Context) Eval(code string) error {
	v, err := ctx.EvalFile("<eval>", code)
	defer v.Free()
	return err
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
		fn.Call(args)
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

func (ctx *Context) LoopOnce() uint64 {
	refs := ctx.runPendingJobs()

	if refs > 0 {
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

	return refs
}

func (ctx *Context) STDLoop() {
	C.js_std_loop(ctx.c)
}

func (ctx *Context) Await(v Value) Value {
	if !v.IsPromise() {
		// Not a promise, return as-is
		return v
	}

	return Value{ctx: ctx, c: C.js_std_await(ctx.c, v.c)}
}

func (ctx *Context) Free() {
	for _, cb := range ctx.onExit {
		cb()
	}

	for _, value := range ctx.values {
		value.Free()
	}

	// C.JS_RunGC(ctx.rt)
	runtimeOp := C.JS_GetRuntimeOpaque(ctx.rt)
	ctxOp := C.JS_GetContextOpaque(ctx.c)

	ctx.DeleteModulesList()
	ctx.FreeValue(ctx.asyncIterator)
	ctx.FreeValue(ctx.promise)
	ctx.FreeValue(ctx.proxy)
	C.JS_FreeContext(ctx.c)
	C.JS_FreeRuntime(ctx.rt)

	pointer.Unref(runtimeOp)
	pointer.Unref(ctxOp)
	runtime.GC()
	// fmt.Println("TO DO! the free below should be enabled")
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

func (ctx *Context) Throwf(format string, a ...any) Value {
	err := fmt.Sprintf(format, a)
	return ctx.Throw(err)
}

func (ctx *Context) Throw2(v interface{}) {
	fn := ctx.EvalFunction("<native>", `(msg) => {
		let err = new Error();
		if (typeof msg === "object") {
			err.message = msg.message;
			if (msg.stack) {
				err.stack = msg.stack;
			}
		} else {
			err.message = msg;
		}
		throw err;
	}`)

	defer fn.Free()
	fn.Call(v)
}

func (ctx *Context) IsException(v interface{}) bool {
	goVal, ok := v.(Value)
	if ok && goVal.IsException() {
		return true
	}

	return false
}

func (ctx *Context) IsError(v interface{}) bool {
	goVal, ok := v.(Value)
	if ok && goVal.IsError() {
		return true
	}

	return false
}

func (ctx *Context) ParseJSON(v string) Value {
	ptr := C.CString(v)
	defer C.free(unsafe.Pointer(ptr))

	filenamePtr := C.CString("")
	defer C.free(unsafe.Pointer(filenamePtr))

	return Value{ctx: ctx, c: C.JS_ParseJSON(ctx.c, ptr, C.size_t(len(v)), filenamePtr)}
}

func (ctx *Context) CheckError(err error) {
	if err != nil {
		var evalErr *Error
		if errors.As(err, &evalErr) {
			fmt.Println(evalErr.Cause)
			fmt.Println(evalErr.Stack)
		}

		fmt.Printf("%v", err)
		os.Exit(2)
	}
}

func (ctx *Context) Wait() {
	ctx.wg.Wait()
}

func (ctx *Context) Add() {
	ctx.wg.Add(1)
}

func (ctx *Context) Done() {
	ctx.wg.Done()
}

func (ctx *Context) OnExit(cb func()) {
	ctx.onExit = append(ctx.onExit, cb)
}

func (ctx *Context) Lock() {
	ctx.mutex.Lock()
}

func (ctx *Context) Unlock() {
	ctx.mutex.Unlock()
}

type Writer struct {
	ctx    *Context
	cb     Value
	err    *Error
	ret    interface{}
	closed bool
}

func (w *Writer) Call(arg interface{}) *Error {
	ctx := w.ctx
	if w.closed == true {
		return &Error{Cause: "write after close"}
	}

	if w.err != nil {
		fmt.Println("called while has error!!!!!!!!!")
	}

	var wg sync.WaitGroup
	wg.Add(1)
	ctx.Ref()
	ctx.Channel <- func() {
		defer ctx.UnRef()
		defer wg.Done()

		ret := w.cb.SafeCall(arg)
		if ctx.IsException(ret) {
			stackErr := ctx.GetStackError()
			if stackErr != nil {
				w.err = stackErr
			} else {
				w.err = &Error{Cause: "unknow error", Stack: ""}
			}
		} else {
			w.ret = ret
		}
	}

	wg.Wait()
	if w.err != nil {
		return w.err
	}

	return nil
}

func (w *Writer) Data() interface{} {
	return w.ret
}

func (w *Writer) Write(buf []byte) (int, error) {
	ctx := w.ctx
	if w.closed == true {
		return 0, &Error{Cause: "write after close"}
	}

	var wg sync.WaitGroup
	wg.Add(1)
	ctx.Ref()
	ctx.Channel <- func() {
		w.cb.Call(buf)
		ctx.UnRef()
		wg.Done()
	}

	wg.Wait()
	return len(buf), nil
}

func (w *Writer) Close() {
	if w == nil {
		return
	}

	if !w.closed {
		w.closed = true
		w.cb.Free()
	}
}

func (ctx *Context) Writer(cb Value) *Writer {
	if cb.IsFunction() {
		cb.Dup()
		writer := &Writer{
			ctx,
			cb,
			nil,
			nil,
			false,
		}

		return writer
	}

	return nil
}
