// URL and URLSearchParams implementation
import * as ops from 'url.go'

// Symbols for private properties
const _list = Symbol('list')
const _urlObject = Symbol('url object')
const _updateUrlSearch = Symbol('updateUrlSearch')

// Parse status constants - must match Go layer
const ParseStatusOk = 0
const ParseStatusOkSerialization = 1
const ParseStatusErr = 2

// Setter constants - must match Go layer
const SET_HASH = 0
const SET_HOST = 1
const SET_HOSTNAME = 2
const SET_PASSWORD = 3
const SET_PATHNAME = 4
const SET_PORT = 5
const SET_PROTOCOL = 6
const SET_SEARCH = 7
const SET_USERNAME = 8

const NO_PORT = 65536

// Helper: Call parse operation and get result
// Note: Operations now return {status, serialization} to avoid race conditions
function opUrlParse(href, maybeBase, buffer) {
    const result = maybeBase === undefined
        ? ops.op_url_parse(href, buffer)
        : ops.op_url_parse_with_base(href, maybeBase, buffer)

    const status = result.status
    const serialization = result.serialization

    if (status === ParseStatusOk) {
        return { status, serialization: href }
    } else if (status === ParseStatusOkSerialization) {
        return { status, serialization }
    } else {
        throw new TypeError(
            `Invalid URL: '${href}'` +
            (maybeBase ? ` with base '${maybeBase}'` : '')
        )
    }
}

// Helper: Reparse URL with new component value
function opUrlReparse(href, setter, value, buffer) {
    const result = ops.op_url_reparse(href, setter, value, buffer)
    return result.serialization
}

// URLSearchParams class
class URLSearchParams {
    constructor(init = '') {
        this[_list] = []
        this[_urlObject] = null

        if (!init) {
            return
        }

        if (typeof init === 'string') {
            // String: parse as query string
            if (init[0] === '?') {
                init = init.substring(1)
            }
            if (init) {
                const pairs = ops.op_url_parse_search_params(init)
                this[_list] = pairs || []
            }
        } else if (Array.isArray(init)) {
            // Array of pairs
            for (const pair of init) {
                if (!Array.isArray(pair) || pair.length !== 2) {
                    throw new TypeError('Each query pair must be an array of length 2')
                }
                this[_list].push([String(pair[0]), String(pair[1])])
            }
        } else if (init instanceof URLSearchParams) {
            // Copy from another URLSearchParams
            this[_list] = [...init[_list]]
        } else if (typeof init === 'object' && init !== null) {
            // Object/Record
            for (const key in init) {
                if (Object.prototype.hasOwnProperty.call(init, key)) {
                    this[_list].push([key, String(init[key])])
                }
            }
        } else {
            throw new TypeError('Invalid URLSearchParams init')
        }
    }

    #updateUrlSearch() {
        const url = this[_urlObject]
        if (url === null) {
            return
        }
        url[_updateUrlSearch](this.toString())
    }

    append(name, value) {
        if (arguments.length < 2) {
            throw new TypeError('append requires 2 arguments')
        }
        this[_list].push([String(name), String(value)])
        this.#updateUrlSearch()
    }

    delete(name) {
        if (arguments.length < 1) {
            throw new TypeError('delete requires 1 argument')
        }
        name = String(name)
        const list = this[_list]
        let i = 0
        while (i < list.length) {
            if (list[i][0] === name) {
                list.splice(i, 1)
            } else {
                i++
            }
        }
        this.#updateUrlSearch()
    }

    get(name) {
        if (arguments.length < 1) {
            throw new TypeError('get requires 1 argument')
        }
        name = String(name)
        for (const pair of this[_list]) {
            if (pair[0] === name) {
                return pair[1]
            }
        }
        return null
    }

    getAll(name) {
        if (arguments.length < 1) {
            throw new TypeError('getAll requires 1 argument')
        }
        name = String(name)
        const result = []
        for (const pair of this[_list]) {
            if (pair[0] === name) {
                result.push(pair[1])
            }
        }
        return result
    }

    has(name) {
        if (arguments.length < 1) {
            throw new TypeError('has requires 1 argument')
        }
        name = String(name)
        for (const pair of this[_list]) {
            if (pair[0] === name) {
                return true
            }
        }
        return false
    }

    set(name, value) {
        if (arguments.length < 2) {
            throw new TypeError('set requires 2 arguments')
        }
        name = String(name)
        value = String(value)

        const list = this[_list]
        let found = false
        let i = 0

        while (i < list.length) {
            if (list[i][0] === name) {
                if (!found) {
                    list[i][1] = value
                    found = true
                    i++
                } else {
                    list.splice(i, 1)
                }
            } else {
                i++
            }
        }

        if (!found) {
            list.push([name, value])
        }

        this.#updateUrlSearch()
    }

    sort() {
        this[_list].sort((a, b) => {
            if (a[0] === b[0]) return 0
            return a[0] < b[0] ? -1 : 1
        })
        this.#updateUrlSearch()
    }

    toString() {
        if (this[_list].length === 0) {
            return ''
        }
        return ops.op_url_stringify_search_params(this[_list])
    }

    // Iterator methods
    entries() {
        const list = this[_list]
        let index = 0
        return {
            next() {
                if (index < list.length) {
                    return { value: [list[index][0], list[index++][1]], done: false }
                }
                return { done: true }
            },
            [Symbol.iterator]() {
                return this
            }
        }
    }

    keys() {
        const list = this[_list]
        let index = 0
        return {
            next() {
                if (index < list.length) {
                    return { value: list[index++][0], done: false }
                }
                return { done: true }
            },
            [Symbol.iterator]() {
                return this
            }
        }
    }

    values() {
        const list = this[_list]
        let index = 0
        return {
            next() {
                if (index < list.length) {
                    return { value: list[index++][1], done: false }
                }
                return { done: true }
            },
            [Symbol.iterator]() {
                return this
            }
        }
    }

    [Symbol.iterator]() {
        return this.entries()
    }

    forEach(callback, thisArg) {
        if (typeof callback !== 'function') {
            throw new TypeError('callback must be a function')
        }
        for (const [key, value] of this[_list]) {
            callback.call(thisArg, value, key, this)
        }
    }

    get size() {
        return this[_list].length
    }
}

