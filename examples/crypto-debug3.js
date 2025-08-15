// Debug Crypto Test 3

console.log("=== Debug Crypto Test 3 ===");

if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
        const randomArray = new Uint8Array(8);
        console.log("Before getRandomValues:", Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join(''));

        const result = crypto.getRandomValues(randomArray);
        console.log("After getRandomValues - result:", result);
        console.log("After getRandomValues - randomArray:", Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join(''));

        if (result) {
            console.log("Result array:", Array.from(result).map(b => b.toString(16).padStart(2, '0')).join(''));
        }
    } catch (error) {
        console.error("Error calling getRandomValues:", error);
    }
} else {
    console.error("crypto.getRandomValues is not available");
}