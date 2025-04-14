({ _exports, METHODS, STATUS_CODES, createServer, request, get }) => {
    // Export constants
    _exports.METHODS = METHODS;
    _exports.STATUS_CODES = STATUS_CODES;

    // Create HTTP Server
    _exports.createServer = (requestListener) => {
        const server = createServer(requestListener);
        return server;
    };

    // Create HTTP Request
    _exports.request = (options, callback) => {
        const req = request(options, callback);
        return req;
    };

    // Create HTTP GET Request
    _exports.get = (options, callback) => {
        const req = get(options, callback);
        return req;
    };

    // Create HTTP Agent class
    class Agent {
        constructor(options = {}) {
            this.options = options;
            this.sockets = {};
            this.requests = {};
            this.maxSockets = options.maxSockets || Infinity;
            this.maxFreeSockets = options.maxFreeSockets || 256;
        }

        getName(options) {
            let name = options.host || 'localhost';
            if (options.port) {
                name += ':' + options.port;
            }
            if (options.localAddress) {
                name += ':' + options.localAddress;
            }
            return name;
        }

        createConnection(options, callback) {
            // TODO: Implement socket creation
            callback(null, null);
        }

        keepSocketAlive(socket) {
            // TODO: Implement socket keep-alive
        }

        reuseSocket(socket, request) {
            // TODO: Implement socket reuse
        }

        destroy() {
            // TODO: Implement agent destruction
        }
    }

    // Export Agent class
    _exports.Agent = Agent;

    // Create default Agent
    _exports.globalAgent = new Agent();

    // Create HTTP Server class
    class Server {
        constructor(requestListener) {
            this.server = createServer(requestListener);
        }

        listen(port, hostname, backlog, callback) {
            if (typeof hostname === 'function') {
                callback = hostname;
                hostname = undefined;
            }
            if (typeof backlog === 'function') {
                callback = backlog;
                backlog = undefined;
            }

            this.server.listen(port, callback);
            return this;
        }

        close(callback) {
            this.server.close(callback);
            return this;
        }

        setTimeout(msecs, callback) {
            // TODO: Implement server timeout
            if (callback) {
                callback();
            }
            return this;
        }
    }

    // Export Server class
    _exports.Server = Server;

    // Create HTTP ClientRequest class
    class ClientRequest {
        constructor(options, callback) {
            this.req = request(options, callback);
        }

        write(chunk, encoding, callback) {
            this.req.write(chunk);
            if (callback) {
                callback();
            }
            return this;
        }

        end(chunk, encoding, callback) {
            this.req.end(chunk);
            if (callback) {
                callback();
            }
            return this;
        }

        abort() {
            // TODO: Implement request abort
            return this;
        }

        setTimeout(timeout, callback) {
            // TODO: Implement request timeout
            if (callback) {
                callback();
            }
            return this;
        }

        setNoDelay(noDelay) {
            // TODO: Implement no delay
            return this;
        }

        setSocketKeepAlive(enable, initialDelay) {
            // TODO: Implement keep alive
            return this;
        }
    }

    // Export ClientRequest class
    _exports.ClientRequest = ClientRequest;

    // Create HTTP ServerResponse class
    class ServerResponse {
        constructor() {
            this.statusCode = 200;
            this.statusMessage = 'OK';
            this.headers = {};
            this.headersSent = false;
            this._data = [];
        }

        writeHead(statusCode, statusMessage, headers) {
            if (typeof statusMessage === 'object') {
                headers = statusMessage;
                statusMessage = undefined;
            }

            this.statusCode = statusCode;
            if (statusMessage) {
                this.statusMessage = statusMessage;
            }

            if (headers) {
                for (const [key, value] of Object.entries(headers)) {
                    this.setHeader(key, value);
                }
            }

            this.headersSent = true;
            return this;
        }

        write(chunk, encoding, callback) {
            this._data.push(chunk);
            if (callback) {
                callback();
            }
            return true;
        }

        end(chunk, encoding, callback) {
            if (chunk) {
                this._data.push(chunk);
            }

            // Write all buffered data
            const data = this._data.join('');
            this._data = [];

            if (callback) {
                callback();
            }
            return this;
        }

        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
            return this;
        }

        getHeader(name) {
            return this.headers[name.toLowerCase()];
        }

        removeHeader(name) {
            delete this.headers[name.toLowerCase()];
            return this;
        }

        hasHeader(name) {
            return name.toLowerCase() in this.headers;
        }

        getHeaderNames() {
            return Object.keys(this.headers);
        }

        getHeaders() {
            return { ...this.headers };
        }
    }

    // Export ServerResponse class
    _exports.ServerResponse = ServerResponse;

    // Create HTTP IncomingMessage class
    class IncomingMessage {
        constructor() {
            this.headers = {};
            this.rawHeaders = [];
            this.httpVersion = '1.1';
            this.method = 'GET';
            this.url = '';
            this.statusCode = 200;
            this.statusMessage = 'OK';
        }

        getHeader(name) {
            return this.headers[name.toLowerCase()];
        }

        getHeaderNames() {
            return Object.keys(this.headers);
        }

        getHeaders() {
            return { ...this.headers };
        }

        hasHeader(name) {
            return name.toLowerCase() in this.headers;
        }
    }

    // Export IncomingMessage class
    _exports.IncomingMessage = IncomingMessage;

    return _exports;
};