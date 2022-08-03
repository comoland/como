import { suite, assert, sleep } from '../../../mod';

const worker = new Worker( import.meta.dir + '/worker.ts');

const test = suite("worker message")

const arr: any = [];
async function run() {
    return new Promise((resolve) => {
        worker.onmessage((data) => {
            console.log(data)
            arr.push(data.count);
            if (data.count === 100) {
                worker.terminate()
                resolve(arr)
            }
        })
    })
}

test("sss", async () => {
    const values = await run()
    assert.equal(arr, Array.from(Array(101), (_,x) => x))
    console.log(values)
})

test.run();
