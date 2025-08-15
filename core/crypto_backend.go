package core

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"hash"
	"math/big"

	"github.com/comoland/como/js"
)

// CryptoBackend provides the actual cryptographic operations
type CryptoBackend struct {
	ctx *js.Context
}

// NewCryptoBackend creates a new crypto backend
func NewCryptoBackend(ctx *js.Context) *CryptoBackend {
	return &CryptoBackend{ctx: ctx}
}

// GenerateKey generates cryptographic keys
func (cb *CryptoBackend) GenerateKey(algorithm string, extractable bool, keyUsages []string, obj js.Value) (interface{}, error) {
	switch algorithm {
	case "RSASSA-PKCS1-v1_5", "RSA-OAEP":
		if !obj.IsObject() {
			return nil, fmt.Errorf("algorithm argument must be an object: %s", obj)
		}

		bit := obj.Get("modulusLength").(int64)
		return cb.generateRSAKey(int(bit), extractable, keyUsages)
	case "ECDSA":
		return cb.generateECDSAKey(elliptic.P256(), extractable, keyUsages)
	case "AES-GCM", "AES-CBC", "AES-CTR":
		return cb.generateAESKey(algorithm, extractable, keyUsages)
	default:
		return nil, fmt.Errorf("unsupported algorithm: %s", algorithm)
	}
}

// Sign signs data with a private key
func (cb *CryptoBackend) Sign(algorithm string, key interface{}, data []byte) ([]byte, error) {
	switch algorithm {
	case "RSASSA-PKCS1-v1_5":
		return cb.signRSA(key, data)
	case "ECDSA":
		return cb.signECDSA(key, data)
	default:
		return nil, fmt.Errorf("unsupported signing algorithm: %s", algorithm)
	}
}

// Verify verifies a signature
func (cb *CryptoBackend) Verify(algorithm string, key interface{}, signature, data []byte) (bool, error) {
	switch algorithm {
	case "RSASSA-PKCS1-v1_5":
		return cb.verifyRSA(key, signature, data)
	case "ECDSA":
		return cb.verifyECDSA(key, signature, data)
	default:
		return false, fmt.Errorf("unsupported verification algorithm: %s", algorithm)
	}
}

// Encrypt encrypts data
func (cb *CryptoBackend) Encrypt(algorithm string, key interface{}, data, iv []byte) ([]byte, error) {
	switch algorithm {
	case "AES-GCM":
		return cb.encryptAESGCM(key, data, iv)
	case "AES-CBC":
		return cb.encryptAESCBC(key, data, iv)
	case "RSA-OAEP":
		return cb.encryptRSAOAEP(key, data)
	default:
		return nil, fmt.Errorf("unsupported encryption algorithm: %s", algorithm)
	}
}

// Decrypt decrypts data
func (cb *CryptoBackend) Decrypt(algorithm string, key interface{}, data, iv []byte) ([]byte, error) {
	switch algorithm {
	case "AES-GCM":
		return cb.decryptAESGCM(key, data, iv)
	case "AES-CBC":
		return cb.decryptAESCBC(key, data, iv)
	case "RSA-OAEP":
		return cb.decryptRSAOAEP(key, data)
	default:
		return nil, fmt.Errorf("unsupported decryption algorithm: %s", algorithm)
	}
}

// Digest creates a hash digest
func (cb *CryptoBackend) Digest(algorithm string, data []byte) ([]byte, error) {
	var h hash.Hash
	switch algorithm {
	case "SHA-1":
		h = sha1.New()
	case "SHA-256":
		h = sha256.New()
	case "SHA-384":
		h = sha512.New384()
	case "SHA-512":
		h = sha512.New()
	default:
		return nil, fmt.Errorf("unsupported digest algorithm: %s", algorithm)
	}

	h.Write(data)
	return h.Sum(nil), nil
}

// GetRandomValues fills an array with cryptographically random values
func (cb *CryptoBackend) GetRandomValues(array []byte) error {
	_, err := rand.Read(array)
	return err
}

// Helper methods for RSA operations
func (cb *CryptoBackend) generateRSAKey(bits int, extractable bool, keyUsages []string) (map[string]interface{}, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return nil, err
	}

	publicKey := &privateKey.PublicKey

	// Convert to JSON-serializable format
	publicKeyBytes, err := json.Marshal(publicKey)
	if err != nil {
		return nil, err
	}

	privateKeyBytes, err := json.Marshal(privateKey)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"publicKey": map[string]interface{}{
			"type":        "public",
			"extractable": extractable,
			"algorithm":   "RSA",
			"usages":      keyUsages,
			"key":         string(publicKeyBytes),
		},
		"privateKey": map[string]interface{}{
			"type":        "private",
			"extractable": extractable,
			"algorithm":   "RSA",
			"usages":      keyUsages,
			"key":         string(privateKeyBytes),
		},
	}, nil
}

