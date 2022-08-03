import { suite, assert, sleep } from './mod'

const Suite = suite("timers");

Suite('Simple timers',  async () => {
    const results: any = [];
    const expected = [1,2,3,4,5,6,7,8,9,10];

    setTimeout(() => {
        results.push(1)
        setTimeout((arg: number) => {
            results.push(arg)
            let b = arg + 1
            setInterval(function(this:any) {
                if (b === 10) {
                    clearInterval(this)
                }
                results.push(b++)
            }, 10)
        }, 10, 2)
    }, 10)

    await sleep(150);
    assert.equal(results, expected)
});

Suite.run();
