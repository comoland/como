({ exports, read }) => {
    exports.read = read;
    exports.readFileSync = (path, enc) => {
        const ret = read(path);
        if (enc) {
            return  Buffer.from(ret).toString(enc);
        }

        return Buffer.from(ret);
    };

    return exports;
};
