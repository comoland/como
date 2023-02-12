package main

import (
	// "fmt"

	"fmt"
	"runtime"
	"testing"

	"github.com/comoland/como/core"
	"github.com/comoland/como/js"
)

func init() {
	runtime.GOMAXPROCS(1)
}

func TestAutoFree(t *testing.T) {
	runs := 0
	Loop, ctx := core.Como("")
	obj := ctx.Object().AutoFree()

	obj.Dup()
	obj.Dup()
	obj.Dup()
	obj.Dup()
	obj.Free()

	fn := ctx.Function(func(args js.Arguments) interface{} {
		arg := args.GetValue(0).Dup()
		fmt.Println(arg)
		runs = runs + 1
		return nil
	}).AutoFree()

	for i := 0; i < 10; i++ {
		fn.Call(obj)
	}

	fn.Dup()
	fn.Free()

	Loop(func() {
		obj.Free()
	})
}

func TestArguments(t *testing.T) {
	runs := 0
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()
	global.Set("testArgs", func(args js.Arguments) interface{} {
		d := args.Get(0).(int64)

		aa := args.GetValue(1)
		s := args.GetString(2)
		runs = runs + 1

		if s != "hi" {
			t.Errorf("%s; want hi", s)
		}

		if d != 10 {
			t.Errorf("%d; want 10", d)
		}

		foo := aa.Get("foo").(string)
		if foo != "bar" {
			t.Errorf("%s; want bar", foo)
		}

		return nil
	})

	ctx.Eval(`
		(async function(){
			testArgs(10, { foo: 'bar' }, "hi")
		})()
	`)

	Loop(func() {
		global.Free()
	})

	if runs != 1 {
		t.Errorf("expected 1 runs, got %d", runs)
	}
}

func TestModule(t *testing.T) {
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()

	m := ctx.NewModule("core.go")

	fn := map[string]interface{}{
		"foo": func(args js.Arguments) interface{} {
			return nil
		},

		"moo": func(args js.Arguments) interface{} {
			return nil
		},
	}

	fn2 := func(args js.Arguments) interface{} {
		return nil
	}

	m.Export("default", fn)
	m.Export("test2", fn2)

	ctx.Eval(`
		(async function(){
			const all = await import('core.go')
		})()
	`)

	Loop(func() {
		global.Free()
	})
}

func TestModule2(t *testing.T) {
	runs := 0
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()

	m2 := ctx.NewModule("core2.go")
	m2.Export("test2", func(args js.Arguments) interface{} {
		arg := args.GetString(0)
		if arg != "foo" {
			t.Errorf("%s; want foo", arg)
		}

		runs = runs + 1
		return "hello"
	})

	m := ctx.NewModule("core.go")
	m.Export("first", func(args js.Arguments) interface{} {
		arg := args.GetString(0)
		if arg != "foo" {
			t.Errorf("%s; want foo", arg)
		}

		runs = runs + 1
		return "hello"
	})

	m.Export("second", func(args js.Arguments) interface{} {
		arg := args.GetString(0)
		if arg != "foo" {
			t.Errorf("%s; want foo", arg)
		}

		runs = runs + 1
		return "hello"
	})

	global.Set("setRet", func(args js.Arguments) interface{} {
		ret := args.GetString(0)
		runs = runs + 1
		if ret != "hello" {
			t.Errorf("%s; want hello", ret)
		}

		return nil
	})

	ctx.Eval(`
		(async function(){
			const { first, second } = await import('core.go')
			setRet(first("foo"))
			setRet(second("foo"))
		})()
	`)

	ctx.Eval(`
		(async function(){
			const { test2 } = await import('core2.go')
			setRet(test2("foo"))
		})()
	`)

	Loop(func() {
		global.Free()
	})

	if runs != 6 {
		t.Errorf("expected 6 runs, got %d", runs)
	}
}

