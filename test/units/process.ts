import { suite, assert, sleep } from '../mod';

const test = suite('process');

test('it should call nextTick', async () => {
    const arr: any = [];

    process.nextTick(() => {
        arr.push(2);
    });

    process.nextTick(() => {
        arr.push(3);
    });

    arr.push(1);

    await sleep(1);
    assert.equal(arr, [1, 2, 3]);
});

test('process suspense', async () => {
    const list : any = [];
    const inter = setInterval(() => {
        // will run twice
        list.push('b')
    }, 90);

    process.suspense((unsuspense) => {
        list.push('a')
        setTimeout(() => {
            clearInterval(inter);
            list.push('c')
            unsuspense()
        }, 200)
    });

    list.push('d')
    console.log(list)
    assert.equal(list, ['a', 'b', 'b', 'c', 'd'])
});

test.run();
