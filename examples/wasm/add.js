import fs from 'fs';

const wasm = fs.readFileSync(Como.path.resolve(import.meta.dir, './add.wasm'));
const m =  WebAssembly.instantiate(wasm);
console.log(m.instance.exports.add(7, 1));
