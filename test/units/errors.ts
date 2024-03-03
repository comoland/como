import { suite, assert } from '../mod';
import { Child1 } from '../fixtures/nested/child1.js';

const test = suite('errors');

export type FakeTypes = {
    Num: number;
    Str: string;
};

// this test depend on the exact line number
// of the error place
test('captureStackTrace should capture stack trace', async () => {
    try {
        throw new Error('9');
    } catch (error: any) {
        const stackTrace = error.captureStackTrace();
        const stacks = stackTrace.split('\n');
        const reg = new RegExp('units/errors.ts:15', 'g');
        assert.ok(reg.test(stacks[0]));
    }
});

test('it should report correct error for async functions', async () => {
    const failingPromise = async () => {
        throw new Error('g');
    };

    try {
        await failingPromise();
    } catch (error: any) {
        assert.ok(error instanceof Error);
        const reg = new RegExp('units/errors.ts:26', 'g');
        assert.ok(reg.test(error.stack || ''));
    }
});

test('it should throw correct message and stack', async () => {
    assert.throws(
        () => {
            throw new Error('should throw');
        },
        (e: any) => {
            const reg = new RegExp('units/errors.ts:41', 'g');
            return /should throw/.test(e) && reg.test(e.stack);
        }
    );
});

test('nested async functions', async () => {
    try {
        await Child1();
    } catch (err: any) {
        const reg = new RegExp('fixtures/nested/child1.js:7', 'g');
        assert.ok(reg.test(err.stack));
        assert.equal(err.message, '[object Object]');
    }
});

test.run();
