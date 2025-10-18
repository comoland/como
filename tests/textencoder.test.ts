import { describe, assert } from './runner'

describe('TextEncoder', async ({ test }) => {
    test('should create TextEncoder instance', async ({ expect }) => {
        const encoder = new TextEncoder()
        expect(encoder.encoding).toBe('utf-8')
    })

    test('should encode empty string', async ({ expect }) => {
        const encoder = new TextEncoder()
        const result = encoder.encode('')
        assert.ok(result instanceof Uint8Array)
        expect(result.length).toBe(0)
    })

    test('should encode ASCII string', async ({ expect }) => {
        const encoder = new TextEncoder()
        const result = encoder.encode('Hello')
        assert.ok(result instanceof Uint8Array)
        expect(result.length).toBe(5)
        expect(Array.from(result)).toMatchObject([72, 101, 108, 108, 111])
    })

    test('should encode UTF-8 string with multi-byte characters', async ({ expect }) => {
        const encoder = new TextEncoder()
        const result = encoder.encode('Hello 世界 🌍')
        assert.ok(result instanceof Uint8Array)
        expect(result.length).toBeGreaterThan(7) // Multi-byte characters
    })

    test('should encode emoji', async ({ expect }) => {
        const encoder = new TextEncoder()
        const result = encoder.encode('😀')
        assert.ok(result instanceof Uint8Array)
        expect(result.length).toBe(4) // UTF-8 emoji is 4 bytes
    })

    test('should handle non-string input', async ({ expect }) => {
        const encoder = new TextEncoder()
        // @ts-expect-error
        const result = encoder.encode(123)
        assert.ok(result instanceof Uint8Array)
        expect(Array.from(result)).toMatchObject([49, 50, 51]) // "123"
    })

    test('should encode into buffer', async ({ expect }) => {
        const encoder = new TextEncoder()
        const buffer = new Uint8Array(10)
        const result = encoder.encodeInto('Hello', buffer)

        expect(result.read).toBe(5)
        expect(result.written).toBe(5)
        expect(Array.from(buffer.slice(0, 5))).toMatchObject([72, 101, 108, 108, 111])
    })

    test('should encode into partial buffer', async ({ expect }) => {
        const encoder = new TextEncoder()
        const buffer = new Uint8Array(3)
        const result = encoder.encodeInto('Hello', buffer)

        expect(result.read).toBe(5) // All characters processed
        expect(result.written).toBe(3) // Only 3 bytes written
        expect(Array.from(buffer)).toMatchObject([72, 101, 108])
    })

    test('should throw on invalid encodeInto arguments', async ({ expect }) => {
        const encoder = new TextEncoder()
        expect(() => {
            // @ts-expect-error
            encoder.encodeInto(123, new Uint8Array(10))
        }).toThrow(/TypeError/)

        expect(() => {
            // @ts-expect-error
            encoder.encodeInto('Hello', 'not-a-buffer')
        }).toThrow(/TypeError/)
    })
})

