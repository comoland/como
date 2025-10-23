package js

// #include "quickjs.h"
// #include "quickjs-libc.h"
import "C"

import (
	"fmt"
	"unsafe"
)

type Error struct {
	Cause string
	Stack string
}

func (err Error) Error() string      { return err.Cause }
func (err Error) StackTrace() string { return err.Stack }

//export promiseRejectionTracker
func promiseRejectionTracker(c *C.JSContext, promise C.JSValueConst, reason C.JSValueConst, is_handled int, opque unsafe.Pointer) {
	ctx := GetContextOpaque(c)
	err := Value{ctx: ctx, c: reason}

	if is_handled == 1 {
		return
	}

	if err.IsError() {
		stack := err.GetValue("stack")
		defer stack.Free()

		formatted := err.GetValue("__error_formatted")
		handeled := err.GetValue("__handeled")
		v := err.Set("__handeled", true)
		defer v.Free()
		defer handeled.Free()
		defer formatted.Free()

		if handeled.ToString() == "true" {
			return
		}

		fmt.Print("Possibly unhandled promise rejection: ")
		fmt.Println(err.String())

		if !stack.IsUndefined() {
			stackError := stack.String()
			if formatted.IsUndefined() {
				stackError = ctx.StackFormatter(stackError)
				err.Set("stack", stackError)
			}

			fmt.Println(stackError, "\n")
		}
	}
}

func (ctx *Context) GetStackError() *Error {
	val := Value{ctx: ctx, c: C.JS_GetException(ctx.c)}
	defer val.Free()

	var err *Error = nil

	if val.IsError() {
		stack := val.GetValue("stack")
		isFormatted, _ := val.Get("__error_formatted").(bool)
		defer stack.Free()

		stackError := stack.String()
		if isFormatted != true {
			stackError = ctx.StackFormatter(stackError)
		}

		err = &Error{Cause: val.String(), Stack: stackError}
	}

	return err
}

func (ctx *Context) GetException() Value {
	val := Value{ctx: ctx, c: C.JS_GetException(ctx.c)}

	if val.IsError() {
		stack := val.GetValue("stack")
		isFormatted, _ := val.Get("__error_formatted").(bool)
		defer stack.Free()

		stackError := stack.String()
		if isFormatted != true {
			stackError = ctx.StackFormatter(stackError)
			val.Set("stack", stackError)
		}
	}

	return val
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
	// os.Exit(0)
}

func initError(ctx *Context) {
	global := ctx.GlobalObject()
	defer global.Free()

	errObject := global.GetValue("Error")
	defer errObject.Free()

	errObject.Set("formatError", func(args Arguments) interface{} {
		stack := args.GetString(0)
		return ctx.StackFormatter(stack)
	})

	v, _ := ctx.EvalFile("<errors>", `
		const ERR = globalThis.Error;

		// Implement Error.captureStackTrace in JavaScript
		ERR.captureStackTrace = function(targetObject, constructorOpt) {
			if (!targetObject) {
				return;
			}

			// Create a temporary error to capture the current stack
			const tempError = new ERR('');

			// Get the stack and format it
			let stack = tempError.stack || '';

			// Split into lines and filter
			let stackLines = stack.split('\n');

			// Remove the first line (error message) and any internal frames
			stackLines = stackLines.filter((line, index) => {
				// Skip the error message line
				if (index === 0 && line.includes('Error:')) return false;
				// Skip captureStackTrace itself
				if (line.includes('captureStackTrace')) return false;
				// Skip internal error construction
				if (line.includes('<errors>')) return false;
				return true;
			});

			// If constructorOpt is provided, remove frames up to and including that function
			if (constructorOpt && typeof constructorOpt === 'function') {
				const constructorName = constructorOpt.name;
				if (constructorName) {
					const constructorIndex = stackLines.findIndex(line => line.includes(constructorName));
					if (constructorIndex !== -1) {
						stackLines = stackLines.slice(constructorIndex + 1);
					}
				}
			}

			// Set the formatted stack on the target object
			targetObject.stack = stackLines.join('\n');
		};

		globalThis.Error = class Error extends ERR {
			constructor(msg, options) {
				super(msg)

				// Handle Error cause property (modern JavaScript feature)
				if (options && options.cause !== undefined) {
					this.cause = options.cause
				}

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

		// Make sure captureStackTrace is available on the new Error constructor
		globalThis.Error.captureStackTrace = ERR.captureStackTrace;
		globalThis.Error.formatError = ERR.formatError;

		globalThis.TypeError = class TypeError extends Error {
			constructor(msg, options) {
				super(msg, options)
				this.name = 'TypeError'
			}
		}

		globalThis.ReferenceError = class ReferenceError extends Error {
			constructor(msg, options) {
				super(msg, options)
				this.name = 'ReferenceError'
			}
		}

		globalThis.SyntaxError = class SyntaxError extends Error {
			constructor(msg, options) {
				super(msg, options)
				this.name = 'SyntaxError'
			}
		}

		globalThis.RangeError = class RangeError extends Error {
			constructor(msg, options) {
				super(msg, options)
				this.name = 'RangeError'
			}
		}
	`)

	v.Free()
}
