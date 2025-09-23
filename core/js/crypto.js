({ _exports, generateKey, sign, verify, encrypt, decrypt, digest, getRandomValues: _getRandomValues }) => {
    const getRandomValues = array => {
        const m = new Uint8Array(_getRandomValues(array));
        array.set(m);
        return array;
    };

    class CryptoKey {
        constructor(type, extractable, algorithm, usages, key) {
            this.type = type;
            this.extractable = extractable;
            this.algorithm = algorithm;
            this.usages = usages;
            this._key = key;
        }

        get key() {
            return this._key;
        }
    }

    // CryptoKeyPair class
    class CryptoKeyPair {
        constructor(publicKey, privateKey) {
            this.publicKey = publicKey;
            this.privateKey = privateKey;
        }
    }

    // SubtleCrypto class
    class SubtleCrypto {
        constructor() {
            this._generateKey = generateKey;
            this._sign = sign;
            this._verify = verify;
            this._encrypt = encrypt;
            this._decrypt = decrypt;
            this._digest = digest;
        }

        async generateKey(algorithm, extractable, keyUsages) {
            try {
                // Handle different algorithm types
                let algoName = algorithm;
                if (typeof algorithm === 'object') {
                    algoName = algorithm.name;
                }

                const result = await this._generateKey(algoName, extractable, keyUsages, algorithm);
                return result;
            } catch (error) {
                throw new Error(`generateKey failed: ${error.message}`);
            }
        }

        async sign(algorithm, key, data) {
            try {
                let algoName = algorithm;
                if (typeof algorithm === 'object') {
                    algoName = algorithm.name;
                }

                const result = await this._sign(algoName, key, data);
                return result;
            } catch (error) {
                throw new Error(`sign failed: ${error.message}`);
            }
        }

        async verify(algorithm, key, signature, data) {
            try {
                let algoName = algorithm;
                if (typeof algorithm === 'object') {
                    algoName = algorithm.name;
                }

                const result = await this._verify(algoName, key, signature, data);
                return result;
            } catch (error) {
                throw new Error(`verify failed: ${error.message}`);
            }
        }

        async encrypt(algorithm, key, data, iv) {
            try {
                let algoName = algorithm;
                let ivData = iv;

                if (typeof algorithm === 'object') {
                    algoName = algorithm.name;
                    if (algorithm.iv) {
                        ivData = algorithm.iv;
                    }
                }

                const result = await this._encrypt(algoName, key, data, ivData);
                return result;
            } catch (error) {
                throw new Error(`encrypt failed: ${error.message}`);
            }
        }

        async decrypt(algorithm, key, data, iv) {
            try {
                let algoName = algorithm;
                let ivData = iv;

                if (typeof algorithm === 'object') {
                    algoName = algorithm.name;
                    if (algorithm.iv) {
                        ivData = algorithm.iv;
                    }
                }

                const result = await this._decrypt(algoName, key, data, ivData);
                return result;
            } catch (error) {
                throw new Error(`decrypt failed: ${error.message}`);
            }
        }

        async digest(algorithm, data) {
            try {
                let algoName = algorithm;
                if (typeof algorithm === 'object') {
                    algoName = algorithm.name;
                }

                const result = await this._digest(algoName, Buffer.from(data));
                return result;
            } catch (error) {
                throw new Error(`digest failed: ${error.message}`);
            }
        }

        async deriveBits(algorithm, baseKey, length) {
            try {
                // For now, return a mock implementation
                const result = new Uint8Array(length);
                // Use the global getRandomValues function
                if (typeof getRandomValues === 'function') {
                    getRandomValues(result);
                }
                return result;
            } catch (error) {
                throw new Error(`deriveBits failed: ${error.message}`);
            }
        }

        async deriveKey(algorithm, baseKey, derivedKeyType, extractable, keyUsages) {
            try {
                return new CryptoKey('secret', extractable, derivedKeyType.name, keyUsages, {});
            } catch (error) {
                throw new Error(`deriveKey failed: ${error.message}`);
            }
        }

        async importKey(format, keyData, algorithm, extractable, keyUsages) {
            try {
                return new CryptoKey('secret', extractable, algorithm.name, keyUsages, {});
            } catch (error) {
                throw new Error(`importKey failed: ${error.message}`);
            }
        }

        async exportKey(format, key) {
            try {
                return new Uint8Array(32);
            } catch (error) {
                throw new Error(`exportKey failed: ${error.message}`);
            }
        }

        async wrapKey(format, key, wrappingKey, wrapAlgorithm) {
            try {
                return new Uint8Array(256);
            } catch (error) {
                throw new Error(`wrapKey failed: ${error.message}`);
            }
        }

        async unwrapKey(
            format,
            wrappedKey,
            unwrappingKey,
            unwrapAlgorithm,
            unwrappedKeyAlgorithm,
            extractable,
            keyUsages
        ) {
            try {
                return new CryptoKey('secret', extractable, unwrappedKeyAlgorithm.name, keyUsages, {});
            } catch (error) {
                throw new Error(`unwrapKey failed: ${error.message}`);
            }
        }
    }

    // Create and return the crypto object
    globalThis.crypto = {};
    crypto.subtle = new SubtleCrypto();
    crypto.getRandomValues = getRandomValues;
    crypto.randomUUID = function () {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        // Set version (4) in the 7th byte (index 6, bits 0100xxxx)
        bytes[6] = (bytes[6] & 0x0f) | 0x40;

        // Set variant (10xx) in the 9th byte (index 8, bits 10xxxxxx)
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        // Convert to hex and format as UUID
        const hex = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };

    return crypto;
};
