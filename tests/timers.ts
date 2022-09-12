import { suite, assert, sleep, bench } from './mod'

const Suite = suite("timers");

Suite('Simple timers',  async () => {
    const results: any = [];
    const expected = [1,2,3,4,5,6,7,8,9,10];

    setTimeout(() => {
        results.push(1)
        setTimeout((arg: number) => {
            results.push(arg)
            let b = arg + 1
            let int = setInterval(function(this:any) {
                if (b === 10) {
                    clearInterval(int)
                }
                results.push(b++)
            }, 10)
        }, 10, 2)
    }, 10)

    await sleep(150);
    assert.equal(results, expected)
});

Suite.run();


const t = bench();
setTimeout(() => {
    setTimeout(() => {
        setTimeout(() => {
            setTimeout(() => {
                setTimeout(() => {
                    setTimeout(() => {
                        setTimeout(() => {
                            t();
                            console.log("should be out")
                        }, 100)
                    }, 100)
                }, 100)
            }, 100)
        }, 100)
    }, 100)
}, 100)

// let t1 = setInterval(() => {
//     let t2 = setTimeout(() => {
//         clearInterval(t1)
//         console.log('t1 ====> ', t1)


//         setTimeout(() => {
//             console.log(t2)
//         }, 1000)
//         // clearInterval(t1)
//         // clearTimeout(t2)
//         // console.log("should be out")
//     }, 100)
// }, 100)

// let vv = setInterval(function(){
//     // const _this = this as any;
//     console.log('sssssssssssssssssssssss')
//     const timer = setTimeout(function(){
//         clearInterval(vv);
//         clearTimeout(timer)
//     }, 10)
// }, 100)


