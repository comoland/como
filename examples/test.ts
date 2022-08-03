import { pool } from './pool';

const p = pool(import.meta.dir + '/worker.ts', 2);

(async function test() {
    console.log('sssss')
    try {
        const v = await p.exec('calc', { foo: "Bar1" });
        console.log('sssssssssssssssss 1 => ', v);
    } catch(e){
        console.log('error occured => ', e)
    }
})();

(async function test() {
    console.log('sssss')
    const v = await p.exec('test', { foo: "Bar2" });
    console.log('sssssssssssssssss 2 => ', v);
})();

setTimeout(() => {
    // p.terminate()
}, 500)



setTimeout(() => {

}, 1000000)

// (async function test() {
//     console.log('sssss')
//     const v = await p.exec('test', { foo: "Bar3" });
//     console.log('sssssssssssssssss 3 => ', v);
// })();




// async function testall(n: number) {
//     console.log('sssss')
//     const v = await p.exec('test', { foo: "Bar4" });
//     console.log('sssssssssssssssss 4 => ', v + ' ====>' + n);
// };

// for (var i = 0; i < 400; i++) {
//     testall(i)
// }
