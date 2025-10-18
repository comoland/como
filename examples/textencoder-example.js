// TextEncoder and TextDecoder Examples

console.log('=== TextEncoder Examples ===')

// Basic encoding
const encoder = new TextEncoder()
const text = 'Hello, World! 🌍'
const encoded = encoder.encode(text)

console.log('Original text:', text)
console.log('Encoded bytes:', Array.from(encoded))
console.log('Encoded length:', encoded.length)

// Encode into existing buffer
const buffer = new Uint8Array(20)
const result = encoder.encodeInto('Hello', buffer)
console.log('EncodeInto result:', result)
console.log('Buffer content:', Array.from(buffer.slice(0, result.written)))

console.log('\n=== TextDecoder Examples ===')

// Basic decoding
const decoder = new TextDecoder()
const decoded = decoder.decode(encoded)
console.log('Decoded text:', decoded)

// Decode with different encodings
const utf16Decoder = new TextDecoder('utf-16le')
const utf16Bytes = new Uint8Array([72, 0, 101, 0, 108, 0, 108, 0, 111, 0]) // "Hello" in UTF-16LE
const utf16Decoded = utf16Decoder.decode(utf16Bytes)
console.log('UTF-16LE decoded:', utf16Decoded)

// Decode with options
const strictDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
console.log('Strict decoder encoding:', strictDecoder.encoding)
console.log('Strict decoder fatal:', strictDecoder.fatal)
console.log('Strict decoder ignoreBOM:', strictDecoder.ignoreBOM)

console.log('\n=== Round-trip Examples ===')

// UTF-8 round-trip
const original = 'Hello 世界 🌍'
const encodedRoundTrip = encoder.encode(original)
const decodedRoundTrip = decoder.decode(encodedRoundTrip)
console.log('UTF-8 round-trip:', original === decodedRoundTrip)

// Working with different input types
const arrayBuffer = new ArrayBuffer(5)
const view = new Uint8Array(arrayBuffer)
view.set([72, 101, 108, 108, 111])

const fromArrayBuffer = decoder.decode(arrayBuffer)
const fromDataView = decoder.decode(new DataView(arrayBuffer))
const fromTypedArray = decoder.decode(view)

console.log('From ArrayBuffer:', fromArrayBuffer)
console.log('From DataView:', fromDataView)
console.log('From TypedArray:', fromTypedArray)

console.log('\n=== Performance Example ===')

// EncodeInto for performance
const largeText = 'A'.repeat(1000)
const largeBuffer = new Uint8Array(2000)

console.time('encodeInto')
const encodeResult = encoder.encodeInto(largeText, largeBuffer)
console.timeEnd('encodeInto')

console.log('Encoded', encodeResult.read, 'characters into', encodeResult.written, 'bytes')

console.log('\n=== Error Handling Examples ===')

// Invalid input types
try {
    encoder.encodeInto(123, new Uint8Array(10))
} catch (error) {
    console.log('Caught error:', error.message)
}

try {
    encoder.encodeInto('Hello', 'not-a-buffer')
} catch (error) {
    console.log('Caught error:', error.message)
}

try {
    decoder.decode('not-a-buffer')
} catch (error) {
    console.log('Caught error:', error.message)
}

// Unsupported encoding
try {
    new TextDecoder('iso-8859-1')
} catch (error) {
    console.log('Caught error:', error.message)
}

console.log('\n=== Integration with Blob ===')

// Working with Blob
const blob = new Blob(['Hello, Blob! 🌍'], { type: 'text/plain' })
const blobText = await blob.text()
console.log('Blob text:', blobText)

// Encode blob text
const blobEncoded = encoder.encode(blobText)
console.log('Blob encoded length:', blobEncoded.length)

// Create new blob from encoded data
const newBlob = new Blob([blobEncoded], { type: 'application/octet-stream' })
console.log('New blob size:', newBlob.size)

console.log('\n=== Encoding Length Helper ===')

// Get encoding length without encoding
import { getEncodingLength } from 'textencoder'

const lengthText = 'Hello 世界'
const utf8Length = getEncodingLength(lengthText, 'utf-8')
const utf16Length = getEncodingLength(lengthText, 'utf-16le')

console.log('Text:', lengthText)
console.log('UTF-8 length:', utf8Length)
console.log('UTF-16LE length:', utf16Length)

console.log('\n=== All examples completed! ===')
