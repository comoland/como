import { describe, test } from './runner'

describe('URLSearchParams', async ({ test }) => {
    test('construct from string', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        expect(params.get('foo')).toBe('bar')
        expect(params.get('baz')).toBe('qux')
    })

    test('construct from string with leading ?', ({ expect }) => {
        const params = new URLSearchParams('?foo=bar&baz=qux')
        expect(params.get('foo')).toBe('bar')
        expect(params.get('baz')).toBe('qux')
    })

    test('construct from object', ({ expect }) => {
        const params = new URLSearchParams({ foo: 'bar', baz: 'qux' })
        expect(params.get('foo')).toBe('bar')
        expect(params.get('baz')).toBe('qux')
    })

    test('construct from array of pairs', ({ expect }) => {
        const params = new URLSearchParams([['foo', 'bar'], ['baz', 'qux']])
        expect(params.get('foo')).toBe('bar')
        expect(params.get('baz')).toBe('qux')
    })

    test('construct from another URLSearchParams', ({ expect }) => {
        const original = new URLSearchParams('foo=bar')
        const copy = new URLSearchParams(original)
        expect(copy.get('foo')).toBe('bar')
    })

    test('append adds new values', ({ expect }) => {
        const params = new URLSearchParams()
        params.append('foo', 'bar')
        params.append('foo', 'baz')
        expect(params.getAll('foo')).toMatchObject(['bar', 'baz'])
    })

    test('set replaces all values', ({ expect }) => {
        const params = new URLSearchParams()
        params.append('foo', 'bar')
        params.append('foo', 'baz')
        params.set('foo', 'qux')
        expect(params.getAll('foo')).toMatchObject(['qux'])
    })

    test('delete removes all values', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&foo=baz&other=value')
        params.delete('foo')
        expect(params.has('foo')).toBe(false)
        expect(params.has('other')).toBe(true)
    })

    test('get returns first value', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&foo=baz')
        expect(params.get('foo')).toBe('bar')
    })

    test('get returns null for missing key', ({ expect }) => {
        const params = new URLSearchParams()
        expect(params.get('missing')).toBe(null)
    })

    test('getAll returns all values', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&foo=baz')
        expect(params.getAll('foo')).toMatchObject(['bar', 'baz'])
    })

    test('getAll returns empty array for missing key', ({ expect }) => {
        const params = new URLSearchParams()
        expect(params.getAll('missing')).toMatchObject([])
    })

    test('has returns true for existing key', ({ expect }) => {
        const params = new URLSearchParams('foo=bar')
        expect(params.has('foo')).toBe(true)
    })

    test('has returns false for missing key', ({ expect }) => {
        const params = new URLSearchParams()
        expect(params.has('missing')).toBe(false)
    })

    test('sort orders keys alphabetically', ({ expect }) => {
        const params = new URLSearchParams('z=1&a=2&m=3')
        params.sort()
        expect(params.toString()).toBe('a=2&m=3&z=1')
    })

    test('toString serializes to query string', ({ expect }) => {
        const params = new URLSearchParams({ foo: 'bar', baz: 'qux' })
        const str = params.toString()
        expect(str.includes('foo=bar')).toBe(true)
        expect(str.includes('baz=qux')).toBe(true)
    })

    test('toString handles special characters', ({ expect }) => {
        const params = new URLSearchParams({ 'hello world': 'foo&bar' })
        const str = params.toString()
        expect(str.includes('hello')).toBe(true)
    })

    test('size returns number of parameters', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        expect(params.size).toBe(2)
    })

    test('size includes duplicates', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&foo=baz')
        expect(params.size).toBe(2)
    })

    test('entries iterator works', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        const entries = Array.from(params.entries())
        expect(entries.length).toBe(2)
        expect(entries[0]).toMatchObject(['foo', 'bar'])
    })

    test('keys iterator works', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        const keys = Array.from(params.keys())
        expect(keys.length).toBe(2)
        expect(keys[0]).toBe('foo')
    })

    test('values iterator works', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        const values = Array.from(params.values())
        expect(values.length).toBe(2)
        expect(values[0]).toBe('bar')
    })

    test('forEach works', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        const results: [string, string][] = []
        params.forEach((value, key) => {
            results.push([key, value])
        })
        expect(results.length).toBe(2)
    })

    test('for...of iteration works', ({ expect }) => {
        const params = new URLSearchParams('foo=bar&baz=qux')
        const results: [string, string][] = []
        for (const [key, value] of params) {
            results.push([key, value])
        }
        expect(results.length).toBe(2)
    })
})

