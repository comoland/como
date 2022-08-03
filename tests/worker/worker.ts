console.log("called!!!")


// postMessage({ hi: 'there' })



Como.onMessage( (msg) => {
    // this is really implemented
    console.log("got a message from parent ===> ", msg)
    Como.postMessage(process.env)
})


// setInterval(() => {
//     console.log('VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV child running')
// }, 100)

// setInterval(() => {
//     postMessage({ hi: 'there' })
// }, 100)

// setInterval(() => {
//     // console.log("tick")
// }, 10)