import { describe, assert } from './runner';

describe('buffer basics', async ({ test }) => {
    test('Buffer should be available', () => {
        assert.ok(Buffer, 'Buffer should be available');
        assert.equal(typeof Buffer, 'function', 'Buffer should be a function');
    });

    test('Buffer.from should create buffer from string', () => {
        const buf = Buffer.from('hello');
        assert.ok(buf, 'Buffer.from should create a buffer');
        assert.equal(buf.length, 5, 'Buffer should have correct length');
        assert.equal(buf.toString(), 'hello', 'Buffer should convert back to string');
    });

    test('Buffer.from should create buffer from array', () => {
        const buf = Buffer.from([72, 101, 108, 108, 111]);
        assert.ok(buf, 'Buffer.from should create a buffer from array');
        assert.equal(buf.length, 5, 'Buffer should have correct length');
        assert.equal(buf.toString(), 'Hello', 'Buffer should convert to correct string');
    });

    test('Buffer.alloc should create buffer with specified size', () => {
        const buf = Buffer.alloc(10);
        assert.ok(buf, 'Buffer.alloc should create a buffer');
        assert.equal(buf.length, 10, 'Buffer should have correct length');
        assert.equal(buf.toString('hex'), '00000000000000000000', 'Buffer should be filled with zeros');
    });

    test('Buffer.allocUnsafe should create buffer with specified size', () => {

        const buf = Buffer.allocUnsafe(10);
        assert.ok(buf, 'Buffer.allocUnsafe should create a buffer');
        assert.equal(buf.length, 10, 'Buffer should have correct length');
    });

    test('Buffer.isBuffer should detect buffers', () => {
        const buf = Buffer.from('test');
        const notBuf = 'test';

        assert.ok(Buffer.isBuffer(buf), 'Buffer.isBuffer should return true for buffers');
        assert.ok(!Buffer.isBuffer(notBuf), 'Buffer.isBuffer should return false for non-buffers');
    });

    test('Buffer.byteLength should return byte length', () => {
        assert.equal(Buffer.byteLength('hello'), 5, 'Buffer.byteLength should return correct byte length');
        assert.equal(Buffer.byteLength('测试'), 6, 'Buffer.byteLength should handle unicode');
    });

    test('Buffer.concat should concatenate buffers', () => {
        const buf1 = Buffer.from('hello');
        const buf2 = Buffer.from(' world');
        const result = Buffer.concat([buf1, buf2]);

        assert.ok(result, 'Buffer.concat should create a buffer');
        assert.equal(result.length, 11, 'Buffer.concat should have correct length');
        assert.equal(result.toString(), 'hello world', 'Buffer.concat should concatenate correctly');
    });

    test('Buffer should support indexing', () => {
        const buf = Buffer.from('hello');
        assert.equal(buf[0], 104, 'Buffer should support indexing (h = 104)');
        assert.equal(buf[1], 101, 'Buffer should support indexing (e = 101)');
        assert.equal(buf[4], 111, 'Buffer should support indexing (o = 111)');
    });

    test('Buffer should support slice', () => {
        const buf = Buffer.from('hello world');
        const sliced = buf.slice(0, 5);

        assert.ok(sliced, 'Buffer.slice should create a buffer');
        assert.equal(sliced.length, 5, 'Buffer.slice should have correct length');
        assert.equal(sliced.toString(), 'hello', 'Buffer.slice should slice correctly');
    });

    test('Buffer should support toString with encoding', () => {
        const buf = Buffer.from('hello');
        assert.equal(buf.toString('utf8'), 'hello', 'Buffer should support utf8 encoding');
        assert.equal(buf.toString('ascii'), 'hello', 'Buffer should support ascii encoding');
    });

    test('Buffer should support write', () => {
        const buf = Buffer.alloc(10);
        const written = buf.write('hello', 0);

        assert.equal(written, 5, 'Buffer.write should return number of bytes written');
        assert.equal(buf.toString('utf8', 0, 5), 'hello', 'Buffer.write should write correctly');
    });

    test('Buffer should support fill', () => {
        const buf = Buffer.alloc(5);
        buf.fill('a');

        assert.equal(buf.toString(), 'aaaaa', 'Buffer.fill should fill with specified value');
    });

    test('Buffer should support copy', () => {
        const buf1 = Buffer.from('hello');
        const buf2 = Buffer.alloc(10);
        const copied = buf1.copy(buf2, 0);

        assert.equal(copied, 5, 'Buffer.copy should return number of bytes copied');
        assert.equal(buf2.toString('utf8', 0, 5), 'hello', 'Buffer.copy should copy correctly');
    });

    test('Buffer should support compare', () => {
        const buf1 = Buffer.from('abc');
        const buf2 = Buffer.from('def');
        const buf3 = Buffer.from('abc');

        assert.ok(buf1.compare(buf2) < 0, 'Buffer.compare should return negative for smaller buffer');
        assert.ok(buf2.compare(buf1) > 0, 'Buffer.compare should return positive for larger buffer');
        assert.equal(buf1.compare(buf3), 0, 'Buffer.compare should return 0 for equal buffers');
    });

    test('Buffer should support indexOf', () => {
        const buf = Buffer.from('hello world');

        assert.equal(buf.indexOf('world'), 6, 'Buffer.indexOf should find substring');
        assert.equal(buf.indexOf('xyz'), -1, 'Buffer.indexOf should return -1 for not found');
        assert.equal(buf.indexOf(Buffer.from('world')), 6, 'Buffer.indexOf should find buffer');
    });

    test('Buffer should support includes', () => {
        const buf = Buffer.from('hello world');

        assert.ok(buf.includes('world'), 'Buffer.includes should return true for found substring');
        assert.ok(!buf.includes('xyz'), 'Buffer.includes should return false for not found');
        assert.ok(buf.includes(Buffer.from('world')), 'Buffer.includes should work with buffers');
    });
});

