package main

import (
	"embed"
	"flag"

	"github.com/comoland/como/core"
)

// func init() {
// 	runtime.LockOSThread()
// }

//go:embed test
var files embed.FS

func main() {
	flag.Bool("check", false, "check type")
	flag.Parse()
	filename := flag.Arg(0)

	Loop, ctx := core.Como(filename)
	ctx.Embed = &files
	Loop(func() {})
}

// package main

// import (
// 	"embed"
// 	"flag"
// 	"fmt"
// 	"sync"

// 	"github.com/comoland/como/core"
// )

// // func init() {
// // 	runtime.LockOSThread()
// // }

// //go:embed test
// var files embed.FS
// var wg = &sync.WaitGroup{}

// func main() {
// 	flag.Bool("check", false, "check type")
// 	flag.Parse()
// 	filename := flag.Arg(0)

// 	// Loop, ctx := core.Como(filename)
// 	// ctx.Embed = &files
// 	// Loop(func() {})

// 	for i := 1; i < 1000; i++ {
// 		wg.Add(1)
// 		go callMe(filename, i)
// 		if i%2 == 0 {
// 			wg.Wait()
// 		}
// 	}

// 	wg.Add(1)
// 	wg.Wait()
// }

// func callMe(filename string, nm int) {

// 	Loop, ctx := core.Como(filename)
// 	ctx.Embed = &files
// 	Loop(func() {})
// 	wg.Done()
// 	fmt.Println("done ", nm)
// }
