import { describe, assert } from './runner'

describe('Request', async ({ test }) => {
    test('constructs with defaults and text body', async () => {
        const req = new Request('https://example.com/resource', {
            method: 'post',
            headers: {
                'X-Token': 'abc'
            },
            body: 'hello world'
        })

        assert.is(req.url, 'https://example.com/resource')
        assert.is(req.method, 'POST')
        assert.is(req.headers.get('x-token'), 'abc')
        assert.ok(req.headers.get('content-type')!.includes('text/plain'))
        assert.is(req.bodyUsed, false)

        const bodyText = await req.text()
        assert.is(bodyText, 'hello world')
        assert.is(req.bodyUsed, true)
    })

    test('rejects body for GET/HEAD', () => {
        assert.throws(() => {
            new Request('https://example.com', { method: 'GET', body: 'nope' })
        })

        assert.throws(() => {
            new Request('https://example.com', { method: 'HEAD', body: 'nope' })
        })
    })

    test('supports Uint8Array bodies', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4])
        const req = new Request('https://example.com/upload', {
            method: 'POST',
            body: bytes
        })

        const buffer = await req.arrayBuffer()
        const view = new Uint8Array(buffer)
        assert.is(view.length, 4)
        assert.is(view[0], 1)
        assert.is(view[3], 4)
    })

    test('supports URLSearchParams bodies', async () => {
        const params = new URLSearchParams({ foo: 'bar', baz: 'qux' })
        const req = new Request('https://example.com/form', {
            method: 'POST',
            body: params
        })

        const buffer = await req.arrayBuffer()
        const decoded = new TextDecoder().decode(buffer)
        assert.ok(decoded.includes('foo=bar'))
        assert.ok(req.headers.get('content-type')!.includes('application/x-www-form-urlencoded'))
    })

    test('clone creates independent request', async () => {
        const original = new Request('https://example.com/data', {
            method: 'POST',
            body: 'clone-me'
        })

        const cloned = original.clone()
        assert.is(cloned.method, 'POST')
        assert.is(cloned.url, original.url)

        const cloneText = await cloned.text()
        assert.is(cloneText, 'clone-me')

        const originalText = await original.text()
        assert.is(originalText, 'clone-me')

        let err: unknown = null
        try {
            await original.text()
        } catch (error) {
            err = error
        }
        assert.ok(err instanceof Error)
    })

    test('constructs from existing Request without overrides', async () => {
        const base = new Request('https://example.com/json', {
            method: 'POST',
            body: JSON.stringify({ ok: true })
        })

        const copy = new Request(base)
        assert.is(copy.method, 'POST')
        assert.is(copy.url, base.url)

        const payload = JSON.parse(await copy.text())
        assert.ok(payload.ok)

        const basePayload = JSON.parse(await base.text())
        assert.ok(basePayload.ok)
    })

    test('Blob bodies use the Blob implementation', async () => {
        const blob = new Blob(['blob-body'], { type: 'text/plain' })
        const req = new Request('https://example.com/blob', {
            method: 'POST',
            body: blob
        })

        const text = await req.text()
        assert.is(text, 'blob-body')
        assert.is(req.headers.get('content-type'), 'text/plain')
    })
})
