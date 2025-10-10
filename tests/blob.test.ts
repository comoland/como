/**
 * Comprehensive test suite for Blob API implementation
 * Tests Web API compliance, memory management, and edge cases
 */

import { Blob, File, createObjectURL, revokeObjectURL, blobFromObjectUrl } from '../node/js/blob.js';

// Test utilities
function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEquals(actual: any, expected: any, message: string) {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

async function assertArrayBufferEquals(actual: ArrayBuffer, expected: Uint8Array, message: string) {
    const actualArray = new Uint8Array(actual);
    assertEquals(actualArray.length, expected.length, `${message} (length)`);

    for (let i = 0; i < actualArray.length; i++) {
        if (actualArray[i] !== expected[i]) {
            throw new Error(`${message}\nDifference at index ${i}: expected ${expected[i]}, got ${actualArray[i]}`);
        }
    }
}

// Test categories
console.log('\n=== BLOB API TEST SUITE ===\n');

// ============================================================================
// Test 1: Basic Blob Creation
// ============================================================================
console.log('Test 1: Basic Blob Creation from String');
{
    const blob = new Blob([Buffer.from('Hello World')]);
    assertEquals(blob.size, 11, 'Blob size should be 11');
    assertEquals(blob.type, '', 'Blob type should be empty by default');

    const text = await blob.text();
    assertEquals(text, 'Hello World', 'Blob text should match input');
    console.log('✓ Basic blob creation from string');
}

// ============================================================================
// Test 2: Blob Creation with Type
// ============================================================================
console.log('\nTest 2: Blob Creation with MIME Type');
{
    const blob = new Blob(['{"key":"value"}'], { type: 'application/json' });
    assertEquals(blob.type, 'application/json', 'Blob type should be set');
    assertEquals(blob.size, 15, 'Blob size should be 15');
    console.log('✓ Blob with MIME type');
}

// ============================================================================
// Test 3: Type Normalization
// ============================================================================
console.log('\nTest 3: MIME Type Normalization');
{
    const blob1 = new Blob(['test'], { type: 'TEXT/PLAIN' });
    assertEquals(blob1.type, 'text/plain', 'Type should be lowercase');

    const blob2 = new Blob(['test'], { type: 'text/plain; charset=utf-8' });
    assertEquals(blob2.type, 'text/plain; charset=utf-8', 'Type with charset should be preserved');

    const blob3 = new Blob(['test'], { type: 'invalid\x00type' });
    assertEquals(blob3.type, '', 'Invalid type should be empty');
    console.log('✓ Type normalization works correctly');
}

// ============================================================================
// Test 4: Blob from Uint8Array
// ============================================================================
console.log('\nTest 4: Blob from Uint8Array');
{
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const blob = new Blob([data]);
    assertEquals(blob.size, 5, 'Blob size should be 5');

    const text = await blob.text();
    assertEquals(text, 'Hello', 'Blob text should be "Hello"');
    console.log('✓ Blob from Uint8Array');
}

// ============================================================================
// Test 5: Blob from ArrayBuffer
// ============================================================================
console.log('\nTest 5: Blob from ArrayBuffer');
{
    const buffer = new ArrayBuffer(5);
    const view = new Uint8Array(buffer);
    view.set([87, 111, 114, 108, 100]); // "World"

    const blob = new Blob([buffer]);
    assertEquals(blob.size, 5, 'Blob size should be 5');

    const text = await blob.text();
    assertEquals(text, 'World', 'Blob text should be "World"');
    console.log('✓ Blob from ArrayBuffer');
}

// ============================================================================
// Test 6: Blob from Mixed Parts
// ============================================================================
console.log('\nTest 6: Blob from Mixed Parts');
{
    const blob = new Blob([
        'Hello ',
        new Uint8Array([87, 111, 114, 108, 100]), // "World"
        '!'
    ]);
    assertEquals(blob.size, 12, 'Blob size should be 12');

    const text = await blob.text();
    assertEquals(text, 'Hello World!', 'Blob text should be "Hello World!"');
    console.log('✓ Blob from mixed parts');
}

// ============================================================================
// Test 7: Blob Slicing
// ============================================================================
console.log('\nTest 7: Blob Slicing');
{
    const blob = new Blob(['Hello World']);

    const slice1 = blob.slice(0, 5);
    assertEquals(slice1.size, 5, 'Slice size should be 5');
    const text1 = await slice1.text();
    assertEquals(text1, 'Hello', 'Slice should be "Hello"');

    const slice2 = blob.slice(6, 11);
    assertEquals(slice2.size, 5, 'Slice size should be 5');
    const text2 = await slice2.text();
    assertEquals(text2, 'World', 'Slice should be "World"');
    console.log('✓ Blob slicing');
}

// ============================================================================
// Test 8: Negative Indices in Slicing
// ============================================================================
console.log('\nTest 8: Negative Indices in Slicing');
{
    const blob = new Blob(['Hello World']);

    const slice1 = blob.slice(-5);
    const text1 = await slice1.text();
    assertEquals(text1, 'World', 'Negative start should work');

    const slice2 = blob.slice(0, -6);
    const text2 = await slice2.text();
    assertEquals(text2, 'Hello', 'Negative end should work');

    const slice3 = blob.slice(-5, -1);
    const text3 = await slice3.text();
    assertEquals(text3, 'Worl', 'Negative start and end should work');
    console.log('✓ Negative indices in slicing');
}

// ============================================================================
// Test 9: Slice with Content Type
// ============================================================================
console.log('\nTest 9: Slice with Content Type');
{
    const blob = new Blob(['{"key":"value"}'], { type: 'application/json' });
    const slice = blob.slice(0, 5, 'text/plain');

    assertEquals(slice.type, 'text/plain', 'Slice should have new type');
    assertEquals(slice.size, 5, 'Slice size should be 5');
    console.log('✓ Slice with content type');
}

// ============================================================================
// Test 10: arrayBuffer() method
// ============================================================================
console.log('\nTest 10: arrayBuffer() method');
{
    const blob = new Blob(['Hello']);
    const buffer = await blob.arrayBuffer();

    assert(buffer instanceof ArrayBuffer, 'Should return ArrayBuffer');
    assertEquals(buffer.byteLength, 5, 'ArrayBuffer size should be 5');

    await assertArrayBufferEquals(buffer, new Uint8Array([72, 101, 108, 108, 111]), 'ArrayBuffer content should match');
    console.log('✓ arrayBuffer() method');
}

// ============================================================================
// Test 11: bytes() method
// ============================================================================
console.log('\nTest 11: bytes() method');
{
    const blob = new Blob(['Hello']);
    const bytes = await blob.bytes();

    assert(bytes instanceof Uint8Array, 'Should return Uint8Array');
    assertEquals(bytes.length, 5, 'Uint8Array size should be 5');
    assertEquals(bytes[0], 72, 'First byte should be 72 (H)');
    console.log('✓ bytes() method');
}

// ============================================================================
// Test 12: Empty Blob
// ============================================================================
console.log('\nTest 12: Empty Blob');
{
    const blob = new Blob([]);
    assertEquals(blob.size, 0, 'Empty blob size should be 0');
    assertEquals(blob.type, '', 'Empty blob type should be empty');

    const text = await blob.text();
    assertEquals(text, '', 'Empty blob text should be empty');
    console.log('✓ Empty blob');
}

// ============================================================================
// Test 13: Blob from Nested Blobs
// ============================================================================
console.log('\nTest 13: Blob from Nested Blobs');
{
    const blob1 = new Blob(['Hello ']);
    const blob2 = new Blob(['World']);
    const combined = new Blob([blob1, blob2]);

    assertEquals(combined.size, 11, 'Combined blob size should be 11');

    const text = await combined.text();
    assertEquals(text, 'Hello World', 'Combined blob text should be "Hello World"');
    console.log('✓ Blob from nested blobs');
}

// ============================================================================
// Test 14: File Class Basic
// ============================================================================
console.log('\nTest 14: File Class Basic');
{
    const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });

    assertEquals(file.name, 'test.txt', 'File name should be set');
    assertEquals(file.size, 11, 'File size should be 11');
    assertEquals(file.type, 'text/plain', 'File type should be text/plain');
    assert(typeof file.lastModified === 'number', 'lastModified should be a number');
    assert(file.lastModified > 0, 'lastModified should be positive');

    const text = await file.text();
    assertEquals(text, 'Hello World', 'File text should be "Hello World"');
    console.log('✓ File class basic');
}

