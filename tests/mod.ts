export * as assert from 'uvu/assert';
export { test, suite } from 'uvu';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