// URL class
class URL {
    #serialization
    #schemeEnd
    #usernameEnd
    #hostStart
    #hostEnd
    #port
    #pathStart
    #queryStart
    #fragmentStart
    #searchParams = null
    #componentsBuf = new Uint32Array(8)  // Each URL instance has its own buffer

    constructor(url, base) {
        if (arguments.length < 1) {
            throw new TypeError('URL constructor requires at least 1 argument')
        }

        url = String(url)
        if (base !== undefined) {
            base = String(base)
        }

        const result = opUrlParse(url, base, this.#componentsBuf)
        this.#serialization = result.serialization
        this.#updateComponents()
    }

    static parse(url, base) {
        if (arguments.length < 1) {
            throw new TypeError('URL.parse requires at least 1 argument')
        }

        url = String(url)
        if (base !== undefined) {
            base = String(base)
        }

        try {
            // Try to construct a URL, catch errors and return null
            return new URL(url, base)
        } catch {
            return null
        }
    }

    static canParse(url, base) {
        if (arguments.length < 1) {
            throw new TypeError('URL.canParse requires at least 1 argument')
        }

        url = String(url)
        if (base !== undefined) {
            base = String(base)
        }

        try {
            const buffer = new Uint32Array(8)
            const result = opUrlParse(url, base, buffer)
            return result.status === ParseStatusOk || result.status === ParseStatusOkSerialization
        } catch {
            return false
        }
    }

    #updateComponents() {
        this.#schemeEnd = this.#componentsBuf[0]
        this.#usernameEnd = this.#componentsBuf[1]
        this.#hostStart = this.#componentsBuf[2]
        this.#hostEnd = this.#componentsBuf[3]
        this.#port = this.#componentsBuf[4]
        this.#pathStart = this.#componentsBuf[5]
        this.#queryStart = this.#componentsBuf[6]
        this.#fragmentStart = this.#componentsBuf[7]
    }

