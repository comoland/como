/**
 * Example usage of the Blob API implementation
 * Demonstrates various features of the Web API-compliant Blob/File system
 */

import { Blob, File, createObjectURL, revokeObjectURL, blobFromObjectUrl } from '../node/js/blob.js';

console.log('=== Blob API Examples ===\n');

// Example 1: Create blob from string
console.log('Example 1: Create blob from string');
const blob1 = new Blob(['Hello World'], { type: 'text/plain' });
console.log(`Size: ${blob1.size}, Type: ${blob1.type}`);
console.log(`Text: ${await blob1.text()}`);
console.log();

// Example 2: Create blob from mixed parts
console.log('Example 2: Create blob from mixed parts');
const blob2 = new Blob([
    'Hello ',
    new Uint8Array([87, 111, 114, 108, 100]), // "World"
    '!'
], { type: 'text/plain' });
console.log(`Size: ${blob2.size}`);
console.log(`Text: ${await blob2.text()}`);
console.log();

// Example 3: Slice operations (zero-copy)
console.log('Example 3: Slice operations');
const blob3 = new Blob(['The quick brown fox jumps over the lazy dog']);
const slice1 = blob3.slice(0, 9);
const slice2 = blob3.slice(10, 19);
console.log(`Original size: ${blob3.size}`);
console.log(`Slice 1: "${await slice1.text()}"`);
console.log(`Slice 2: "${await slice2.text()}"`);
console.log();

// Example 4: Negative indices
console.log('Example 4: Negative indices in slicing');
const blob4 = new Blob(['Hello World']);
const lastFive = blob4.slice(-5);
console.log(`Last 5 chars: "${await lastFive.text()}"`);
console.log();

// Example 5: File with metadata
console.log('Example 5: File with metadata');
const file = new File(['File content here'], 'example.txt', {
    type: 'text/plain',
    lastModified: Date.now()
});
console.log(`Name: ${file.name}`);
console.log(`Size: ${file.size}`);
console.log(`Type: ${file.type}`);
console.log(`Last Modified: ${new Date(file.lastModified).toISOString()}`);
console.log(`Content: ${await file.text()}`);
console.log();

// Example 6: Object URLs
console.log('Example 6: Object URLs');
const blob5 = new Blob(['Data to store in URL'], { type: 'text/plain' });
const url = createObjectURL(blob5);
console.log(`Created URL: ${url}`);

// Retrieve blob from URL
const retrieved = blobFromObjectUrl(url);
console.log(`Retrieved size: ${retrieved.size}`);
console.log(`Retrieved content: ${await retrieved.text()}`);

// Clean up
revokeObjectURL(url);
console.log('URL revoked');
console.log();

// Example 7: Nested blobs
console.log('Example 7: Nested blobs');
const part1 = new Blob(['First ']);
const part2 = new Blob(['Second ']);
const part3 = new Blob(['Third']);
const combined = new Blob([part1, part2, part3]);
console.log(`Combined size: ${combined.size}`);
console.log(`Combined text: ${await combined.text()}`);
console.log();

// Example 8: Binary data
console.log('Example 8: Binary data');
const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
const binaryBlob = new Blob([binaryData], { type: 'image/jpeg' });
console.log(`Binary blob size: ${binaryBlob.size}`);
console.log(`Type: ${binaryBlob.type}`);
const bytes = await binaryBlob.bytes();
console.log(`First bytes: ${Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ')}`);
console.log();

// Example 9: ArrayBuffer conversion
console.log('Example 9: ArrayBuffer conversion');
const blob6 = new Blob(['Convert to buffer']);
const buffer = await blob6.arrayBuffer();
console.log(`ArrayBuffer byteLength: ${buffer.byteLength}`);
const view = new Uint8Array(buffer);
console.log(`First 7 bytes as text: "${String.fromCharCode(...view.slice(0, 7))}"`);
console.log();

// Example 10: Streaming (for large data)
console.log('Example 10: Streaming');
const blob7 = new Blob(['Chunk 1, ', 'Chunk 2, ', 'Chunk 3']);
const stream = blob7.stream();
const reader = stream.getReader();
let chunkNum = 1;

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(`Stream chunk ${chunkNum++}: ${value.length} bytes`);
}
console.log();

// Example 11: UTF-8 support
console.log('Example 11: UTF-8 support');
const utf8Blob = new Blob(['Hello 世界 🌍'], { type: 'text/plain; charset=utf-8' });
console.log(`UTF-8 size: ${utf8Blob.size} bytes (not characters)`);
console.log(`UTF-8 text: ${await utf8Blob.text()}`);
console.log();

// Example 12: JSON data
console.log('Example 12: JSON data');
const jsonData = { name: 'John', age: 30, city: 'New York' };
const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
console.log(`JSON blob size: ${jsonBlob.size}`);
const parsedData = JSON.parse(await jsonBlob.text());
console.log(`Parsed JSON:`, parsedData);

console.log('\n=== All examples completed successfully ===');

