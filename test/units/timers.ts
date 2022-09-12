import { suite, assert, sleep, timeThis } from '../mod';

const test = suite("timers")

test("multi clears", () => {
    const timer = setTimeout(() => {
        assert.ok(0)
    })

    setInterval(function(this: any) {
        clearTimeout(this)
    })

    clearTimeout(timer)
    clearTimeout(timer)
    clearTimeout(timer)
})

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

test('nested timers',  async () => {
    const results: any = [];
    const expected = [1,2,3,4,5,6,7,8,9,10];
    setTimeout(() => {
        results.push(1)
        setTimeout((arg: number) => {
            results.push(arg)
            let b = arg + 1
            let int = setInterval(function(this:any) {
                if (b === 10) {
                    clearInterval(int)
                }
                results.push(b++)
            }, 10)
        }, 10, 2)
    }, 10)

    await sleep(150);
    assert.equal(results, expected)
});

test('nested correct time',  async () => {
    const t = timeThis();
    setTimeout(() => {
        setTimeout(() => {
            setTimeout(() => {
                setTimeout(() => {
                    setTimeout(() => {
                        setTimeout(() => {
                            t.end();
                        }, 100)
                    }, 100)
                }, 100)
            }, 100)
        }, 100)
    }, 100)

    await sleep(750);
    assert.ok(t.get() > 600)
    assert.ok(t.get() < 650, 'time should be between 600 and 650');
});


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
