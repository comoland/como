// TextEncoder and TextDecoder implementation
import * as ops from 'web:textencoder.go'

// Encoding label normalization
function normalizeEncodingLabel(label) {
    if (typeof label !== 'string') {
        return 'utf-8'
    }

    const normalized = label.toLowerCase().trim()

    switch (normalized) {
        case 'utf8':
        case 'utf-8':
        case 'unicode-1-1-utf-8':
            return 'utf-8'
        case 'utf-16le':
        case 'utf16le':
        case 'utf-16':
            return 'utf-16le'
        case 'utf-16be':
        case 'utf16be':
            return 'utf-16be'
        default:
            return 'utf-8' // Default fallback
    }
}

// TextEncoder class - UTF-8 only per Web API spec
class TextEncoder {
    constructor() {
        // TextEncoder only supports UTF-8 per spec
    }

    get encoding() {
        return 'utf-8'
    }

    encode(input = '') {
        // Convert to string if needed
        const str = String(input)

        // Encode to UTF-8
        if (!input) {
            return new Uint8Array(0)
        }

        const result = ops.op_encode(str, 'utf-8')

        // Convert ArrayBuffer to Uint8Array if needed
        if (result instanceof ArrayBuffer) {
            return new Uint8Array(result)
        }
        return result
    }

    encodeInto(source, destination) {
        if (typeof source !== 'string') {
            throw new TypeError('Source must be a string')
        }

        if (!(destination instanceof Uint8Array)) {
            throw new TypeError('Destination must be a Uint8Array')
        }

        // Encode into buffer
        const result = ops.op_encode_into(source, destination, 'utf-8')

        return {
            read: result.read,
            written: result.written
        }
    }
}

// TextDecoder class - Supports UTF-8, UTF-16LE, UTF-16BE
class TextDecoder {
    #encoding
    #fatal
    #ignoreBOM

    constructor(label = 'utf-8', options = {}) {
        // Normalize encoding label
        this.#encoding = normalizeEncodingLabel(label)

        // Validate encoding
        if (!['utf-8', 'utf-16le', 'utf-16be'].includes(this.#encoding)) {
            throw new RangeError(`The encoding "${label}" is not supported`)
        }

        // Parse options
        this.#fatal = Boolean(options.fatal)
        this.#ignoreBOM = Boolean(options.ignoreBOM)
    }

    get encoding() {
        return this.#encoding
    }

    get fatal() {
        return this.#fatal
    }

    get ignoreBOM() {
        return this.#ignoreBOM
    }

    decode(input, options = {}) {
        // Convert input to Uint8Array if needed
        let buffer
        if (input instanceof ArrayBuffer) {
            buffer = new Uint8Array(input)
        } else if (ArrayBuffer.isView(input)) {
            buffer = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        } else if (input instanceof Uint8Array) {
            buffer = input
        } else {
            throw new TypeError('Input must be an ArrayBuffer, TypedArray, or DataView')
        }

        // Handle stream option (for future streaming support)
        const stream = Boolean(options.stream)

        // Use instance options or override with decode options
        const fatal = options.fatal !== undefined ? Boolean(options.fatal) : this.#fatal
        const ignoreBOM = options.ignoreBOM !== undefined ? Boolean(options.ignoreBOM) : this.#ignoreBOM

        try {
            // Decode using native operation
            const result = ops.op_decode(buffer, this.#encoding, fatal, ignoreBOM)
            return result
        } catch (error) {
            if (fatal) {
                throw new TypeError(`Decoding failed: ${error.message || error}`)
            } else {
                // In non-fatal mode, replace invalid sequences
                // This is handled by the Go layer - return empty string as fallback
                return ''
            }
        }
    }
}

// Helper function to get encoding length
function getEncodingLength(input, encoding) {
    if (typeof input !== 'string') {
        throw new TypeError('Input must be a string')
    }

    const normalizedEncoding = normalizeEncodingLabel(encoding)
    return ops.op_get_encoding_length(input, normalizedEncoding)
}

export { TextEncoder, TextDecoder, getEncodingLength }
