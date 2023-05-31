({ _exports, read }) => {
    _exports.read = read;
    _exports.readFileSync = (path, enc) => {
        const ret = read(path);
        if (enc) {
            return  Buffer.from(ret).toString(enc);
        }

        return Buffer.from(ret);
    };

    return _exports;
};
