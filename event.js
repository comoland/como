// process.env.COUNTER = "1"
// import { sleep } from './runner'
// // import React from 'react'
// /// this is the code ///////////////////////
// // const { createRequire } = await import("module");
// // globalThis.require = createRequire(import.meta.filename);
// // process.env.NODE_ENV = 'production'
// const { main } = require("./tests/fixtures/require/file1")



// require("./tests/fixtures/require/file1")
// require("./tests/fixtures/require/file2")

// console.log({ main }, process.env.COUNTER)

// const React = require("react")
// const rrr = require("react-dom")

// console.log({rrr, React})

// setTimeout(() => {
//     throw new Error(9)
// }, 1000)



// setTimeout(() => {
//     throw new Error(9)
// }, 5000)

// console.log(module)
const r = require("./fs2")
console.log({ r })
setTimeout(() => {
    console.log("xxx")
}, 500)


// process.suspense(async (un) => {
//     console.log("called")

//     await sleep(3000)
//     un()
//     // setTimeout(() => {
//     //     un()
//     // }, 3000)

// })

// // await sleep(5000)

// console.log("called")
