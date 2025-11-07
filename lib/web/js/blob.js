// Get native blob operations from Go
// const ops = Como.blob || {};
import * as ops from 'blob.go'

// FinalizationRegistry for automatic cleanup of blob parts
const registry = new FinalizationRegistry((uuid) => {
    if (ops.op_blob_remove_part) {
        ops.op_blob_remove_part(uuid);
    }
});

// Helper: Normalize MIME type (lowercase, ASCII-only)
function normalizeType(type) {
    if (typeof type !== 'string') return '';

    // Convert to lowercase
    type = type.toLowerCase();

    // Check if it contains only ASCII characters (0x20-0x7E)
    for (let i = 0; i < type.length; i++) {
        const code = type.charCodeAt(i);
        if (code < 0x20 || code > 0x7E) {
            return '';
        }
    }

    return type;
}

// Helper: Convert line endings to native (CRLF on Windows)
function convertLineEndingsToNative(str) {
    // For now, we'll keep as-is (transparent mode is default)
    // Native mode would convert \n to \r\n on Windows
    // Since we're on Linux primarily, we'll skip this conversion
    return str;
}

// Helper: Get all part UUIDs from a blob (flattened)
function getParts(blob) {
    if (!(blob instanceof Blob)) {
        throw new TypeError('Argument must be a Blob');
    }

    const parts = [];
    for (const part of blob._parts) {
        if (part instanceof BlobReference) {
            parts.push(part._id);
        } else if (part instanceof Blob) {
            // Recursively get parts from nested blobs
            parts.push(...getParts(part));
        }
    }
    return parts;
}

// Helper: Process blob parts from constructor
function processBlobParts(parts, endings) {
    const processed = [];
    let totalSize = 0;

    for (let part of parts) {
        if (typeof part === 'string') {
            // Convert string to UTF-8 bytes
            let str = part;
            if (endings === 'native') {
                str = convertLineEndingsToNative(str);
            }

            // Encode to UTF-8
            const encoder = new TextEncoder();
            const bytes = encoder.encode(str);
            const ref = BlobReference.fromUint8Array(bytes);
            processed.push(ref);
            totalSize += ref.size;
        } else if (part instanceof Blob) {
            // Keep blob as-is for nested structure
            processed.push(part);
            totalSize += part.size;
        } else if (part instanceof ArrayBuffer) {
            // Convert ArrayBuffer to Uint8Array
            const bytes = new Uint8Array(part);
            const ref = BlobReference.fromUint8Array(bytes);
            processed.push(ref);
            totalSize += ref.size;
        } else if (ArrayBuffer.isView(part)) {
            // TypedArray or DataView
            const bytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
            const ref = BlobReference.fromUint8Array(bytes);
            processed.push(ref);
            totalSize += ref.size;
        } else {
            throw new TypeError(`Failed to construct 'Blob': The provided value cannot be converted to a sequence.`);
        }
    }

    return { parts: processed, size: totalSize };
}

// BlobReference: Internal class wrapping a native blob part
class BlobReference {
    constructor(id, size) {
        this._id = id;
        this._size = size;

        // Register for garbage collection cleanup
        registry.register(this, id);
    }

    static fromUint8Array(data) {
        if (!ops.op_blob_create_part) {
            throw new Error('Blob operations not available');
        }

        const id = ops.op_blob_create_part(data);
        return new BlobReference(id, data.length);
    }

    slice(start, end) {
        if (!ops.op_blob_slice_part) {
            throw new Error('Blob operations not available');
        }

        const length = end - start;
        const id = ops.op_blob_slice_part(this._id, start, length);
        return new BlobReference(id, length);
    }

    async read() {
        if (!ops.op_blob_read_part) {
            throw new Error('Blob operations not available');
        }

        const result = await ops.op_blob_read_part(this._id);
        // Convert ArrayBuffer to Uint8Array
        if (result instanceof ArrayBuffer) {
            return new Uint8Array(result);
        }
        return result;
    }

    async *stream() {
        // Read the part and yield it as a chunk
        const data = await this.read();
        yield data;
    }

    get size() {
        return this._size;
    }
}

// Blob: Web API-compliant Blob class
class Blob {
    constructor(blobParts = [], options = {}) {
        // Validate and process options
        const opts = options || {};
        const endings = opts.endings === 'native' ? 'native' : 'transparent';
        const type = normalizeType(opts.type || '');

        // Process blob parts
        let parts = [];
        let size = 0;

        if (Array.isArray(blobParts)) {
            const result = processBlobParts(blobParts, endings);
            parts = result.parts;
            size = result.size;
        }

        // Store as private properties (using underscore convention)
        this._type = type;
        this._size = size;
        this._parts = parts;
    }

    get size() {
        return this._size;
    }

    get type() {
        return this._type;
    }

