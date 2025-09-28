({
    _exports,
    watch,
    read,
    write,
    append,
    mkdir,
    readdir,
    stat,
    unlink,
    rmdir,
    rename,
    copyFile,
    chmod,
    chown,
    utimes,
    realpath,
    exists,
    access,
    readlink,
    symlink,
    lstat,
    truncate,
    ftruncate,
    open,
    close,
    readFile,
    writeFile,
    appendFile,
    mkdtemp
}) => {
    // File system constants
    const constants = {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1
    };

    // File system flags
    const flags = {
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
    const modes = {
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

    // Export all methods with promise handling
    // _exports.read = async (file) => await read(file);
    // _exports.write = async (file, data) => await write(file, data);
    // _exports.append = async (file, data) => await append(file, data);
    // _exports.mkdir = async (path, mode) => await mkdir(path, mode);
    _exports.stat = async (path) => {
        const st = await stat(path)
        return {
            ...st,
            isFile: () => st.isDir === false,
            isDirectory: () => st.isDir
        }
    };
    // _exports.unlink = async (path) => await unlink(path);
    // _exports.rmdir = async (path) => await rmdir(path);
    // _exports.rename = async (oldPath, newPath) => await rename(oldPath, newPath);
    // _exports.copyFile = async (src, dst) => await copyFile(src, dst);
    // _exports.chmod = async (path, mode) => await chmod(path, mode);
    // _exports.chown = async (path, uid, gid) => await chown(path, uid, gid);
    // _exports.utimes = async (path, atime, mtime) => await utimes(path, atime, mtime);
    // _exports.realpath = async (path) => await realpath(path);
    _exports.exists = async (path) => await exists(path);
    // _exports.access = async (path, mode) => await access(path, mode);
    // _exports.readlink = async (path) => await readlink(path);
    // _exports.symlink = async (target, path) => await symlink(target, path);
    _exports.lstat = async (path) => await lstat(path);
    // _exports.truncate = async (path, size) => await truncate(path, size);
    // _exports.ftruncate = async (fd, size) => await ftruncate(fd, size);
    // _exports.open = async (path, flags, mode) => await open(path, flags, mode);
    // _exports.close = async (fd) => await close(fd);
    // _exports.appendFile = async (path, data) => await appendFile(path, data);
    // _exports.mkdtemp = async (prefix) => await mkdtemp(prefix);

    _exports.watch = (path, cb) => {
        const ev = new EventEmitter()
        if (typeof cb === "function") {
            const origCB = cb.bind()
            cb = (...args) => {
                ev.emit('change', ...args);
                origCB(...args)
            }
        }

        const watcher = watch(path, cb);
        ev.close = watcher.close;
        return ev
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

        const promise = readdir(path, opts).then(entries => {
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

        const promise = readFile(path).then(data => {
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

        const promise = writeFile(file, data, opts).then(() => {
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

    // Export constants
    _exports.constants = constants;
    _exports.flags = flags;
    _exports.modes = modes;

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
    return _exports;
};
