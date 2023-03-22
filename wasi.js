import fs from 'fs';

const wasm = fs.readFileSync('./age_calculator.wasm')

// console.log(wasm.toString())

// setInterval(() => {
    const m =  WebAssembly.instantiate(wasm, {
        "env": {
            "log_i32": (v) => {
                console.log('log ==> ', v, typeof v)
            },
            "current_year": () => {
                return 2023
            }
        }
    })

// }, 100)

// m.instance.exports.get_age(1980)
console.log(m.instance.exports.get_age(1980))

let i = 0
setInterval(() => {
    i++;
m.instance.exports.log_age(1980+i)
}, 1)
// const result = m.instance.exports.add(1,20)

// m.instance.exports._start()

// console.log(result[0] + BigInt(-9))
