import { suite, assert } from '../../../mod';

const test = suite('Thread1');

async function Test() {
    return new Promise(resolve => {
        const worker = Como.worker2(import.meta.dir + '/worker.ts', msg => {
            console.log("go message", msg);
            worker.terminate();
            resolve(msg);
        });

        worker.terminate();
    });
}

test('worker basics', async () => {
    const v = await Test();
    assert.equal(v, 'Hi');
});

test.run();
