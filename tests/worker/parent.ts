
// const worker = new Como.worker(import.meta.dir + '/worker.ts');
// console.log(worker)

(function() {
    const worker = Como.worker(import.meta.dir + '/worker.ts', function(msg) {
        console.log("go a message from worker", msg)
      })

    setTimeout(() => {
        worker.postMessage("hhhhhhhhhhhh")
        worker.terminate()
    }, 500)
})();


(function() {
    const worker = Como.worker(import.meta.dir + '/worker.ts', function(msg) {
        console.log("go a message from worker", msg)
        worker.postMessage("hhhhhhhhhhhh 2")
    })

    setInterval(() => {
        console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX parent running')
    }, 1)

    setTimeout(() => {
        worker.postMessage(process.env)
        // worker.terminate()
    }, 500)


    setTimeout(() => {
        // worker.postMessage("hhhhhhhhhhhh 2")
        worker.terminate()
    }, 1000)
})();

(function() {
    const worker = Como.worker(import.meta.dir + '/worker.ts', function(msg) {
        console.log("go a message from worker", msg)
        worker.postMessage("hhhhhhhhhhhh 2")
    })

    setInterval(() => {
        console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX parent running')
    }, 1)

    setTimeout(() => {
        worker.postMessage(process.env)
        // worker.terminate()
    }, 500)


    setTimeout(() => {
        // worker.postMessage("hhhhhhhhhhhh 2")
        worker.terminate()
    }, 1000)
})();

(function() {
    const worker = Como.worker(import.meta.dir + '/worker.ts', function(msg) {
        console.log("go a message from worker", msg)
        worker.postMessage("hhhhhhhhhhhh 2")
    })

    setInterval(() => {
        console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX parent running')
    }, 1)

    setTimeout(() => {
        worker.postMessage(process.env)
        // worker.terminate()
    }, 500)


    setTimeout(() => {
        // worker.postMessage("hhhhhhhhhhhh 2")
        worker.terminate()
    }, 10000)
})();

(function() {
    const worker = Como.worker(import.meta.dir + '/worker.ts', function(msg) {
        console.log("go a message from worker", msg)
        worker.postMessage("hhhhhhhhhhhh 2")
    })

    // setInterval(() => {
    //     console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX parent running')
    // }, 100)

    setTimeout(() => {
        worker.postMessage(process.env)
        // worker.terminate()
    }, 500)


    setTimeout(() => {
        // worker.postMessage("hhhhhhhhhhhh 2")
        worker.terminate()
    }, 1500)
})();
