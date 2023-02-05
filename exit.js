// console.log("cleared")

// console.log(process)

setTimeout(() => {
    console.log("timeout")
    // setInterval( () => {
    //     console.log("ssss last")
    //     // throw new Error("timeout")
    // })
})


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
//         throw new Error("timeout")
//     }, 2000)
// }


setInterval(() => {
    const worker = Como.worker2((() => {


    }).toString(), function XXXXXXXXX(e){
        console.log("got message from child ssssssssssssssssssssssssssssssssssssssssssss", e)
        // globalThis.closeChild()
        // worker.terminate()
    })

    // worker.postMessage("hiiiii")
    worker.terminate()


}, 20)


setTimeout(() => {
    console.log("ssssssssssssssssssssssssssssssssssssss")
    throw new Error("XXXXXXXXXX")
}, 100)

