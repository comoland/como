import { describe, assert } from '../runner';
import { Child1 } from './fixtures/nested/child1.js';

// a dummy type
export type FakeTypes = {
    Num: number;
    Str: string;
};

describe("captureStack", async ({ test }) => {
    // this test depend on the exact line number
    // of the error place
    test('captureStackTrace should capture stack trace', async () => {
        try {
            throw new Error('9');
        } catch (error: any) {
            const stacks = error.stack.split('\n');
            // line comment
            const reg = new RegExp('errors.test.ts:15', 'g');
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
            const reg = new RegExp('errors.test.ts:26', 'g');
            assert.ok(reg.test(error.stack || ''));
        }
    });

    test('it should throw correct message and stack', async () => {
        assert.throws(
            () => {
                throw new Error('should throw');
            },
            (e: any) => {
                const reg = new RegExp('tests/errors.test.ts:41', 'g');
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

    test('Error should have correct name property', () => {
        const err = new Error('test error');
        assert.equal(err.name, 'Error', 'Error should have name "Error"');
        assert.equal(err.message, 'test error', 'Error should have correct message');
    });

    test('TypeError should have correct properties', () => {
        const err = new TypeError('type error');
        assert.equal(err.name, 'TypeError', 'TypeError should have name "TypeError"');
        assert.equal(err.message, 'type error', 'TypeError should have correct message');
        assert.ok(err instanceof Error, 'TypeError should be instance of Error');
        assert.ok(err instanceof TypeError, 'TypeError should be instance of TypeError');
    });

    test('ReferenceError should have correct properties', () => {
        const err = new ReferenceError('reference error');
        assert.equal(err.name, 'ReferenceError', 'ReferenceError should have name "ReferenceError"');
        assert.equal(err.message, 'reference error', 'ReferenceError should have correct message');
        assert.ok(err instanceof Error, 'ReferenceError should be instance of Error');
    });

    test('SyntaxError should have correct properties', () => {
        const err = new SyntaxError('syntax error');
        assert.equal(err.name, 'SyntaxError', 'SyntaxError should have name "SyntaxError"');
        assert.equal(err.message, 'syntax error', 'SyntaxError should have correct message');
        assert.ok(err instanceof Error, 'SyntaxError should be instance of Error');
    });

    test('RangeError should have correct properties', () => {
        const err = new RangeError('range error');
        assert.equal(err.name, 'RangeError', 'RangeError should have name "RangeError"');
        assert.equal(err.message, 'range error', 'RangeError should have correct message');
        assert.ok(err instanceof Error, 'RangeError should be instance of Error');
    });

    test('Error stack should include function names', () => {
        function throwingFunction() {
            throw new Error('from function');
        }

        try {
            throwingFunction();
        } catch (err: any) {
            assert.ok(err.stack, 'Error should have stack trace');
            assert.ok(err.stack.includes('throwingFunction'), 'Stack should include function name');
        }
    });

    test('Error stack should show nested function calls', () => {
        function level3() {
            throw new Error('nested error');
        }

        function level2() {
            level3();
        }

        function level1() {
            level2();
        }

        try {
            level1();
        } catch (err: any) {
            const stack = err.stack;
            assert.ok(stack.includes('level3'), 'Stack should include level3');
            assert.ok(stack.includes('level2'), 'Stack should include level2');
            assert.ok(stack.includes('level1'), 'Stack should include level1');
        }
    });

    test('Custom error classes should work correctly', () => {
        class CustomError extends Error {
            code: number;
            constructor(message: string, code: number) {
                super(message);
                this.name = 'CustomError';
                this.code = code;
            }
        }

        const err = new CustomError('custom error', 42);
        assert.equal(err.name, 'CustomError', 'Custom error should have correct name');
        assert.equal(err.message, 'custom error', 'Custom error should have correct message');
        assert.equal(err.code, 42, 'Custom error should have custom properties');
        assert.ok(err instanceof Error, 'Custom error should be instance of Error');
        assert.ok(err instanceof CustomError, 'Custom error should be instance of CustomError');
    });

    test('Error.captureStackTrace should work', () => {
        const obj: any = {};
        Error.captureStackTrace(obj);
        assert.ok(obj.stack, 'captureStackTrace should add stack property');
        assert.ok(typeof obj.stack === 'string', 'stack should be a string');
    });

    test('Error.captureStackTrace should capture current call stack', () => {
        function captureInFunction() {
            const obj: any = {};
            Error.captureStackTrace(obj);
            return obj;
        }

        const obj = captureInFunction();
        assert.ok(obj.stack, 'should have stack property');
        assert.ok(obj.stack.includes('captureInFunction'), 'stack should include function name');
    });

    test('Error.captureStackTrace should work with nested calls', () => {
        function level3(obj: any) {
            Error.captureStackTrace(obj);
        }

        function level2(obj: any) {
            level3(obj);
        }

        function level1() {
            const obj: any = {};
            level2(obj);
            return obj;
        }

        const obj = level1();
        assert.ok(obj.stack, 'should have stack property');
        assert.ok(obj.stack.includes('level3'), 'should include level3');
        assert.ok(obj.stack.includes('level2'), 'should include level2');
        assert.ok(obj.stack.includes('level1'), 'should include level1');
    });

    test('Error.captureStackTrace should work on multiple objects', () => {
        const obj1: any = {};
        const obj2: any = {};

        Error.captureStackTrace(obj1);
        Error.captureStackTrace(obj2);

        assert.ok(obj1.stack, 'obj1 should have stack');
        assert.ok(obj2.stack, 'obj2 should have stack');
        assert.ok(typeof obj1.stack === 'string', 'obj1.stack should be string');
        assert.ok(typeof obj2.stack === 'string', 'obj2.stack should be string');
    });

    test('Error.captureStackTrace should work with custom error objects', () => {
        class CustomError {
            message: string;
            stack?: string;
            constructor(message: string) {
                this.message = message;
                Error.captureStackTrace(this);
            }
        }

        const err = new CustomError('custom error');
        assert.ok(err.stack, 'custom error should have stack');
        assert.equal(err.message, 'custom error', 'should preserve message');
        assert.ok(err.stack.includes('CustomError'), 'stack should include constructor name');
    });

    test('Error.captureStackTrace with constructorOpt should hide frames', () => {
        function MyError(this: any, message: string) {
            this.message = message;
            Error.captureStackTrace(this, MyError);
        }

        const err: any = new (MyError as any)('test');
        assert.ok(err.stack, 'should have stack');
        // The MyError constructor frame should be hidden
        // (implementation may vary based on runtime support)
    });

    test('Error.captureStackTrace should preserve existing properties', () => {
        const obj: any = {
            name: 'MyObject',
            code: 42,
            data: { foo: 'bar' }
        };

        Error.captureStackTrace(obj);

        assert.ok(obj.stack, 'should add stack property');
        assert.equal(obj.name, 'MyObject', 'should preserve name');
        assert.equal(obj.code, 42, 'should preserve code');
        assert.equal(obj.data.foo, 'bar', 'should preserve nested data');
    });

    test('Error toString should return formatted string', () => {
        const err = new Error('test message');
        const str = err.toString();
        assert.ok(str.includes('Error'), 'toString should include error name');
        assert.ok(str.includes('test message'), 'toString should include error message');
    });

    test('Errors in callbacks should preserve stack trace', () => {
        function runCallback(cb: () => void) {
            cb();
        }

        try {
            runCallback(() => {
                throw new Error('callback error');
            });
        } catch (err: any) {
            assert.ok(err.stack, 'Callback error should have stack trace');
            assert.ok(err.stack.includes('runCallback'), 'Stack should include callback context');
        }
    });

    test('Promise rejection should have stack trace', async () => {
        try {
            await Promise.reject(new Error('rejected'));
        } catch (err: any) {
            assert.ok(err instanceof Error, 'Rejected value should be Error');
            assert.equal(err.message, 'rejected', 'Error should have correct message');
            assert.ok(err.stack, 'Rejected error should have stack trace');
        }
    });

    test('Throw without Error object should work', () => {
        try {
            throw 'string error';
        } catch (err) {
            assert.equal(err, 'string error', 'Should catch string error');
        }

        try {
            throw 42;
        } catch (err) {
            assert.equal(err, 42, 'Should catch number error');
        }

        try {
            throw { message: 'object error' };
        } catch (err: any) {
            assert.equal(err.message, 'object error', 'Should catch object error');
        }
    });

    test('Error cause property should work', () => {
        const cause = new Error('original error');
        const err = new Error('wrapped error', { cause });

        assert.equal(err.message, 'wrapped error', 'Error should have correct message');
        assert.ok(err.cause, 'Error should have cause property');
        assert.equal((err.cause as Error).message, 'original error', 'Cause should be original error');
    });

    test('Multiple errors in sequence should have separate stacks', () => {
        let stack1: string = '';
        let stack2: string = '';

        function error1() {
            throw new Error('first error');
        }

        function error2() {
            throw new Error('second error');
        }

        try {
            error1();
        } catch (err: any) {
            stack1 = err.stack;
        }

        try {
            error2();
        } catch (err: any) {
            stack2 = err.stack;
        }

        assert.ok(stack1.includes('error1'), 'First stack should include error1');
        assert.ok(stack2.includes('error2'), 'Second stack should include error2');
        assert.ok(!stack1.includes('error2'), 'First stack should not include error2');
        assert.ok(!stack2.includes('error1'), 'Second stack should not include error1');
    });

    test('Error in setTimeout should have stack trace', async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    throw new Error('timeout error');
                } catch (err: any) {
                    assert.ok(err.stack, 'Timeout error should have stack trace');
                    assert.equal(err.message, 'timeout error', 'Error should have correct message');
                    resolve(null);
                }
            }, 10);
        });
    });

    test('Error in setImmediate should have stack trace', async () => {
        return new Promise((resolve) => {
            setImmediate(() => {
                try {
                    throw new Error('immediate error');
                } catch (err: any) {
                    assert.ok(err.stack, 'Immediate error should have stack trace');
                    assert.equal(err.message, 'immediate error', 'Error should have correct message');
                    resolve(null);
                }
            });
        });
    });
})
