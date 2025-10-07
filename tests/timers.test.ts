import { test, sleep, describe, assert, timeThis, promiso } from '../runner';

describe('timers', async ({ test }) => {
    test('setTimeout should execute callback after delay', async () => {
        let executed = false;
        setTimeout(() => {
            executed = true;
        }, 10);

        await sleep(20);
        assert.ok(executed, 'setTimeout callback should execute');
    });

    test('setTimeout should return a timer ID', () => {
        const timerId = setTimeout(() => {}, 100);
        assert.ok(timerId !== undefined, 'setTimeout should return a value');
        assert.ok(timerId !== null, 'timer ID should not be null');
        clearTimeout(timerId);
    });

    test('clearTimeout should prevent callback execution', async () => {
        let executed = false;
        const timerId = setTimeout(() => {
            executed = true;
        }, 50);

        clearTimeout(timerId);
        await sleep(60);
        assert.ok(!executed, 'clearTimeout should prevent callback execution');
    });

    test('setInterval should execute callback repeatedly', async () => {
        let count = 0;
        const intervalId = setInterval(() => {
            count++;
        }, 10);

        await sleep(35);
        clearInterval(intervalId);
        assert.ok(count >= 3, 'setInterval should execute multiple times');
    });

    test('clearInterval should stop interval execution', async () => {
        let count = 0;
        const intervalId = setInterval(() => {
            count++;
        }, 10);

        await sleep(25);
        clearInterval(intervalId);
        const initialCount = count;
        await sleep(20);
        assert.equal(count, initialCount, 'clearInterval should stop execution');
    });

    test('multiple clearTimeout calls should be safe', () => {
        const timerId = setTimeout(() => {
            assert.ok(0, 'This should not execute');
        }, 100);

        clearTimeout(timerId);
        clearTimeout(timerId);
        clearTimeout(timerId);

        // Test passes if no assertion error is thrown
        assert.ok(true, 'Multiple clearTimeout calls should be safe');
    });

    test('setImmediate should execute callback on next tick', async () => {
        let executed = false;
        setImmediate(() => {
            executed = true;
        });

        await sleep(5);
        assert.ok(executed, 'setImmediate should execute on next tick');
    });

    test('clearImmediate should prevent immediate execution', async () => {
        let executed = false;
        const immediateId = setImmediate(() => {
            executed = true;
        });

        clearImmediate(immediateId);
        await sleep(5);
        assert.ok(!executed, 'clearImmediate should prevent execution');
    });

    test('timer IDs should be unique', () => {
        const timer1 = setTimeout(() => {}, 100);
        const timer2 = setTimeout(() => {}, 100);
        const interval1 = setInterval(() => {}, 100);
        const interval2 = setInterval(() => {}, 100);

        assert.ok(timer1 !== timer2, 'setTimeout IDs should be unique');
        assert.ok(interval1 !== interval2, 'setInterval IDs should be unique');
        assert.ok(timer1 !== interval1, 'Different timer types should have different IDs');

        clearTimeout(timer1);
        clearTimeout(timer2);
        clearInterval(interval1);
        clearInterval(interval2);
    });

    test('timers should handle zero delay', async () => {
        let executed = false;
        setTimeout(() => {
            executed = true;
        }, 0);

        await sleep(5);
        assert.ok(executed, 'setTimeout with zero delay should execute');
    });
});

test('it should time out', () => {
    const timer = setTimeout(() => {
        assert.ok(0);
    });

    const timer2 = setInterval(() => {
        assert.ok(0);
    });

    setInterval(function (this: any) {
        clearTimeout(this);
    });

    clearTimeout(timer);
    clearInterval(timer2);
});

test('nested timers', async () => {
    const results: any = [];
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    setTimeout(() => {
        results.push(1);
        setTimeout(
            (arg: number) => {
                results.push(arg);
                let b = arg + 1;
                let int = setInterval(function (this: any) {
                    if (b === 10) {
                        clearInterval(int);
                    }
                    results.push(b++);
                }, 10);
            },
            10,
            2
        );
    }, 10);

    await sleep(150);
    assert.equal(results, expected);
});

test('nested correct time', async () => {
    const t = timeThis();
    setTimeout(() => {
        setTimeout(() => {
            setTimeout(() => {
                setTimeout(() => {
                    setTimeout(() => {
                        setTimeout(() => {
                            t.end();
                        }, 100);
                    }, 100);
                }, 100);
            }, 100);
        }, 100);
    }, 100);

    await sleep(750);
    assert.ok(t.get() > 600);
    assert.ok(t.get() < 650, 'time should be between 600 and 650');
});

test('it should be called on Timeout', async () => {
    const msg = await new Promise(resolve => {
        setTimeout(() => {
            resolve('called');
        }, 1);
    });

    assert.equal(msg, 'called');
});

test('it should access arguments', async () => {
    const arr = Array.from(Array(10).keys());
    const result: any = [];
    arr.forEach(key => {
        setTimeout(
            (arg: number) => {
                result.push(arg);
            },
            key * 2,
            key
        );
    });

    await sleep(60);
    assert.equal(result, arr);
});

test('async timers', async () => {
    const p = promiso();

    const prom = (ms: number) =>
        new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('done');
            }, ms);
        });

    let r = 0;
    setInterval(async function (this: any) {
        await prom(1000);
        clearInterval(this);
        if (++r === 10) {
            p.resolve();
        }
    }, 100);

    await p.promise;
    assert.equal(r, 10);
});
