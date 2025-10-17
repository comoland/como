// Demonstration of enhanced URL console output

console.log('=== URL Console Output Demo ===\n');

// 1. Simple URL
console.log('1. Simple URL:');
const simple = new URL('https://example.com');
console.log(simple);
console.log();

// 2. URL with all components
console.log('2. Full URL with all components:');
const full = new URL('https://user:pass@api.example.com:8080/v1/users?limit=10&page=1#results');
console.log(full);
console.log();

// 3. URLs in arrays
console.log('3. Array of URLs:');
const urls = [
    new URL('https://google.com/search?q=javascript'),
    new URL('https://github.com/user/repo'),
    new URL('https://stackoverflow.com/questions/12345')
];
console.log(urls);
console.log();

// 4. URLs in objects
console.log('4. URLs in nested object:');
const config = {
    api: new URL('https://api.example.com'),
    cdn: new URL('https://cdn.example.com'),
    endpoints: {
        users: new URL('https://api.example.com/users'),
        posts: new URL('https://api.example.com/posts')
    }
};
console.log(config);
console.log();

// 5. URLSearchParams
console.log('5. URLSearchParams:');
const params = new URLSearchParams('name=Alice&age=30&hobbies=reading&hobbies=coding');
console.log(params);
console.log();

// 6. URLSearchParams with duplicate keys
console.log('6. URLSearchParams with duplicate keys:');
const multiParams = new URLSearchParams();
multiParams.append('color', 'red');
multiParams.append('color', 'blue');
multiParams.append('color', 'green');
multiParams.append('size', 'large');
console.log(multiParams);
console.log();

// 7. URL with searchParams
console.log('7. URL with searchParams property:');
const urlWithParams = new URL('https://shop.com/products?category=electronics&price=100-500');
console.log('URL:', urlWithParams);
console.log('searchParams:', urlWithParams.searchParams);
console.log();

// 8. Comparing to plain objects
console.log('8. Comparison - Plain Object vs URL Class:');
const plainObj = {
    href: 'https://example.com',
    protocol: 'https:',
    hostname: 'example.com'
};
console.log('Plain object:', plainObj);
console.log('URL instance:', new URL('https://example.com'));
console.log();

// 9. Mixed data structures
console.log('9. Mixed data structure:');
const mixed = {
    name: 'API Config',
    version: '1.0',
    urls: [
        new URL('https://api.example.com'),
        new URL('https://cdn.example.com')
    ],
    params: new URLSearchParams('key=value&limit=100'),
    metadata: new Map([
        ['created', new Date()],
        ['url', new URL('https://example.com')]
    ])
};
console.log(mixed);
console.log();

// 10. Using console.table with URL data
console.log('10. console.table with URL data:');
const sites = [
    { name: 'Google', url: new URL('https://google.com') },
    { name: 'GitHub', url: new URL('https://github.com') },
    { name: 'Stack Overflow', url: new URL('https://stackoverflow.com') }
];
// Note: console.table shows the URL objects - they'll be formatted as [Object]
// but you can see them individually
sites.forEach(site => {
    console.log(`  ${site.name}:`, site.url);
});

console.log('\n=== Demo Complete ===\n');

