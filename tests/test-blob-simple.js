import { Blob } from './node/js/blob.js';

console.log('Test: Creating simple blob');

try {
    const blob = new Blob(['Hello'], { type: 'text/plain' });
    console.log('Blob created');
    console.log('Size:', blob.size);
    console.log('Type:', blob.type);

    const text = await blob.text();
    console.log('Text length:', text.length);
    console.log('Text:', JSON.stringify(text));
    console.log('Text bytes:', [...text].map(c => c.charCodeAt(0)));

    const buffer = await blob.arrayBuffer();
    console.log('Buffer length:', buffer.byteLength);
    const view = new Uint8Array(buffer);
    console.log('Buffer bytes:', Array.from(view));
} catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
}

