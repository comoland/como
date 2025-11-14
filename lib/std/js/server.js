import * as ops from 'std:server.go'
import { Reader, Writer } from 'std:io'

const textDecoder = typeof TextDecoder === 'function' ? new TextDecoder() : null
const textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : null

const HANDLE_NOT_FOUND_MSG = 'handle not found'

function isHandleNotFound(error) {
    if (error == null) {
        return false
    }

    if (typeof error === 'string') {
        return error.includes(HANDLE_NOT_FOUND_MSG)
    }

    if (typeof error.message === 'string') {
        return error.message.includes(HANDLE_NOT_FOUND_MSG)
    }

    return false
}

function buildHeaders(headersInit) {
    if (typeof Headers === 'function') {
        const headers = new Headers()
        for (const [key, values] of Object.entries(headersInit ?? {})) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    headers.append(key, String(value))
                }
            } else if (values != null) {
                headers.append(key, String(values))
            }
        }
        return headers
    }

    const headers = Object.create(null)
    for (const [key, values] of Object.entries(headersInit ?? {})) {
        if (Array.isArray(values)) {
            headers[key.toLowerCase()] = values.map((value) => String(value))
        } else if (values != null) {
            headers[key.toLowerCase()] = [String(values)]
        }
    }
    return headers
}

function collectBytes(chunks) {
    if (chunks.length === 0) {
        return new Uint8Array(0)
    }

    if (chunks.length === 1) {
        return chunks[0]
    }

    let total = 0
    for (const chunk of chunks) {
        total += chunk.byteLength
    }

    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
    }
    return merged
}

class ServerRequest {
    #id
    #readerHandle
    #reader
    #bodyUsed = false

    constructor(descriptor) {
        this.#id = descriptor.id
        this.method = descriptor.method
        this.url = descriptor.url
        this.path = descriptor.path ?? descriptor.pathname ?? descriptor.url
        this.queryString = descriptor.queryString ?? ''
        this.query = descriptor.query ?? {}
        this.remoteAddr = descriptor.remoteAddr
        this.host = descriptor.host
        this.protocol = descriptor.protocol
        this.headers = buildHeaders(descriptor.headers)

        this.#readerHandle = descriptor.bodyHandle || null
        this.#reader = this.#readerHandle ? Reader.fromHandle(this.#readerHandle) : null
    }

    get id() {
        return this.#id
    }

    get bodyUsed() {
        return this.#bodyUsed
    }

    #ensureReader() {
        if (!this.#reader) {
            throw new TypeError('request body is empty')
        }

        if (this.#bodyUsed) {
            throw new TypeError('request body already consumed')
        }

        this.#bodyUsed = true
        return this.#reader
    }

    async arrayBuffer() {
        const reader = this.#ensureReader()
        const chunks = []
        while (true) {
            const chunk = await reader.read()
            if (chunk === null) {
                break
            }
            chunks.push(chunk)
        }
        return collectBytes(chunks).buffer
    }

    async bytes() {
        const reader = this.#ensureReader()
        const chunks = []
        while (true) {
            const chunk = await reader.read()
            if (chunk === null) {
                break
            }
            chunks.push(chunk)
        }
        return collectBytes(chunks)
    }

    async text() {
        const buffer = await this.bytes()
        if (textDecoder) {
            return textDecoder.decode(buffer)
        }

        let result = ''
        for (const byte of buffer) {
            result += String.fromCharCode(byte)
        }
        return result
    }

    async json() {
        const body = await this.text()
        return JSON.parse(body)
    }

    stream(streamOptions) {
        if (!this.#reader) {
            throw new TypeError('request body is empty')
        }

        this.#bodyUsed = true
        return this.#reader.toReadableStream(streamOptions)
    }

    async close() {
        if (this.#reader) {
            try {
                await this.#reader.close()
            } catch (error) {
                if (!isHandleNotFound(error)) {
                    throw error
                }
            }
            this.#reader = null
            this.#bodyUsed = true
        }
    }

    header(name) {
        if (!name) {
            return undefined
        }

        if (this.headers instanceof Headers) {
            return this.headers.get(name)
        }

        const values = this.headers[name.toLowerCase()]
        if (!values || values.length === 0) {
            return undefined
        }
        return values[0]
    }
}

class ServerResponse {
    #id
    #writerHandle
    #writer
    #ended = false

    constructor(descriptor) {
        this.#id = descriptor.id
        this.#writerHandle = descriptor.writerHandle || null
        this.#writer = this.#writerHandle ? Writer.fromHandle(this.#writerHandle) : null
    }

