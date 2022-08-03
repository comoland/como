import { suite, assert, sleep } from '../mod';

const test = suite("process")

test("it should call nextTick", async () => {
    const arr : any = []

    process.nextTick(() => {
        arr.push(2)
    })

    process.nextTick(() => {
        arr.push(3)
    })

    arr.push(1)

    await sleep(1)
    assert.equal(arr, [1,2,3])
})

test.run()
