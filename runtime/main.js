globalThis.global = globalThis;

const { createModule } = await import("module");
const module = createModule(import.meta.filename, globalThis.module);
globalThis.module = module;
globalThis.exports = module.exports;
globalThis.require = module.require;

// global: process
import 'process';

// global: console
import "console";

// global: timers
import "timers"

// Buffer
const b = await import("buffer");
globalThis.Buffer = b.Buffer;


// web streams polyfills
await import("web/stream");

// Web Blob & File globals
const { Blob, File } = await import("blob");
globalThis.Blob = Blob;
globalThis.File = File;

// Web URL
const { URL, URLSearchParams } = await import("url");
globalThis.URL = URL;
globalThis.URLSearchParams = URLSearchParams;

// TextEncoder & TextDecoder
const { TextEncoder, TextDecoder } = await import("textencoder");
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

export const handleError = async (e) => {
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

async (module) => {
    try {
        await import(module);
    } catch (e) {
        await handleError(e)
    }
}
