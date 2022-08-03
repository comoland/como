
let count = 0;

setInterval(() => {
    // if (count++ === 50) {
    //     throw new Error(0)
    // }

    postMessage({ worker: 1, count: count++ })
}, 1);
