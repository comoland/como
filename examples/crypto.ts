// Web Crypto API Example for Como Runtime

console.log("=== Web Crypto API Example ===\n");
console.time('BENCH');
// Test 1: Generate random values
console.log("1. Testing getRandomValues...");
const randomArray1 = new Uint8Array(16);
crypto.getRandomValues(randomArray1);
console.log("Random values:", Array.from(randomArray1).map(b => b.toString(16).padStart(2, '0')).join(''));
console.log();

// Test 2: Hash digest
console.log("2. Testing digest...");
const textEncoder1 = new TextEncoder();
const data1 = textEncoder1.encode("Hello, World!");
crypto.subtle.digest("SHA-256", data1).then(hash => {
    const hashArray = new Uint8Array(hash);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log("SHA-256 hash:", hashHex);
    console.log();

    // Test 3: Generate RSA key pair
    console.log("3. Testing RSA key generation...");
    return crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["sign", "verify"]
    );
}).then(keyPair => {
    console.log("RSA key pair generated successfully");
    console.log("Public key type:", keyPair.publicKey.type);
    console.log("Private key type:", keyPair.privateKey.type);
    console.log();

    // Test 4: Sign and verify
    console.log("4. Testing sign and verify...");
    const message1 = textEncoder1.encode("Hello, Crypto!");
    return crypto.subtle.sign(
        {
            name: "RSASSA-PKCS1-v1_5"
        },
        keyPair.privateKey,
        message1
    ).then(signature => {
        console.log("Message signed successfully");
        console.log("Signature length:", signature.byteLength);

        return crypto.subtle.verify(
            {
                name: "RSASSA-PKCS1-v1_5"
            },
            keyPair.publicKey,
            signature,
            message1
        );
    });
}).then(isValid => {
    console.log("Signature verification:", isValid ? "SUCCESS" : "FAILED");
    console.log();

    // Test 5: Generate AES key
    console.log("5. Testing AES key generation...");
    return crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
}).then(aesKey => {
    console.log("AES key generated successfully");
    console.log("Key type:", aesKey.type);
    console.log();

    // Test 6: Encrypt and decrypt
    console.log("6. Testing AES encryption...");
    const plaintext = textEncoder1.encode("Secret message");
    const iv = crypto.getRandomValues(new Uint8Array(12));

    return crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        aesKey,
        plaintext
    ).then(ciphertext => {
        console.log("Message encrypted successfully");
        console.log("Ciphertext length:", ciphertext.byteLength);

        return crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            aesKey,
            ciphertext
        );
    });
}).then(decrypted => {
    const decryptedText = new TextDecoder().decode(decrypted);
    console.log("Decrypted message:", decryptedText);
    console.log();

    // Test 7: Generate ECDSA key pair
    console.log("7. Testing ECDSA key generation...");
    return crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256"
        },
        true,
        ["sign", "verify"]
    );
}).then(ecdsaKeyPair => {
    console.log("ECDSA key pair generated successfully");
    console.log("Public key type:", ecdsaKeyPair.publicKey.type);
    console.log("Private key type:", ecdsaKeyPair.privateKey.type);
    console.log();

    // Test 8: ECDSA sign and verify
    console.log("8. Testing ECDSA sign and verify...");
    const ecdsaMessage = textEncoder1.encode("ECDSA test message");
    return crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: "SHA-256"
        },
        ecdsaKeyPair.privateKey,
        ecdsaMessage
    ).then(ecdsaSignature => {
        console.log("ECDSA signature created");
        console.log("Signature length:", ecdsaSignature.byteLength);

        return crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: "SHA-256"
            },
            ecdsaKeyPair.publicKey,
            ecdsaSignature,
            ecdsaMessage
        );
    });
}).then(ecdsaValid => {
    console.log("ECDSA signature verification:", ecdsaValid ? "SUCCESS" : "FAILED");
    console.log();

    console.log("=== All crypto tests completed successfully! ===");
    console.timeEnd('BENCH');
}).catch(error => {
    console.error("Crypto test failed:", error);
});
