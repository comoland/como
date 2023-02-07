import { suite, assert, sleep, timeThis, promiso } from '../mod';

const test = suite('path');

test('should throw', () => {
    const dir = Como.path.resolve(import.meta.dir, './unknown')
    assert.throws(() => {
        Como.path.walk(dir, (file) => {
            console.log(file)
        })
    }, /no such file or directory/)

    assert.throws(() => {
        Como.path.walk(dir, 1 as any)
    }, /callback must be a function/)

    assert.throws(() => {
        Como.path.walk(undefined as any, 1 as any)
    }, /path must be a string/)
});

test('path walk', () => {
    const files : any[] = []
    const dir = Como.path.resolve(import.meta.dir, '../fixtures')
    Como.path.walk(dir, (file) => {
        files.push(file)
    })

    assert.ok(files.length > 0)
});

test.run()
