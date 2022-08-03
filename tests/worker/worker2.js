const arr = []
Como.onMessage((msg) => {
    arr.push(msg)
    console.log('WORDER2: got message from worker1 ', msg)
    Como.postMessage({
        arr,
        msg: 'from worker 2'
    })
})
