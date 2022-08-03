

const worker = Worker(import.meta.dir + '/worker.ts', function(msg) {
    console.log("go a message from worker", msg)
    // worker.terminate()
    // worker.postMessage("hhhhhhhhhhhh 2")
})

setInterval(() => {
    worker.postMessage("ssssss")
}, 1)
