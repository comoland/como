// Test to verify GetTypedArray handles byteOffset correctly
import { Blob } from './node/js/blob.js';

console.log('=== Testing TypedArray with byteOffset ===\n');

// Create a buffer with data
const buffer = new ArrayBuffer(20);
const fullView = new Uint8Array(buffer);

// Fill with test data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...]
for (let i = 0; i < 20; i++) {
    fullView[i] = i;
}

console.log('Full buffer (20 bytes):', Array.from(fullView));

// Create a view starting at offset 5, length 10
const offsetView = new Uint8Array(buffer, 5, 10);
console.log('View at offset 5, length 10:', Array.from(offsetView));
console.log('View properties - length:', offsetView.length, 'byteOffset:', offsetView.byteOffset);

// Create a blob from the offset view
const blob = new Blob([offsetView]);
console.log('\nBlob size:', blob.size);

// Read it back
const data = await blob.bytes();
console.log('Blob data:', Array.from(data));

// Verify correctness
const expected = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const match = data.every((byte, i) => byte === expected[i]);

if (match && data.length === 10) {
    console.log('\n✓ SUCCESS: GetTypedArray correctly handled byteOffset!');
    console.log('  Expected:', expected);
    console.log('  Got:     ', Array.from(data));
} else {
    console.log('\n✗ FAILED: Data mismatch!');
    console.log('  Expected:', expected);
    console.log('  Got:     ', Array.from(data));
}

