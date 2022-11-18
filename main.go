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
