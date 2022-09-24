package js

// #include "quickjs.h"
// #include "quickjs-libc.h"
import "C"

import (
	"fmt"
	"unsafe"
)

//export promiseRejectionTracker
func promiseRejectionTracker(c *C.JSContext, promise C.JSValueConst, reason C.JSValueConst, is_handled int, opque unsafe.Pointer) {
	ctx := c.getOpaque()
	err := Value{ctx: ctx, c: reason}

	if is_handled == 1 {
		return
	}

	if err.IsError() {
		stack := err.GetValue("stack")
		defer stack.Free()

		formatted := err.GetValue("__error_formatted")
		defer formatted.Free()

		// err.Set("_handled", true)
		fmt.Print("Possibly unhandled promise rejection: ")
		fmt.Println(err.String())
		if !stack.IsUndefined() {
			stackError := stack.String()
			if formatted.IsUndefined() {
				stackError = ctx.StackFormatter(stackError)
			}

			fmt.Println(stackError, "\n")
		}
	}
}

func (ctx *Context) ThrowStackError() {
	val := Value{ctx: ctx, c: C.JS_GetException(ctx.c)}
	defer val.Free()

	if val.IsError() {
		stack := val.GetValue("stack")
		isFormatted, _ := val.Get("__error_formatted").(bool)
		defer stack.Free()

		stackError := stack.String()
		if isFormatted != true {
			stackError = ctx.StackFormatter(stackError)
		}

		fmt.Println(val.String())
		fmt.Println(stackError, "\n")
	}

	ctx.Terminate()
}

func initError(ctx *Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	errObject := global.GetValue("Error")
	defer errObject.Free()

	errObject.Set("captureStackTrace", func(args Arguments) interface{} {
		this := args.This
		stack := this.GetValue("stack")
		defer stack.Free()
		return stack.String()
		// return ctx.StackFormatter(stack.String())
	})

	errObject.Set("formatError", func(args Arguments) interface{} {
		stack := args.GetString(0)
		return ctx.StackFormatter(stack)
	})

	v, _ := ctx.EvalFile("<errors>", `
		Error.prototype.captureStackTrace = Error.captureStackTrace;
		const ERR = globalThis.Error;

		globalThis.Error = class Error extends ERR {
			constructor(msg) {
				super(msg)

				let newStack = this.stack.split('\n')
				newStack = newStack.filter((str) => !/<errors>/.test(str))

				if (msg instanceof Error) {
					this.stack = newStack.join("\n")
					return this;
				}

				if (!this.__error_formatted) {
					this.__error_formatted = true;
					this.stack = Error.formatError(newStack.join("\n"))
				}
			}
		}

		globalThis.TypeError = class TypeError extends Error {}
		globalThis.ReferenceError = class ReferenceError extends Error {}
		globalThis.SyntaxError = class SyntaxError extends Error {}
	`)

	v.Free()
}
