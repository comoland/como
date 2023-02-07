import { suite, assert } from '../../../mod';

const test = suite('Thread2');

async function Test() {
    return new Promise(resolve => {
        const worker = Como.worker2(import.meta.dir + '/worker.ts', msg => {
            worker.terminate();
            resolve(msg);
        });

        worker.postMessage('Bar');
    });
}

test('worker basics', async () => {
    const v = await Test();
    assert.equal(v, { foo: 'Bar' });
});

test.run();
