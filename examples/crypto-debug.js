// Debug Crypto Test

console.log("=== Debug Crypto Test ===");

// Check if crypto object exists
console.log("crypto object:", typeof crypto);
console.log("crypto.getRandomValues:", typeof crypto?.getRandomValues);

if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
        const randomArray = new Uint8Array(8);
        const result = crypto.getRandomValues(randomArray);
        console.log("Random values:", Array.from(result).map(b => b.toString(16).padStart(2, '0')).join(''));
    } catch (error) {
        console.error("Error calling getRandomValues:", error);
    }
} else {
    console.error("crypto.getRandomValues is not available");
}