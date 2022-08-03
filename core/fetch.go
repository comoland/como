package core

import (
	"github.com/comoland/como/js"
	// "github.com/imroc/req"
	// "encoding/json"
	// "fmt"
	// "time"
)

func fetch(ctx *js.Context, global js.Value) {
	// globalThis.setTimeout
	global.SetFunction("fetch", func(args js.Arguments) interface{} {
		// url, ok := args.Get(0).(string)
		// if !ok {
		// 	return ctx.Throw("timers arg(0) muct be a string")
		// }

		// promise := ctx.NewPromise()
		// go func() {
		// 	r, err := req.Get(url)
		// 	if err != nil {
		// 		panic(err)
		// 	}

		// 	foo := map[string]interface{}{"userId": 999}

		// 	resp := r.Response()
		// 	// fmt.Println(resp.StatusCode)

		// 	promise.Resolve(func() interface {} {
		// 		// e := r.ToJSON(&foo)
		// 		json.Unmarshal(resp, foo)
		// 		return foo
		// 	})
		// }()

		// return promise
		return 1
	})
}
