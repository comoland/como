# GetBuffer() Migration Plan

## Overview

This document tracks the migration from `GetBuffer()` to the more correct `GetTypedArray()` method across the codebase.

## Background

- **Problem**: `GetBuffer()` returns the entire underlying `ArrayBuffer`, ignoring TypedArray view bounds (length, byteOffset)
- **Solution**: Added `GetTypedArray()` which correctly respects view boundaries
- **Status**: `GetTypedArray()` implemented and tested; `GetBuffer()` preserved for backward compatibility

## Current Usage Statistics

Total `GetBuffer()` calls: **52 instances**

### Breakdown by File

| File | Count | Notes |
|------|-------|-------|
| `lib/node/buffer.go` | 30 | Buffer operations - likely needs review |
| `lib/node/fs.go` | 4 | File system writes |
| `lib/web/crypto.go` | 8 | Cryptographic operations |
| `lib/web/url.go` | 3 | URL parsing buffer management |
| `lib/web/wasi.go` | 2 | WASM standard I/O |
| `lib/web/blob.go` | 0 | ✅ Migrated to `GetTypedArray()` |

## Migration Status

### ✅ Completed
- **lib/web/blob.go**: Migrated to `GetTypedArray()` (1 use case)
  - Status: Tested and working
  - All 25 tests passing

### 🔍 Needs Audit

#### High Priority
1. **lib/node/buffer.go** (30 uses)
   - Line 811 comment: *"source might be an ArrayBuffer view, but GetBuffer handles that"*
   - **Action Required**: This is incorrect - GetBuffer doesn't handle views properly
   - Many operations like `copy()`, `compare()`, `indexOf()` may be affected
   - **Impact**: Could cause bugs when passing TypedArray views with offsets

2. **lib/node/fs.go** (4 uses)
   - Lines: 39, 58, 530, 620 (all for file writes)
   - **Risk**: Writing wrong amount of data if passed a TypedArray view
   - **Action Required**: Test with `Uint8Array` views that have byteOffset

3. **lib/web/crypto.go** (8 uses)
   - Lines: 73, 100, 105, 132, 137, 164, 169, 195, 223
   - Used for: signing, verifying, encryption, decryption, hashing
   - **Risk**: Critical - wrong data could break cryptographic operations
   - **Action Required**: High priority migration

#### Medium Priority
4. **lib/web/url.go** (3 uses)
   - Lines: 130, 281, 292
   - Used for HTTP request/response bodies
   - **Risk**: Could send/receive incorrect data
   - **Action Required**: Test with TypedArray views

5. **lib/web/wasi.go** (2 uses)
   - Lines: 23, 258
   - Used for WASM stdio
   - **Risk**: Wrong data passed to WASM modules
   - **Action Required**: Review WASI spec compliance

## Testing Strategy

For each file to migrate:

1. **Create test case with TypedArray view + byteOffset**:
   ```javascript
   const buffer = new ArrayBuffer(20);
   const view = new Uint8Array(buffer, 5, 10); // offset=5, length=10
   // Fill with test data
   // Pass to function under test
   // Verify only bytes 5-14 are used, not all 20
   ```

2. **Run existing tests** to ensure no regression

3. **Add edge case tests**:
   - Empty views
   - Full buffer (offset=0, length=buffer.length)
   - View at end of buffer
   - Overlapping views

## Migration Checklist

For each file:

- [ ] **lib/node/buffer.go**
  - [ ] Audit all 30 uses
  - [ ] Identify which need `GetTypedArray()`
  - [ ] Create test cases
  - [ ] Migrate and test
  - [ ] Remove incorrect comment on line 811

- [ ] **lib/node/fs.go**
  - [ ] Test file writes with TypedArray views
  - [ ] Migrate if needed
  - [ ] Verify no data corruption

- [ ] **lib/web/crypto.go**
  - [ ] Test crypto operations with views
  - [ ] Migrate all uses (critical for security)
  - [ ] Verify cryptographic correctness

- [ ] **lib/web/url.go**
  - [ ] Test HTTP body handling with views
  - [ ] Migrate if needed
  - [ ] Test with real HTTP requests

- [ ] **lib/web/wasi.go**
  - [ ] Review WASI spec for buffer handling
  - [ ] Test with WASM modules
  - [ ] Migrate if needed

## Decision Tree

When should you use which method?

```
Is the input expected to be a TypedArray (Uint8Array, etc.)?
├─ Yes → Use GetTypedArray()
│   └─ Respects view bounds (length, byteOffset)
│
└─ No, expecting raw ArrayBuffer
    └─ Use GetBuffer()
        └─ Returns entire buffer
```

## Example Migration

**Before** (incorrect for TypedArray views):
```go
data, err := args.GetBuffer(0)
if err != nil {
    return ctx.Throw("Expected buffer")
}
// data might be larger than intended!
```

**After** (correct for TypedArray views):
```go
data, err := args.GetTypedArray(0)
if err != nil {
    return ctx.Throw("Expected TypedArray")
}
// data is exactly what the view represents
```

## Known Issues

### Critical Issue in buffer.go

Line 811 comment is **incorrect**:
```go
// source might be an ArrayBuffer view, but GetBuffer handles that
source, err := args.GetBuffer(1)
```

**Reality**: `GetBuffer()` does NOT handle views correctly - it returns the entire underlying buffer.

**Impact**: When copying/comparing buffers with TypedArray views, wrong data is used.

**Example Bug**:
```javascript
const big = new Uint8Array(1000);
const small = big.subarray(0, 10); // View of first 10 bytes

buffer.copy(target, small);
// BUG: Copies all 1000 bytes instead of 10!
```

## Timeline

- **Phase 1** (Completed): Add `GetTypedArray()` method
- **Phase 2** (Completed): Migrate blob.go and test
- **Phase 3** (Next): Audit and migrate crypto.go (security critical)
- **Phase 4**: Migrate buffer.go (most complex, 30 uses)
- **Phase 5**: Migrate remaining files
- **Phase 6**: Consider deprecating GetBuffer() or updating its docs

## Success Criteria

✅ All migrated code:
- Passes existing tests
- Passes new TypedArray view tests
- Has correct behavior with byteOffset
- No performance regression

## References

- Implementation: `js/arguments.go` (lines 114-180)
- Test: All blob tests demonstrate correct behavior
- Documentation: `GETTYPEDARRAY_ADDITION.md`

---

**Created**: 2025-10-10
**Status**: Phase 2 Complete (blob.go migrated)
**Next Action**: Audit crypto.go for security-critical uses

