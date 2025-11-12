import * as ops from 'std:io.go'

const DEFAULT_CHUNK_SIZE = 64 * 1024
const textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : null

const readerState = new WeakMap()
const writerState = new WeakMap()

function normalizeHandle(handle, registerFn, type) {
    if (typeof handle !== 'string') {
        throw new TypeError(`${type} handle must be a string`)
    }
    return registerFn(handle)
}

function toUint8Array(value) {
    if (value == null) {
        throw new TypeError('chunk is required')
    }

    if (value instanceof Uint8Array) {
        return value
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value)
    }

    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    }

    if (typeof value === 'string') {
        if (textEncoder) {
            return textEncoder.encode(value)
        }

        const buffer = new Uint8Array(value.length)
        for (let i = 0; i < value.length; i += 1) {
            buffer[i] = value.charCodeAt(i) & 0xff
        }
        return buffer
    }

    throw new TypeError(`Unsupported chunk type: ${typeof value}`)
}

function isHandleNotFound(error) {
    if (error == null) {
        return false
    }

    const message = typeof error === 'string' ? error : error.message
    return typeof message === 'string' && message.includes('handle not found')
}

async function closeReaderState(state, force = false) {
    if (state.closed) {
        return
    }

    state.closed = true
    if (state.finalizerToken) {
        state.finalizerToken = null
    }

    if (state.autoClose || force) {
        try {
            ops.op_closeHandle(state.handle)
        } catch (error) {
            if (!isHandleNotFound(error)) {
                throw error
            }
        }
    }
}

async function closeWriterState(state, force = false) {
    if (state.closed) {
        return
    }

    state.closed = true
    if (state.finalizerToken) {
        state.finalizerToken = null
    }

    if (state.autoClose || force) {
        try {
            ops.op_closeHandle(state.handle)
        } catch (error) {
            if (!isHandleNotFound(error)) {
                throw error
            }
        }
    }
}

class Reader {
    highWaterMark = 64 * 1024
    constructor(handle, options = {}) {
        const { autoClose = true, highWaterMark = 64 * 1024 } = options;
        this.highWaterMark = highWaterMark;
        const normalized = normalizeHandle(handle, ops.op_registerReader, 'Reader')

        const state = {
            handle: normalized,
            closed: false,
            autoClose,
            finalizerToken: null,
        }

        if (autoClose) {
            state.finalizerToken = Como.finalizer(() => {
                ops.op_closeHandle(handle)
            })
        }

        readerState.set(this, state)
    }

    static fromHandle(handle, options) {
        return new Reader(handle, options)
    }

    static fromStdin(options) {
        const handle = ops.op_readerFromStdin()
        return new Reader(handle, options)
    }

    static fromFile(path, options) {
        const handle = ops.op_readerFromFile(path)
        return new Reader(handle, options)
    }

    static fromCallback(callback, options) {
        if (typeof callback !== 'function') {
            throw new TypeError('callback must be a function')
        }

        const handle = ops.op_readerFromCallback(callback)
        return new Reader(handle, options)
    }

    get closed() {
        const state = readerState.get(this)
        return !!(state && state.closed)
    }

    get handle() {
        const state = readerState.get(this)
        return state && state.handle
    }

    async read(size) {
        size = size ?? this.highWaterMark;
        const state = readerState.get(this)
        if (!state) {
            throw new Error('Reader state missing')
        }

        if (state.closed) {
            return null
        }

        const result = await ops.op_readerRead(state.handle, size);
        let chunk = result.chunk
        const { done } = result

        if (chunk != null) {
            if (chunk instanceof Uint8Array) {
                // already fine
            } else if (chunk instanceof ArrayBuffer) {
                chunk = new Uint8Array(chunk)
            } else if (ArrayBuffer.isView(chunk)) {
                chunk = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
            } else {
                throw new TypeError(`Unexpected reader chunk type: ${typeof chunk}`)
            }
        }

        if (done) {
            await closeReaderState(state)
        }

        if (chunk == null || chunk.length === 0) {
            return done ? null : new Uint8Array()
        }

        return chunk
    }

    async pipeTo(writer, options = {}) {
        const state = readerState.get(this)
        if (!state || state.closed) {
            throw new Error('reader is closed')
        }

        if (!(writer instanceof Writer)) {
            throw new TypeError('writer must be an instance of Writer')
        }

        const writerInfo = writerState.get(writer)
        if (!writerInfo || writerInfo.closed) {
            throw new Error('writer is closed')
        }

        const args = [state.handle, writerInfo.handle]
        if (options && options.chunkSize != null) {
            const chunkSize = Number(options.chunkSize)
            if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
                throw new TypeError('chunkSize must be a positive number')
            }
            args.push(chunkSize)
        }

