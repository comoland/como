# URL and URLSearchParams Implementation

## Overview

This document describes the implementation of WHATWG URL and URLSearchParams APIs for Como, following a two-layer architecture with Go handling performance-critical operations and JavaScript providing the developer API.

## Architecture

### Two-Layer Design

Similar to Blob implementation and following Deno's pattern:

**Go Layer** (`node/url.go`):
- URL parsing and validation
- Component extraction
- URL normalization/serialization
- Query string parsing and serialization
- Percent encoding/decoding

**JavaScript Layer** (`node/js/url.js`):
- URL and URLSearchParams classes
- Property getters/setters
- Iterators (entries, keys, values)
- Input validation and type conversions
- Lazy searchParams initialization

### Buffer-Based Communication

To minimize data copying, URL component offsets are passed via a shared Uint32Array buffer:

```
Buffer Layout (8 elements):
[0] = scheme_end      (e.g., "https" ends at index 5)
[1] = username_end    (credentials end position)
[2] = host_start      (hostname begins)
[3] = host_end        (hostname ends)
[4] = port            (port number, or 65536 for no port)
[5] = path_start      (pathname begins)
[6] = query_start     (search begins, or 0 if none)
[7] = fragment_start  (hash begins, or 0 if none)
```

JavaScript slices the serialized URL string using these offsets to extract components.

## API Specification

### URLSearchParams

```javascript
class URLSearchParams {
  constructor(init?: string | Record<string, string> | [string, string][] | URLSearchParams)

  // Methods
  append(name: string, value: string): void
  delete(name: string): void
  get(name: string): string | null
  getAll(name: string): string[]
  has(name: string): boolean
  set(name: string, value: string): void
  sort(): void
  toString(): string

  // Iterators
  entries(): Iterator<[string, string]>
  keys(): Iterator<string>
  values(): Iterator<string>
  [Symbol.iterator](): Iterator<[string, string]>

  // Properties
  readonly size: number
}
```

### URL

```javascript
class URL {
  constructor(url: string, base?: string)

  // Static methods
  static canParse(url: string, base?: string): boolean
  static parse(url: string, base?: string): URL | null

  // Properties (all with getters and setters)
  href: string
  origin: string (readonly)
  protocol: string
  username: string
  password: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  searchParams: URLSearchParams (readonly)
  hash: string

  // Methods
  toString(): string
  toJSON(): string
}
```

## Go Operations

### op_url_parse(href, buffer)

Parses a URL string without a base URL.

**Parameters:**
- `href`: URL string to parse
- `buffer`: Uint32Array (8 elements) to fill with component offsets

**Returns:** Status code
- `0`: Success, href unchanged (serialization same as input)
- `1`: Success, needs serialization (normalized URL differs from input)
- `2`: Error (invalid URL)

**Implementation:**
1. Parse URL using Go's `net/url` package
2. Extract component offsets
3. Compare serialized form with input
4. Store serialization in context if different
5. Fill buffer with offsets

### op_url_parse_with_base(href, base, buffer)

Parses a URL string with a base URL.

**Parameters:**
- `href`: URL string to parse (can be relative)
- `base`: Base URL string
- `buffer`: Uint32Array to fill with offsets

**Returns:** Same status codes as op_url_parse

### op_url_get_serialization()

Retrieves the serialized URL stored during parsing.

**Returns:** Normalized URL string

### op_url_reparse(href, setter, value, buffer)

Reparses URL after modifying a component (for setters).

**Parameters:**
- `href`: Current URL string
- `setter`: Component to modify (0-8)
  - 0: hash
  - 1: host
  - 2: hostname
  - 3: password
  - 4: pathname
  - 5: port
  - 6: protocol
  - 7: search
  - 8: username
- `value`: New value for the component
- `buffer`: Uint32Array to fill with new offsets

**Returns:** Status code (same as op_url_parse)

### op_url_parse_search_params(query)

Parses a query string into key-value pairs.

**Parameters:**
- `query`: Query string (with or without leading '?')

**Returns:** Array of [key, value] pairs

**Implementation:**
- Remove leading '?' if present
- Split on '&'
- Split each part on '='
- URL decode keys and values
- Handle edge cases (empty values, multiple '=', etc.)

