import * as binding from 'fs.go';
// import EventEmitter from 'events';
const _exports = Object.assign({}, binding);

// File system constants - get from native layer
const _constants = _exports.constants = binding.constants() || {};

_exports.stat = async path => {
    const st = await binding.stat(path);
    return {
        ...st,
        isFile: () => st.isDir === false,
        isDirectory: () => st.isDir
    };
};

_exports.watch = (path, cb) => {
    const ev = new EventEmitter();
    if (typeof cb === 'function') {
        const origCB = cb.bind();
        cb = (...args) => {
            ev.emit('change', ...args);
            origCB(...args);
        };
    }

    const watcher = binding.watch(path, cb);
    ev.close = watcher.close;
    return ev;
};

_exports.readdir = async (path, options, cb) => {
    let callback = cb;
    let opts = {};

    // Handle different argument patterns
    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        opts = options;
    } else if (typeof options === 'string') {
        opts.encoding = options;
    }

    // Default options
    const defaultOpts = {
        encoding: 'utf8',
        withFileTypes: false,
        recursive: false
    };

    // Merge options with defaults
    opts = { ...defaultOpts, ...opts };

    const promise = binding.readdir(path, opts).then(entries => {
        // If withFileTypes is true, return the entries as is
        if (opts.withFileTypes) {
            return entries;
        }

        // If recursive is true, return the entries as is
        if (opts.recursive) {
            return entries;
        }

        // Otherwise, just return the names
        return entries;
    });

    if (callback) {
        try {
            callback(null, await promise);
        } catch (err) {
            callback(err.message);
        }
        return;
    }

    return promise;
};

_exports.readFile = async (path, options, cb) => {
    let callback = cb;
    let enc = null;

    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        enc = options.encoding;
    } else {
        enc = options;
    }

    const promise = binding.readFile(path).then(data => {
        const buffer = Buffer.from(data);
        if (enc) {
            return buffer.toString(enc);
        }

        return buffer;
    });

    if (callback) {
        try {
            callback(null, await promise);
        } catch (err) {
            callback(err.message, null);
        }

        return;
    }

    return promise;
};

_exports.writeFile = async (file, data, options, cb) => {
    let callback = cb;
    let opts = {};

    // Handle different argument patterns
    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        opts = options;
    } else if (typeof options === 'string') {
        opts.encoding = options;
    }

    // Default options
    const defaultOpts = {
        encoding: 'utf8',
        mode: 0o666,
        flag: 'w',
        flush: false
    };

    // Merge options with defaults
    opts = { ...defaultOpts, ...opts };

    // Convert data to buffer if it's a string
    if (typeof data === 'string') {
        data = Buffer.from(data, opts.encoding);
    }

    const promise = binding.writeFile(file, data, opts).then(() => {
        return undefined; // writeFile returns void
    });

    if (callback) {
        try {
            await promise;
            callback(null);
        } catch (err) {
            callback(err.message);
        }
        return;
    }

    return promise;
};

// Add wrappers for new operations
_exports.fstat = async (fd, options, cb) => {
    let callback = cb;
    let opts = {};

    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        opts = options;
    }

    const promise = binding.fstat(fd);

    if (callback) {
        try {
            const st = await promise;
            callback(null, {
                ...st,
                isFile: () => st.isDir === false,
                isDirectory: () => st.isDir
            });
        } catch (err) {
            callback(err);
        }
        return;
    }

    const st = await promise;
    return {
        ...st,
        isFile: () => st.isDir === false,
        isDirectory: () => st.isDir
    };
};

