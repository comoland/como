const worker = Como.worker2(`
// throw new Error('worker2')
    setTimeout(() => {
        globalThis.postMessage("should be called and then terminated")

    }, 5000)
`, function XXXXXXXXX(e){
    console.log("got data finally ", e)
    // throw e
    // console.log("got message from child ssssssssssssssssssssssssssssssssssssssssssss ", i++, e)
    // globalThis.closeChild()
    // worker.terminate()
}, {
    isCode: true,
    filename: "worker2.js",
})


// throw new Error("sss")