describe('buffer advanced', async ({ test }) => {
    test('Buffer should handle different encodings', () => {
        const buf = Buffer.from('hello', 'utf8');
        assert.equal(buf.toString('utf8'), 'hello', 'should handle utf8 encoding');
        assert.equal(buf.toString('ascii'), 'hello', 'should handle ascii encoding');
        assert.equal(buf.toString('latin1'), 'hello', 'should handle latin1 encoding');
    });

    test('Buffer should handle hex encoding', () => {
        const buf = Buffer.from('hello');
        assert.equal(buf.toString('hex'), '68656c6c6f', 'should convert to hex');

        const fromHex = Buffer.from('68656c6c6f', 'hex');
        assert.equal(fromHex.toString(), 'hello', 'should create from hex');
    });

    test('Buffer should handle base64 encoding', () => {
        const buf = Buffer.from('hello');
        assert.equal(buf.toString('base64'), 'aGVsbG8=', 'should convert to base64');

        const fromBase64 = Buffer.from('aGVsbG8=', 'base64');
        assert.equal(fromBase64.toString(), 'hello', 'should create from base64');
    });

    test('Buffer should handle unicode strings', () => {
        const unicode = '测试🚀';
        const buf = Buffer.from(unicode, 'utf8');
        assert.equal(buf.toString('utf8'), unicode, 'should handle unicode strings');
        assert.equal(buf.length, 10, 'should have correct byte length for unicode');
    });

    test('Buffer should support read operations', () => {
        const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);

        assert.equal(buf.readUInt8(0), 0x12, 'should read UInt8');
        assert.equal(buf.readUInt16BE(0), 0x1234, 'should read UInt16BE');
        assert.equal(buf.readUInt16LE(0), 0x3412, 'should read UInt16LE');
        assert.equal(buf.readUInt32BE(0), 0x12345678, 'should read UInt32BE');
        assert.equal(buf.readUInt32LE(0), 0x78563412, 'should read UInt32LE');
    });

    test('Buffer should support write operations', () => {
        const buf = Buffer.alloc(8);

        buf.writeUInt8(0x12, 0);
        buf.writeUInt16BE(0x3456, 1);
        buf.writeUInt32LE(0x9abcdef0, 3);

        assert.equal(buf.readUInt8(0), 0x12, 'should write UInt8');
        assert.equal(buf.readUInt16BE(1), 0x3456, 'should write UInt16BE');
        assert.equal(buf.readUInt32LE(3), 0x9abcdef0, 'should write UInt32LE');
    });

    test('Buffer should support float operations', () => {
        const buf = Buffer.alloc(8);

        buf.writeFloatBE(3.14159, 0);
        // Note: writeDoubleLE needs 8 bytes, so we can't write at offset 4 in an 8-byte buffer
        // This is the correct behavior - both Node.js and Bun throw the same error

        assert.ok(Math.abs(buf.readFloatBE(0) - 3.14159) < 0.001, 'should write/read FloatBE');

        // Test with a larger buffer for double operations
        const buf2 = Buffer.alloc(12);
        buf2.writeDoubleLE(2.71828, 4);
        assert.ok(Math.abs(buf2.readDoubleLE(4) - 2.71828) < 0.001, 'should write/read DoubleLE');
    });

    test('Buffer should support signed integers', () => {
        const buf = Buffer.alloc(8);

        buf.writeInt8(-128, 0);
        buf.writeInt16BE(-32768, 1);
        buf.writeInt32LE(-2147483648, 3);

        assert.equal(buf.readInt8(0), -128, 'should write/read Int8');
        assert.equal(buf.readInt16BE(1), -32768, 'should write/read Int16BE');
        assert.equal(buf.readInt32LE(3), -2147483648, 'should write/read Int32LE');
    });

    test('Buffer should support swap operations', () => {
        const buf = Buffer.from([0x12, 0x34, 0x56, 0x78]);

        const swapped16 = Buffer.from(buf);
        swapped16.swap16();
        assert.equal(swapped16[0], 0x34, 'swap16 should swap bytes');
        assert.equal(swapped16[1], 0x12, 'swap16 should swap bytes');

        const swapped32 = Buffer.from(buf);
        swapped32.swap32();
        assert.equal(swapped32[0], 0x78, 'swap32 should swap bytes');
        assert.equal(swapped32[3], 0x12, 'swap32 should swap bytes');
    });

    test('Buffer should support lastIndexOf', () => {
        const buf = Buffer.from('hello world hello');

        assert.equal(buf.lastIndexOf('hello'), 12, 'should find last occurrence');
        assert.equal(buf.lastIndexOf('world'), 6, 'should find last occurrence');
        assert.equal(buf.lastIndexOf('xyz'), -1, 'should return -1 for not found');
    });

    test('Buffer should support subarray', () => {
        const buf = Buffer.from('hello world');
        const sub = buf.subarray(0, 5);

        assert.equal(sub.toString(), 'hello', 'subarray should create correct slice');
        assert.ok(sub instanceof Buffer, 'subarray should return Buffer instance');
    });

    test('Buffer should support entries, keys, values', () => {
        const buf = Buffer.from('abc');

        const entries = Array.from(buf.entries());
        assert.equal(entries.length, 3, 'entries should return all entries');
        assert.equal(entries[0][0], 0, 'entries should have correct index');
        assert.equal(entries[0][1], 97, 'entries should have correct value');

        const keys = Array.from(buf.keys());
        assert.equal(keys.length, 3, 'keys should return all indices');
        assert.equal(keys[0], 0, 'keys should start from 0');

        const values = Array.from(buf.values());
        assert.equal(values.length, 3, 'values should return all values');
        assert.equal(values[0], 97, 'values should have correct values');
    });

    test('Buffer should support forEach', () => {
        const buf = Buffer.from('abc');
        const results: any[] = [];

        buf.forEach((value, index) => {
            results.push({ value, index });
        });

        assert.equal(results.length, 3, 'forEach should iterate all elements');
        assert.equal(results[0].value, 97, 'forEach should provide correct value');
        assert.equal(results[0].index, 0, 'forEach should provide correct index');
    });

    test('Buffer should support map', () => {
        const buf = Buffer.from('abc');
        const doubled = buf.map(x => x * 2);

        assert.ok(doubled instanceof Buffer, 'map should return Buffer');
        assert.equal(doubled.length, 3, 'map should preserve length');
        assert.equal(doubled[0], 194, 'map should apply function correctly');
    });

    test('Buffer should support filter', () => {
        const buf = Buffer.from('abc');
        const filtered = buf.filter(x => x > 97); // Only 'b' and 'c'

        assert.ok(filtered instanceof Buffer, 'filter should return Buffer');
        assert.equal(filtered.length, 2, 'filter should reduce length');
        assert.equal(filtered[0], 98, 'filter should apply condition correctly');
    });

    test('Buffer should support reduce', () => {
        const buf = Buffer.from('abc');
        const sum = buf.reduce((acc, val) => acc + val, 0);

        assert.equal(sum, 294, 'reduce should accumulate values'); // 97 + 98 + 99
    });

    test('Buffer should support some and every', () => {
        const buf = Buffer.from('abc');

        assert.ok(
            buf.some(x => x > 98),
            'some should return true when condition met'
        );
        assert.ok(!buf.some(x => x > 100), 'some should return false when condition not met');

        assert.ok(
            buf.every(x => x >= 97),
            'every should return true when all meet condition'
        );
        assert.ok(!buf.every(x => x > 97), 'every should return false when not all meet condition');
    });

    test('Buffer should support find and findIndex', () => {
        const buf = Buffer.from('abc');

        const found = buf.find(x => x > 97);
        assert.equal(found, 98, 'find should return first matching element');

        const foundIndex = buf.findIndex(x => x > 97);
        assert.equal(foundIndex, 1, 'findIndex should return first matching index');
    });

    test('Buffer should support reverse', () => {
        const buf = Buffer.from('hello');
        buf.reverse();

        assert.equal(buf.toString(), 'olleh', 'reverse should reverse buffer in place');
    });

    test('Buffer should support sort', () => {
        const buf = Buffer.from('hello');
        buf.sort();

        assert.equal(buf.toString(), 'ehllo', 'sort should sort buffer in place');
    });

    test('Buffer should handle large buffers', () => {
        const size = 1024 * 1024; // 1MB
        const buf = Buffer.alloc(size);

        assert.equal(buf.length, size, 'should create large buffer');
        assert.ok(Buffer.isBuffer(buf), 'should be a valid buffer');

        // Test writing and reading
        buf.write('test', 0);
        assert.equal(buf.toString('utf8', 0, 4), 'test', 'should write/read in large buffer');
    });

    test('Buffer should handle edge cases in read/write', () => {
        const buf = Buffer.alloc(4);

        // Test bounds
        assert.equal(buf.readUInt8(0), 0, 'should read zero from allocated buffer');
        assert.equal(buf.readUInt8(3), 0, 'should read zero from last position');

        // Test writing at bounds
        buf.writeUInt8(255, 0);
        buf.writeUInt8(0, 3);
        assert.equal(buf.readUInt8(0), 255, 'should write max value');
        assert.equal(buf.readUInt8(3), 0, 'should write min value');
    });
});
