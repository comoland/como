import { suite, assert } from '../../../mod';

const test = suite("Thread1")

async function Test() {
    return new Promise((resolve) => {
        const worker = Como.worker(import.meta.dir + '/worker.ts', (msg) => {
            worker.terminate()
            resolve(msg)
        })
    })
}

test("worker basics", async () => {
    const v = await Test()
    assert.equal(v, "Hi")
})

test.run()
