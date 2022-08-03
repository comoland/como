import { worker } from './pool'

worker('calc', async (data) => {
    if (data.foo === "Bar1") {
        // throw new Error('sssssss from aaaaa')
    }

    return {
        foo: "Bar calc" + " " + data.foo
    }
})

worker('test', async (data) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log('should not be called')
            resolve({
                foo: "Bar test" + " " + data.foo
            })
        }, 2000)
    })
})
