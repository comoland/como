# URL Console Output Fix

## Problem
When logging URL instances with `console.log()`, they appeared as `URL {}` with no visible properties, making debugging difficult.

## Solution
Added custom `inspect()` methods to both `URL` and `URLSearchParams` classes, and fixed the console's custom inspect handling.

## Changes Made

### 1. Fixed Console Custom Inspect Logic (`core/js/console.js`)
- Removed broken legacy check that prevented custom inspect from working
- Added constructor name preservation when custom inspect returns an object
- Now properly shows class name prefix (e.g., `URL { ... }`)

### 2. Added URL.inspect() Method (`lib/web/js/url.js`)
Returns an object with all URL properties:
```javascript
inspect() {
    return {
        href: this.href,
        origin: this.origin,
        protocol: this.protocol,
        username: this.username,
        password: this.password,
        host: this.host,
        hostname: this.hostname,
        port: this.port,
        pathname: this.pathname,
        search: this.search,
        hash: this.hash
    }
}
```

### 3. Added URLSearchParams.inspect() Method (`lib/web/js/url.js`)
Returns an object representing the query parameters:
```javascript
inspect() {
    const obj = {}
    for (const [key, value] of this[_list]) {
        if (obj[key] === undefined) {
            obj[key] = value
        } else if (Array.isArray(obj[key])) {
            obj[key].push(value)
        } else {
            obj[key] = [obj[key], value]
        }
    }
    return obj
}
```

## Results

### Before
```javascript
const url = new URL('https://example.com:8080/path?query=value#hash');
console.log(url);
// Output: URL {}

const params = new URLSearchParams('foo=bar&baz=qux');
console.log(params);
// Output: URLSearchParams {}
```

### After
```javascript
const url = new URL('https://example.com:8080/path?query=value#hash');
console.log(url);
// Output: URL {
//   href: 'https://example.com:8080/path?query=value#hash',
//   origin: 'https://example.com:8080',
//   protocol: 'https:',
//   username: '',
//   password: '',
//   host: 'example.com:8080',
//   hostname: 'example.com',
//   port: '8080',
//   pathname: '/path',
//   search: '?query=value',
//   hash: '#hash'
// }

const params = new URLSearchParams('foo=bar&baz=qux');
console.log(params);
// Output: URLSearchParams { foo: 'bar', baz: 'qux' }
```

## Benefits
- ✅ Easy debugging of URL objects
- ✅ See all URL components at a glance
- ✅ Compatible with other JS engines (Node.js, Deno, Bun)
- ✅ Works in arrays and nested objects
- ✅ Consistent with enhanced console formatting

## Technical Notes
- Uses the `inspect()` method pattern (supported by Como's console)
- Console preserves constructor name when custom inspect is used
- URLSearchParams properly handles duplicate keys
- All existing tests pass
- No breaking changes

## Test
Run: `go run . ./examples/test-url-console.js`

---

**Date:** October 11, 2025
**Status:** ✅ Complete