describe('URL', async ({ test }) => {
    test('construct from absolute URL', ({ expect }) => {
        const url = new URL('https://example.com/path')
        expect(url.href).toBe('https://example.com/path')
    })

    test('construct from relative URL with base', ({ expect }) => {
        const url = new URL('/path', 'https://example.com')
        expect(url.href).toBe('https://example.com/path')
    })

    test('construct from relative path with base', ({ expect }) => {
        const url = new URL('subpath', 'https://example.com/base/')
        expect(url.href).toBe('https://example.com/base/subpath')
    })

    test('throws on invalid URL', ({ expect }) => {
        expect(() => {
            new URL('not a url')
        }).toThrow()
    })

    test('throws on relative URL without base', ({ expect }) => {
        expect(() => {
            new URL('/path')
        }).toThrow()
    })

    test('URL.parse returns URL or null', ({ expect }) => {
        const valid = URL.parse('https://example.com')
        expect(valid).not.toBe(null)
        expect(valid?.href).toBe('https://example.com')

        const invalid = URL.parse('not a url')
        expect(invalid).toBe(null)
    })

    test('URL.canParse returns boolean', ({ expect }) => {
        expect(URL.canParse('https://example.com')).toBe(true)
        expect(URL.canParse('not a url')).toBe(false)
    })

    test('protocol getter', ({ expect }) => {
        const url = new URL('https://example.com')
        expect(url.protocol).toBe('https:')
    })

    test('protocol setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.protocol = 'http'
        expect(url.protocol).toBe('http:')
    })

    test('hostname getter', ({ expect }) => {
        const url = new URL('https://example.com:8080')
        expect(url.hostname).toBe('example.com')
    })

    test('hostname setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.hostname = 'test.com'
        expect(url.hostname).toBe('test.com')
    })

    test('host getter includes port', ({ expect }) => {
        const url = new URL('https://example.com:8080')
        expect(url.host).toBe('example.com:8080')
    })

    test('host setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.host = 'test.com:9000'
        expect(url.host).toBe('test.com:9000')
    })

    test('port getter', ({ expect }) => {
        const url = new URL('https://example.com:8080')
        expect(url.port).toBe('8080')
    })

    test('port getter returns empty for default port', ({ expect }) => {
        const url = new URL('https://example.com')
        expect(url.port).toBe('')
    })

    test('port setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.port = '8080'
        expect(url.port).toBe('8080')
    })

    test('pathname getter', ({ expect }) => {
        const url = new URL('https://example.com/path/to/resource')
        expect(url.pathname).toBe('/path/to/resource')
    })

    test('pathname setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.pathname = '/new/path'
        expect(url.pathname).toBe('/new/path')
    })

    test('search getter', ({ expect }) => {
        const url = new URL('https://example.com?foo=bar')
        expect(url.search).toBe('?foo=bar')
    })

    test('search getter returns empty when no query', ({ expect }) => {
        const url = new URL('https://example.com')
        expect(url.search).toBe('')
    })

    test('search setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.search = 'foo=bar'
        expect(url.search).toBe('?foo=bar')
    })

    test('search setter with leading ?', ({ expect }) => {
        const url = new URL('https://example.com')
        url.search = '?foo=bar'
        expect(url.search).toBe('?foo=bar')
    })

    test('hash getter', ({ expect }) => {
        const url = new URL('https://example.com#section')
        expect(url.hash).toBe('#section')
    })

    test('hash getter returns empty when no fragment', ({ expect }) => {
        const url = new URL('https://example.com')
        expect(url.hash).toBe('')
    })

    test('hash setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.hash = 'section'
        expect(url.hash).toBe('#section')
    })

    test('username getter', ({ expect }) => {
        const url = new URL('https://user@example.com')
        expect(url.username).toBe('user')
    })

    test('username setter', ({ expect }) => {
        const url = new URL('https://example.com')
        url.username = 'user'
        expect(url.username).toBe('user')
    })

    test('password getter', ({ expect }) => {
        const url = new URL('https://user:pass@example.com')
        expect(url.password).toBe('pass')
    })

    test('password setter', ({ expect }) => {
        const url = new URL('https://user@example.com')
        url.password = 'pass'
        expect(url.password).toBe('pass')
    })

    test('origin for http', ({ expect }) => {
        const url = new URL('http://example.com:8080/path')
        expect(url.origin).toBe('http://example.com:8080')
    })

    test('origin for https', ({ expect }) => {
        const url = new URL('https://example.com/path')
        expect(url.origin).toBe('https://example.com')
    })

    test('origin for file', ({ expect }) => {
        const url = new URL('file:///path/to/file')
        expect(url.origin).toBe('file://')
    })

    test.skip('href getter returns full URL', ({ expect }) => {
        const url = new URL('https://user:pass@example.com:8080/path?query=value#hash')
        expect(url.href).toContain('example.com')
        expect(url.href).toContain('/path')
    })

    test('href setter updates URL', ({ expect }) => {
        const url = new URL('https://example.com')
        url.href = 'https://test.com/path'
        expect(url.href).toBe('https://test.com/path')
    })

    test('searchParams is lazy initialized', ({ expect }) => {
        const url = new URL('https://example.com?foo=bar')
        const params = url.searchParams
        expect(params.get('foo')).toBe('bar')
    })

    test('searchParams reflects search changes', ({ expect }) => {
        const url = new URL('https://example.com')
        url.search = 'foo=bar'
        expect(url.searchParams.get('foo')).toBe('bar')
    })

    test.skip('searchParams modifications update search', ({ expect }) => {
        const url = new URL('https://example.com')
        url.searchParams.set('foo', 'bar')
        expect(url.search).toContain('foo')
        expect(url.search).toContain('bar')
    })

    test('toString returns href', ({ expect }) => {
        const url = new URL('https://example.com/path')
        expect(url.toString()).toBe(url.href)
    })

    test('toJSON returns href', ({ expect }) => {
        const url = new URL('https://example.com/path')
        expect(url.toJSON()).toBe(url.href)
    })

    test.skip('complex URL with all components', ({ expect }) => {
        const url = new URL('https://user:pass@example.com:8080/path/to/resource?foo=bar&baz=qux#section')
        expect(url.protocol).toBe('https:')
        expect(url.username).toBe('user')
        expect(url.password).toBe('pass')
        expect(url.hostname).toBe('example.com')
        expect(url.port).toBe('8080')
        expect(url.pathname).toBe('/path/to/resource')
        expect(url.search).toContain('foo=bar')
        expect(url.hash).toBe('#section')
    })

    test.skip('URL with IPv6 hostname', ({ expect }) => {
        const url = new URL('http://[2001:db8::1]:8080/')
        expect(url.hostname).toContain('2001')
    })

    test('file:// URL', ({ expect }) => {
        const url = new URL('file:///path/to/file.txt')
        expect(url.protocol).toBe('file:')
        expect(url.pathname).toBe('/path/to/file.txt')
    })

    test('data: URL', ({ expect }) => {
        const url = new URL('data:text/plain;base64,SGVsbG8=')
        expect(url.protocol).toBe('data:')
    })

    test('blob: URL', ({ expect }) => {
        const url = new URL('blob:null/12345')
        expect(url.protocol).toBe('blob:')
    })
})

describe('URL and URLSearchParams integration', async ({ test }) => {
    test.skip('searchParams updates URL search', ({ expect }) => {
        const url = new URL('https://example.com')
        url.searchParams.append('foo', 'bar')
        url.searchParams.append('baz', 'qux')

        expect(url.search).toContain('foo=bar')
        expect(url.search).toContain('baz=qux')
    })

    test('URL search updates affect searchParams', ({ expect }) => {
        const url = new URL('https://example.com?foo=bar')
        const params1 = url.searchParams
        expect(params1.get('foo')).toBe('bar')

        url.search = 'baz=qux'
        expect(url.searchParams.get('baz')).toBe('qux')
        expect(url.searchParams.get('foo')).toBe(null)
    })

    test('searchParams object persists across search changes', ({ expect }) => {
        const url = new URL('https://example.com?foo=bar')
        const params = url.searchParams

        url.search = 'baz=qux'
        expect(url.searchParams).toBe(params) // Same object
        expect(params.get('baz')).toBe('qux')
    })
})