        return ops.op_readerPipe(...args)
    }

    async close() {
        const state = readerState.get(this)
        if (!state) {
            return
        }

        await closeReaderState(state, true)
    }

    [Symbol.asyncIterator]() {
        return {
            reader: this,
            async next() {
                const chunk = await this.reader.read()
                if (chunk === null) {
                    return { value: undefined, done: true }
                }
                return { value: chunk, done: false }
            },
        }
    }

    toReadableStream(streamOptions) {
        if (typeof ReadableStream !== 'function') {
            throw new Error('ReadableStream is not available in this environment')
        }

        const reader = this
        return new ReadableStream(
            {
                async pull(controller) {
                    const chunk = await reader.read()
                    if (chunk === null) {
                        controller.close()
                        return
                    }
                    controller.enqueue(chunk)
                },
                async cancel() {
                    await reader.close()
                },
            },
            streamOptions,
        )
    }
}

class Writer {
    constructor(handle, options = {}) {
        const { autoClose = true } = options
        const normalized = normalizeHandle(handle, ops.op_registerWriter, 'Writer')

        const state = {
            handle: normalized,
            closed: false,
            autoClose,
            finalizerToken: null,
        }

        if (autoClose) {
            state.finalizerToken = Como.finalizer(() => {
                ops.op_closeHandle(handle)
            })

            // writerFinalizer.register(this, normalized, state.finalizerToken)
        }

        writerState.set(this, state)
    }

    static fromHandle(handle, options) {
        return new Writer(handle, options)
    }

    static fromCallback(callback, options) {
        if (typeof callback !== 'function') {
            throw new TypeError('callback must be a function')
        }

        const handle = ops.op_writerFromCallback((chunk) => {
            return callback(toUint8Array(chunk))
        })

        return new Writer(handle, options)
    }

    static fromFile(path, options) {
        const handle = ops.op_writerFromFile(path)
        return new Writer(handle, options)
    }

    get closed() {
        const state = writerState.get(this)
        return !!(state && state.closed)
    }

    get handle() {
        const state = writerState.get(this)
        return state && state.handle
    }

    async write(chunk) {
        const state = writerState.get(this)
        if (!state) {
            throw new Error('Writer state missing')
        }

        if (state.closed) {
            throw new Error('writer is closed')
        }

        const payload = toUint8Array(chunk)
        return ops.op_writerWrite(state.handle, payload)
    }

    async close() {
        const state = writerState.get(this)
        if (!state) {
            return
        }

        await closeWriterState(state, true)
    }

    toWritableStream(streamOptions) {
        if (typeof WritableStream !== 'function') {
            throw new Error('WritableStream is not available in this environment')
        }

        const writer = this
        return new WritableStream(
            {
                async write(chunk) {
                    await writer.write(chunk)
                },
                async close() {
                    await writer.close()
                },
                async abort(reason) {
                    await writer.close()
                    return reason
                },
            },
            streamOptions,
        )
    }
}

export function fromReaderHandle(handle, options) {
    return Reader.fromHandle(handle, options)
}

export function fromWriterHandle(handle, options) {
    return Writer.fromHandle(handle, options)
}

export function readerFromCallback(callback, options) {
    return Reader.fromCallback(callback, options)
}

export function writerFromCallback(callback, options) {
    return Writer.fromCallback(callback, options)
}

export function getReaderHandle(reader) {
    if (reader instanceof Reader) {
        return reader.handle
    }
    if (typeof reader === 'string') {
        return ops.op_registerReader(reader)
    }
    throw new TypeError('expected Reader instance or handle string')
}

export function getWriterHandle(writer) {
    if (writer instanceof Writer) {
        return writer.handle
    }
    if (typeof writer === 'string') {
        return ops.op_registerWriter(writer)
    }
    throw new TypeError('expected Writer instance or handle string')
}

export { Reader, Writer, DEFAULT_CHUNK_SIZE }

export default {
    Reader,
    Writer,
    DEFAULT_CHUNK_SIZE,
    fromReaderHandle,
    fromWriterHandle,
    readerFromCallback,
    writerFromCallback,
    getReaderHandle,
    getWriterHandle,
}