func (cb *CryptoBackend) signRSA(key interface{}, data []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyData, ok := keyMap["key"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	var privateKey rsa.PrivateKey
	err := json.Unmarshal([]byte(keyData), &privateKey)
	if err != nil {
		return nil, err
	}

	h := sha256.New()
	h.Write(data)
	hashed := h.Sum(nil)

	return rsa.SignPKCS1v15(rand.Reader, &privateKey, crypto.SHA256, hashed)
}

func (cb *CryptoBackend) verifyRSA(key interface{}, signature, data []byte) (bool, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return false, fmt.Errorf("invalid key format")
	}

	keyData, ok := keyMap["key"].(string)
	if !ok {
		return false, fmt.Errorf("invalid key data")
	}

	var publicKey rsa.PublicKey
	err := json.Unmarshal([]byte(keyData), &publicKey)
	if err != nil {
		return false, err
	}

	h := sha256.New()
	h.Write(data)
	hashed := h.Sum(nil)

	err = rsa.VerifyPKCS1v15(&publicKey, crypto.SHA256, hashed, signature)
	return err == nil, err
}

func (cb *CryptoBackend) encryptRSAOAEP(key interface{}, data []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyData, ok := keyMap["key"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	var publicKey rsa.PublicKey
	err := json.Unmarshal([]byte(keyData), &publicKey)
	if err != nil {
		return nil, err
	}

	return rsa.EncryptOAEP(sha256.New(), rand.Reader, &publicKey, data, nil)
}

func (cb *CryptoBackend) decryptRSAOAEP(key interface{}, data []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyData, ok := keyMap["key"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	var privateKey rsa.PrivateKey
	err := json.Unmarshal([]byte(keyData), &privateKey)
	if err != nil {
		return nil, err
	}

	return rsa.DecryptOAEP(sha256.New(), rand.Reader, &privateKey, data, nil)
}

// Helper methods for ECDSA operations
func (cb *CryptoBackend) generateECDSAKey(curve elliptic.Curve, extractable bool, keyUsages []string) (map[string]interface{}, error) {
	privateKey, err := ecdsa.GenerateKey(curve, rand.Reader)
	if err != nil {
		return nil, err
	}

	// Extract key components manually to avoid elliptic.Curve serialization issues
	publicKeyData := map[string]interface{}{
		"curve": "P-256", // We only support P-256 for now
		"x":     privateKey.PublicKey.X.Bytes(),
		"y":     privateKey.PublicKey.Y.Bytes(),
	}

	privateKeyData := map[string]interface{}{
		"curve": "P-256", // We only support P-256 for now
		"x":     privateKey.PublicKey.X.Bytes(),
		"y":     privateKey.PublicKey.Y.Bytes(),
		"d":     privateKey.D.Bytes(),
	}

	// Convert to JSON-serializable format
	publicKeyBytes, err := json.Marshal(publicKeyData)
	if err != nil {
		return nil, err
	}

	privateKeyBytes, err := json.Marshal(privateKeyData)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"publicKey": map[string]interface{}{
			"type":        "public",
			"extractable": extractable,
			"algorithm":   "ECDSA",
			"usages":      keyUsages,
			"key":         string(publicKeyBytes),
		},
		"privateKey": map[string]interface{}{
			"type":        "private",
			"extractable": extractable,
			"algorithm":   "ECDSA",
			"usages":      keyUsages,
			"key":         string(privateKeyBytes),
		},
	}, nil
}

func (cb *CryptoBackend) signECDSA(key interface{}, data []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format: expected map, got %T", key)
	}

	keyData, ok := keyMap["key"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid key format: missing 'key' field or not a string")
	}

	// Parse the key components
	var keyComponents map[string]interface{}
	err := json.Unmarshal([]byte(keyData), &keyComponents)
	if err != nil {
		return nil, fmt.Errorf("failed to parse key data: %v", err)
	}

	// Extract and decode the private key component 'd'
	dStr, ok := keyComponents["d"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid private key format: missing 'd' component")
	}
	dBytes, err := base64.StdEncoding.DecodeString(dStr)
	if err != nil {
		return nil, fmt.Errorf("failed to decode 'd' component: %v", err)
	}

	// Extract and decode the public key components
	xStr, ok := keyComponents["x"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid private key format: missing 'x' component")
	}
	xBytes, err := base64.StdEncoding.DecodeString(xStr)
	if err != nil {
		return nil, fmt.Errorf("failed to decode 'x' component: %v", err)
	}

	yStr, ok := keyComponents["y"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid private key format: missing 'y' component")
	}
	yBytes, err := base64.StdEncoding.DecodeString(yStr)
	if err != nil {
		return nil, fmt.Errorf("failed to decode 'y' component: %v", err)
	}

	// Reconstruct the private key
	privateKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		},
		D: new(big.Int).SetBytes(dBytes),
	}

	h := sha256.New()
	h.Write(data)
	hashed := h.Sum(nil)

	r, s, err := ecdsa.Sign(rand.Reader, privateKey, hashed)
	if err != nil {
		return nil, err
	}

	// Encode signature as R || S
	sig := make([]byte, 64)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(sig[32-len(rBytes):], rBytes)
	copy(sig[64-len(sBytes):], sBytes)

	return sig, nil
}

