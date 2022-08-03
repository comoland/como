
const obj = {
    fn: () => {},
    test: [ "hello" ]
}

const ret = Como.Get(obj)
console.log(Como.Reflect(obj))
// obj.fn()
console.log(obj.test[0])

// setTimeout(() => {
//     console.log("called")
// }, 1000)
