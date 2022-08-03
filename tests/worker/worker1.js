const worker = Como.worker(import.meta.dir + '/worker2.js', function(msg) {
    console.log('WORKER1: got message from worker2', msg)
    // worker.terminate()
    Como.postMessage('from worker 1')
})

Como.onMessage((msg) => {
    console.log('WORKER1: got message from parent', msg)
    worker.postMessage('from worker 1')
})