    #updateSearchParams() {
        if (this.#searchParams !== null) {
            const search = this.search
            const query = search.startsWith('?') ? search.substring(1) : search
            const newPairs = ops.op_url_parse_search_params(query)
            this.#searchParams[_list].splice(0, this.#searchParams[_list].length, ...(newPairs || []))
        }
    }

    #hasAuthority() {
        return this.#serialization.substring(this.#schemeEnd).startsWith('//')
    }

    [_updateUrlSearch](value) {
        try {
            this.#serialization = opUrlReparse(this.#serialization, SET_SEARCH, value, this.#componentsBuf)
            this.#updateComponents()
        } catch {
            // Silently ignore invalid updates
        }
    }

    // href
    get href() {
        return this.#serialization
    }

    set href(value) {
        value = String(value)
        try {
            const result = opUrlParse(value, undefined, this.#componentsBuf)
            this.#serialization = result.serialization
            this.#updateComponents()
            this.#updateSearchParams()
        } catch (e) {
            throw new TypeError(`Failed to set 'href': ${e.message}`)
        }
    }

    // origin (readonly)
    get origin() {
        const scheme = this.protocol

        // Special schemes that have an origin
        if (scheme === 'http:' || scheme === 'https:' || scheme === 'ws:' || scheme === 'wss:' || scheme === 'ftp:') {
            return scheme + '//' + this.host
        }

        if (scheme === 'file:') {
            return 'file://'
        }

        return 'null'
    }

    // protocol
    get protocol() {
        return this.#serialization.substring(0, this.#schemeEnd)
    }

    set protocol(value) {
        value = String(value)
        try {
            this.#serialization = opUrlReparse(this.#serialization, SET_PROTOCOL, value, this.#componentsBuf)
            this.#updateComponents()
        } catch {
            // Silently ignore
        }
    }

    // username
    get username() {
        if (!this.#hasAuthority()) {
            return ''
        }

        // Check if there's userinfo by looking for '@' before hostStart
        const afterSlashes = this.#schemeEnd + 2
        if (this.#usernameEnd <= afterSlashes) {
            // No userinfo
            return ''
        }

        // Userinfo is from after "//" to before '@'
        // usernameEnd includes the '@', so we extract up to that
        const userInfoStart = afterSlashes
        const userInfoEnd = this.#usernameEnd - 1 // Before '@'
        const userInfo = this.#serialization.substring(userInfoStart, userInfoEnd)

        // Extract username (before ':' if present)
        const colonIndex = userInfo.indexOf(':')
        if (colonIndex !== -1) {
            return userInfo.substring(0, colonIndex)
        }

        return userInfo
    }

    set username(value) {
        value = String(value)
        if (this.#hasAuthority()) {
            try {
                this.#serialization = opUrlReparse(this.#serialization, SET_USERNAME, value, this.#componentsBuf)
                this.#updateComponents()
            } catch {
                // Silently ignore
            }
        }
    }

    // password
    get password() {
        if (!this.#hasAuthority()) {
            return ''
        }

        // Check if there's userinfo
        const afterSlashes = this.#schemeEnd + 2
        if (this.#usernameEnd <= afterSlashes) {
            // No userinfo
            return ''
        }

        // Userinfo is from after "//" to before '@'
        const userInfoStart = afterSlashes
        const userInfoEnd = this.#usernameEnd - 1 // Before '@'
        const userInfo = this.#serialization.substring(userInfoStart, userInfoEnd)

        // Extract password (after ':' if present)
        const colonIndex = userInfo.indexOf(':')
        if (colonIndex !== -1) {
            return userInfo.substring(colonIndex + 1)
        }

        return ''
    }

    set password(value) {
        value = String(value)
        if (this.#hasAuthority()) {
            try {
                this.#serialization = opUrlReparse(this.#serialization, SET_PASSWORD, value, this.#componentsBuf)
                this.#updateComponents()
            } catch {
                // Silently ignore
            }
        }
    }

    // host
    get host() {
        return this.#serialization.substring(this.#hostStart, this.#pathStart)
    }

    set host(value) {
        value = String(value)
        if (this.#hasAuthority()) {
            try {
                this.#serialization = opUrlReparse(this.#serialization, SET_HOST, value, this.#componentsBuf)
                this.#updateComponents()
            } catch {
                // Silently ignore
            }
        }
    }

    // hostname
    get hostname() {
        return this.#serialization.substring(this.#hostStart, this.#hostEnd)
    }

    set hostname(value) {
        value = String(value)
        if (this.#hasAuthority()) {
            try {
                this.#serialization = opUrlReparse(this.#serialization, SET_HOSTNAME, value, this.#componentsBuf)
                this.#updateComponents()
            } catch {
                // Silently ignore
            }
        }
    }

    // port
    get port() {
        if (this.#port === NO_PORT) {
            return ''
        }
        return String(this.#port)
    }

    set port(value) {
        value = String(value)
        if (this.#hasAuthority()) {
            try {
                this.#serialization = opUrlReparse(this.#serialization, SET_PORT, value, this.#componentsBuf)
                this.#updateComponents()
            } catch {
                // Silently ignore
            }
        }
    }

    // pathname
    get pathname() {
        const start = this.#pathStart
        const end = this.#queryStart || this.#serialization.length
        return this.#serialization.substring(start, end)
    }

    set pathname(value) {
        value = String(value)
        try {
            this.#serialization = opUrlReparse(this.#serialization, SET_PATHNAME, value, this.#componentsBuf)
            this.#updateComponents()
        } catch {
            // Silently ignore
        }
    }

    // search
    get search() {
        if (!this.#queryStart || this.#queryStart === 0) {
            return ''
        }
        const start = this.#queryStart
        const end = this.#fragmentStart || this.#serialization.length
        return this.#serialization.substring(start, end)
    }

    set search(value) {
        value = String(value)
        try {
            this.#serialization = opUrlReparse(this.#serialization, SET_SEARCH, value, this.#componentsBuf)
            this.#updateComponents()
            this.#updateSearchParams()
        } catch {
            // Silently ignore
        }
    }

    // searchParams (readonly, lazy)
    get searchParams() {
        if (this.#searchParams === null) {
            this.#searchParams = new URLSearchParams(this.search)
            this.#searchParams[_urlObject] = this
        }
        return this.#searchParams
    }

    // hash
    get hash() {
        if (!this.#fragmentStart || this.#fragmentStart === 0) {
            return ''
        }
        return this.#serialization.substring(this.#fragmentStart)
    }

    set hash(value) {
        value = String(value)
        try {
            this.#serialization = opUrlReparse(this.#serialization, SET_HASH, value, this.#componentsBuf)
            this.#updateComponents()
        } catch {
            // Silently ignore
        }
    }

    // Methods
    toString() {
        return this.#serialization
    }

    toJSON() {
        return this.#serialization
    }
}

export { URL, URLSearchParams }

