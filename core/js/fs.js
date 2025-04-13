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

    // Export all methods
    _exports.read = read;
    _exports.write = write;
    _exports.append = append;
    _exports.mkdir = mkdir;
    _exports.readdir = readdir;
    _exports.stat = stat;
    _exports.unlink = unlink;
    _exports.rmdir = rmdir;
    _exports.rename = rename;
    _exports.copyFile = copyFile;
    _exports.chmod = chmod;
    _exports.chown = chown;
    _exports.utimes = utimes;
    _exports.realpath = realpath;
    _exports.exists = exists;
    _exports.access = access;
    _exports.readlink = readlink;
    _exports.symlink = symlink;
    _exports.lstat = lstat;
    _exports.truncate = truncate;
    _exports.ftruncate = ftruncate;
    _exports.open = open;
    _exports.close = close;
    _exports.readFile = readFile;
    _exports.writeFile = writeFile;
    _exports.appendFile = appendFile;
    _exports.mkdtemp = mkdtemp;

    // Export constants
    _exports.constants = constants;
    _exports.flags = flags;
    _exports.modes = modes;

    // Export synchronous versions
    _exports.readFileSync = (path, options) => {
        const ret = readFile(path, options);
        if (options && options.encoding) {
            return Buffer.from(ret).toString(options.encoding);
        }
        return Buffer.from(ret);
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

    _exports.copyFileSync = (src, dest, flags) => {
        return copyFile(src, dest, flags);
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

    _exports.realpathSync = (path, options) => {
        return realpath(path, options);
    };

    _exports.existsSync = (path) => {
        return exists(path);
    };

    _exports.accessSync = (path, mode) => {
        return access(path, mode);
    };

    _exports.readlinkSync = (path, options) => {
        return readlink(path, options);
    };

    _exports.symlinkSync = (target, path, type) => {
        return symlink(target, path, type);
    };

    _exports.truncateSync = (path, len) => {
        return truncate(path, len);
    };

    _exports.ftruncateSync = (fd, len) => {
        return ftruncate(fd, len);
    };

    _exports.openSync = (path, flags, mode) => {
        return open(path, flags, mode);
    };

    _exports.closeSync = (fd) => {
        return close(fd);
    };

    _exports.mkdtempSync = (prefix, options) => {
        return mkdtemp(prefix, options);
    };

    return _exports;
};