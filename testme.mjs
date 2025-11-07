// cتonst { Readable, Writable }  = require('stream')
import fs from 'fs/promises'
import * as b from 'web:blob'
import exec from 'std:exec';
console.log(Request)

const cmd = exec.command("echo", ["7777", "jjjj"])
cmd.stdout()
cmd.env()
await cmd.run()
console.log(cmd)
// await exec.command("echo", ["7777", "jjjj"]).stdout().run()
// import { Buffer } from 'buffer'
// import * as ms from 'fs.go'
console.log(parseInt('', 10));

// const { Readable } = await import("stream");
// const readableStream = Readable.from(["Hello", " ", "World", "!"]);

const fd =  await fs.open('./xxxxxx.mjs', 'w+')
// fd.xxx = function(){}
// console.log(fd)
const bb = Buffer.from("hello")

// bb.fill("\x09")
const c = await fd.write(bb)
console.log(c.buffer)
console.log(c.buffer instanceof Buffer)
console.log(bb.toString("ascii").length)
console.log(bb.toString("ascii"))
// const b = await fd.read(Buffer.from("xxxx".repeat(1000)))
// console.log(b.buffer.toString())
// setInterval(() => {
//     console.log("running")
// }, 500)

console.log(Buffer.from("م", "ascii").toString("utf8"))
await fd.close()
// console.time("BENCH")
// for (let i = 0; i < 10000; i++) {
//     // console.log("i ==========> ", i)
//     const r = fs.readFileSync('./README.md')
//     const r2 = fs.readFileSync('./testme.js')
//     // console.log(r.toString(), r2.toString())
// }
// console.timeEnd("BENCH")
// setTimeout(() => {

// }, 80000)

// // console.log("xxx", Readable)
// // import * as e from 'stream'
// // import { Readable, Writable } from 'stream';
// // // const m = require("util")
// // // // const process = require("process");
// // console.log(x)
// // // import * as v from 'internal/validators'
// // import * as util from 'util'
// // // console.log(v)
// // // v.validateString(6, 'string')
// // // import process from 'process'
// // // console.log(process.env)
// // // import * as stream from 'stream'

// // // console.log(stream)
// setInterval(() => {
// console.log("running")
// }, 1000)

// const pender = (fn) => {
//     let ret = undefined;
//     let err;
//     const m = new Promise(async (resolve, reject) => {
//         try {
//             ret = await fn()
//             resolve(ret)
//         } catch(e) {
//             err = e
//             reject(e)
//         }
//     });

//     const xx = globalThis.op_sync(m)
//     console.log({  xx })
//     // if (err) {
//     //     throw err
//     // }

//     return ret;
// }

// const mm = new Promise((resolve, reject) => {
//     console.log("running 2")
//     setTimeout(() => resolve('ddddddadasdasd'), 2000)
// });
// const rr = () => {
//     console.log("running called 1")
//     return new Promise((resolve, reject) => {
//         console.log("running 2")
//         setTimeout(() => reject(new Error("should")), 2000)
//     });
// }

// try {
//     const rb = op_sync(mm)

//     // await rr();

//     console.log("out xxxxxxxxxxxxxxxxx", rb)
// } catch {}

// console.log({ Readable, Writable  })
// const rb2 = pender(rr)

// console.log("out xxxxxxxxxxxxxxxxx", rb2)
