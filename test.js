import { exit } from 'process.go'

// console.log(typeof Worker)

const worker = Como.worker('./work.js', (arg) => {
    console.log('got message from worker xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  ====> ', arg)
})


let count = 0

// worker.onmessage((arg) => {
//     // worker.postMessage({  parent: 1, ount: count++ })
//     console.log('got message from worker xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  ====> ', arg)
// })

// worker.postMessage({  parent: 1, ount: count++ })

// // throw new Error("s")

setTimeout((e) => {
    worker.postMessage({  parent: 1, ount: count++ })
    worker.terminate()
}, 1000)



// setInterval(() => {
//     worker.postMessage("hi!!!!!!!")
// }, 1)


// setTimeout((e) => {
//     console.log("terminate worker")
//     worker.terminate()
// }, 500)

// setTimeout((e) => {
//     worker.terminate()
// }, 1000)

// let i = 0;
// const e1 = setInterval(function(){
//     if (i++ > 10) {
//         clearTimeout(this)
//     }
//     print("dddd")
// }, 100)


// // clearTimeout(e1)

// setTimeout(() => {
//     console.log({  ff: 9999 })
// }, 100);

// // function test() {

// // }

// const e = new test()
// console.log(e.test())

// const e2 = new test('ggg')
// console.log(e2.test())

// console.log(e.num, e === e2)
// console.log(import.meta.url)

// print("ok")
// process.exit(1)

// setInterval(() => {
//     // print("8888888888")
// }, 2000)