package main

import (
	"embed"
	"flag"
	"fmt"

	"github.com/comoland/como/core"
)

//go:embed test
var files embed.FS

func main() {
	flag.Bool("check", false, "check type")
	flag.Parse()
	filename := flag.Arg(0)
	Loop, ctx := core.ComoStr("runner", fmt.Sprintf(`
		const { handleError } = await import("main");
		try {
			await import("%s");
		} catch (e) {
		 	await handleError(e)
		}
	`, filename))

	ctx.Embed = &files
	Loop(func() {})
}
