const worker = Como.worker(import.meta.dir + '/worker1.js', function(msg) {
    console.log('PARENT: got message from worker1', msg)
    worker.terminate()
})

worker.postMessage({ from: 'parent' })

