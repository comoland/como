
console.log(Como)
const e = Como.callThis('xxxxx', (a) => {
    console.log("should be called\n\n", a)
    return {hello : 9}
})

const n = setTimeout(function(...e){
    // clearTimeout(n)
    // console.log(this.__refed)
    console.log(e)
}, 1000, { hi: "there" }, "again", "them")
// console.log(n)
// clearTimeout(n)
// console.log(e)
let r = 0;
setInterval(function(){
    r++;
    if (r > 10) {
        clearInterval(this)
    }

    const n = setTimeout(function(...e){
        // clearTimeout(n)
        // console.log(this.__refed)
        console.log("last ==> ", e)
    }, 1000, { hi: "there" }, "again", "them")
    console.log('ssss')
}, 250)

setInterval(function(){
    r++;
    if (r > 10) {
        clearInterval(this)
    }
    const n = setTimeout(function(...e){
        // clearTimeout(n)
        // console.log(this.__refed)
        console.log(e)
    }, 1000, { hi: "there" }, "again", "them")
    console.log('ssss')
}, 20)
