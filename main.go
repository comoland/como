package main

import (
	"flag"

	"github.com/comoland/como/core"
)

// func init() {
// 	runtime.LockOSThread()
// }

func main() {
	flag.Bool("check", false, "check type")
	flag.Parse()
	filename := flag.Arg(0)

	Loop, _ := core.Como(filename)
	Loop(func() {})
}
