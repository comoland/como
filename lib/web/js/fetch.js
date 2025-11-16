var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];
function normalizeMethod(method) {
    var upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method;
}

const _fetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
    const [req, opt] = args;
    if (req instanceof Request) {
        const { url, ...rest } = req;
        return fetch(url, {
            ...rest
        });
    }

    if (opt && opt.headers && opt.headers instanceof Headers) {
        const headers = {};
        for await (const v of opt.headers.entries()) {
            const [key, value] = v;
            headers[key] = value;
        }

        opt.headers = headers;
    }

    if (opt && opt.body) {
        if (opt.body instanceof URLSearchParams) {
            opt.body = Buffer.from(opt.body.toString());
        }
    }

    return _fetch(req, opt);
};
