import { describe, assert } from './runner'

describe('Response', async ({ test }) => {
    test('constructs with defaults and text body', async () => {
        const res = new Response('hello world', {
            status: 201,
            headers: {
                'X-Test': 'value'
            }
        })

        assert.is(res.status, 201)
        assert.is(res.ok, true)
        assert.is(res.headers.get('x-test'), 'value')
        assert.ok(res.headers.get('content-type')!.includes('text/plain'))
        assert.is(res.bodyUsed, false)

        const text = await res.text()
        assert.is(text, 'hello world')
        assert.is(res.bodyUsed, true)
    })

    test('rejects body for 204/205/304 statuses', () => {
        assert.throws(() => new Response('nope', { status: 204 }))
        assert.throws(() => new Response('nope', { status: 205 }))
        assert.throws(() => new Response('nope', { status: 304 }))
    })

    test('supports Blob bodies', async () => {
        const blob = new Blob(['blob-body'], { type: 'text/plain' })
        const res = new Response(blob, { status: 200 })

        const text = await res.text()
        assert.is(text, 'blob-body')
        assert.is(res.headers.get('content-type'), 'text/plain')
    })

    test('supports Uint8Array bodies', async () => {
        const data = new Uint8Array([1, 2, 3, 4])
        const res = new Response(data, { status: 200 })

        const buffer = await res.arrayBuffer()
        const view = new Uint8Array(buffer)
        assert.is(view.length, 4)
        assert.is(view[0], 1)
        assert.is(view[3], 4)
    })

    test('clone creates independent response', async () => {
        const original = new Response('clone-me', { status: 200 })
        const cloned = original.clone()

        assert.is(cloned.status, 200)
        assert.is(await cloned.text(), 'clone-me')
        assert.is(await original.text(), 'clone-me')

        let err: unknown = null
        try {
            await original.text()
        } catch (error) {
            err = error
        }
        assert.ok(err instanceof Error)
    })

    test('Response.error()', () => {
        const res = Response.error()
        assert.is(res.type, 'error')
        assert.is(res.status, 0)
        assert.is(res.ok, false)
    })

    test('Response.redirect()', () => {
        const res = Response.redirect('https://example.com', 301)
        assert.is(res.status, 301)
        assert.is(res.headers.get('location'), 'https://example.com')
    })
})
