const m = setInterval(function() {
    // clearTimeout(this)
    // clearTimeout(m)
    console.log('called')
}, 200)



const inter = setTimeout(() => {
    console.log('called timeout')
    clearInterval(m)
}, 1000)


const prom = (ms) => new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve('done')
    } , ms)
})


const promiso = async () => {
    let resolve;
    let reject;

    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    })

    return {
        promise,
        resolve,
        reject,
    }
}

let r = 0
setInterval(async function() {
    await prom(1000);
    console.log('called xxxx ' + r++)
    clearInterval(this)
}, 100);

// const m4 = setTimeout(function() {
//     clearTimeout(inter)
//     console.log('called 10000')
// }, 1000)

// clearTimeout(m)

// const t = setInterval(function(){
//      setInterval(function(){
//         clearTimeout(this);
//         console.log('before error called')
//         // throw new Error("5")
//         // return
//         console.log('called 2   ', this)
//     }, 1000)

//     clearTimeout(t);
//     console.log('called 2    ', this)
// }, 1000)
// clearInterval(t)
// const t = setInterval(() => {
//     console.log('called')
// }, 1000)




// console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssss", t)