// Debug Crypto Test 2

console.log("=== Debug Crypto Test 2 ===");

// Check if crypto object exists
console.log("crypto object:", typeof crypto);
console.log("crypto keys:", Object.keys(crypto || {}));

if (typeof crypto !== 'undefined') {
    console.log("crypto.subtle:", typeof crypto.subtle);
    if (crypto.subtle) {
        console.log("crypto.subtle keys:", Object.keys(crypto.subtle));
    }

    // Check if getRandomValues exists as a property
    console.log("crypto.getRandomValues:", typeof crypto.getRandomValues);
    console.log("crypto.hasOwnProperty('getRandomValues'):", crypto.hasOwnProperty ? crypto.hasOwnProperty('getRandomValues') : 'N/A');

    // Try to access getRandomValues in different ways
    if (crypto.getRandomValues) {
        console.log("getRandomValues is available!");
        try {
            const randomArray = new Uint8Array(8);
            const result = crypto.getRandomValues(randomArray);
            console.log("Random values:", Array.from(result).map(b => b.toString(16).padStart(2, '0')).join(''));
        } catch (error) {
            console.error("Error calling getRandomValues:", error);
        }
    } else {
        console.error("getRandomValues is not available on crypto object");
    }
} else {
    console.error("crypto object is not defined");
}