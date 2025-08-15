# Web Crypto API Implementation for Como Runtime

This document describes the Web Crypto API implementation for the Como JavaScript runtime, which provides a full-featured cryptographic API using Go's crypto packages as the backend.

## Overview

The implementation consists of two main components:

1. **Go Backend** (`core/crypto.go`, `core/crypto_backend.go`): Provides the actual cryptographic operations using Go's standard crypto packages
2. **JavaScript Frontend** (`core/js/crypto.js`): Implements the Web Crypto API interface that JavaScript code interacts with

## Features

### Supported Algorithms

#### Hash Functions (Digest)
- SHA-1
- SHA-256
- SHA-384
- SHA-512

#### Symmetric Encryption
- AES-GCM
- AES-CBC
- AES-CTR

#### Asymmetric Encryption
- RSA-OAEP
- RSASSA-PKCS1-v1_5

#### Digital Signatures
- ECDSA (with P-256 curve)
- RSA-PKCS1-v1_5

#### Key Generation
- RSA key pairs (2048-bit)
- ECDSA key pairs (P-256 curve)
- AES keys (256-bit)

#### Random Number Generation
- Cryptographically secure random values via `crypto.getRandomValues()`

## API Usage

### Basic Usage

```javascript
// Generate random values
const randomArray = new Uint8Array(16);
crypto.getRandomValues(randomArray);

// Create hash digest
const textEncoder = new TextEncoder();
const data = textEncoder.encode("Hello, World!");
const hash = await crypto.subtle.digest("SHA-256", data);
```

### Key Generation

```javascript
// Generate RSA key pair
const keyPair = await crypto.subtle.generateKey(
    {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
    },
    true,
    ["sign", "verify"]
);

// Generate AES key
const aesKey = await crypto.subtle.generateKey(
    {
        name: "AES-GCM",
        length: 256
    },
    true,
    ["encrypt", "decrypt"]
);
```

### Signing and Verification

```javascript
// Sign data
const message = textEncoder.encode("Hello, Crypto!");
const signature = await crypto.subtle.sign(
    {
        name: "RSASSA-PKCS1-v1_5"
    },
    keyPair.privateKey,
    message
);

// Verify signature
const isValid = await crypto.subtle.verify(
    {
        name: "RSASSA-PKCS1-v1_5"
    },
    keyPair.publicKey,
    signature,
    message
);
```

### Encryption and Decryption

```javascript
// Encrypt data
const plaintext = textEncoder.encode("Secret message");
const iv = crypto.getRandomValues(new Uint8Array(12));

const ciphertext = await crypto.subtle.encrypt(
    {
        name: "AES-GCM",
        iv: iv
    },
    aesKey,
    plaintext
);

// Decrypt data
const decrypted = await crypto.subtle.decrypt(
    {
        name: "AES-GCM",
        iv: iv
    },
    aesKey,
    ciphertext
);
```

## Architecture

### Go Backend

The Go backend provides the actual cryptographic operations:

- **CryptoBackend**: Main backend class that handles all crypto operations
- **Key Management**: Secure generation and storage of cryptographic keys
- **Algorithm Support**: Full support for RSA, ECDSA, AES, and hash functions
- **Random Generation**: Cryptographically secure random number generation

### JavaScript Frontend

The JavaScript frontend provides the Web Crypto API interface:

- **CryptoKey**: Represents cryptographic keys with metadata
- **CryptoKeyPair**: Represents key pairs (public/private)
- **SubtleCrypto**: Implements the Web Crypto API's SubtleCrypto interface
- **Crypto**: Main crypto object with `getRandomValues()` and `subtle` properties

## Security Features

### Key Security
- Keys are stored securely in Go memory
- Private keys are never exposed to JavaScript
- All cryptographic operations happen in Go

### Algorithm Security
- Uses Go's standard crypto packages
- Implements industry-standard algorithms
- Proper padding and encoding schemes

### Random Generation
- Uses Go's `crypto/rand` for cryptographically secure random numbers
- No predictable patterns or weak entropy sources

## Examples

### Complete Example

```javascript
// Generate a key pair
const keyPair = await crypto.subtle.generateKey(
    {
        name: "ECDSA",
        namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
);

// Sign a message
const message = new TextEncoder().encode("Hello, Crypto!");
const signature = await crypto.subtle.sign(
    {
        name: "ECDSA",
        hash: "SHA-256"
    },
    keyPair.privateKey,
    message
);

// Verify the signature
const isValid = await crypto.subtle.verify(
    {
        name: "ECDSA",
        hash: "SHA-256"
    },
    keyPair.publicKey,
    signature,
    message
);

console.log("Signature valid:", isValid);
```

### File Encryption Example

```javascript
// Generate AES key
const key = await crypto.subtle.generateKey(
    {
        name: "AES-GCM",
        length: 256
    },
    true,
    ["encrypt", "decrypt"]
);

// Encrypt file data
const fileData = new TextEncoder().encode("Secret file content");
const iv = crypto.getRandomValues(new Uint8Array(12));

const encrypted = await crypto.subtle.encrypt(
    {
        name: "AES-GCM",
        iv: iv
    },
    key,
    fileData
);

// Decrypt file data
const decrypted = await crypto.subtle.decrypt(
    {
        name: "AES-GCM",
        iv: iv
    },
    key,
    encrypted
);

const decryptedText = new TextDecoder().decode(decrypted);
console.log("Decrypted:", decryptedText);
```

## Testing

Run the included test examples:

```bash
# Simple crypto test
go run main.go examples/crypto-simple.js

# Comprehensive crypto test
go run main.go examples/crypto.ts
```

## Implementation Details

### Key Storage
Keys are stored as JSON-serialized data in the Go backend and referenced by JavaScript through opaque handles.

### Algorithm Mapping
The implementation maps Web Crypto API algorithms to Go crypto packages:
- `RSASSA-PKCS1-v1_5` → `crypto/rsa` with PKCS1v15 padding
- `ECDSA` → `crypto/ecdsa` with P-256 curve
- `AES-GCM` → `crypto/aes` with GCM mode
- `SHA-256` → `crypto/sha256`

### Error Handling
All cryptographic operations include proper error handling and validation:
- Algorithm validation
- Key format validation
- Input parameter validation
- Cryptographic operation error handling

## Future Enhancements

Potential improvements and additions:

1. **Additional Algorithms**
   - ChaCha20-Poly1305
   - Ed25519 signatures
   - X25519 key exchange

2. **Key Import/Export**
   - PEM format support
   - JWK format support
   - PKCS#8/PKCS#12 support

3. **Advanced Features**
   - Key derivation functions (PBKDF2, HKDF)
   - Certificate handling
   - Hardware security module (HSM) integration

4. **Performance Optimizations**
   - Async key generation
   - Streaming encryption/decryption
   - Batch operations

## Security Considerations

1. **Key Management**: Private keys are never exposed to JavaScript
2. **Algorithm Security**: Uses only well-vetted cryptographic algorithms
3. **Random Generation**: Uses cryptographically secure random number generation
4. **Memory Security**: Sensitive data is handled in Go memory, not JavaScript
5. **Input Validation**: All inputs are validated before cryptographic operations

## Browser Compatibility

The implementation follows the Web Crypto API specification and should be compatible with code written for browser environments, with some limitations:

- Not all browser algorithms are supported
- Some advanced features may not be available
- Performance characteristics may differ from native browser implementations

## Contributing

When contributing to the crypto implementation:

1. Follow Go security best practices
2. Use only well-vetted cryptographic algorithms
3. Include comprehensive tests for new features
4. Document security considerations
5. Follow the existing code structure and patterns