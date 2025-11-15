import * as ops from 'response.go'
import { Blob } from 'web:blob'

const kResponseId = Symbol('responseId')
const kHeaders = Symbol('headers')
const kBodyUsed = Symbol('bodyUsed')

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const VALID_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function toHeaders(init) {
    if (init instanceof Headers) {
        return init
    }
    return new Headers(init ?? {})
}

function headersToRecord(headers) {
    const bag = toHeaders(headers)
    const record = {}
    bag.forEach((value, key) => {
        record[key] = value
    })
    return record
}

function recordToHeaders(record) {
    return record instanceof Headers ? record : new Headers(record ?? {})
}

function collectBlobPartIds(blob) {
    const ids = []

    const walk = (target) => {
        if (!(target instanceof Blob)) {
            return
        }

        const parts = target._parts ?? []
        for (const part of parts) {
            if (part instanceof Blob) {
                walk(part)
            } else if (part && typeof part._id === 'string') {
                ids.push(part._id)
            }
        }
    }

    walk(blob)
    return ids
}

function normalizeBody(body, headers) {
    if (body === null || body === undefined) {
        return { kind: 'none' }
    }

    if (body instanceof Blob) {
        if (body.type && !headers.has('content-type')) {
            headers.set('content-type', body.type)
        }
        return {
            kind: 'blob',
            blobParts: collectBlobPartIds(body),
            contentType: body.type || null,
        }
    }

    if (body instanceof ArrayBuffer) {
        return { kind: 'bytes', bytes: new Uint8Array(body) }
    }

    if (ArrayBuffer.isView(body)) {
        return {
            kind: 'bytes',
            bytes: new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
        }
    }

    if (typeof body === 'string') {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'text/plain;charset=UTF-8')
        }
        return {
            kind: 'bytes',
            bytes: encoder.encode(body),
            contentType: headers.get('content-type'),
        }
    }

    if (body instanceof URLSearchParams) {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
        return {
            kind: 'bytes',
            bytes: encoder.encode(body.toString()),
            contentType: headers.get('content-type'),
        }
    }

    if (body instanceof Uint8Array) {
        return { kind: 'bytes', bytes: new Uint8Array(body) }
    }

    throw new TypeError('Unsupported Response body type')
}

function createSnapshot(metadata, headers, bodyDescriptor) {
    const bag = toHeaders(headers)
    return {
        status: metadata.status,
        statusText: metadata.statusText,
        headers: headersToRecord(bag),
        url: metadata.url,
        type: metadata.type,
        bodyUsed: false,
        hasBody: bodyDescriptor.kind !== 'none',
        contentType: bag.get('content-type') ?? bodyDescriptor.contentType ?? '',
    }
}

function createResponseFromSnapshot(id, snapshot) {
    const instance = Object.create(Response.prototype)
    instance[kResponseId] = id
    instance._status = snapshot.status
    instance._statusText = snapshot.statusText || ''
    instance._url = snapshot.url || ''
    instance._type = snapshot.type || 'basic'
    instance[kHeaders] = recordToHeaders(snapshot.headers)
    instance[kBodyUsed] = Boolean(snapshot.bodyUsed)
    instance._contentType = snapshot.contentType ?? ''
    return instance
}

async function consumeBodyBytes(response) {
    if (response[kBodyUsed]) {
        throw new TypeError('Body has already been used for this Response')
    }

    response[kBodyUsed] = true
    const result = ops.op_response_consume_body(response[kResponseId])

    if (!result) {
        return new Uint8Array()
    }

    if (result instanceof Uint8Array) {
        return result
    }

    if (result instanceof ArrayBuffer) {
        return new Uint8Array(result)
    }

    if (ArrayBuffer.isView(result)) {
        return new Uint8Array(result.buffer, result.byteOffset, result.byteLength)
    }

    return Uint8Array.from(result)
}

class Response {
    constructor(body = null, init = {}) {
        const status = init.status ?? 200
        if (status < 200 || status > 599) {
            throw new RangeError('Response status must be between 200 and 599')
        }

        const statusText = init.statusText ?? ''
        const headers = toHeaders(init.headers)

        const bodyDescriptor = normalizeBody(body, headers)
        if ((status === 204 || status === 205 || status === 304) && bodyDescriptor.kind !== 'none') {
            throw new TypeError('Body not allowed for status 204, 205, or 304')
        }

        const metadata = {
            status,
            statusText,
            headers: headersToRecord(headers),
            url: init.url ?? '',
            type: init.type ?? 'basic',
            bodyKind: bodyDescriptor.kind,
            blobParts: bodyDescriptor.blobParts ?? [],
            contentType: headers.get('content-type') ?? bodyDescriptor.contentType ?? '',
        }

        const responseId = bodyDescriptor.kind === 'bytes'
            ? ops.op_response_create(metadata, bodyDescriptor.bytes ?? new Uint8Array())
            : ops.op_response_create(metadata)

        const snapshot = createSnapshot(metadata, headers, bodyDescriptor)
        return createResponseFromSnapshot(responseId, snapshot)
    }

    get status() {
        return this._status
    }

    get ok() {
        return this._status >= 200 && this._status < 300
    }

    get statusText() {
        return this._statusText
    }

    get type() {
        return this._type
    }

    get url() {
        return this._url
    }

    get headers() {
        return this[kHeaders]
    }

    get bodyUsed() {
        return this[kBodyUsed]
    }

    async arrayBuffer() {
        const bytes = await consumeBodyBytes(this)
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }

    async text() {
        const buffer = await this.arrayBuffer()
        return decoder.decode(buffer)
    }

    async json() {
        const text = await this.text()
        return JSON.parse(text)
    }

    async blob() {
        const bytes = await consumeBodyBytes(this)
        return new Blob([bytes], { type: this._contentType ?? this.headers.get('content-type') ?? '' })
    }

    clone() {
        if (this.bodyUsed) {
            throw new TypeError('Cannot clone a Response with disturbed body')
        }

        const clonedId = ops.op_response_clone(this[kResponseId])
        const snapshot = ops.op_response_snapshot(clonedId)
        return createResponseFromSnapshot(clonedId, snapshot)
    }

    static error() {
        const response = Object.create(Response.prototype)
        response._status = 0
        response._statusText = ''
        response._type = 'error'
        response._url = ''
        response[kHeaders] = new Headers()
        response[kBodyUsed] = true
        response._contentType = ''
        response[kResponseId] = ''
        return response
    }

    static redirect(url, status = 302) {
        if (!VALID_REDIRECT_STATUSES.has(status)) {
            throw new RangeError('Invalid status code for redirect')
        }

        return new Response(null, {
            status,
            headers: { Location: String(url) },
        })
    }
}

export { Response }

