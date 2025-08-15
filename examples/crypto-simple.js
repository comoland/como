// Simple Crypto Test for Como Runtime

console.log("=== Simple Crypto Test ===\n");

// Test 1: Basic random values
console.log("1. Testing getRandomValues...");
const randomArray = new Uint8Array(8);
crypto.getRandomValues(randomArray);
console.log("Random values:", Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join(''));
console.log();

// Test 2: Basic digest
console.log("2. Testing digest...");
const textEncoder = new TextEncoder();
const data = textEncoder.encode("Hello, World!");
crypto.subtle.digest("SHA-256", data).then(hash => {
    const hashArray = new Uint8Array(hash);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log("SHA-256 hash:", hashHex);
    console.log();

    console.log("=== Basic crypto test completed! ===");
}).catch(error => {
    console.error("Crypto test failed:", error);
});