    slice(start, end, contentType) {
        // Clamp start and end to valid range
        const size = this._size;

        // Handle undefined/missing arguments
        let relativeStart = start === undefined ? 0 : start;
        let relativeEnd = end === undefined ? size : end;

        // Handle negative indices (Python-style)
        if (relativeStart < 0) {
            relativeStart = Math.max(size + relativeStart, 0);
        } else {
            relativeStart = Math.min(relativeStart, size);
        }

        if (relativeEnd < 0) {
            relativeEnd = Math.max(size + relativeEnd, 0);
        } else {
            relativeEnd = Math.min(relativeEnd, size);
        }

        // Calculate span
        const span = Math.max(relativeEnd - relativeStart, 0);

        // Slice parts efficiently
        const slicedParts = [];
        let currentOffset = 0;
        let remainingStart = relativeStart;
        let remainingLength = span;

        for (const part of this._parts) {
            if (remainingLength <= 0) break;

            const partSize = part instanceof Blob ? part.size : part.size;

            // Check if this part is in range
            if (remainingStart < partSize) {
                const partStart = remainingStart;
                const partEnd = Math.min(partStart + remainingLength, partSize);
                const partLength = partEnd - partStart;

                if (part instanceof BlobReference) {
                    // Slice the reference (zero-copy)
                    const sliced = part.slice(partStart, partEnd);
                    slicedParts.push(sliced);
                } else if (part instanceof Blob) {
                    // Recursively slice nested blob
                    const sliced = part.slice(partStart, partEnd);
                    slicedParts.push(sliced);
                }

                remainingLength -= partLength;
                remainingStart = 0;
            } else {
                remainingStart -= partSize;
            }
        }

        // Create new blob with sliced parts
        const slicedBlob = Object.create(Blob.prototype);
        slicedBlob._type = normalizeType(contentType !== undefined ? contentType : '');
        slicedBlob._size = span;
        slicedBlob._parts = slicedParts;

        return slicedBlob;
    }

    stream() {
        // Return a ReadableStream (if available)
        const parts = this._parts;
        let index = 0;

        return new ReadableStream({
            async pull(controller) {
                if (index >= parts.length) {
                    controller.close();
                    return;
                }

                const part = parts[index++];

                if (part instanceof BlobReference) {
                    const data = await part.read();
                    controller.enqueue(data);
                } else if (part instanceof Blob) {
                    // Read nested blob
                    const data = await part.arrayBuffer();
                    controller.enqueue(new Uint8Array(data));
                }
            }
        });
    }

    async arrayBuffer() {
        // Read all parts and concatenate
        const chunks = [];
        let totalSize = 0;

        for (const part of this._parts) {
            if (part instanceof BlobReference) {
                const data = await part.read();
                chunks.push(data);
                totalSize += data.length;
            } else if (part instanceof Blob) {
                const data = await part.arrayBuffer();
                chunks.push(new Uint8Array(data));
                totalSize += data.byteLength;
            }
        }

        // Concatenate into single ArrayBuffer
        const result = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }

    async text() {
        const buffer = await this.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(buffer);
    }

    async bytes() {
        const buffer = await this.arrayBuffer();
        return new Uint8Array(buffer);
    }
}

// File: Extends Blob with name and lastModified
class File extends Blob {
    constructor(fileBits, fileName, options = {}) {
        // Call Blob constructor
        super(fileBits, options);

        // Store file-specific properties
        this._name = String(fileName);
        this._lastModified = options.lastModified !== undefined
            ? Number(options.lastModified)
            : Date.now();
    }

    get name() {
        return this._name;
    }

    get lastModified() {
        return this._lastModified;
    }
}

// URL.createObjectURL and URL.revokeObjectURL extensions
function createObjectURL(blob) {
    if (!(blob instanceof Blob)) {
        throw new TypeError('Failed to execute \'createObjectURL\': parameter 1 is not of type \'Blob\'');
    }

    if (!ops.op_blob_create_object_url) {
        throw new Error('Blob operations not available');
    }

    // Get all part UUIDs (flattened)
    const partIDs = getParts(blob);

    // Create object URL
    const url = ops.op_blob_create_object_url(blob.type, partIDs);
    return url;
}

function revokeObjectURL(url) {
    if (typeof url !== 'string') {
        throw new TypeError('Failed to execute \'revokeObjectURL\': parameter 1 is not of type \'string\'');
    }

    if (!ops.op_blob_revoke_object_url) {
        throw new Error('Blob operations not available');
    }

    // Revoke URL (errors are swallowed per spec)
    try {
        ops.op_blob_revoke_object_url(url);
    } catch (e) {
        // Silently ignore errors per spec
    }
}

function blobFromObjectUrl(url) {
    if (typeof url !== 'string') {
        throw new TypeError('Parameter must be a string');
    }

    if (!ops.op_blob_from_object_url) {
        throw new Error('Blob operations not available');
    }

    // Get blob data from URL
    const data = ops.op_blob_from_object_url(url);

    // Reconstruct blob from parts
    const parts = [];
    for (const partInfo of data.parts) {
        const ref = new BlobReference(partInfo.uuid, partInfo.size);
        parts.push(ref);
    }

    // Create blob
    const blob = Object.create(Blob.prototype);
    blob._type = data.media_type;
    blob._size = parts.reduce((sum, part) => sum + part.size, 0);
    blob._parts = parts;

    return blob;
}

export { Blob, File, createObjectURL, revokeObjectURL, blobFromObjectUrl };