    get id() {
        return this.#id
    }

    get ended() {
        return this.#ended
    }

    status(code) {
        if (!Number.isInteger(code)) {
            throw new TypeError('status code must be an integer')
        }

        ops.op_request_set_status(this.#id, code)
        return this
    }

    setHeader(name, value) {
        if (typeof name !== 'string') {
            throw new TypeError('header name must be a string')
        }

        ops.op_request_set_header(this.#id, name, String(value))
        return this
    }

    appendHeader(name, value) {
        if (typeof name !== 'string') {
            throw new TypeError('header name must be a string')
        }

        ops.op_request_add_header(this.#id, name, String(value))
        return this
    }

    async write(chunk) {
        if (this.#ended) {
            throw new Error('response already ended')
        }

        if (!this.#writer) {
            throw new Error('response writer not available')
        }

        await this.#writer.write(chunk)
        return this
    }

    async flush() {
        if (this.#ended) {
            return this
        }
        ops.op_request_flush(this.#id)
        return this
    }

    async end(chunk) {
        if (this.#ended) {
            return
        }

        if (chunk != null) {
            await this.write(chunk)
        }

        await this.#closeHandles()
        ops.op_request_end(this.#id)
        this.#ended = true
    }

    async #closeHandles() {
        if (this.#writer) {
            try {
                await this.#writer.close()
            } catch (error) {
                if (!isHandleNotFound(error)) {
                    throw error
                }
            }
            this.#writer = null
        }
    }
}

class Server {
    #id
    #handler
    #closed = false
    #loopPromise = null
    #pending = new Set()
    #address

    constructor(options, handler) {
        this.#handler = handler ?? null
        const created = ops.op_createServer(options ?? {})
        if (typeof created === 'string') {
            this.#id = created
            this.#address = ops.op_server_address(this.#id)
        } else if (created && typeof created === 'object') {
            this.#id = created.id
            this.#address = created.address
        } else {
            throw new Error('std:server op_createServer returned unexpected value')
        }
    }

    get address() {
        if (!this.#address) {
            this.#address = ops.op_server_address(this.#id)
        }
        return this.#address
    }

    onRequest(handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('handler must be a function')
        }
        this.#handler = handler
        return this
    }

    async listen(handler) {
        if (handler) {
            this.onRequest(handler)
        }

        if (!this.#handler) {
            throw new Error('server handler is not defined')
        }

        if (!this.#loopPromise) {
            this.#loopPromise = this.#acceptLoop()
        }

        return this
    }

    async close() {
        if (this.#closed) {
            return
        }
        this.#closed = true
        ops.op_closeServer(this.#id)
        if (this.#loopPromise) {
            await this.#loopPromise
        }
        if (this.#pending.size > 0) {
            await Promise.allSettled(this.#pending)
        }
    }

    async #acceptLoop() {
        while (!this.#closed) {
            const descriptor = await ops.op_server_accept(this.#id)
            if (!descriptor) {
                break
            }

            const task = this.#handleDescriptor(descriptor)
            this.#pending.add(task)
            task.finally(() => {
                this.#pending.delete(task)
            }).catch(() => {
                this.#pending.delete(task)
            })
        }
    }

    async #handleDescriptor(descriptor) {
        const request = new ServerRequest(descriptor)
        const response = new ServerResponse(descriptor)

        let handlerError = null
        try {
            await this.#handler(request, response)
        } catch (error) {
            handlerError = error
            try {
                if (!response.ended) {
                    response.status(500)
                    await response.end('Internal Server Error')
                }
            } catch (_) {
                // ignore secondary errors
            }
            console.error('std:server handler error', error)
        } finally {
            // Only auto-end response if handler threw an error
            // If handler returned normally, assume it will handle response (even if async like setTimeout)
            if (handlerError && !response.ended) {
                // Error case: always send error response
                try {
                    await response.end()
                } catch (_) {
                    // ignore close errors
                }
            }
            // Note: We don't auto-end if handler returned normally, even if response hasn't started.
            // This allows handlers to use setTimeout/Promises to send responses asynchronously.
            // The request will complete when res.end() is eventually called.

            // Always close request reader when handler completes
            try {
                await request.close()
            } catch (_) {
                // ignore close errors
            }
        }
    }
}

export function createServer(options, handler) {
    if (typeof options === 'function') {
        handler = options
        options = undefined
    }

    const server = new Server(options, handler)
    return server
}

export { Server, ServerRequest, ServerResponse }

export default {
    createServer,
    Server,
    ServerRequest,
    ServerResponse,
}