// ============================================================================
// Test 15: File with lastModified
// ============================================================================
console.log('\nTest 15: File with lastModified');
{
    const timestamp = 1234567890000;
    const file = new File(['test'], 'test.txt', { lastModified: timestamp });

    assertEquals(file.lastModified, timestamp, 'lastModified should be set correctly');
    console.log('✓ File with lastModified');
}

// ============================================================================
// Test 16: Object URL Creation and Revocation
// ============================================================================
console.log('\nTest 16: Object URL Creation and Revocation');
{
    const blob = new Blob(['Hello World'], { type: 'text/plain' });
    const url = createObjectURL(blob);

    assert(typeof url === 'string', 'URL should be a string');
    assert(url.startsWith('blob:'), 'URL should start with blob:');

    // Revoke URL (should not throw)
    revokeObjectURL(url);
    console.log('✓ Object URL creation and revocation');
}

// ============================================================================
// Test 17: Retrieve Blob from Object URL
// ============================================================================
console.log('\nTest 17: Retrieve Blob from Object URL');
{
    const originalBlob = new Blob(['Test Data'], { type: 'text/plain' });
    const url = createObjectURL(originalBlob);

    const retrievedBlob = blobFromObjectUrl(url);
    assertEquals(retrievedBlob.type, 'text/plain', 'Retrieved blob type should match');
    assertEquals(retrievedBlob.size, 9, 'Retrieved blob size should match');

    const text = await retrievedBlob.text();
    assertEquals(text, 'Test Data', 'Retrieved blob content should match');

    revokeObjectURL(url);
    console.log('✓ Retrieve blob from object URL');
}

