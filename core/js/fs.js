({ _exports, read, write, append, mkdir, readdir, stat, unlink, rmdir, rename, copyFile, chmod, chown, utimes, realpath, exists, access, readlink, symlink, lstat, truncate, ftruncate, open, close, readFile, writeFile, appendFile, mkdtemp }) => {
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
    // _exports.readdir = async (path) => await readdir(path);
    // _exports.stat = async (path) => await stat(path);
    // _exports.unlink = async (path) => await unlink(path);
    // _exports.rmdir = async (path) => await rmdir(path);
    // _exports.rename = async (oldPath, newPath) => await rename(oldPath, newPath);
    // _exports.copyFile = async (src, dst) => await copyFile(src, dst);
    // _exports.chmod = async (path, mode) => await chmod(path, mode);
    // _exports.chown = async (path, uid, gid) => await chown(path, uid, gid);
    // _exports.utimes = async (path, atime, mtime) => await utimes(path, atime, mtime);
    // _exports.realpath = async (path) => await realpath(path);
    // _exports.exists = async (path) => await exists(path);
    // _exports.access = async (path, mode) => await access(path, mode);
    // _exports.readlink = async (path) => await readlink(path);
    // _exports.symlink = async (target, path) => await symlink(target, path);
    // _exports.lstat = async (path) => await lstat(path);
    // _exports.truncate = async (path, size) => await truncate(path, size);
    // _exports.ftruncate = async (fd, size) => await ftruncate(fd, size);
    // _exports.open = async (path, flags, mode) => await open(path, flags, mode);
    // _exports.close = async (fd) => await close(fd);
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

        const promise = readFile(path).then((data) => {
            const buffer = Buffer.from(data)
            if (enc) {
                return buffer.toString(enc)
            }

            return buffer;
        });

        if (callback) {
            try {
                callback(null, await promise)
            } catch (err) {
                callback(err.message, null)
            }

            return;
        }

        return promise;
    };

    // _exports.writeFile = async (path, data) => await writeFile(path, data);
    // _exports.appendFile = async (path, data) => await appendFile(path, data);
    // _exports.mkdtemp = async (prefix) => await mkdtemp(prefix);

    // Export constants
    _exports.constants = constants;
    _exports.flags = flags;
    _exports.modes = modes;

    // Export synchronous versions
    _exports.readFileSync = (path, options) => {
        let ret = null;
        let error = null;
        process.suspense(async (unsuspense) => {
            try {
                ret = await _exports.readFile(path, options);
            } catch (e) {
                error = e;
            } finally {
                unsuspense()
            }
        });

        if (error) {
            throw error;
        }

        return ret;
    };

    _exports.writeFileSync = (path, data, options) => {
        return writeFile(path, data, options);
    };

    _exports.appendFileSync = (path, data, options) => {
        return appendFile(path, data, options);
    };

    _exports.readdirSync = (path, options) => {
        return readdir(path, options);
    };

    _exports.mkdirSync = (path, options) => {
        return mkdir(path, options);
    };

    _exports.statSync = (path) => {
        return stat(path);
    };

    _exports.lstatSync = (path) => {
        return lstat(path);
    };

    _exports.unlinkSync = (path) => {
        return unlink(path);
    };

    _exports.rmdirSync = (path) => {
        return rmdir(path);
    };

    _exports.renameSync = (oldPath, newPath) => {
        return rename(oldPath, newPath);
    };

    _exports.copyFileSync = (src, dst) => {
        return copyFile(src, dst);
    };

    _exports.chmodSync = (path, mode) => {
        return chmod(path, mode);
    };

    _exports.chownSync = (path, uid, gid) => {
        return chown(path, uid, gid);
    };

    _exports.utimesSync = (path, atime, mtime) => {
        return utimes(path, atime, mtime);
    };

    _exports.realpathSync = (path) => {
        return realpath(path);
    };

    _exports.existsSync = (path) => {
        return exists(path);
    };

    _exports.accessSync = (path, mode) => {
        return access(path, mode);
    };

    _exports.readlinkSync = (path) => {
        return readlink(path);
    };

    _exports.symlinkSync = (target, path) => {
        return symlink(target, path);
    };

    _exports.truncateSync = (path, size) => {
        return truncate(path, size);
    };

    _exports.ftruncateSync = (fd, size) => {
        return ftruncate(fd, size);
    };

    _exports.openSync = (path, flags, mode) => {
        return open(path, flags, mode);
    };

    _exports.closeSync = (fd) => {
        return close(fd);
    };

    _exports.mkdtempSync = (prefix) => {
        return mkdtemp(prefix);
    };

    return _exports;
};