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

(async () => {
    for (let i = 0; i < 1000; i++) {

        const w = Como.worker('./exit.js', ()=> {})

        // const worker = await test()
        // await worker.exec("start")
        const t =  w.terminate();


        console.log("terminated", t)
    }
})();

setTimeout(() => {

}, 800000);