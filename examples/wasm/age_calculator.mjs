import fs from 'fs';
import path from 'path'

const wasm = fs.readFileSync(path.resolve(import.meta.dirname, './age_calculator.wasm'))

const m =  await WebAssembly.instantiate(wasm, {
    "env": {
        "log_i32": (v) => {
            console.log('log ==> ', v, typeof v)
        },
        "current_year": () => {
            return 2023
        }
    }
})

console.log(m.instance.exports)
m.instance.exports.log_age(1980)
console.log(m.instance.exports.get_age(2050))
