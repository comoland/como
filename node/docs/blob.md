# **Implementation Plan: Web Blob API for QuickJS Runtime with Go Backend**

## **Project Overview**
Implement a production-ready Blob API following the W3C File API specification, using a two-tier architecture: JavaScript layer (QuickJS) for Web API compliance and Go layer for efficient memory management and operations.

---

## **Architecture Summary**

### **Design Pattern: Two-Tier Split Architecture**
- **JavaScript Layer (QuickJS)**: Implements Web API-compliant Blob/File interfaces with proper type checking, argument validation, and spec-compliant behavior
- **Go Layer**: Provides efficient storage, memory management, and high-performance operations through native functions
- **Communication**: Bridge functions (ops) callable from JavaScript that execute Go code

### **Key Architectural Decisions from Deno**
1. **Zero-copy slicing**: Blob slices don't duplicate data, they reference original parts with offset/length
2. **UUID-based part tracking**: Each blob part gets a unique identifier for lifecycle management
3. **Finalization registry**: Automatic garbage collection cleanup of native resources
4. **Object URL store**: Separate storage for blob:// URLs with origin-based generation
5. **Async streaming**: Blob data reading is async to handle large files efficiently

---

## **Core Components**

### **1. Go Native Layer Implementation**

#### **A. BlobStore (Central Management)**
```go
type BlobStore struct {
    parts       sync.Map // map[uuid.UUID]*BlobPart - stores blob data
    objectURLs  sync.Map // map[string]*Blob - stores blob:// URLs
}
```

**Methods:**
- `InsertPart(part BlobPart) uuid.UUID` - Store blob part, return UUID
- `GetPart(id uuid.UUID) (*BlobPart, error)` - Retrieve blob part
- `RemovePart(id uuid.UUID)` - Delete blob part (GC cleanup)
- `InsertObjectURL(blob *Blob, origin string) string` - Create blob:// URL
- `GetObjectURL(url string) (*Blob, error)` - Retrieve blob from URL
- `RevokeObjectURL(url string)` - Remove blob URL
- `Clear()` - Clear all stored data

#### **B. Blob Structure**
```go
type Blob struct {
    MediaType string      // MIME type (e.g., "text/plain")
    Parts     []uuid.UUID // References to BlobPart UUIDs
}
```

**Methods:**
- `Size() int64` - Calculate total size from all parts
- `ReadAll() ([]byte, error)` - Read entire blob content (async)

#### **C. BlobPart Interface & Implementations**
```go
type BlobPart interface {
    Read() ([]byte, error)
    Size() int64
}

// In-memory storage
type InMemoryBlobPart struct {
    data []byte
}

// Zero-copy slice reference
type SlicedBlobPart struct {
    parentID uuid.UUID  // Reference to original part
    start    int64
    length   int64
    store    *BlobStore // Access to get parent
}
```

#### **D. Native Functions (Go → JS Bridge)**

Register these 7 functions with QuickJS:

1. **`op_blob_create_part(data []byte) string`**
   - Input: Uint8Array from JS
   - Creates InMemoryBlobPart
   - Returns: UUID string

2. **`op_blob_slice_part(id string, start int64, len int64) (string, error)`**
   - Input: Part UUID, slice range
   - Creates SlicedBlobPart (zero-copy)
   - Returns: New UUID string

3. **`op_blob_read_part(id string) ([]byte, error)`**
   - Input: Part UUID
   - Returns: Byte array (async in JS)
   - Handles sliced parts by reading parent and extracting range

4. **`op_blob_remove_part(id string)`**
   - Input: Part UUID
   - Deletes from BlobStore
   - Called by JS FinalizationRegistry

5. **`op_blob_create_object_url(mediaType string, partIDs []string) (string, error)`**
   - Input: MIME type, array of part UUIDs
   - Creates Blob struct, generates URL
   - Format: `blob:{origin}/{uuid}`
   - Returns: Object URL string

6. **`op_blob_revoke_object_url(url string) error`**
   - Input: Object URL
   - Removes from objectURLs map
   - Returns: Error if URL invalid

7. **`op_blob_from_object_url(url string) (*BlobData, error)`**
   - Input: Object URL
   - Returns: JSON struct with `{media_type: string, parts: [{uuid: string, size: int}]}`
   - Used to recreate Blob from URL

---

### **2. JavaScript Layer Implementation (QuickJS)**

#### **A. Blob Class**

**File: `blob.js`**

