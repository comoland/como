export * as assert from 'uvu/assert';
export { test, suite } from 'uvu';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function bench() {
    const start = Date.now();

    return () => {
        const end = Date.now();
        console.log('ended in ===> ', end - start);
    }
}
