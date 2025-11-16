package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	"embed"
	"sync"

	"github.com/mattn/go-pointer"
)

type JSRunTime struct {
	rt              *C.JSRuntime
	mainThread      bool
	classFunctionId uint32
	classObjectId   uint32
}

func NewRuntime() *JSRunTime {
	rt := C.JS_NewRuntime()

	runtime := &JSRunTime{
		rt:              rt,
		classFunctionId: 0,
		classObjectId:   0,
	}

	C.JS_SetRuntimeOpaque(rt, pointer.Save(runtime))
	return runtime
}

func (runtime *JSRunTime) NewContext() *Context {
	ctx := C.como_js_context(runtime.rt)

	promise := evalFile(ctx, "<Promise>", `() => {
		var res, rej;

		var promise = new Promise((resolve, reject) => {
			res = resolve;
			rej = reject;
		});

		promise.resolve = res;
		promise.reject = rej;
		promise.fin = (finalCB) => {
			promise.finally(() => {
				finalCB()
			})
		}

		return promise;
	}`, 0)

	proxy := evalFile(ctx, "<Proxy>", `(get) => {
		let obj = {};
		return new Proxy(obj, {
			get(target, key) {
				if (key in target) {
					return target[key];
				} else {
					target[key] = get(key);
					return target[key]
				}
			}
		});
	}`, 0)

	asyncIterator := evalFile(ctx, "<AsyncIterator>", `() => {
		let pullQueue = [];
		let pushQueue = [];
		const pushValue = async (args) => {
			if (pullQueue.length !== 0) {
				const resolver = pullQueue.shift()
				resolver(args)
			} else {
				pushQueue.push(args)
			}
		}

		const pullValue = () => {
			return new Promise((resolve) => {
				if (pushQueue.length !== 0) {
					const args = pushQueue.shift()
					resolve(args)
				} else {
					pullQueue.push(resolve)
				}
			})
		}

		var iterator = {
			pushValue,
			[Symbol.asyncIterator]() {
				return {
					async next() {
						const data = await pullValue();
						return Promise.resolve({ done: false, value: data });
					},
					async return() {
						console.log('return called!!!')
						iterator.clean()
					},
					async throw(e){
						iterator.clean()
						return e;
					}
				}
			}
		}
		return iterator;
	}`, 0)

	channel := make(chan interface{})
	wg := new(sync.WaitGroup)
	mutex := new(sync.Mutex)
	finalizer := new(Finalizers)

	context := &Context{
		rt:            runtime.rt,
		runtime:       runtime,
		c:             ctx,
		mutex:         mutex,
		wg:            wg,
		Channel:       channel,
		promise:       promise,
		proxy:         proxy,
		finalizers:    finalizer,
		asyncIterator: asyncIterator,
		values:        make(map[string]Value),
		modules:       make(map[string]*Module),
		StackFormatter: func(stack string) string {
			return stack
		},
	}

	context.FSEmbedder = &Embedder{
		ctx:        context,
		Fs:         nil,
		modulesLib: "",
	}

	context.CoreModules = make(map[string]struct {
		Path string
		FS   *embed.FS
	})

	SetContextOpaque(ctx, context)
	initError(context)
	return context
}

// SetMemoryLimit sets the maximum memory usage limit
func (runtime *JSRunTime) SetMemoryLimit(limit int64) {
	C.JS_SetMemoryLimit(runtime.rt, C.size_t(limit))
}

// SetGCThreshold sets the garbage collection threshold
func (runtime *JSRunTime) SetGCThreshold(threshold int64) {
	C.JS_SetGCThreshold(runtime.rt, C.size_t(threshold))
}

// SetMaxStackSize sets the maximum stack size
func (runtime *JSRunTime) SetMaxStackSize(size int64) {
	C.JS_SetMaxStackSize(runtime.rt, C.size_t(size))
}

// SetRuntimeInfo sets the runtime identification string
func (runtime *JSRunTime) SetRuntimeInfo(info string) {
	C.JS_SetRuntimeInfo(runtime.rt, C.CString(info))
}

// SetStripInfo sets debug stripping flags
func (runtime *JSRunTime) SetStripInfo(flags int) {
	C.JS_SetStripInfo(runtime.rt, C.int(flags))
}

// SetCanBlock sets whether blocking operations are allowed
func (runtime *JSRunTime) SetCanBlock(canBlock bool) {
	var block C.int
	if canBlock {
		block = 1
	} else {
		block = 0
	}
	C.JS_SetCanBlock(runtime.rt, block)
}
