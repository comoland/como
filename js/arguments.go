package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	// "fmt"

	"encoding/json"
	"fmt"
	"reflect"

	"github.com/mitchellh/mapstructure"
)

type Arguments struct {
	Ctx  *Context
	This Value
	argc int
	argv []C.JSValueConst
}

func (ctx *Context) NewArguments(args ...interface{}) Arguments {
	jsArgs := make([]C.JSValueConst, 0)
	for _, arg := range args {
		jsArgs = append(jsArgs, ctx.goToJSValue(arg))
	}

	return Arguments{Ctx: ctx, argc: len(jsArgs), argv: jsArgs}
}

func (a *Arguments) Add(args ...interface{}) Arguments {
	jsArgs := a.argv
	for _, arg := range args {
		val := a.Ctx.goToJSValue(arg)
		jsArgs = append(jsArgs, val)
	}

	return Arguments{Ctx: a.Ctx, argc: len(jsArgs), argv: jsArgs}
}

func (a *Arguments) Append(arg interface{}) Arguments {
	val := a.Ctx.goToJSValue(arg)
	a.argv = append(a.argv, val)
	return *a
}

func (args Arguments) Dup() Arguments {
	ctx := args.Ctx
	dupped := make([]C.JSValueConst, 0)
	for _, argv := range args.argv {
		dupped = append(dupped, ctx.DupValue(argv))
	}

	return Arguments{Ctx: ctx, argc: len(dupped), argv: dupped, This: args.This}
}

func (args Arguments) Free() {
	ctx := args.Ctx
	for _, argv := range args.argv {
		ctx.FreeValue(argv)
	}
}

func (args Arguments) Len() int {
	return args.argc
}

func (args Arguments) ForEach(cb func(arg interface{}, i int)) {
	for i, argv := range args.argv {
		cb(args.Ctx.JsToGoValue(argv), i)
	}
}

func (args Arguments) Get(argIndex int) interface{} {
	if args.argc == 0 || argIndex > args.argc-1 {
		return nil
	}

	argv := args.argv[argIndex]
	return args.Ctx.JsToGoValue(argv)
}

func (args Arguments) GetString(argIndex int) string {
	str, ok := args.Get(argIndex).(string)
	if !ok {
		args.Ctx.Throw2("not a string")
		args.Ctx.ThrowStackError()
	}

	return str
}

func (args Arguments) GetBuffer(argIndex int) ([]byte, error) {
	val := args.GetValue(argIndex)
	if val.IsObject() {
		buf, ok := val.Get("buffer").([]byte)
		if !ok {
			buf, isBuf := args.Get(argIndex).([]byte)
			if !isBuf {
				return nil, &Error{Cause: "not a buffer"}
			}

			return buf, nil
		}

		return buf, nil
	}

	return nil, &Error{Cause: "not a buffer"}
}

func (args Arguments) GetNumber(argIndex int) (float64, bool) {
	num, ok := args.Get(argIndex).(int64)
	if !ok {
		num, ok := args.Get(argIndex).(float64)
		if ok {
			return num, ok
		}
	}

	return float64(num), ok
}

func (args Arguments) GetMap(argIndex int, output interface{}) error {
	val := args.Get(argIndex)
	er := mapstructure.Decode(val, output)
	return er
}

func (ctx *Context) GetMap(input interface{}, output interface{}) error {
	er := mapstructure.Decode(input, output)
	return er
}

func makeSafe(val reflect.Value, seen map[uintptr]bool) interface{} {
	if !val.IsValid() {
		return nil
	}

	// Dereference pointers
	for val.Kind() == reflect.Ptr {
		ptr := val.Pointer()
		if seen[ptr] {
			return nil
		}
		seen[ptr] = true
		if val.IsNil() {
			return nil
		}
		val = val.Elem()
	}

	typ := val.Type()

	// If it implements fmt.Stringer, use its String() value
	if typ.Implements(reflect.TypeOf((*fmt.Stringer)(nil)).Elem()) {
		return val.Interface().(fmt.Stringer).String()
	}

	switch val.Kind() {
	case reflect.Struct:
		result := make(map[string]interface{})
		for i := 0; i < val.NumField(); i++ {
			field := typ.Field(i)
			if field.PkgPath != "" {
				continue
			}
			result[field.Name] = makeSafe(val.Field(i), seen)
		}
		return result

	case reflect.Map:
		result := make(map[string]interface{})
		for _, key := range val.MapKeys() {
			result[fmt.Sprint(key.Interface())] = makeSafe(val.MapIndex(key), seen)
		}
		return result

	case reflect.Slice, reflect.Array:
		elemType := val.Type().Elem()
		stringerType := reflect.TypeOf((*fmt.Stringer)(nil)).Elem()

		// Check if element type implements fmt.Stringer
		if elemType.Implements(stringerType) {
			result := make([]interface{}, val.Len())
			for i := 0; i < val.Len(); i++ {
				stringVal := val.Index(i).Interface().(fmt.Stringer).String()
				result[i] = stringVal
			}
			return result
		}

		// For pointers to Stringers (e.g. []*CustomEnum)
		if elemType.Kind() == reflect.Ptr && elemType.Implements(stringerType) {
			result := make([]interface{}, val.Len())
			for i := 0; i < val.Len(); i++ {
				item := val.Index(i)
				if item.IsNil() {
					result[i] = nil
				} else {
					result[i] = item.Interface().(fmt.Stringer).String()
				}
			}
			return result
		}

		// Default case: recurse
		result := make([]interface{}, val.Len())
		for i := 0; i < val.Len(); i++ {
			result[i] = makeSafe(val.Index(i), seen)
		}
		return result

	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16,
		reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8,
		reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Float32,
		reflect.Float64, reflect.String:
		return val.Interface()

	case reflect.Interface:
		if !val.IsNil() {
			return makeSafe(val.Elem(), seen)
		}
		return nil

	default:
		// If it's a custom int/float/uint type, convert to underlying kind
		kind := val.Kind()
		switch kind {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
			reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
			reflect.Float32, reflect.Float64, reflect.Bool:
			return val.Interface()
		}
		return nil
	}
}

func (ctx *Context) ToSafeJSONString(v interface{}) (string, error) {
	seen := make(map[uintptr]bool)
	safe := makeSafe(reflect.ValueOf(v), seen)
	bytes, err := json.MarshalIndent(safe, "", "  ")
	return string(bytes), err
}

func (ctx *Context) ToSafeValue(v interface{}) interface{} {
	seen := make(map[uintptr]bool)
	safe := makeSafe(reflect.ValueOf(v), seen)
	return safe
}

// get js.Value at index return undefined js value
// if index out of bound
func (args Arguments) GetValue(argIndex int) Value {
	if args.argc == 0 || argIndex > args.argc-1 {
		return args.Ctx.Undefined()
	}

	argv := args.argv[argIndex]
	return Value{ctx: args.Ctx, c: argv}
}

func (args Arguments) Slice(low int, high int) Arguments {
	if high == -1 {
		high = args.argc
	}

	var s []C.JSValueConst = args.argv[low:high]
	return Arguments{Ctx: args.Ctx, argc: len(s), argv: s}
}
