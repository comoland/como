# Missing Node.js fs Functions

This document lists Node.js fs API functions that are currently **NOT implemented** in Como's fs module.

## Implemented Functions ✅

### File Operations
- `readFile` - Read file (async)
- `writeFile` - Write file (async)
- `appendFile` - Append to file (async)
- `read` - Low-level read (async)
- `write` - Low-level write (async)
- `append` - Low-level append (async)

### Directory Operations
- `mkdir` - Create directory (async, supports recursive via MkdirAll)
- `readdir` - Read directory (async, supports recursive and withFileTypes)
- `rmdir` - Remove directory (async, uses RemoveAll)

### File Info
- `stat` - Get file stats (async)
- `lstat` - Get file stats without following symlinks (async)
- `exists` - Check file existence (async)

### File Manipulation
- `unlink` - Delete file (async)
- `rename` - Rename/move file (async)
- `copyFile` - Copy file (async)
- `truncate` - Truncate file (async)

### Permissions
- `chmod` - Change file mode (async)
- `chown` - Change file owner (async)

### File Times
- `utimes` - Change file access/modification times (async)

### Path Operations
- `realpath` - Resolve real path (async)

### Symbolic Links
- `symlink` - Create symbolic link (async)
- `readlink` - Read symbolic link target (async)

### File Descriptors
- `open` - Open file descriptor (async)
- `close` - Close file descriptor (async)

### Temporary Files
- `mkdtemp` - Create temporary directory (async)

### File Access
- `access` - Check file access permissions (async)

### File Watching
- `watch` - Watch file/directory for changes (async)

### Constants & Flags
- `constants` - File system constants (F_OK, R_OK, W_OK, X_OK)
- `flags` - File open flags
- `modes` - File permission modes

---

## Missing Functions ❌

### Streams
- `createReadStream` - Create readable file stream
- `createWriteStream` - Create writable file stream

### File Descriptor Operations (synchronous versions)
- `fstat` - Get file stats from file descriptor (async)
- `futimes` - Change file times via file descriptor (async)
- `fchmod` - Change file mode via file descriptor (async)
- `fchown` - Change file owner via file descriptor (async)
- `ftruncate` - Truncate file via file descriptor (async)
- `fsync` - Flush file descriptor to disk (async)
- `fdatasync` - Flush file data to disk (async, no metadata)

### File Descriptor Synchronous I/O
- `readSync` - Synchronous read from file descriptor
- `writeSync` - Synchronous write to file descriptor
- `readv` - Scatter read (read into multiple buffers)
- `writev` - Gather write (write from multiple buffers)

### Hard Links
- `link` - Create hard link (async)
- `linkSync` - Create hard link (sync)

### Modern Node.js APIs (v14.5.0+)
- `cp` - Copy files/directories recursively (async)
- `cpSync` - Copy files/directories recursively (sync)
- `rm` - Remove files/directories recursively (async)
- `rmSync` - Remove files/directories recursively (sync)
- `opendir` - Open directory stream (async)
- `readdir` stream-like API improvements
- `openAsBlob` - Open file as Blob (async, Node.js v18.17.0+)

### Promises API
- `fs.promises` namespace - All async operations in promises namespace
  - `fs.promises.readFile`
  - `fs.promises.writeFile`
  - `fs.promises.mkdir`
  - etc.

### Synchronous Versions
Note: `fs.js` has a `makeSync()` function that attempts to create sync versions, but it uses `globalThis.op_sync` which may not work correctly. The following sync functions should be properly implemented:
- `readFileSync` - Synchronous readFile
- `writeFileSync` - Synchronous writeFile
- `appendFileSync` - Synchronous appendFile
- `mkdirSync` - Synchronous mkdir
- `readdirSync` - Synchronous readdir
- `rmdirSync` - Synchronous rmdir
- `statSync` - Synchronous stat
- `lstatSync` - Synchronous lstat
- `unlinkSync` - Synchronous unlink
- `renameSync` - Synchronous rename
- `copyFileSync` - Synchronous copyFile
- `chmodSync` - Synchronous chmod
- `chownSync` - Synchronous chown
- `utimesSync` - Synchronous utimes
- `realpathSync` - Synchronous realpath
- `symlinkSync` - Synchronous symlink
- `readlinkSync` - Synchronous readlink
- `truncateSync` - Synchronous truncate
- `openSync` - Synchronous open
- `closeSync` - Synchronous close
- `mkdtempSync` - Synchronous mkdtemp
- `accessSync` - Synchronous access
- `existsSync` - Synchronous exists (deprecated but still exists)

### Callback-based API
While some functions support callbacks (like `readdir` and `readFile` in fs.js), the callback support is incomplete. All functions should support:
- Promise-based API (current)
- Callback-based API (fs(error, data) pattern)
- Synchronous API

### Additional Utilities
- `constants` - Additional constants beyond F_OK, R_OK, W_OK, X_OK:
  - `S_IFMT`, `S_IFREG`, `S_IFDIR`, `S_IFBLK`, etc. (file type masks)
  - `O_RDONLY`, `O_WRONLY`, `O_RDWR`, `O_CREAT`, etc. (open flags as numbers)
- Better flag constants (currently only string flags are exported)

### Error Handling
- Custom `fs` error classes (not just generic errors):
  - `FSWatcher` - For watch operations
  - Better error codes matching Node.js

---

## Priority for Implementation

### High Priority
1. **Synchronous versions** - Critical for compatibility with Node.js ecosystem
2. **Streams** (`createReadStream`, `createWriteStream`) - Essential for large files
3. **File descriptor operations** - Complete the file descriptor API
4. **fs.promises namespace** - Modern Node.js standard

### Medium Priority
5. **Modern APIs** (`cp`, `rm`, `opendir`) - Useful utilities
6. **Hard links** (`link`, `linkSync`) - Less common but part of core API
7. **Better callback support** - For full Node.js compatibility

### Low Priority
8. **Advanced file descriptor ops** (`readv`, `writev`) - Specialized use cases
9. **Additional constants** - Nice to have for completeness
10. **openAsBlob** - Very new API, lower compatibility requirement

---

## Notes

- The `makeSync()` function in `fs.js` attempts to auto-generate sync versions but relies on `globalThis.op_sync` which may not work correctly
- Some functions like `rmdir` use `RemoveAll` which is more aggressive than Node.js `rmdir` (should be `Remove` for single dir, `rm` for recursive)
- File watching implementation exists but may need EventEmitter integration
- Constants, flags, and modes are exported but may not match Node.js exactly

