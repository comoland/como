import { suite, assert, sleep, timeThis, promiso } from '../mod';

const test = suite('workers');

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

test.run();
