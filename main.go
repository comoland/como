package main

import (
	"flag"
	"fmt"

	"github.com/comoland/como/core"
)

func main() {
	flag.Bool("check", false, "check type")
	flag.Parse()
	filename := flag.Arg(0)
	Loop, _ := core.ComoStr("runner", fmt.Sprintf(`
		const { handleError } = await import("main");
		try {
			await import("%s");
		} catch (e) {
		 	await handleError(e)
		}
	`, filename))

	Loop(func() {})
}
