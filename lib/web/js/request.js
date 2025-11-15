import * as ops from 'request.go'
import { Blob } from 'web:blob'

const METHODS = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
const kRequestId = Symbol('requestId')
const kHeaders = Symbol('headers')
const kBodyUsed = Symbol('bodyUsed')
const kHasBody = Symbol('hasBody')

const DEFAULTS = {
    method: 'GET',
    mode: 'cors',
    credentials: 'same-origin',
    cache: 'default',
    redirect: 'follow',
    referrer: 'about:client',
    integrity: '',
    keepalive: false,
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function normalizeMethod(method = 'GET') {
    const token = String(method).toUpperCase()
    return METHODS.includes(token) ? token : token
}

function headersToRecord(headers) {
    const record = {}
    if (!headers) {
        return record
    }

    const assignPair = (key, value) => {
        const normalizedKey = String(key).toLowerCase()
        record[normalizedKey] = String(value)
    }

    if (typeof headers.forEach === 'function') {
        headers.forEach((value, key) => {
            assignPair(key, value)
        })
        return record
    }

    if (typeof headers.entries === 'function') {
        const entries = headers.entries()
        if (typeof entries?.[Symbol.iterator] === 'function') {
            for (const [key, value] of entries) {
                assignPair(key, value)
            }
            return record
        }

        if (Array.isArray(entries)) {
            for (const pair of entries) {
                if (Array.isArray(pair) && pair.length === 2) {
                    assignPair(pair[0], pair[1])
                }
            }
            return record
        }
    }

    if (Array.isArray(headers)) {
        for (const pair of headers) {
            if (Array.isArray(pair) && pair.length === 2) {
                assignPair(pair[0], pair[1])
            }
        }
        return record
    }

    if (typeof headers === 'object') {
        for (const key of Object.keys(headers)) {
            assignPair(key, headers[key])
        }
    }

    return record
}

function recordToHeaders(record) {
    return new Headers(record ?? {})
}

function normalizeURL(input) {
    if (typeof input === 'string') {
        return new URL(input).href
    }

    if (input instanceof URL) {
        return input.href
    }

    throw new TypeError('Request input must be a string or URL')
}

function hasOverrides(init) {
    if (!init) {
        return false
    }

    const overrideKeys = [
        'method',
        'headers',
        'body',
        'mode',
        'credentials',
        'cache',
        'redirect',
        'referrer',
        'integrity',
        'keepalive'
    ]

    return overrideKeys.some((key) => init[key] !== undefined)
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
        const partIds = collectBlobPartIds(body)
        const descriptor = {
            kind: 'blob',
            blobParts: partIds,
            contentType: body.type || null,
        }
        return descriptor
    }

    if (body instanceof ArrayBuffer) {
        return { kind: 'bytes', bytes: new Uint8Array(body) }
    }

    if (ArrayBuffer.isView(body)) {
        return {
            kind: 'bytes',
            bytes: new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
        }
    }

    if (typeof body === 'string') {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'text/plain;charset=UTF-8')
        }
        return { kind: 'bytes', bytes: encoder.encode(body), contentType: headers.get('content-type') }
    }

    if (body instanceof URLSearchParams) {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
        return { kind: 'bytes', bytes: encoder.encode(body.toString()), contentType: headers.get('content-type') }
    }

    if (body instanceof Uint8Array) {
        return { kind: 'bytes', bytes: new Uint8Array(body) }
    }

    throw new TypeError('Unsupported Request body type')
}

function createSnapshot(metadata, bodyDescriptor, headers) {
    return {
        url: metadata.url,
        method: metadata.method,
        headers: headersToRecord(headers),
        credentials: metadata.credentials,
        mode: metadata.mode,
        cache: metadata.cache,
        redirect: metadata.redirect,
        referrer: metadata.referrer,
        integrity: metadata.integrity,
        keepalive: metadata.keepalive,
        bodyUsed: false,
        hasBody: bodyDescriptor.kind !== 'none',
        contentType: headers.get('content-type') ?? bodyDescriptor.contentType ?? '',
    }
}

