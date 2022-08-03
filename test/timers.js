// import { bench } from './mod'

// const end = bench()
Array.from(Array(100).keys()).forEach((key) => {
    const m = setInterval(function(arg) {
        clearTimeout(this)
        console.log(key)
    }, key, key)

    clearTimeout(m)
})

// end()


setInterval(function() {
    clearTimeout(this)
    console.log('hello xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    // throw new Error("sss")
}, 500)
