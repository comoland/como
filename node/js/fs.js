import * as binding from 'fs.go';

// import EventEmitter from 'events';
const _exports = Object.assign({}, binding);

// File system constants
export const constants = {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
};

// File system flags
export const flags = {
    a: 'a',
    ax: 'ax',
    a_: 'a+',
    ax_: 'ax+',
    as: 'as',
    as_: 'as+',
    r: 'r',
    rx: 'rx',
    r_: 'r+',
    rx_: 'rx+',
    w: 'w',
    wx: 'wx',
    w_: 'w+',
    wx_: 'wx+'
};

// File system modes
export const modes = {
    S_IRUSR: 0o400,
    S_IWUSR: 0o200,
    S_IXUSR: 0o100,
    S_IRGRP: 0o40,
    S_IWGRP: 0o20,
    S_IXGRP: 0o10,
    S_IROTH: 0o4,
    S_IWOTH: 0o2,
    S_IXOTH: 0o1
};

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

// synchronous versions
const makeSync = () => {
    Object.entries(_exports).forEach(([key, value]) => {
        if (typeof value === 'function') {
            key = `${key}Sync`;
            _exports[key] = (...args) => {
                let ret = null;
                let error = null;
                process.suspense(async unsuspense => {
                    try {
                        ret = await value(...args);
                    } catch (e) {
                        error = e;
                    } finally {
                        unsuspense();
                    }
                });

                if (error) {
                    throw error;
                }

                return ret;
            };
        }
    });
};

makeSync();

export default _exports;
globalThis.NamedExports = _exports;
