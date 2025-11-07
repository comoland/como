const { Readable, Writable }  = require('stream')
import fs from 'fs'
import * as all from './tests/runner'


console.log({ all })
console.log(fs)
const bb = require("buffer")
const r = await fs.readFile('./README.md')
console.log(r.toString())
// console.log("xxx", Readable)
// import * as e from 'stream'
// import { Readable, Writable } from 'stream';
// // const m = require("util")
// // // const process = require("process");
// console.log(x)
// // import * as v from 'internal/validators'
// import * as util from 'util'
// // console.log(v)
// // v.validateString(6, 'string')
// // import process from 'process'
// // console.log(process.env)
// // import * as stream from 'stream'

// // console.log(stream)
setInterval(() => {
console.log("running")
}, 1000)

const pender = (fn) => {
    let ret = undefined;
    let err;
    const m = new Promise(async (resolve, reject) => {
        try {
            ret = await fn()
            resolve(ret)
        } catch(e) {
            err = e
            reject(e)
        }
    });

    const xx = globalThis.op_sync(m)
    console.log({  xx })
    // if (err) {
    //     throw err
    // }

    return ret;
}

const mm = new Promise((resolve, reject) => {
    console.log("running 2")
    setTimeout(() => resolve('ddddddadasdasd'), 2000)
});
const rr = () => {
    console.log("running called 1")
    return new Promise((resolve, reject) => {
        console.log("running 2")
        setTimeout(() => reject(new Error("should")), 2000)
    });
}

try {
    const rb = op_sync(mm)

    // await rr();

    console.log("out xxxxxxxxxxxxxxxxx", rb)
} catch {}

console.log({ Readable, Writable, bb  })
const rb2 = pender(rr)

console.log("out xxxxxxxxxxxxxxxxx", rb2)