```javascript
class Blob {
    #type = ""
    #size = 0
    #parts = []  // Array of BlobReference or nested Blob objects

    constructor(blobParts = [], options = {}) {
        // 1. Validate arguments using WebIDL converters
        // 2. Process blob parts: convert strings, ArrayBuffers, TypedArrays, DataViews to BlobReference
        // 3. Handle 'endings' option: "transparent" or "native" (CRLF conversion on Windows)
        // 4. Normalize type (lowercase, ASCII-only)
        // 5. Store processed parts and size
    }

    get size() { return this.#size }
    get type() { return this.#type }

    slice(start, end, contentType) {
        // 1. Clamp start/end to valid range
        // 2. Slice parts efficiently (don't copy data)
        // 3. Return new Blob with sliced references
    }

    stream() {
        // Return ReadableStream<Uint8Array>
        // Pull from parts iterator asynchronously
    }

    async text() {
        // Read all bytes, decode as UTF-8
    }

    async arrayBuffer() {
        // Read all bytes, return ArrayBuffer
    }

    async bytes() {
        // Read all bytes, return Uint8Array
    }
}
```

**Helper Functions in JS:**
- `processBlobParts(parts, endings)` - Convert various input types to BlobReference
- `convertLineEndingsToNative(str)` - Convert CRLF for "native" endings
- `normalizeType(str)` - Lowercase, validate ASCII
- `getParts(blob)` - Flatten nested Blob structure to UUID array

#### **B. BlobReference Class (Internal)**

```javascript
class BlobReference {
    #id      // UUID string from Go
    #size    // Size in bytes

    constructor(id, size) {
        this.#id = id
        this.#size = size
        // Register with FinalizationRegistry for cleanup
        registry.register(this, id)
    }

    static fromUint8Array(data) {
        // Call op_blob_create_part(data)
        // Return new BlobReference(uuid, data.length)
    }

    slice(start, end) {
        // Call op_blob_slice_part(this.#id, start, end-start)
        // Return new BlobReference(uuid, end-start)
    }

    async *stream() {
        // Async generator
        // yield await op_blob_read_part(this.#id)
    }

    get size() { return this.#size }
}
```

#### **C. File Class (extends Blob)**

```javascript
class File extends Blob {
    #name
    #lastModified

    constructor(fileBits, fileName, options = {}) {
        super(fileBits, options)
        this.#name = fileName
        this.#lastModified = options.lastModified ?? Date.now()
    }

    get name() { return this.#name }
    get lastModified() { return this.#lastModified }
}
```

#### **D. URL Extensions**

```javascript
URL.createObjectURL = function(blob) {
    // Validate blob is Blob instance
    // Flatten blob.#parts to UUID array
    // Call op_blob_create_object_url(blob.type, partUUIDs)
    // Return object URL string
}

URL.revokeObjectURL = function(url) {
    // Call op_blob_revoke_object_url(url)
}

function blobFromObjectUrl(url) {
    // Call op_blob_from_object_url(url)
    // Reconstruct Blob from returned data
    // Create BlobReference objects for each part
}
```

#### **E. Garbage Collection**

```javascript
const registry = new FinalizationRegistry((uuid) => {
    op_blob_remove_part(uuid)
})
```

---

## **Implementation Steps**

### **Phase 1: Go Backend (Native Layer)**

1. **Create blob store structure**
   - Implement BlobStore with thread-safe maps
   - Add UUID generation (github.com/google/uuid)

2. **Implement BlobPart types**
   - InMemoryBlobPart (stores []byte)
   - SlicedBlobPart (stores parent reference + range)
   - Implement Read() methods with slice logic

3. **Implement 7 native operations**
   - Create op_blob_* functions
   - Add error handling (custom error types)
   - Ensure thread safety with mutexes/sync.Map

4. **Register with QuickJS**
   - Use cgo or go-quickjs bindings
   - Export functions to JS global namespace
   - Handle type conversions ([]byte ↔ Uint8Array)

### **Phase 2: JavaScript Layer (QuickJS)**

1. **Create WebIDL converters**
   - Type validation for BlobPart union type
   - Dictionary converters for options
   - Sequence converters for arrays

2. **Implement Blob class**
   - Constructor with part processing
   - Slice method with range clamping
   - Stream method with ReadableStream integration
   - text/arrayBuffer/bytes async methods

3. **Implement BlobReference class**
   - UUID lifecycle management
   - FinalizationRegistry integration
   - Async streaming

4. **Implement File class**
   - Extend Blob with name/lastModified
   - Proper inheritance

5. **Implement URL extensions**
   - createObjectURL/revokeObjectURL
   - Object URL format: `blob:{origin}/{uuid}`

### **Phase 3: Integration & Testing**

1. **Basic functionality tests**
   - Create blobs from strings, arrays, buffers
   - Slice operations
   - Type handling

2. **Memory tests**
   - GC triggers blob cleanup
   - No memory leaks
   - Slicing doesn't copy data

3. **Object URL tests**
   - Create/revoke URLs
   - Retrieve blobs from URLs
   - Origin handling

