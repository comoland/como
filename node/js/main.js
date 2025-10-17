globalThis.global = globalThis;

const b = await import("buffer");
globalThis.Buffer = b.Buffer;

// web streams polyfills
await import("web/stream");

const { Blob, File } = await import("blob");
globalThis.Blob = Blob;
globalThis.File = File;

const { URL, URLSearchParams } = await import("url");
globalThis.URL = URL;
globalThis.URLSearchParams = URLSearchParams;

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
    process.exit(0)
}