func (cb *CryptoBackend) verifyECDSA(key interface{}, signature, data []byte) (bool, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return false, fmt.Errorf("invalid key format")
	}

	keyData, ok := keyMap["key"].(string)
	if !ok {
		return false, fmt.Errorf("invalid key data")
	}

	// Parse the key components
	var keyComponents map[string]interface{}
	err := json.Unmarshal([]byte(keyData), &keyComponents)
	if err != nil {
		return false, fmt.Errorf("failed to parse key data: %v", err)
	}

	// Extract and decode the public key components
	xStr, ok := keyComponents["x"].(string)
	if !ok {
		return false, fmt.Errorf("invalid public key format: missing 'x' component")
	}
	xBytes, err := base64.StdEncoding.DecodeString(xStr)
	if err != nil {
		return false, fmt.Errorf("failed to decode 'x' component: %v", err)
	}

	yStr, ok := keyComponents["y"].(string)
	if !ok {
		return false, fmt.Errorf("invalid public key format: missing 'y' component")
	}
	yBytes, err := base64.StdEncoding.DecodeString(yStr)
	if err != nil {
		return false, fmt.Errorf("failed to decode 'y' component: %v", err)
	}

	// Reconstruct the public key
	publicKey := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}

	if len(signature) != 64 {
		return false, fmt.Errorf("invalid signature length")
	}

	h := sha256.New()
	h.Write(data)
	hashed := h.Sum(nil)

	r := new(big.Int).SetBytes(signature[:32])
	s := new(big.Int).SetBytes(signature[32:])

	return ecdsa.Verify(publicKey, hashed, r, s), nil
}

// Helper methods for AES operations
func (cb *CryptoBackend) generateAESKey(algorithm string, extractable bool, keyUsages []string) (map[string]interface{}, error) {
	key := make([]byte, 32) // 256-bit key
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"type":        "secret",
		"extractable": extractable,
		"algorithm":   algorithm,
		"usages":      keyUsages,
		"key":         key,
	}, nil
}

func (cb *CryptoBackend) encryptAESGCM(key interface{}, data, iv []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyBytes, ok := keyMap["key"].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return aesGCM.Seal(nil, iv, data, nil), nil
}

func (cb *CryptoBackend) decryptAESGCM(key interface{}, data, iv []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyBytes, ok := keyMap["key"].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return aesGCM.Open(nil, iv, data, nil)
}

func (cb *CryptoBackend) encryptAESCBC(key interface{}, data, iv []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyBytes, ok := keyMap["key"].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}

	// PKCS7 padding
	padding := aes.BlockSize - (len(data) % aes.BlockSize)
	paddedData := make([]byte, len(data)+padding)
	copy(paddedData, data)
	for i := len(data); i < len(paddedData); i++ {
		paddedData[i] = byte(padding)
	}

	ciphertext := make([]byte, len(paddedData))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, paddedData)

	return ciphertext, nil
}

func (cb *CryptoBackend) decryptAESCBC(key interface{}, data, iv []byte) ([]byte, error) {
	keyMap, ok := key.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key format")
	}

	keyBytes, ok := keyMap["key"].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid key data")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}

	plaintext := make([]byte, len(data))
	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(plaintext, data)

	// Remove PKCS7 padding
	padding := int(plaintext[len(plaintext)-1])
	if padding > aes.BlockSize || padding == 0 {
		return nil, fmt.Errorf("invalid padding")
	}

	return plaintext[:len(plaintext)-padding], nil
}
