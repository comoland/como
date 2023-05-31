import fs from 'fs';

const wasm = fs.readFileSync(Como.path.resolve(import.meta.dir, './greet-go.wasm'))

const m =  WebAssembly.instantiate(wasm, {
    "env": {
        "log": (offset, byteCount) => {
            // m.instance.exports.memory.write(offset + 10, Buffer.from("sssss"))
            const v = m.instance.exports.memory.read(offset, byteCount)
            console.log('log ==> ', Buffer.from(v).toString());
        },
    }
})

console.log(m.instance.exports)

const name = Buffer.from('WAZEROXXX Mad')
const p = m.instance.exports.malloc(name.length)
m.instance.exports.memory.write(p, name)
console.log({ p })

m.instance.exports.greet(p, name.length)

const p2 = m.instance.exports.greeting(p, name.length)
console.log({ p2, pp:  Number(BigInt.asUintN(64, BigInt(p2)) >> BigInt(32)) })

// setTimeout(() => {
//     m.instance.exports.deallocate(p2, 15)
// })


const v = m.instance.exports.memory.read((BigInt.asUintN(64, BigInt(p2)) >> BigInt(32)), p2)
console.log('log xxxxxxxxx ==> ', Buffer.from(v).toString());
