import { Blob, File, createObjectURL, revokeObjectURL, blobFromObjectUrl } from 'blob';
import { describe, assert } from './runner';

async function assertArrayBufferEquals(actual: ArrayBuffer, expected: Uint8Array, message: string) {
    const actualArray = new Uint8Array(actual);
    assert.equal(actualArray.length, expected.length, `${message} (length)`);

    for (let i = 0; i < actualArray.length; i++) {
        if (actualArray[i] !== expected[i]) {
            throw new Error(`${message}\nDifference at index ${i}: expected ${expected[i]}, got ${actualArray[i]}`);
        }
    }
}

// Test categories
describe("Blob", async ({ test }) => {
    test('Test 1: Basic Blob Creation from String', async () => {
        const blob = new Blob([Buffer.from('Hello World')]);
        assert.equal(blob.size, 11, 'Blob size should be 11');
        assert.equal(blob.type, '', 'Blob type should be empty by default');
        const text = await blob.text();
        assert.equal(text, 'Hello World', 'Blob text should match input');
    });

    test('Test 2: Blob Creation with MIME Type', () => {
        const blob = new Blob(['{"key":"value"}'], { type: 'application/json' });
        assert.equal(blob.type, 'application/json', 'Blob type should be set');
        assert.equal(blob.size, 15, 'Blob size should be 15');
    });

    test('Test 3: MIME Type Normalization', () => {
        const blob1 = new Blob(['test'], { type: 'TEXT/PLAIN' });
        assert.equal(blob1.type, 'text/plain', 'Type should be lowercase');

        const blob2 = new Blob(['test'], { type: 'text/plain; charset=utf-8' });
        assert.equal(blob2.type, 'text/plain; charset=utf-8', 'Type with charset should be preserved');

        const blob3 = new Blob(['test'], { type: 'invalid\x00type' });
        assert.equal(blob3.type, '', 'Invalid type should be empty');
    });

    test('Test 4: Blob from Uint8Array', async () => {
        const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        const blob = new Blob([data]);
        assert.equal(blob.size, 5, 'Blob size should be 5');

        const text = await blob.text();
        assert.equal(text, 'Hello', 'Blob text should be "Hello"');
    });

    test('Test 5: Blob from ArrayBuffer', async () => {
        const buffer = new ArrayBuffer(5);
        const view = new Uint8Array(buffer);
        view.set([87, 111, 114, 108, 100]); // "World"

        const blob = new Blob([buffer]);
        assert.equal(blob.size, 5, 'Blob size should be 5');

        const text = await blob.text();
        assert.equal(text, 'World', 'Blob text should be "World"');
    });

    test('Test 6: Blob from Mixed Parts', async () => {
        const blob = new Blob([
            'Hello ',
            new Uint8Array([87, 111, 114, 108, 100]), // "World"
            '!'
        ]);
        assert.equal(blob.size, 12, 'Blob size should be 12');

        const text = await blob.text();
        assert.equal(text, 'Hello World!', 'Blob text should be "Hello World!"');
    });

    test('Test 7: Blob Slicing', async () => {
        const blob = new Blob(['Hello World']);

        const slice1 = blob.slice(0, 5);
        assert.equal(slice1.size, 5, 'Slice size should be 5');
        const text1 = await slice1.text();
        assert.equal(text1, 'Hello', 'Slice should be "Hello"');

        const slice2 = blob.slice(6, 11);
        assert.equal(slice2.size, 5, 'Slice size should be 5');
        const text2 = await slice2.text();
        assert.equal(text2, 'World', 'Slice should be "World"');
    });

    test('Test 8: Negative Indices in Slicing', async () => {
        const blob = new Blob(['Hello World']);

        const slice1 = blob.slice(-5);
        const text1 = await slice1.text();
        assert.equal(text1, 'World', 'Negative start should work');

        const slice2 = blob.slice(0, -6);
        const text2 = await slice2.text();
        assert.equal(text2, 'Hello', 'Negative end should work');

        const slice3 = blob.slice(-5, -1);
        const text3 = await slice3.text();
        assert.equal(text3, 'Worl', 'Negative start and end should work');
    });

    test('Test 9: Slice with Content Type', () => {
        const blob = new Blob(['{"key":"value"}'], { type: 'application/json' });
        const slice = blob.slice(0, 5, 'text/plain');

        assert.equal(slice.type, 'text/plain', 'Slice should have new type');
        assert.equal(slice.size, 5, 'Slice size should be 5');
    });

    test('Test 10: arrayBuffer() method', async () => {
        const blob = new Blob(['Hello']);
        const buffer = await blob.arrayBuffer();

        assert.ok(buffer instanceof ArrayBuffer, 'Should return ArrayBuffer');
        assert.equal(buffer.byteLength, 5, 'ArrayBuffer size should be 5');

        await assertArrayBufferEquals(buffer, new Uint8Array([72, 101, 108, 108, 111]), 'ArrayBuffer content should match');
    });

    test('Test 11: bytes() method', async () => {
        const blob = new Blob(['Hello']);
        const bytes = await blob.bytes();

        assert.ok(bytes instanceof Uint8Array, 'Should return Uint8Array');
        assert.equal(bytes.length, 5, 'Uint8Array size should be 5');
        assert.equal(bytes[0], 72, 'First byte should be 72 (H)');
    });

    test('Test 12: Empty Blob', async () => {
        const blob = new Blob([]);
        assert.equal(blob.size, 0, 'Empty blob size should be 0');
        assert.equal(blob.type, '', 'Empty blob type should be empty');

        const text = await blob.text();
        assert.equal(text, '', 'Empty blob text should be empty');
    });

    test('Test 13: Blob from Nested Blobs', async () => {
        const blob1 = new Blob(['Hello ']);
        const blob2 = new Blob(['World']);
        const combined = new Blob([blob1, blob2]);

        assert.equal(combined.size, 11, 'Combined blob size should be 11');

        const text = await combined.text();
        assert.equal(text, 'Hello World', 'Combined blob text should be "Hello World"');
    });

    test('Test 14: File Class Basic', async () => {
        const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });

        assert.equal(file.name, 'test.txt', 'File name should be set');
        assert.equal(file.size, 11, 'File size should be 11');
        assert.equal(file.type, 'text/plain', 'File type should be text/plain');
        assert.ok(typeof file.lastModified === 'number', 'lastModified should be a number');
        assert.ok(file.lastModified > 0, 'lastModified should be positive');

        const text = await file.text();
        assert.equal(text, 'Hello World', 'File text should be "Hello World"');
    });

    test('Test 15: File with lastModified', () => {
        const timestamp = 1234567890000;
        const file = new File(['test'], 'test.txt', { lastModified: timestamp });

        assert.equal(file.lastModified, timestamp, 'lastModified should be set correctly');
    });

    test('Test 16: Object URL Creation and Revocation', () => {
        const blob = new Blob(['Hello World'], { type: 'text/plain' });
        const url = createObjectURL(blob);

        assert.ok(typeof url === 'string', 'URL should be a string');
        assert.ok(url.startsWith('blob:'), 'URL should start with blob:');

        // Revoke URL (should not throw)
        revokeObjectURL(url);
    });

    test('Test 17: Retrieve Blob from Object URL', async () => {
        const originalBlob = new Blob(['Test Data'], { type: 'text/plain' });
        const url = createObjectURL(originalBlob);

        const retrievedBlob = blobFromObjectUrl(url);
        assert.equal(retrievedBlob.type, 'text/plain', 'Retrieved blob type should match');
        assert.equal(retrievedBlob.size, 9, 'Retrieved blob size should match');

        const text = await retrievedBlob.text();
        assert.equal(text, 'Test Data', 'Retrieved blob content should match');

        revokeObjectURL(url);
    });

    test('Test 18: Large Blob', async () => {
        const size = 1024 * 1024 * 2; // 2MB
        const largeData = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            largeData[i] = i % 256;
        }

        const blob = new Blob([largeData]);
        assert.equal(blob.size, size, 'Large blob size should be correct');

        const buffer = await blob.arrayBuffer();
        assert.equal(buffer.byteLength, size, 'Large blob ArrayBuffer size should be correct');
    });

    test('Test 19: Nested Blob Slicing', async () => {
        const blob1 = new Blob(['Hello World']);
        const slice1 = blob1.slice(0, 5);
        const slice2 = slice1.slice(1, 4);

        assert.equal(slice2.size, 3, 'Nested slice size should be 3');
        const text = await slice2.text();
        assert.equal(text, 'ell', 'Nested slice content should be "ell"');
    });

    test('Test 20: Slice Boundary Conditions', () => {
        const blob = new Blob(['Hello']);

        const slice1 = blob.slice(0, 0);
        assert.equal(slice1.size, 0, 'Slice(0,0) should be empty');

        const slice2 = blob.slice(5, 5);
        assert.equal(slice2.size, 0, 'Slice(5,5) should be empty');

        const slice3 = blob.slice(10, 20);
        assert.equal(slice3.size, 0, 'Slice beyond size should be empty');

        const slice4 = blob.slice(-10, 3);
        assert.equal(slice4.size, 3, 'Slice with large negative start should work');

        const slice5 = blob.slice();
        assert.equal(slice5.size, 5, 'Slice() without args should return full blob');
    });

    test('Test 21: UTF-8 Encoding', async () => {
        const blob = new Blob(['Hello 世界 🌍']);
        const text = await blob.text();
        assert.equal(text, 'Hello 世界 🌍', 'UTF-8 should be preserved');

        // Check byte length (not character length)
        assert.ok(blob.size > text.length, 'Byte length should be greater than character length for non-ASCII');
    });

    test('Test 22: TypedArray Views', () => {
        const buffer = new ArrayBuffer(16);
        const int32View = new Int32Array(buffer);
        int32View[0] = 0x48656C6C; // "lleH" in little-endian
        int32View[1] = 0x6F57206F; // "oW o" in little-endian

        const blob = new Blob([int32View]);
        assert.equal(blob.size, 16, 'Blob from Int32Array should include full buffer');
    });

    test('Test 23: Stream Method', async () => {
        const blob = new Blob(['Hello World']);
        const stream = blob.stream();

        assert.ok(stream instanceof ReadableStream, 'stream() should return ReadableStream');

        // Read from stream
        const reader = stream.getReader();
        let chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        assert.ok(chunks.length > 0, 'Stream should yield chunks');
    });

    test('Test 24: Concurrent Operations', async () => {
        const blob = new Blob(['Test Data']);

        // Perform multiple concurrent reads
        const promises = [
            blob.text(),
            blob.arrayBuffer(),
            blob.bytes(),
            blob.slice(0, 4).text(),
            blob.slice(5).text()
        ];

        const results = await Promise.all(promises);

        assert.equal(results[0], 'Test Data', 'Concurrent text() should work');
        assert.equal(results[1].byteLength, 9, 'Concurrent arrayBuffer() should work');
        assert.equal(results[2].length, 9, 'Concurrent bytes() should work');
        assert.equal(results[3], 'Test', 'Concurrent slice text() should work');
        assert.equal(results[4], 'Data', 'Concurrent slice text() should work');
    });

    test('Test 25: Error Handling', () => {
        try {
            createObjectURL('not a blob' as any);
            throw new Error('Should have thrown TypeError');
        } catch (e) {
            assert.ok(e instanceof TypeError, 'createObjectURL should throw TypeError for non-blob');
        }
    });
})
