package js

/*
#include "quickjs.h"
#include "quickjs-libc.h"

static uintptr_t como_promise_ptr(JSValueConst value) {
	return (uintptr_t)JS_VALUE_GET_PTR(value);
}
*/
import "C"

import (
	"fmt"
	"os"
	"sync"
	"time"
	"unsafe"
)

type Error struct {
	Cause string
	Stack string
}

type pendingRejection struct {
	timer *time.Timer
	ctx   *Context
}

var (
	rejectionMu            sync.Mutex
	pendingRejectionTimers = map[uintptr]*pendingRejection{}
)

const promiseWarningDelay = 25 * time.Millisecond

func (err Error) Error() string      { return err.Cause }
func (err Error) StackTrace() string { return err.Stack }

//export promiseRejectionTracker
func promiseRejectionTracker(c *C.JSContext, promise C.JSValueConst, reason C.JSValueConst, is_handled int, opque unsafe.Pointer) {
	ctx := GetContextOpaque(c)
	if ctx == nil {
		return
	}

	key := promisePointerKey(promise)

	if is_handled != 0 {
		cancelPendingRejection(key)
		return
	}

	err := ctx.Value(reason)

	if err.IsError() {
		stack := err.GetValue("stack")
		defer stack.Free()

		formatted := err.GetValue("__error_formatted")
		defer formatted.Free()

		message := err.String()
		stackError := ""

		if !stack.IsUndefined() {
			stackError = stack.String()
			if formatted.IsUndefined() {
				stackError = ctx.StackFormatter(stackError)
				err.Set("stack", stackError)
			}
		}

		schedulePendingRejection(ctx, key, message, stackError)
	}
}

func promisePointerKey(promise C.JSValueConst) uintptr {
	return uintptr(C.como_promise_ptr(promise))
}

func cancelPendingRejection(key uintptr) {
	if key == 0 {
		return
	}

	rejectionMu.Lock()
	pending, ok := pendingRejectionTimers[key]
	if ok {
		delete(pendingRejectionTimers, key)
	}
	rejectionMu.Unlock()

	if !ok || pending.timer == nil {
		return
	}

	if pending.timer.Stop() {
		pending.ctx.UnRef()
	}
}

func schedulePendingRejection(ctx *Context, key uintptr, message string, stack string) {
	if key == 0 {
		return
	}

	ctx.Ref()

	timer := time.AfterFunc(promiseWarningDelay, func() {
		rejectionMu.Lock()
		delete(pendingRejectionTimers, key)
		rejectionMu.Unlock()

		ctx.Channel <- func() {
			fmt.Print("Possibly unhandled promise rejection: ")
			fmt.Println(message)
			if stack != "" {
				fmt.Println(stack, "\n")
			}
			ctx.UnRef()
		}
	})

	rejectionMu.Lock()
	if pending, ok := pendingRejectionTimers[key]; ok && pending.timer != nil {
		if pending.timer.Stop() {
			pending.ctx.UnRef()
		}
	}
	pendingRejectionTimers[key] = &pendingRejection{timer: timer, ctx: ctx}
	rejectionMu.Unlock()
}

func (ctx *Context) GetStackError() *Error {
	val := ctx.Value(C.JS_GetException(ctx.c))
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
	val := ctx.Value(C.JS_GetException(ctx.c))

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
	val := ctx.Value(C.JS_GetException(ctx.c))
	defer val.Free()

	stack := val.GetValue("stack")
	isFormatted, _ := val.Get("__error_formatted").(bool)
	defer stack.Free()

	stackError := stack.String()
	if !isFormatted {
		stackError = ctx.StackFormatter(stackError)
	}

	fmt.Println(val.String())
	fmt.Println(stackError)

	// ctx.Throw(val)
	// ctx.Terminate()
	os.Exit(3)
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

	v, _ := ctx.EvalModule("<errors>", `
		const NativeErrors = {
			Error: globalThis.Error,
			TypeError: globalThis.TypeError,
			SyntaxError: globalThis.SyntaxError,
			RangeError: globalThis.RangeError,
			ReferenceError: globalThis.ReferenceError,
		};

		// Implement Error.captureStackTrace in JavaScript
		function captureStackTrace(targetObject, constructorOpt) {
			if (!targetObject) {
				return;
			}

			// Create a temporary error to capture the current stack
			const tempError = new NativeErrors.Error('');

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

			if (!targetObject.__error_formatted) {
				targetObject.__error_formatted = true;
				targetObject.stack = NativeErrors.Error.formatError(stackLines.join("\n"))
			} else {
			 	targetObject.stack = stackLines.join('\n');
			}
		};

		function MakeError(name) {
			const Native = NativeErrors[name];
			function CustomError(message, options) {
				if (typeof this === "undefined") {
					return new CustomError(message, options)
				}

				const err = new Native(message, options);
				Object.setPrototypeOf(err, CustomError.prototype);

				if (options && options.cause) {
					this.cause = options.cause;
				}

				captureStackTrace(err, CustomError);

				Object.defineProperty(this, "message", {
					value: err.message,
					writable: true,
					enumerable: false,
					configurable: true
				});

				Object.defineProperty(this, "stack", {
					value: err.stack,
					writable: true,
					enumerable: false,
					configurable: true
				});

				// don't return
			}

			// IMPORTANT: use the **native prototype**, not a new one
			CustomError.prototype = Native.prototype;
			CustomError.prototype.constructor = CustomError;
			return CustomError;
		}

		globalThis.Error = MakeError('Error');
		globalThis.TypeError = MakeError('TypeError');
		globalThis.ReferenceError = MakeError('ReferenceError');
		globalThis.SyntaxError = MakeError('SyntaxError');
		globalThis.RangeError = MakeError('RangeError');

		globalThis.Error.captureStackTrace = captureStackTrace;
	`)

	v.Free()
}