// ============================================================================
// Test 18: Large Blob (>1MB)
// ============================================================================
console.log('\nTest 18: Large Blob');
{
    const size = 1024 * 1024 * 2; // 2MB
    const largeData = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        largeData[i] = i % 256;
    }

    const blob = new Blob([largeData]);
    assertEquals(blob.size, size, 'Large blob size should be correct');

    const buffer = await blob.arrayBuffer();
    assertEquals(buffer.byteLength, size, 'Large blob ArrayBuffer size should be correct');
    console.log('✓ Large blob (2MB)');
}

// ============================================================================
// Test 19: Nested Blob Slicing
// ============================================================================
console.log('\nTest 19: Nested Blob Slicing');
{
    const blob1 = new Blob(['Hello World']);
    const slice1 = blob1.slice(0, 5);
    const slice2 = slice1.slice(1, 4);

    assertEquals(slice2.size, 3, 'Nested slice size should be 3');
    const text = await slice2.text();
    assertEquals(text, 'ell', 'Nested slice content should be "ell"');
    console.log('✓ Nested blob slicing');
}

// ============================================================================
// Test 20: Slice Boundary Conditions
// ============================================================================
console.log('\nTest 20: Slice Boundary Conditions');
{
    const blob = new Blob(['Hello']);

    const slice1 = blob.slice(0, 0);
    assertEquals(slice1.size, 0, 'Slice(0,0) should be empty');

    const slice2 = blob.slice(5, 5);
    assertEquals(slice2.size, 0, 'Slice(5,5) should be empty');

    const slice3 = blob.slice(10, 20);
    assertEquals(slice3.size, 0, 'Slice beyond size should be empty');

    const slice4 = blob.slice(-10, 3);
    assertEquals(slice4.size, 3, 'Slice with large negative start should work');

    const slice5 = blob.slice();
    assertEquals(slice5.size, 5, 'Slice() without args should return full blob');
    console.log('✓ Slice boundary conditions');
}

// ============================================================================
// Test 21: UTF-8 Encoding
// ============================================================================
console.log('\nTest 21: UTF-8 Encoding');
{
    const blob = new Blob(['Hello 世界 🌍']);
    const text = await blob.text();
    assertEquals(text, 'Hello 世界 🌍', 'UTF-8 should be preserved');

    // Check byte length (not character length)
    assert(blob.size > text.length, 'Byte length should be greater than character length for non-ASCII');
    console.log('✓ UTF-8 encoding');
}

// ============================================================================
// Test 22: TypedArray Views
// ============================================================================
console.log('\nTest 22: TypedArray Views');
{
    const buffer = new ArrayBuffer(16);
    const int32View = new Int32Array(buffer);
    int32View[0] = 0x48656C6C; // "lleH" in little-endian
    int32View[1] = 0x6F57206F; // "oW o" in little-endian

    const blob = new Blob([int32View]);
    assertEquals(blob.size, 16, 'Blob from Int32Array should include full buffer');
    console.log('✓ TypedArray views');
}

// ============================================================================
// Test 23: Stream Method
// ============================================================================
console.log('\nTest 23: Stream Method');
{
    const blob = new Blob(['Hello World']);
    const stream = blob.stream();

    assert(stream instanceof ReadableStream, 'stream() should return ReadableStream');

    // Read from stream
    const reader = stream.getReader();
    let chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    assert(chunks.length > 0, 'Stream should yield chunks');
    console.log('✓ Stream method');
}

// ============================================================================
// Test 24: Concurrent Operations
// ============================================================================
console.log('\nTest 24: Concurrent Operations');
{
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

    assertEquals(results[0], 'Test Data', 'Concurrent text() should work');
    assertEquals(results[1].byteLength, 9, 'Concurrent arrayBuffer() should work');
    assertEquals(results[2].length, 9, 'Concurrent bytes() should work');
    assertEquals(results[3], 'Test', 'Concurrent slice text() should work');
    assertEquals(results[4], 'Data', 'Concurrent slice text() should work');
    console.log('✓ Concurrent operations');
}

// ============================================================================
// Test 25: Invalid Constructor Arguments
// ============================================================================
console.log('\nTest 25: Error Handling');
{
    try {
        createObjectURL('not a blob' as any);
        throw new Error('Should have thrown TypeError');
    } catch (e) {
        assert(e instanceof TypeError, 'createObjectURL should throw TypeError for non-blob');
    }

    console.log('✓ Error handling');
}

// ============================================================================
// Summary
// ============================================================================
console.log('\n=== ALL TESTS PASSED ===');
console.log('Total: 25 test suites');
console.log('✓ Blob creation and properties');
console.log('✓ Type normalization');
console.log('✓ Various input types (string, Uint8Array, ArrayBuffer, mixed)');
console.log('✓ Slicing operations (including negative indices)');
console.log('✓ Content reading (text, arrayBuffer, bytes)');
console.log('✓ File class');
console.log('✓ Object URLs');
console.log('✓ Large blobs');
console.log('✓ Edge cases and boundary conditions');
console.log('✓ UTF-8 encoding');
console.log('✓ Streaming');
console.log('✓ Concurrent operations');
console.log('✓ Error handling');
