// console.log("cleared")

// console.log(process)

// setTimeout(() => {
//     console.log("timeout")
//     setInterval( () => {
//         console.log("ssss last")
//         throw new Error("timeout")
//     })
// })


// setInterval( () => {
//     console.log("ssss")
//     // throw new Error("timeout")
// }, 10)


// setInterval( () => {
//     console.log("ssss")
//     // throw new Error("timeout")
// }, 1)



// setInterval( () => {
//     console.log("ssss last")
//     throw new Error("timeout")
// }, 1000)

// for (let i = 0; i < 5; i++) {
//     setTimeout(() => {
//         // throw new Error("timeout")
//     }, 2000)
// }

let i = 0
// setInterval(() => {
    const worker = Como.worker2(`
        globalThis.onmessage = function(msg) {
            (async () => {
                setTimeout(() => {
                    console.log("got message from parent ", msg)
                    // throw new Error('ss xxxxxxxxxxxxxxxxxxxxxx')
                    postMessage("hi")
                }, 1)
            })();
        };

    `, function XXXXXXXXX(e){
        console.log("got message from child ssssssssssssssssssssssssssssssssssssssssssss ", i++, e)
        // globalThis.closeChild()
        worker.terminate()
    }, {
        isCode: true,
        filename: "worker2.js",
    })

    worker.postMessage("hiiiii")
    // worker.terminate()
// }, 20)


// setTimeout(() => {
//     console.log("ssssssssssssssssssssssssssssssssssssss")
//     throw new Error("XXXXXXXXXX")
// }, 5000)
