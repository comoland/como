// const Throttle = () => {
//     let currentRequests = [];
//     let maxConcurrentRequests = 3;
//     let runningRequests = 0;

//     const tryRun = async () => {
//         if (runningRequests >= maxConcurrentRequests) {
//             return
//         }

//         const fist = currentRequests.shift();
//         if (fist) {
//             runningRequests++;
//             const r = await fist.fn()
//             fist.resolve(r)
//             // console.log("resolved", r)
//             runningRequests--;
//             tryRun()
//         }
//     }

//     return {
//         aquire: async (fn) => {
//             return new Promise((resolve, reject) => {
//                 currentRequests.push({
//                     resolve,
//                     reject,
//                     fn
//                 });

//                 tryRun();
//             })
//         },
//         release: () => {
//             runningRequests--;
//             tryRun()
//         }
//     }
// };

// const thro = Throttle();

// (async () => {


//     console.log("start")

//     // setInterval(() => {
//     //     thro.release()
//     //     console.log("running")
//     // }, 100)
//     try {
//         // console.log( await thro.aquire(() => 1));
//         console.log( await thro.aquire(() => new Promise(r => setTimeout(r, 2000, 1))));
//         // thro.release()

//     } catch(e) {
//         console.log("error ==> ", e)
//     }
// })();



// (async () => {


//     console.log("start")

//     // setInterval(() => {
//     //     thro.release()
//     //     console.log("running")
//     // }, 100)
//     try {
//         // console.log( await thro.aquire(() => 1));
//         console.log(await thro.aquire(() => new Promise(r => setTimeout(r, 2000, 2))));
//         // thro.release()

//     } catch(e) {
//         console.log("error ==> ", e)
//     }
// })();


// (async () => {


//     console.log("start")

//     // setInterval(() => {
//     //     thro.release()
//     //     console.log("running")
//     // }, 100)
//     try {
//         // console.log( await thro.aquire(() => 1));
//         console.log( await thro.aquire(() => new Promise(r => setTimeout(r, 2000, 3))));
//         thro.release()


//     } catch(e) {
//         console.log("error ==> ", e)
//     }
// })();


// Como.thread(async (parent) => {
//     console.log("child loaded", { parent })

//     setInterval(() => {
//         console.log("child running")
//     }, 100)

//     // parent.onData = (data) => {
//     //     console.log("data from parent ==>", { data })
//     //     parent.send(data)
//     // }

//     parent.on("data", (data) => {
//         // parent.send(data + " pong")
//         console.log("data from parent ==>", { data })
//         parent.send(data)
//     });
// }).then((child) => {
//     console.log("parent ", { child })
//     child.on("data", (data) => {
//         console.log("data from child  ==> ", data)
//         // child.send(data)
//     })

//     child.send(JSON.stringify({ Hi: "there" }))
//     // child.send({ Hi: "there 2" })
//     // child.send({ Hi: "there 3" })
//     var i = 0;
//     setInterval(async () => {
//         child.send((JSON.stringify({ Hi: "there " + i++ })))
//     }, 1)
// })


Como.thread(async (parent) => {
    console.log("child loaded", { parent })
    const { test } = await import('./imp.js')
    console.log({ test })


    parent.on("data", (data) => {
        console.log("got data", { data })
        parent.send(test())
    })

    // parent.onData = (data) => {
    //     console.log("got data", { data })
    //     parent.send(data)
    // }
}).then(async (child) => {
    console.log("parent ", { child })

    // child.onData = (data) => {
    //     console.log(data)
    // }

    child.on("data", (data) => {
        console.log("data from child ===> ", data)
    })

    child.send(JSON.stringify({ Hi: "there 1" }))
    // child.send({ Hi: "there 2" })
    // child.send({ Hi: "there 3" })


    // var i = 0;
    // setInterval(() => {
    //     child.send(JSON.stringify({ Hi: "there " + i++ }))
    // }, 1)
    // child.on("data", (data) => {
    //     console.log(data)
    //     child.send("ping")
    // })

    // child.send("ping")
})

setTimeout(() => {

}, 1000)



await fetch('http://google.com').then((res) => {
    console.log("ddddddd", res)
})