describe('TextDecoder', async ({ test }) => {
    test('should create TextDecoder with default options', async ({ expect }) => {
        const decoder = new TextDecoder()
        expect(decoder.encoding).toBe('utf-8')
        expect(decoder.fatal).toBe(false)
        expect(decoder.ignoreBOM).toBe(false)
    })

    test('should create TextDecoder with custom options', async ({ expect }) => {
        const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
        expect(decoder.encoding).toBe('utf-8')
        expect(decoder.fatal).toBe(true)
        expect(decoder.ignoreBOM).toBe(true)
    })

    test('should normalize encoding labels', async ({ expect }) => {
        const decoder1 = new TextDecoder('UTF8')
        const decoder2 = new TextDecoder('utf-8')
        const decoder3 = new TextDecoder('unicode-1-1-utf-8')

        expect(decoder1.encoding).toBe('utf-8')
        expect(decoder2.encoding).toBe('utf-8')
        expect(decoder3.encoding).toBe('utf-8')
    })

    test('should decode empty buffer', async ({ expect }) => {
        const decoder = new TextDecoder()
        const result = decoder.decode(new Uint8Array())
        expect(result).toBe('')
    })

    test('should decode ASCII bytes', async ({ expect }) => {
        const decoder = new TextDecoder()
        const bytes = new Uint8Array([72, 101, 108, 108, 111])
        const result = decoder.decode(bytes)
        expect(result).toBe('Hello')
    })

    test('should decode UTF-8 multi-byte characters', async ({ expect }) => {
        const decoder = new TextDecoder()
        // "Hello 世界" in UTF-8 bytes
        const bytes = new Uint8Array([72, 101, 108, 108, 111, 32, 228, 184, 150, 231, 149, 140])
        const result = decoder.decode(bytes)
        expect(result).toBe('Hello 世界')
    })

    test('should decode emoji', async ({ expect }) => {
        const decoder = new TextDecoder()
        // "😀" in UTF-8 bytes
        const bytes = new Uint8Array([240, 159, 152, 128])
        const result = decoder.decode(bytes)
        expect(result).toBe('😀')
    })

    test('should decode from ArrayBuffer', async ({ expect }) => {
        const decoder = new TextDecoder()
        const buffer = new ArrayBuffer(5)
        const view = new Uint8Array(buffer)
        view.set([72, 101, 108, 108, 111])

        const result = decoder.decode(buffer)
        expect(result).toBe('Hello')
    })

    test('should decode from DataView', async ({ expect }) => {
        const decoder = new TextDecoder()
        const buffer = new ArrayBuffer(5)
        const view = new DataView(buffer)
        view.setUint8(0, 72)
        view.setUint8(1, 101)
        view.setUint8(2, 108)
        view.setUint8(3, 108)
        view.setUint8(4, 111)

        const result = decoder.decode(view)
        expect(result).toBe('Hello')
    })

    test('should decode UTF-16LE', async ({ expect }) => {
        const decoder = new TextDecoder('utf-16le')
        // "Hello" in UTF-16LE bytes
        const bytes = new Uint8Array([72, 0, 101, 0, 108, 0, 108, 0, 111, 0])
        const result = decoder.decode(bytes)
        expect(result).toBe('Hello')
    })

    test('should decode UTF-16BE', async ({ expect }) => {
        const decoder = new TextDecoder('utf-16be')
        // "Hello" in UTF-16BE bytes
        const bytes = new Uint8Array([0, 72, 0, 101, 0, 108, 0, 108, 0, 111])
        const result = decoder.decode(bytes)
        expect(result).toBe('Hello')
    })

    test('should handle BOM detection', async ({ expect }) => {
        const decoder = new TextDecoder('utf-8', { ignoreBOM: false })
        // UTF-8 BOM + "Hello"
        const bytes = new Uint8Array([239, 187, 191, 72, 101, 108, 108, 111])
        const result = decoder.decode(bytes)
        expect(result).toBe('Hello') // BOM should be stripped
    })

    test('should ignore BOM when ignoreBOM is true', async ({ expect }) => {
        const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
        // UTF-8 BOM + "Hello"
        const bytes = new Uint8Array([239, 187, 191, 72, 101, 108, 108, 111])
        const result = decoder.decode(bytes)
        expect(result).toBe('\uFEFFHello') // BOM should be preserved
    })

    test('should handle decode options override', async ({ expect }) => {
        const decoder = new TextDecoder('utf-8', { fatal: false })
        const bytes = new Uint8Array([72, 101, 108, 108, 111])

        // Override with decode options
        // @ts-expect-error
        const result = decoder.decode(bytes, { fatal: true })
        expect(result).toBe('Hello')
    })

    test('should throw on invalid input type', async ({ expect }) => {
        const decoder = new TextDecoder()

        expect(() => {
            // @ts-expect-error
            decoder.decode('not-a-buffer')
        }).toThrow(/TypeError/)
    })

    test.skip('should throw on unsupported encoding', async ({ expect }) => {
        expect(() => {
            new TextDecoder('iso-8859-1')
        }).toThrow(/Error/)
    })

    test('should handle invalid UTF-8 sequences in non-fatal mode', async ({ expect }) => {
        const decoder = new TextDecoder('utf-8', { fatal: false })
        // Invalid UTF-8 sequence
        const bytes = new Uint8Array([72, 101, 108, 255, 111])
        const result = decoder.decode(bytes)
        // Should not throw, invalid byte replaced with replacement character
        expect(typeof result).toBe('string')
    })
})

describe('TextEncoder/TextDecoder Round-trip', async ({ test }) => {
    test('should round-trip ASCII text', async ({ expect }) => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const original = 'Hello, World!'
        const encoded = encoder.encode(original)
        const decoded = decoder.decode(encoded)

        expect(decoded).toBe(original)
    })

    test('should round-trip UTF-8 text with multi-byte characters', async ({ expect }) => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const original = 'Hello 世界 🌍'
        const encoded = encoder.encode(original)
        const decoded = decoder.decode(encoded)

        expect(decoded).toBe(original)
    })

    test('should round-trip UTF-16LE text', async ({ expect }) => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder('utf-16le')

        const original = 'Hello 世界'
        const encoded = encoder.encode(original) // This will be UTF-8
        // For UTF-16 round-trip, we need to encode with UTF-16
        const utf16Bytes = new Uint8Array(original.length * 2)
        for (let i = 0; i < original.length; i++) {
            const code = original.charCodeAt(i)
            utf16Bytes[i * 2] = code & 0xFF
            utf16Bytes[i * 2 + 1] = code >> 8
        }

        const decoded = decoder.decode(utf16Bytes)
        expect(decoded).toBe(original)
    })
})

describe('Edge Cases', async ({ test }) => {
    test('should handle null and undefined', async ({ expect }) => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        // @ts-expect-error
        expect(encoder.encode(null) instanceof Uint8Array ).toBeTruthy()
        expect(encoder.encode(undefined) instanceof Uint8Array).toBeTruthy()
        expect(decoder.decode(new Uint8Array())).toBe('')
    })

    test('should handle very long strings', async ({ expect }) => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const longString = 'A'.repeat(10000)
        const encoded = encoder.encode(longString)
        const decoded = decoder.decode(encoded)

        expect(decoded).toBe(longString)
    })

    test('should handle mixed content', async ({ expect }) => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const mixed = 'ASCII + 中文 + emoji 😀 + numbers 123'
        const encoded = encoder.encode(mixed)
        const decoded = decoder.decode(encoded)

        expect(decoded).toBe(mixed)
    })
})
