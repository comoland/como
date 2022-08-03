

// (async function(){
//     for await (let req of Como.http(":8080")) {

//         req.body('sssssssssss')
//         // setTimeout(async () => {
//         //     console.log('open a new server')
//         //     for await (let req of Como.http(":8080")) {
//         //         req.body('333333')
//         //         return
//         //     }
//         // }, 1000)

//         return

//     }
// })();

(async function(){
    for await (let { req, res } of Como.http(":8080")) {
        // req.query.ttt
        res.body('rrrrrrrrrrrrrrrrrrrrrrrr ' + req.uri)
        // return
    }
})();


// setTimeout(() => {
//     console.log('now out')
// }, 5000)