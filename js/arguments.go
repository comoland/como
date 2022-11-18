package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	// "fmt"
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
		args.Ctx.Throw("not a string")
		args.Ctx.ThrowStackError()
	}

	return str
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
