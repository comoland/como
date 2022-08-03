import { suite, assert, sleep } from '../mod';

const test = suite("timers")

test("it should time out", () => {
    const timer = setTimeout(() => {
        assert.ok(0)
    })

    const timer2 = setInterval(() => {
        assert.ok(0)
    })

    setInterval(function(this: any) {
        clearTimeout(this)
    })

    clearTimeout(timer)
    clearInterval(timer2)
})


test("it should be called on Timeout", async () => {
    const msg = await (new Promise((resolve) => {
        setTimeout(() => {
            resolve('called')
        }, 1)
    }))

   assert.equal(msg, "called")
})

test('it should access arguments', async () => {
    const arr = Array.from(Array(10).keys())
    const result: any = []
    arr.forEach((key) => {
        setTimeout((arg: number) => {
            result.push(arg)
        }, key * 2, key)
    })

    await sleep(60)
    assert.equal(result, arr)
})

test.run()