_exports.fchmod = async (fd, mode, cb) => {
    const promise = binding.fchmod(fd, mode);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.fchown = async (fd, uid, gid, cb) => {
    const promise = binding.fchown(fd, uid, gid);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.futimes = async (fd, atime, mtime, cb) => {
    const promise = binding.futimes(fd, atime, mtime);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.ftruncate = async (fd, len, cb) => {
    const promise = binding.ftruncate(fd, len);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.fsync = async (fd, cb) => {
    const promise = binding.fsync(fd);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.fdatasync = async (fd, cb) => {
    const promise = binding.fdatasync(fd);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.readv = async (fd, buffers, cb) => {
    const promise = binding.readv(fd, buffers);
    if (typeof cb === 'function') {
        try {
            cb(null, await promise);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.writev = async (fd, buffers, cb) => {
    const promise = binding.writev(fd, buffers);
    if (typeof cb === 'function') {
        try {
            cb(null, await promise);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.link = async (existingPath, newPath, cb) => {
    const promise = binding.link(existingPath, newPath);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.lchown = async (path, uid, gid, cb) => {
    const promise = binding.lchown(path, uid, gid);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.lutimes = async (path, atime, mtime, cb) => {
    const promise = binding.lutimes(path, atime, mtime);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.lchmod = async (path, mode, cb) => {
    const promise = binding.lchmod(path, mode);
    if (typeof cb === 'function') {
        try {
            await promise;
            cb(null);
        } catch (err) {
            cb(err);
        }
        return;
    }
    return promise;
};

_exports.cp = async (src, dest, options, cb) => {
    let callback = cb;
    let opts = {};

    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        opts = options;
    }

    const promise = binding.cp(src, dest, opts);

    if (callback) {
        try {
            await promise;
            callback(null);
        } catch (err) {
            callback(err);
        }
        return;
    }

    return promise;
};

_exports.rm = async (path, options, cb) => {
    let callback = cb;
    let opts = {};

    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        opts = options;
    }

    const promise = binding.rm(path, opts);

    if (callback) {
        try {
            await promise;
            callback(null);
        } catch (err) {
            callback(err);
        }
        return;
    }

    return promise;
};

_exports.opendir = async (path, options, cb) => {
    let callback = cb;
    let opts = {};

    if (typeof options === 'function') {
        callback = options;
    } else if (typeof options === 'object') {
        opts = options;
    }

    const promise = binding.opendir(path, opts);

    if (callback) {
        try {
            callback(null, await promise);
        } catch (err) {
            callback(err);
        }
        return;
    }

    return promise;
};

// Helper function to convert string flags to numeric flags
// Uses constants from native layer
function stringToFlags(flagStr) {
    if (typeof flagStr !== 'string') {
        return flagStr; // Assume it's already a number
    }

    // Get constants from native layer
    const c = _constants;
    if (!c) {
        // Fallback to O_RDONLY if constants not available
        return 0;
    }

    // Map Node.js flag strings to flag combinations using constants
    switch (flagStr) {
        case 'r':
            return c.O_RDONLY || 0;
        case 'rs':
            return (c.O_RDONLY || 0) | (c.O_SYNC || 0);
        case 'r+':
            return c.O_RDWR || 0;
        case 'rs+':
            return (c.O_RDWR || 0) | (c.O_SYNC || 0);
        case 'w':
            return (c.O_WRONLY || 0) | (c.O_CREAT || 0) | (c.O_TRUNC || 0);
        case 'wx':
            return (c.O_WRONLY || 0) | (c.O_CREAT || 0) | (c.O_TRUNC || 0) | (c.O_EXCL || 0);
        case 'w+':
            return (c.O_RDWR || 0) | (c.O_CREAT || 0) | (c.O_TRUNC || 0);
        case 'wx+':
            return (c.O_RDWR || 0) | (c.O_CREAT || 0) | (c.O_TRUNC || 0) | (c.O_EXCL || 0);
        case 'a':
            return (c.O_WRONLY || 0) | (c.O_CREAT || 0) | (c.O_APPEND || 0);
        case 'ax':
            return (c.O_WRONLY || 0) | (c.O_CREAT || 0) | (c.O_APPEND || 0) | (c.O_EXCL || 0);
        case 'a+':
            return (c.O_RDWR || 0) | (c.O_CREAT || 0) | (c.O_APPEND || 0);
        case 'ax+':
            return (c.O_RDWR || 0) | (c.O_CREAT || 0) | (c.O_APPEND || 0) | (c.O_EXCL || 0);
        case 'as':
            return (c.O_WRONLY || 0) | (c.O_CREAT || 0) | (c.O_APPEND || 0) | (c.O_SYNC || 0);
        case 'as+':
            return (c.O_RDWR || 0) | (c.O_CREAT || 0) | (c.O_APPEND || 0) | (c.O_SYNC || 0);
        default:
            // Default to read-only
            return c.O_RDONLY || 0;
    }
}

// Wrap open function with defaults
_exports.open = async (...args) => {
    const [path, flags, mode, cb] = args;

    // Handle different argument patterns
    let callback = cb;
    let actualFlags = flags;
    let actualMode = mode;

    // If only 2 arguments and second is a function, it's the callback
    if (args.length === 2 && typeof flags === 'function') {
        callback = flags;
        actualFlags = 'r'; // default: read-only
        actualMode = 0o666; // default mode
    }

    // If 3 arguments and third is a function, it's the callback
    else if (args.length === 3 && typeof mode === 'function') {
        callback = mode;
        actualMode = 0o666; // default mode
        // flags already set
    }

    // If flags not provided, default to 'r'
    else if (actualFlags === undefined || actualFlags === null) {
        actualFlags = 'r';
    }

    // Convert string flags to numeric if needed
    if (typeof actualFlags === 'string') {
        actualFlags = stringToFlags(actualFlags);
    }

    // Default mode if not provided
    if (actualMode === undefined || actualMode === null) {
        actualMode = 0o666;
    }

    const promise = binding.open(path, actualFlags, actualMode);

    if (callback) {
        try {
            callback(null, await promise);
        } catch (err) {
            callback(err);
        }
        return;
    }

    return promise;
};

// FileHandle class
const fileHandleId = Symbol('filehandle.id');

export class FileHandle {
    constructor(fd) {
        if (typeof fd !== 'number') {
            throw new TypeError('FileHandle: fd must be a number');
        }

        this.fd = fd;
        this[fileHandleId] = binding.createFileHandle(fd);
        Object.defineProperty(this, "fd", { configurable: false, writable: false });
    }

    get _id() {
        return this[fileHandleId]
    }

    async read(buffer, offset, length, position) {
        if (Buffer.isBuffer(buffer)) {
            buffer = buffer;
        } else if (typeof buffer === "object") {
            offset = buffer.offset;
            length = buffer.length;
            position = buffer.position;
            buffer = buffer.buffer;
        }

        if (buffer && !Buffer.isBuffer(buffer)) {
            throw new TypeError('FileHandle.read: buffer must be a Buffer');
        }

        // Use unified read operation with string handle ID
        const result = await binding.read(this._id, buffer, offset, length, position);
        return result;
    }

    async write(buffer, offset, length, position) {
        if (!Buffer.isBuffer(buffer)) {
            throw new TypeError('FileHandle.write: buffer must be a Buffer');
        }
        // Use unified write operation with string handle ID
        const result = await binding.write(this._id, buffer, offset, length, position);
        return result;
    }

    async stat() {
        // Use unified fstat operation with string handle ID
        const st = await binding.fstat(this._id);
        return {
            ...st,
            isFile: () => st.isDir === false,
            isDirectory: () => st.isDir
        };
    }

    async chmod(mode) {
        if (typeof mode !== 'number') {
            throw new TypeError('FileHandle.chmod: mode must be a number');
        }
        // Use unified fchmod operation with string handle ID
        await binding.fchmod(this._id, mode);
    }

    async chown(uid, gid) {
        if (typeof uid !== 'number' || typeof gid !== 'number') {
            throw new TypeError('FileHandle.chown: uid and gid must be numbers');
        }
        // Use unified fchown operation with string handle ID
        await binding.fchown(this._id, uid, gid);
    }

    async truncate(len = 0) {
        if (typeof len !== 'number') {
            throw new TypeError('FileHandle.truncate: len must be a number');
        }
        // Use unified ftruncate operation with string handle ID
        await binding.ftruncate(this._id, len);
    }

    async utimes(atime, mtime) {
        if (typeof atime !== 'number' || typeof mtime !== 'number') {
            throw new TypeError('FileHandle.utimes: atime and mtime must be numbers');
        }
        // Use unified futimes operation with string handle ID
        await binding.futimes(this._id, atime, mtime);
    }

    async sync() {
        // Use unified fsync operation with string handle ID
        await binding.fsync(this._id);
    }

    async datasync() {
        // Use unified fdatasync operation with string handle ID
        await binding.fdatasync(this._id);
    }

    async close() {
        await binding.fileHandleClose(this._id);
    }
}

// synchronous versions
const makeSync = () => {
    Object.entries(_exports).forEach(([key, value]) => {
        if (typeof value === 'function') {
            key = `${key}Sync`;
            _exports[key] = (...args) => {
                let ret = null;
                let error = null;

                const prom = new Promise(async (resolve, reject) => {
                    try {
                        ret = await value(...args);
                        resolve(ret)
                    } catch (err) {
                        reject(err)
                    }
                })

                return globalThis.op_sync(prom);
            };
        }
    });
};

makeSync();

export default _exports;
globalThis.NamedExports = _exports;
