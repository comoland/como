package js

// #include "quickjs.h"
// #include "bridge.c"
import "C"

import (
	"sync"
)

// run time
func NewRuntime() *C.JSRuntime {
	rt := C.JS_NewRuntime()
	C.JS_SetCanBlock(rt, 0)
	return rt
}

func (rt *C.JSRuntime) Free() {
	C.JS_FreeRuntime(rt)
}

func (rt *C.JSRuntime) NewContext() *Context {
	ctx := C.como_js_context(rt)

	promise := ctx.evalFile("<Promise>", `() => {
		var res, rej;

		var promise = new Promise((resolve, reject) => {
			res = resolve;
			rej = reject;
		});

		promise.resolve = res;
		promise.reject = rej;

		return promise;
	}`, 0)

	proxy := ctx.evalFile("<Proxy>", `(get) => {
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

	asyncIterator := ctx.evalFile("<AsyncIterator>", `() => {
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
						console.log('rrrrrrrrrrrrrr')
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

	context := &Context{
		rt:            rt,
		c:             ctx,
		mutex:         mutex,
		wg:            wg,
		Channel:       channel,
		promise:       promise,
		proxy:         proxy,
		asyncIterator: asyncIterator,
		values:        make(map[string]Value),
		modules:       make(map[string]Module),
		StackFormatter: func(stack string) string {
			return stack
		},
	}

	ctx.setOpaque(context)
	initError(context)
	return context
}