### op_url_stringify_search_params(pairs)

Serializes key-value pairs to query string format.

**Parameters:**
- `pairs`: Array of [key, value] pairs

**Returns:** Query string (without leading '?')

**Implementation:**
- URL encode keys and values
- Join with '=' and '&'
- Handle special characters per WHATWG spec

## JavaScript Implementation Details

### URLSearchParams Internal Structure

```javascript
class URLSearchParams {
  #list = []           // Array of [key, value] pairs
  #urlObject = null    // Associated URL object (if any)

  #updateUrlSearch() {
    if (this.#urlObject) {
      this.#urlObject.search = this.toString()
    }
  }
}
```

When URLSearchParams is associated with a URL (via url.searchParams), modifications automatically update the URL's search property.

### URL Internal Structure

```javascript
class URL {
  #serialization    // Full URL string
  #schemeEnd
  #usernameEnd
  #hostStart
  #hostEnd
  #port
  #pathStart
  #queryStart
  #fragmentStart
  #searchParams = null  // Lazy-initialized

  #updateComponents() {
    // Extract offsets from componentsBuf
  }

  #updateSearchParams() {
    // Sync searchParams with current search string
  }
}
```

Component extraction is lazy - properties slice the serialization string on access.

### Performance Optimizations

1. **Lazy searchParams**: Only create URLSearchParams when accessed
2. **Buffer passing**: Use shared Uint32Array for component offsets
3. **Minimal reparsing**: Only reparse when setters modify URL
4. **String slicing**: Extract components from serialized string (no object overhead)
5. **Caching**: Store parsed components, avoid redundant parsing

## Edge Cases and Spec Compliance

### URL Parsing

- **Relative URLs**: Require base URL
- **Special schemes**: http, https, ws, wss, ftp, file (have authority)
- **Opaque paths**: data:, mailto: (no component parsing)
- **IPv6 addresses**: Enclosed in brackets [2001:db8::1]
- **Port normalization**: Default ports omitted (80 for http, 443 for https)
- **Percent encoding**: Applied to path, query, fragment
- **IDN/Punycode**: International domain names (future enhancement)

### URLSearchParams

- **Encoding**: application/x-www-form-urlencoded
- **Space encoding**: '+' or '%20'
- **Order preservation**: Maintains insertion order
- **Duplicate keys**: Allowed (use getAll to retrieve)
- **Empty values**: Allowed (key= or key)

## Testing Strategy

### URL Tests

```javascript
// Basic parsing
test('parse absolute URL')
test('parse relative URL with base')
test('parse URL with all components')

// Setters
test('set each URL component')
test('invalid setter values rejected')
test('port normalization')

// Static methods
test('URL.canParse returns boolean')
test('URL.parse returns URL or null')

// Edge cases
test('IPv6 addresses')
test('special schemes')
test('percent encoding')
test('unicode handling')
```

### URLSearchParams Tests

```javascript
// Construction
test('construct from string')
test('construct from object')
test('construct from array of pairs')
test('construct from another URLSearchParams')

// Operations
test('append, set, get, getAll, has, delete')
test('sort alphabetically')
test('toString serialization')

// Integration
test('url.searchParams reflects url.search')
test('modifying searchParams updates url.search')

// Iteration
test('entries(), keys(), values()')
test('for...of iteration')
```

## Known Limitations

1. **Go net/url differences**: Go's `net/url` implements RFC 3986, not WHATWG URL spec
   - Some edge cases may differ from browser behavior
   - Consider using a WHATWG-compliant Go library in future

2. **IDN support**: International domain names require additional work
   - Current implementation handles ASCII domains well
   - Unicode domain names may need Punycode conversion

3. **Performance**: While optimized, may be slower than native browser implementations
   - Good enough for server-side and tooling use cases

## Future Enhancements

1. **URLPattern**: Pattern matching API (separate implementation)
2. **IDN/Punycode**: Full international domain name support
3. **Performance profiling**: Benchmark against Node.js and Deno
4. **WHATWG compliance**: Use spec-compliant parsing library if available

## References

- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [RFC 3986 - URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)
- [Deno ext/url implementation](https://github.com/denoland/deno/tree/main/ext/url)
- [Go net/url package](https://pkg.go.dev/net/url)

