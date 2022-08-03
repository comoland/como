console.log("worker called");


onmessage((msg) => {
    console.log("got message from parent ====> ", msg)
    Como.postMessage({ worker: 1, count: count++ });
});


let count = 0;

setInterval(() => {
    Como.postMessage({ worker: 1, count: count++ });
}, 100)


// setInterval(() => {
//     postMessage({ worker: 1, count: count++ });
//     // throw new Error(9)
// }, 1);

// throw new Error(9);
// setInterval(() => {
//     console.log("should be called")
//     // throw new Error(9)
// }, 300);


// (async () => {
//     for await (let { req, res } of Como.http(':9090')) {
//         res.body("not found")
//     }
// })()