function createRequestFromSnapshot(id, snapshot) {
    const instance = Object.create(Request.prototype)
    instance[kRequestId] = id
    instance._url = snapshot.url
    instance._method = snapshot.method
    instance[kHeaders] = recordToHeaders(snapshot.headers)
    instance._credentials = snapshot.credentials ?? DEFAULTS.credentials
    instance._mode = snapshot.mode ?? DEFAULTS.mode
    instance._cache = snapshot.cache ?? DEFAULTS.cache
    instance._redirect = snapshot.redirect ?? DEFAULTS.redirect
    instance._referrer = snapshot.referrer ?? DEFAULTS.referrer
    instance._integrity = snapshot.integrity ?? DEFAULTS.integrity
    instance._keepalive = Boolean(snapshot.keepalive)
    instance[kBodyUsed] = Boolean(snapshot.bodyUsed)
    instance[kHasBody] = Boolean(snapshot.hasBody)
    instance._contentType = snapshot.contentType ?? ''
    return instance
}

async function consumeBodyBytes(request) {
    if (request[kBodyUsed]) {
        throw new TypeError('Body has already been used for this Request')
    }

    request[kBodyUsed] = true
    const result = ops.op_request_consume_body(request[kRequestId])

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

class Request {
    constructor(input, init = {}) {
        if (input instanceof Request && !hasOverrides(init)) {
            if (input.bodyUsed) {
                throw new TypeError('Cannot construct Request with disturbed body')
            }
            const clonedId = ops.op_request_clone(input[kRequestId])
            const snapshot = ops.op_request_snapshot(clonedId)
            return createRequestFromSnapshot(clonedId, snapshot)
        }

        if (input instanceof Request && hasOverrides(init)) {
            throw new TypeError('Constructing Request from Request with overrides is not supported yet')
        }

        const url = normalizeURL(input)
        const method = normalizeMethod(init.method ?? DEFAULTS.method)

        const headers = new Headers(init.headers ?? {})
        const bodyDescriptor = normalizeBody(init.body ?? null, headers)

        if ((method === 'GET' || method === 'HEAD') && bodyDescriptor.kind !== 'none') {
            throw new TypeError('Body not allowed for GET or HEAD requests')
        }

        const metadata = {
            url,
            method,
            headers: headersToRecord(headers),
            credentials: init.credentials ?? DEFAULTS.credentials,
            mode: init.mode ?? DEFAULTS.mode,
            cache: init.cache ?? DEFAULTS.cache,
            redirect: init.redirect ?? DEFAULTS.redirect,
            referrer: init.referrer ?? DEFAULTS.referrer,
            integrity: init.integrity ?? DEFAULTS.integrity,
            keepalive: Boolean(init.keepalive ?? DEFAULTS.keepalive),
            bodyKind: bodyDescriptor.kind,
            blobParts: bodyDescriptor.blobParts ?? [],
            contentType: headers.get('content-type') ?? bodyDescriptor.contentType ?? '',
        }

        const requestId = bodyDescriptor.kind === 'bytes'
            ? ops.op_request_create(metadata, bodyDescriptor.bytes ?? new Uint8Array())
            : ops.op_request_create(metadata)

        const snapshot = createSnapshot(metadata, bodyDescriptor, headers)
        return createRequestFromSnapshot(requestId, snapshot)
    }

    get url() {
        return this._url
    }

    get method() {
        return this._method
    }

    get headers() {
        return this[kHeaders]
    }

    get credentials() {
        return this._credentials
    }

    get mode() {
        return this._mode
    }

    get cache() {
        return this._cache
    }

    get redirect() {
        return this._redirect
    }

    get referrer() {
        return this._referrer
    }

    get integrity() {
        return this._integrity
    }

    get keepalive() {
        return this._keepalive
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
            throw new TypeError('Cannot clone a Request with disturbed body')
        }

        const clonedId = ops.op_request_clone(this[kRequestId])
        const snapshot = ops.op_request_snapshot(clonedId)
        return createRequestFromSnapshot(clonedId, snapshot)
    }
}

export { Request }
