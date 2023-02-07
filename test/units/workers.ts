import { suite, assert } from '../mod';

const test = suite('workers cb');

test('async worker', async () => {
    const workerData = await Como.asyncWorker(async (args: any) => {
        return {
            data: 'worker ran perfectly'
        };
    });

    assert.equal(workerData, { data: 'worker ran perfectly' });
});

test('async worker import async return', async () => {
    const isError = await Como.asyncWorker((args: any) => {
        throw new Error('test');
    }).catch(e => {
        return new Error(e.message);
    });

    assert.ok(isError instanceof Object);
});

test('async worker import meta', async () => {
    const workerData = await Como.asyncWorker(async (args: any) => {
        return {
            ...import.meta
        };
    });

    assert.equal(workerData, { ...import.meta, main: true });
});

test('async worker import', async () => {
    const { test } = await import('../fixtures/import-from-worker');
    assert.equal(test(1), 2);
    const workerData = await Como.asyncWorker(async (args: any) => {
        const { test } = await import('../fixtures/import-from-worker');
        return {
            num: test(1),
            data: 'worker ran perfectly'
        };
    });

    assert.equal(workerData, { data: 'worker ran perfectly', num: 2 });
});

test('async worker import async return', async () => {
    const { test } = await import('../fixtures/import-from-worker');
    assert.equal(test(1), 2);
    const workerData = await Como.asyncWorker(async (args: any) => {
        const { test } = await import('../fixtures/import-from-worker');

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve({
                    num: test(2),
                    data: 'worker ran perfectly'
                });
            }, 2000);
        });
    });

    assert.equal(workerData, { data: 'worker ran perfectly', num: 3 });
});

test('create worker', async () => {
    const worker = Como.createWorker(async (args: { data: any }) => {
        return args;
    });

    const ret = await worker.exec({ data: 'worker ran perfectly' });
    const ret2 = await worker.exec({ data: 'worker ran perfectly 2' });

    assert.equal(ret, { data: 'worker ran perfectly' });
    assert.equal(ret2, { data: 'worker ran perfectly 2' });
    worker.terminate();
});

test('worker errors', async () => {
    const workerFn = async (args: { data: any }) => {
        const nested = () => {
            throw new Error('some error xxx');
        };

        const r = 8;
        const b = 9;

        nested();
        return { p: 9 };
    };

    const worker = Como.createWorker(workerFn);

    const err = await worker.exec({ data: 'worker ran perfectly' }).catch((e: Error) => e);

    if (!(err instanceof Error)) {
        throw err;
    }

    assert.ok(err.message.includes('some error xxx'));
    assert.ok(err.stack?.includes('throw new Error("some error xxx")'));
    worker.terminate();
});

test('create worker', async () => {
    const worker = Como.createWorker(
        async (args: number) => {
            return args;
        },
        { pool: 5 }
    );

    const arr = Array.from(Array(200).keys());
    const promises = arr.map(i => {
        return worker.exec(i);
    });

    const ret = await Promise.all(promises);
    worker.terminate();
    assert.equal(ret, arr);
});

test('create worker single should not lock', async () => {
    const worker = Como.createWorker(
        async (args: number) => {
            return args;
        },
        { pool: 1 }
    );

    const arr = Array.from(Array(5000).keys());
    const promises = arr.map(i => {
        return worker.exec(i);
    });

    const ret = await Promise.all(promises);
    worker.terminate();
    assert.equal(ret, arr);
});

test('create worker dispatch', async () => {
    const worker = Como.createWorker(
        async (action: string) => {
            if (action === 'a') {
                return 'a';
            } else {
                return 'b';
            }
        },
        { pool: 3 }
    );

    worker.exec('a');
    worker.exec('a');
    const a = worker.exec('a');
    worker.exec('a');
    const b = worker.exec('b');
    worker.exec('a');
    worker.exec('a');

    // assert.equal(a, 'a');
    assert.equal(await b, 'b');
    assert.equal(await a, 'a');

    worker.terminate();
});

test('nested workers', async () => {
    const worker = Como.createWorker(
        async (arg: string) => {
            return new Promise(async resolve => {
                const worker = Como.createWorker(
                    async (arg: string) => {
                        return new Promise(resolve => {
                            resolve(arg + 'b');
                        });
                    },
                    { pool: 2 }
                );

                const ab = await worker.exec(arg);
                // we don't need to terminate nested workers
                // worker.terminate();
                resolve(ab);
            });
        },
        { pool: 3 }
    );

    const a = await worker.exec('a');
    worker.terminate();
    assert.equal(await a, 'ab');
});

test('graceful exit', async () => {
    Como.worker2(`
        setTimeout(() => {
            throw new Error("should exit gracefully")
        }, 1000)
    `,
        () => {},
        {
            isCode: true,
            filename: 'worker2.js'
        }
    );
});

test('multiple terminate should not lock', async () => {
    const worker = Como.worker2(`
        globalThis.onmessage = () => {
            postMessage(1)
        }
    `,
        () => {
            worker.terminate();
        },
        {
            isCode: true,
            filename: 'worker2.js'
        }
    );

    worker.postMessage({ type: 'terminate' });
    worker.terminate();
    worker.terminate();
});

test('throw inside a worker should not terminate main process', async () => {
    const worker = Como.worker2(`
        throw new Error("error from worker")
    `,
        () => {
            worker.terminate();
        },
        {
            isCode: true,
            filename: 'worker2.js'
        }
    );
});

test.run();
