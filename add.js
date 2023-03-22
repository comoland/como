import fs from 'fs';

const wasm = fs.readFileSync('./add.wasm')

// console.log(wasm.toString())

// setInterval(() => {
    const m =  WebAssembly.instantiate(wasm)

// }, 100)

console.log(m.instance.exports.add(7, 1))
// const result = m.instance.exports.add(1,20)