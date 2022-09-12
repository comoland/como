export * as assert from 'uvu/assert';
export { test, suite } from 'uvu';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function timeThis() {
    const start = Date.now();

    let final = 0;

    return {
        end: () => {
            final = Date.now() - start;
            return final
        },
        get: () => {
            return final;
        }
    }
}


export function bench() {
    const start = Date.now();

    return () => {
        const end = Date.now();
        console.log('ended in ===> ', end - start);
    }
}


export const promiso = () => {
    let resolve : (value: void | PromiseLike<void>) => void = () => {};
    let reject : (value: void | PromiseLike<void>) => void = () => {};

    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    })

    return {
        promise,
        resolve,
        reject,
    }
}
