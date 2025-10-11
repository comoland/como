// URL and URLSearchParams Examples

console.log('=== URLSearchParams Examples ===\n')

// Creating URLSearchParams from string
const params1 = new URLSearchParams('foo=bar&baz=qux')
console.log('From string:', params1.toString())
console.log('Get foo:', params1.get('foo'))

// Creating from object
const params2 = new URLSearchParams({ name: 'John', age: '30' })
console.log('\nFrom object:', params2.toString())

// Creating from array of pairs
const params3 = new URLSearchParams([
    ['color', 'red'],
    ['size', 'large']
])
console.log('From array:', params3.toString())

// Manipulating parameters
const params = new URLSearchParams()
params.append('fruits', 'apple')
params.append('fruits', 'banana')
params.append('color', 'red')
console.log('\nAfter appends:', params.toString())
console.log('All fruits:', params.getAll('fruits'))

// Setting a parameter (replaces all existing)
params.set('fruits', 'orange')
console.log('After set:', params.toString())

// Sorting parameters
params.append('zebra', 'last')
params.append('aardvark', 'first')
console.log('Before sort:', params.toString())
params.sort()
console.log('After sort:', params.toString())

// Iterating
console.log('\nIterating with for...of:')
for (const [key, value] of params) {
    console.log(`  ${key} = ${value}`)
}

console.log('\n=== URL Examples ===\n')

// Creating absolute URL
const url1 = new URL('https://example.com/path?query=value#hash')
console.log('Absolute URL:', url1.href)
console.log('Protocol:', url1.protocol)
console.log('Hostname:', url1.hostname)
console.log('Pathname:', url1.pathname)
console.log('Search:', url1.search)
console.log('Hash:', url1.hash)

// Creating relative URL with base
const url2 = new URL('/api/users', 'https://example.com')
console.log('\nRelative URL:', url2.href)

const url3 = new URL('subpath', 'https://example.com/base/')
console.log('Relative path:', url3.href)

// URL with all components
const url4 = new URL('https://user:password@example.com:8080/path?foo=bar#section')
console.log('\nFull URL:', url4.href)
console.log('Username:', url4.username)
console.log('Password:', url4.password)
console.log('Host:', url4.host)
console.log('Port:', url4.port)
console.log('Origin:', url4.origin)

// Modifying URL components
const url5 = new URL('https://example.com')
url5.protocol = 'http'
url5.hostname = 'test.com'
url5.port = '3000'
url5.pathname = '/api/data'
url5.search = 'id=123'
url5.hash = 'section'
console.log('\nModified URL:', url5.href)

// URL.parse() - returns null on error instead of throwing
const validUrl = URL.parse('https://example.com')
const invalidUrl = URL.parse('not a valid url')
console.log('\nURL.parse valid:', validUrl?.href)
console.log('URL.parse invalid:', invalidUrl)

// URL.canParse() - checks if URL is valid
console.log('\nURL.canParse valid:', URL.canParse('https://example.com'))
console.log('URL.canParse invalid:', URL.canParse('not a valid url'))

console.log('\n=== URLSearchParams Integration ===\n')

// Using searchParams property
const url = new URL('https://example.com')
url.searchParams.set('name', 'Alice')
url.searchParams.set('age', '25')
url.searchParams.append('hobby', 'reading')
url.searchParams.append('hobby', 'coding')

console.log('URL with params:', url.href)
console.log('Search string:', url.search)
console.log('Get name:', url.searchParams.get('name'))
console.log('Get all hobbies:', url.searchParams.getAll('hobby'))

// Modifying search updates searchParams
url.search = 'foo=bar&baz=qux'
console.log('\nAfter setting search:')
console.log('Search:', url.search)
console.log('Get foo:', url.searchParams.get('foo'))

// Modifying searchParams updates search
url.searchParams.delete('foo')
url.searchParams.set('new', 'value')
console.log('\nAfter modifying searchParams:')
console.log('Search:', url.search)

console.log('\n=== Special URL Schemes ===\n')

// File URL
const fileUrl = new URL('file:///home/user/document.txt')
console.log('File URL:', fileUrl.href)
console.log('File pathname:', fileUrl.pathname)

// Data URL
const dataUrl = new URL('data:text/plain;charset=utf-8,Hello%20World')
console.log('Data URL:', dataUrl.href)

// Blob URL
const blobUrl = new URL('blob:null/550e8400-e29b-41d4-a716-446655440000')
console.log('Blob URL:', blobUrl.href)

console.log('\n=== Advanced Examples ===\n')

// Building a complex API URL
const apiUrl = new URL('https://api.example.com/v1/search')
apiUrl.searchParams.set('q', 'javascript url api')
apiUrl.searchParams.set('page', '1')
apiUrl.searchParams.set('limit', '10')
apiUrl.searchParams.set('sort', 'relevance')
console.log('API URL:', apiUrl.href)

// Parsing and modifying query string
const currentUrl = new URL('https://shop.com/products?category=electronics&price=100-500')
console.log('\nOriginal:', currentUrl.href)

// Add new filter
currentUrl.searchParams.set('brand', 'Samsung')
console.log('Added brand filter:', currentUrl.href)

// Update existing parameter
currentUrl.searchParams.set('price', '200-600')
console.log('Updated price filter:', currentUrl.href)

// Get all parameters as object
const allParams = {}
for (const [key, value] of currentUrl.searchParams) {
    allParams[key] = value
}
console.log('All parameters:', allParams)

// Working with base URLs
const baseUrl = 'https://example.com/api/v2/'
const endpoint1 = new URL('users', baseUrl)
const endpoint2 = new URL('posts', baseUrl)
const endpoint3 = new URL('../v1/legacy', baseUrl)

console.log('\nAPI endpoints:')
console.log('Users:', endpoint1.href)
console.log('Posts:', endpoint2.href)
console.log('Legacy:', endpoint3.href)

console.log('\n=== URL Validation ===\n')

const testUrls = [
    'https://example.com',
    'http://localhost:3000/path',
    'ftp://files.example.com',
    'file:///home/user/file.txt',
    'not a url',
    '/relative/path',
    '//example.com/path'
]

console.log('Testing URL validity:')
for (const testUrl of testUrls) {
    const isValid = URL.canParse(testUrl)
    console.log(`  ${testUrl.padEnd(35)} -> ${isValid ? '✓' : '✗'}`)
}

console.log('\n=== Done ===')