func TestPromise(t *testing.T) {
	runs := 0
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()
	global.Set("setRet", func(args js.Arguments) interface{} {
		ret := args.GetString(0)
		runs = runs + 1
		if ret != "hello" {
			t.Errorf("%s; want hello", ret)
		}

		return nil
	})

	global.Set("testAsync", func(args js.Arguments) interface{} {
		promise := ctx.NewPromise()
		go func() {
			go func() {
				promise.Resolve("hello")
			}()
		}()
		return promise
	})

	ctx.Eval(`
		(async function(){
			const ret = await globalThis.testAsync()
			globalThis.setRet(ret)
		})()
	`)

	Loop(func() {
		global.Free()
	})

	if runs != 1 {
		t.Errorf("expected 1 runs, got %b", runs)
	}
}

func TestRPC(t *testing.T) {
	runs := 0
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()

	global.Set("rpc", func(args js.Arguments) interface{} {
		runs = runs + 1
		fn := args.Get(0).(js.Function)
		rpc := ctx.NewRPC(&fn)

		go func() {
			go func() {
				go func() {
					runs = runs + 1
					ret := rpc.SendOnce("hello")
					if ret != "hello" {
						t.Errorf("%s; want hello", ret)
					}
				}()
			}()
		}()

		return nil
	})

	ctx.Eval(`
		(async function(){
			const ret = globalThis.rpc((arg) => {
				return arg
			})
		})()
	`)

	Loop(func() {
		global.Free()
	})

	if runs != 2 {
		t.Errorf("expected 1 runs, got %d", runs)
	}
}

func TestBuffer(t *testing.T) {
	runs := 0
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()

	global.Set("getBuffer", func(args js.Arguments) interface{} {
		runs = runs + 1
		buf := args.Get(0).([]byte)
		return buf
	})

	global.Set("setError", func(args js.Arguments) interface{} {
		t.Errorf("buffers do not match")
		return nil
	})

	_, err := ctx.Eval(`
		function ab2str(buf) {
			return String.fromCharCode.apply(null, new Uint16Array(buf));
		}
		function str2ab(str) {
			var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
			var bufView = new Uint16Array(buf);
			for (var i=0, strLen=str.length; i < strLen; i++) {
			bufView[i] = str.charCodeAt(i);
			}
			return buf;
		}

		(function(){
			const str = 'this is an array buffer string with wide chars ابتثجحخ'.repeat(500)
			const buffer = str2ab(str);
			const ret = globalThis.getBuffer(buffer)
			if (str !==  ab2str(ret)) {
				globalThis.setError()
			}
		})()
	`)

	Loop(func() {
		global.Free()
	})

	if err != nil {
		t.Errorf("expected 1 runs, got %d", runs)
	}

	if runs != 1 {
		t.Errorf("expected 1 runs, got %d", runs)
	}
}

func TestFinalizers(t *testing.T) {
	Loop, ctx := core.Como("")
	global := ctx.GlobalObject()

	var list []string
	obj := ctx.ClassObject(func() {
		list = append(list, "second")
	})

	obj1 := ctx.ClassObject(func() {
		list = append(list, "first")
	})

	global.Set("insert", func(args js.Arguments) interface{} {
		list = append(list, "third")
		return nil
	})

	// should call finalizer immediately
	obj1.Free()
	global.Set("a", obj)

	ctx.Eval(`
		globalThis.b = {...a}
		delete globalThis.a
		// should be called after second finalizer
		globalThis.insert()
		delete globalThis.b
	`)

	Loop(func() {
		global.Free()
	})

	if len(list) != 3 {
		t.Errorf("expected 1 runs, got %d", len(list))
	}

	if list[0] != "first" || list[1] != "second" || list[2] != "third" {
		t.Errorf("expected ordered free list")
	}
}

func TestJs(t *testing.T) {
	Loop, _ := core.Como("./test/load.js")
	Loop(func() {})
}
