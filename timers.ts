// import timers from 'timers-browserify-full'

// console.log(timers.setTimeout)
// Array.from(Array(500000).keys()).forEach((i) => {
//     timers.setTimeout((arg) => {
//         console.log(arg)
//     }, 100, i)
// })



// // console.log('done')

// // setTimeout(() => {

// // }, 500000)

// var i = 0
// const again = () => {
//     timers.setTimeout((arg) => {
//         console.log(arg)
//         again()
//     }, 1, i++)
// }

// again();


async function test() {
    const worker = Como.createWorker(async (action: string) => {

        console.log("action ===> ", action);
        let server: any;
        if (action === 'start') {

            // setTimeout(() => {
            //     console.log("should not run")
            // }, 100)
            // server = await app.start();
        }

        // else {
        //     if (server) {
        //         await server.stop()
        //     }
        // }
    }, { pool: 1 })

    return worker

    // worker.exec('start')




    // setTimeout(async () => {
    //     // await worker.exec('stop').catch((e) => console.log("error", e))
    //     worker.terminate()
    //     await test()
    // }, 100)
    // e.terminate()
};

// (async () => {
//     for (let i = 0; i < 1000; i++) {

//         const w = Como.worker2('process.go', ()=> {})

//         // const worker = await test()
//         // await worker.exec("start")
//         const t =  w.terminate();


//         console.log("terminated", t)
//     }
// })();


setInterval(() => {
    // const w = Como.worker2('process3.go', ()=> {
    //     console.log("u8uuuuuuuuuuuuuuuuuuuuu")
    // })
    // w.terminate()

    const w = Como.createWorker(async () => {
        setTimeout(() => {
            import("jsrsasign").then((r) => {
                import("react")
                // console.log("u8uuuuuuuuuuuuuuuuuuuuu", typeof r)
            })
        }, 100)
    })

    w.exec()

    setTimeout(() => {
        w.terminate()
        console.log('terminated')
    }, 105)

}, 10)

setTimeout(() => {

}, 800000);