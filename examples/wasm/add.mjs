import fs from 'fs';
import path from 'path';

const wasmBuffer = fs.readFileSync(path.resolve(import.meta.dir, './pdfium.wasm'));

const wasmModule = await WebAssembly.instantiate(wasmBuffer, {
    env: {}
});
// const { add } = wasmModule.instance.exports;

// console.log("5 + 3 =", add(5, 3));