4. **Edge cases**
   - Empty blobs
   - Large blobs (>100MB)
   - Nested blob slicing
   - Concurrent access

5. **Web Platform Tests (WPT)**
   - Run official W3C File API tests
   - Ensure spec compliance

---

## **Key Optimizations**

1. **Zero-Copy Slicing**
   - SlicedBlobPart references parent data
   - Only store offset/length, not duplicate bytes

2. **Lazy Reading**
   - Don't load blob data until read
   - Stream large blobs in chunks

3. **Reference Counting**
   - Parent parts stay alive while slices exist
   - Use Arc/shared pointers in Go

4. **Async Operations**
   - All read operations are async
   - Don't block JS event loop

5. **String Handling**
   - Use TextEncoder in JS (UTF-8 encoding)
   - Handle line ending conversion efficiently

---

## **Dependencies**

### **Go Packages**
- `github.com/google/uuid` - UUID generation (for now create a simple function in golang to do this, no external UUID)
- `sync` - Thread-safe maps and mutexes
- QuickJS Go bindings through our engine implementation available in ./js/** folder

### **JavaScript Features (QuickJS must support)**
- ES6 Classes
- Async/await
- Async generators (for streaming)
- FinalizationRegistry (GC cleanup)
- ReadableStream (byte streams)
- TypedArrays (Uint8Array)
- Symbol properties (private fields)

---

## **Spec Compliance Checklist**

- [ ] Blob constructor accepts `BlobPart[]` (BufferSource | Blob | string)
- [ ] `endings` option: "transparent" (default) and "native"
- [ ] `type` normalization: lowercase, ASCII-only
- [ ] Slice with negative indices (Python-style)
- [ ] stream() returns ReadableStream with byte support
- [ ] text() returns UTF-8 decoded string
- [ ] arrayBuffer() returns ArrayBuffer
- [ ] bytes() returns Uint8Array
- [ ] File extends Blob with name/lastModified
- [ ] URL.createObjectURL() format: `blob:{origin}/{id}`
- [ ] URL.revokeObjectURL() properly cleans up
- [ ] Blob from object URL doesn't duplicate data
- [ ] GC cleanup of unused blob parts
- [ ] Thread-safe concurrent blob operations

---

## **Error Handling**

### **Go Errors (mapped to JS exceptions)**
- `BlobPartNotFound` → TypeError in JS
- `SizeLargerThanBlobPart` → TypeError in JS
- `BlobURLsNotSupported` → TypeError in JS
- `InvalidURL` → TypeError in JS

### **JS Validation Errors**
- Invalid BlobPart type → TypeError
- Invalid options → TypeError
- Missing required arguments → TypeError

---

## **Performance Considerations**

1. **Memory efficiency**: Blobs composed of parts don't allocate contiguous memory until read
2. **Slice performance**: O(1) operation, creates new part reference
3. **Read performance**: Async to avoid blocking, can chunk large reads
4. **GC pressure**: FinalizationRegistry ensures native cleanup
5. **Concurrent access**: Thread-safe BlobStore allows parallel operations

---

## **Testing Strategy**

1. **Unit tests** (Go): Test each BlobPart type, BlobStore operations ( skip )
2. **Integration tests** (JS): Test Blob/File API surface
3. **Memory tests**: Verify GC cleanup, no leaks
4. **Performance tests**: Large blobs, many slices, concurrent access
5. **WPT compliance**: Run official Web Platform Tests

---

## **Example Usage (Expected Behavior)**

```javascript
// Create blob from mixed parts
const blob = new Blob(['Hello ', new Uint8Array([87, 111, 114, 108, 100])],
                      { type: 'text/plain' })

console.log(blob.size)  // 11
console.log(blob.type)  // "text/plain"

// Slice (zero-copy)
const slice = blob.slice(0, 5)
console.log(await slice.text())  // "Hello"

// Object URL
const url = URL.createObjectURL(blob)
console.log(url)  // "blob:null/550e8400-e29b-41d4-a716-446655440000"

// Retrieve blob
const blob2 = blobFromObjectUrl(url)
console.log(await blob2.text())  // "Hello World"

// Cleanup
URL.revokeObjectURL(url)
```

---

## **Success Criteria**

✅ All Web Platform Tests for File API pass
✅ Memory usage stable under load (no leaks)
✅ Slice operations are O(1) time complexity
✅ Can handle blobs >1GB without memory issues
✅ GC automatically cleans up unused blob parts
✅ Thread-safe for concurrent blob operations
✅ Compatible with existing web code using Blob API

---

This implementation plan provides a complete blueprint for building a production-ready, spec-compliant Blob API using Go and QuickJS, following proven architectural patterns from Deno's implementation.