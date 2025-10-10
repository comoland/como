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
		globalThis.global = globalThis;
		import "web-streams-polyfill/polyfill";
		const { Blob, File } = await import("blob");
		globalThis.Blob = Blob;
		globalThis.File = File;

		const b = await import("buffer");
		globalThis.Buffer = b.Buffer
		globalThis.handleError = async (e) => {
			const colors = await import("como/colors").then((e) => e.default)
			console.log(colors.red().bold((e.name ?? "Error")) +  (e.code ? " [" + e.code + "]" : "" ) +  ": " + (e.message ?? e))
			if (e.stack) {
				console.log(colors.magenta(e.stack))
			}

			if (typeof e === "object") {
				const {__error_formatted, __handeled, message, ...rest} = e
				const json = JSON.parse(JSON.stringify(rest, null, 4))
				if (Object.keys(json).length) {
					console.log(JSON.parse(JSON.stringify(rest, null, 4)))
				}
			}
			process.exit(1)
		}

		try {
			await import("%s");
		} catch (e) {
		 	await handleError(e)
		}
	`, filename))
	ctx.Embed = &files
	Loop(func() {})
}
