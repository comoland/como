import * as assert from 'assert'

// try {
  assert.equal({}, {xxx : 9}, "DDDDd")
// } catch (e) {
// throw new Error(e)
// //   throw new Error((JSON.stringify(e, null, 4)))
// }

const test = async () => {
  throw new Error("hello from error")
}

try {
  await test()
} catch(e) {
  throw e
}

console.log("passed !!!!")

// import fs from 'fs'
// import path from 'path'
// import os from 'os'
// import stream from 'react'
// console.log(fs, path, os)
// import react from 'react'
// import { EventTarget, Event } from 'event-target-shim'

// console.log(react)
// // constructor (was added to the standard on 8 Jul 2017)
// const myNode = new EventTarget();

// // passive flag (was added to the standard on 6 Jan 2016)
// myNode.addEventListener(
//   "hello",
//   (e) => {
//     console.log(JSON.stringify(e))
//     // e.preventDefault(); // ignored and print warning on console.
//   },
//   { passive: true }
// );

// const listener = (...xx) => {
//   console.log(xx)
// }

// // once flag (was added to the standard on 15 Apr 2016)
// myNode.addEventListener("hello", listener, { once: true });
// myNode.dispatchEvent(new Event("hello")); // remove the listener after call.
// myNode.dispatchEvent(new Event("hello")); // remove the listener after call.
// // signal (was added to the standard on 4 Dec 2020)
// // const ac = new AbortController();
// // myNode.addEventListener("hello", listener, { signal: ac.signal });
// // ac.abort(); // remove the listener.

// // class MyCustomEmitter extends EventTarget {
// //     constructor() {
// //       super();
// //     }

// //     emitMyEvent(data) {
// //       const event = new CustomEvent('myCustomEvent', { detail: data });
// //       this.dispatchEvent(event);
// //     }
// //   }

// //   const emitter = new MyCustomEmitter();

// //   emitter.addEventListener('myCustomEvent', (event) => {
// //     console.log('myCustomEvent received:', event.detail);
// //   });

// // emitter.emitMyEvent('Hello from Bun!');

// // fs.readFileSync("./watch.js","utf8", (m, r) => {

// // })

// // console.log(r)
// // await import("XXX").then((e) => console.log(e), 1)

// // const t = {
// //     X: 1,
// //     default: 8
// // }
// globalThis[Symbol('ddddddd')] = 1
// // export const { X } = t
// const syms = Object.getOwnPropertySymbols(globalThis);
// for (const s of syms) console.log(s.description);
// console.log({ FormData, syms, xxx: 9 });

// // const blob = new Blob(["PASS"]);
// // const text = await blob.text();
// Como.test("test 1 - fs write", () => {
//   console.log(1)
//   throw new Error(9);
// });


// setTimeout(() => {
//   Como.test.run()
// }, 1000)