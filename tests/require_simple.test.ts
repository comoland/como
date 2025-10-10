import { describe, assert } from './runner';

describe('require simple tests', async ({ test }) => {
    test('should require basic module', () => {
        const counter = require('./fixtures/require/counter');
        assert.ok(counter, 'counter module loaded');
        assert.equal(typeof counter.increment, 'function', 'increment is a function');
        assert.equal(typeof counter.getCount, 'function', 'getCount is a function');
        assert.equal(typeof counter.reset, 'function', 'reset is a function');
    });

    test('should handle exports', () => {
        const exportTypes = require('./fixtures/require/export_types');
        assert.equal(exportTypes.named, 'exported value', 'named export works');
        assert.equal(exportTypes.number, 42, 'number export works');
        assert.equal(exportTypes.boolean, true, 'boolean export works');
    });

    test('should handle primitive exports', () => {
        const primitive = require('./fixtures/require/primitive');
        assert.equal(primitive, 'string export', 'primitive string export works');
    });

    test('should handle function exports', () => {
        const func = require('./fixtures/require/function_export');
        assert.equal(typeof func, 'function', 'function export is a function');
        assert.equal(func('World'), 'Hello, World!', 'function export works correctly');
    });
});
