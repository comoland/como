({ exit, env, setEnv, stdout, stdin, registerAlias, cwd, args, platform, suspense }) => {
    let promise;

    // EventEmitter.js
    class EventEmitter {
        constructor() {
            // Map eventName -> Array of listener objects {fn, once, original}
            this._events = new Map();
            this._maxListeners = EventEmitter.defaultMaxListeners;
        }

        // static default (similar to Node)
        static get defaultMaxListeners() {
            return 10;
        }

        // set/get max listeners
        setMaxListeners(n) {
            if (typeof n !== 'number' || n < 0 || !Number.isFinite(n)) {
                throw new TypeError('n must be a non-negative finite number');
            }
            this._maxListeners = n;
            return this;
        }

        getMaxListeners() {
            return this._maxListeners;
        }

        // internal: create listener array if missing
        _getListeners(event, create = false) {
            if (!this._events.has(event)) {
                if (!create) return undefined;
                this._events.set(event, []);
            }
            return this._events.get(event);
        }

        // add listener (append)
        on(event, fn) {
            return this.addListener(event, fn);
        }

        addListener(event, fn) {
            if (typeof fn !== 'function') throw new TypeError('listener must be a function');
            const list = this._getListeners(event, true);
            list.push({ fn, once: false, original: fn });

            // warn if too many listeners
            if (this._maxListeners > 0 && list.length > this._maxListeners) {
                // Use setTimeout to avoid throwing during construction and mimic Node's async warning
                setTimeout(() => {
                    if (list.length > this._maxListeners) {
                        console &&
                            console.warn &&
                            console.warn(
                                `(EventEmitter) Possible memory leak detected. ${
                                    list.length
                                } listeners added for event "${String(
                                    event
                                )}". Use emitter.setMaxListeners(n) to increase limit.`
                            );
                    }
                }, 0);
            }
            return this;
        }

        // add listener to front
        prependListener(event, fn) {
            if (typeof fn !== 'function') throw new TypeError('listener must be a function');
            const list = this._getListeners(event, true);
            list.unshift({ fn, once: false, original: fn });
            return this;
        }

        once(event, fn) {
            return this._addOnce(event, fn, false);
        }

        prependOnceListener(event, fn) {
            return this._addOnce(event, fn, true);
        }

        _addOnce(event, fn, prepend = false) {
            if (typeof fn !== 'function') throw new TypeError('listener must be a function');
            // We wrap the function so we can remove it after first call; keep reference to original
            const wrapper = (...args) => {
                this.removeListener(event, wrapper);
                return fn.apply(this, args);
            };
            const entry = { fn: wrapper, once: true, original: fn };
            const list = this._getListeners(event, true);
            if (prepend) list.unshift(entry);
            else list.push(entry);

            // warn if too many listeners
            if (this._maxListeners > 0 && list.length > this._maxListeners) {
                setTimeout(() => {
                    if (list.length > this._maxListeners) {
                        console &&
                            console.warn &&
                            console.warn(
                                `(EventEmitter) Possible memory leak detected. ${
                                    list.length
                                } listeners added for event "${String(
                                    event
                                )}". Use emitter.setMaxListeners(n) to increase limit.`
                            );
                    }
                }, 0);
            }
            return this;
        }

        // remove a specific listener (by original function or wrapper)
        removeListener(event, fn) {
            if (typeof fn !== 'function') throw new TypeError('listener must be a function');
            const list = this._getListeners(event, false);
            if (!list) return this;

            // filter out listeners whose fn === fn OR original === fn
            let changed = false;
            for (let i = list.length - 1; i >= 0; i--) {
                const li = list[i];
                if (li.fn === fn || li.original === fn) {
                    list.splice(i, 1);
                    changed = true;
                }
            }
            if (list.length === 0) this._events.delete(event);
            return this;
        }

        off(event, fn) {
            return this.removeListener(event, fn);
        }

        removeAllListeners(event) {
            if (event === undefined) {
                this._events.clear();
            } else {
                this._events.delete(event);
            }
            return this;
        }

        // Returns copy of listener functions (not internal objects)
        listeners(event) {
            const list = this._getListeners(event, false) || [];
            return list.map(l => l.original || l.fn);
        }

        // Returns internal listener wrapper objects (for debugging)
        rawListeners(event) {
            const list = this._getListeners(event, false) || [];
            return list.slice(); // shallow copy
        }

        // count
        listenerCount(event) {
            const list = this._getListeners(event, false);
            return list ? list.length : 0;
        }

        // event names
        eventNames() {
            return Array.from(this._events.keys());
        }

        // emit: synchronous, returns true if event had listeners
        emit(event, ...args) {
            const list = this._getListeners(event, false);
            if (!list || list.length === 0) return false;

            // Make a shallow copy to allow listeners to be removed/added safely during emit.
            const listenersCopy = list.slice();

            // Call each listener in order
            for (let li of listenersCopy) {
                try {
                    li.fn.apply(this, args);
                } catch (err) {
                    // If an 'error' event is emitted and throws, follow Node convention: if no error listener, throw.
                    if (event === 'error') {
                        // rethrow to surface the error
                        throw err;
                    } else {
                        // Emit 'error' event with this error, if any listeners present
                        // Avoid infinite recursion if error event handlers also throw.
                        if (this.listenerCount('error') > 0) {
                            try {
                                this.emit('error', err);
                            } catch (e) {
                                // If error handler throws, rethrow outer error
                                throw e;
                            }
                        } else {
                            // No 'error' listeners -> rethrow
                            throw err;
                        }
                    }
                }
            }
            return true;
        }

        // convenience: emit asynchronously (calls setImmediate / setTimeout(0) fallback)
        emitAsync(event, ...args) {
            const hasImmediate = typeof setImmediate === 'function';
            const fn = () => this.emit(event, ...args);
            if (hasImmediate) setImmediate(fn);
            else setTimeout(fn, 0);
            return this;
        }

        // alias for compatibility
        addEventListener(event, fn) {
            return this.on(event, fn);
        }
        removeEventListener(event, fn) {
            return this.off(event, fn);
        }

        // inspect
        toString() {
            return `[EventEmitter events=${this.eventNames().join(',')}]`;
        }
    }

    // Export for CommonJS & ES modules
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = EventEmitter;
    } else {
        // attach to window/global for browser
        if (typeof window !== 'undefined') window.EventEmitter = EventEmitter;
        if (typeof globalThis !== 'undefined') globalThis.EventEmitter = EventEmitter;
    }

    class STDIN extends EventEmitter {
        isTTY = true;
        _on;
        _once;
        constructor() {
            super();
            this._on = this.on.bind(this);
            this._once = this.once.bind(this);

            this.on = (event, ...args) => {
                this._on(event, ...args);
                if (event === "data") {
                    stdin(data => {
                        this.emit('data', Buffer.from(data));
                        this.removeListener(event, ...args);
                        this.on(event, ...args);
                    });
                }
            };

            this.once = (...args) => {
                this._once(...args);
                stdin(data => {
                    this.emit('data', Buffer.from(data));
                    this.removeListener(...args);
                    this.once(...args);
                });
            };
        }
    }

    const queueMicrotask = (cb, ...args) =>
        (promise || (promise = Promise.resolve()))
            .then(() => cb(...args))
            .catch(err =>
                setTimeout(() => {
                    throw err;
                }, 0)
            );

    var performance = globalThis.performance || {};
    var performanceNow =
        performance.now ||
        function () {
            return new Date().getTime();
        };

    // generate timestamp or delta
    // see http://nodejs.org/api/process.html#process_process_hrtime
    function hrtime(previousTimestamp) {
        var clocktime = performanceNow.call(performance) * 1e-3;
        var seconds = Math.floor(clocktime);
        var nanoseconds = Math.floor((clocktime % 1) * 1e9);
        if (previousTimestamp) {
            seconds = seconds - previousTimestamp[0];
            nanoseconds = nanoseconds - previousTimestamp[1];
            if (nanoseconds < 0) {
                seconds--;
                nanoseconds += 1e9;
            }
        }
        return [seconds, nanoseconds];
    }

    const envProxy = new Proxy(env(), {
        get(target, prop) {
            return target[prop];
        },
        set(target, prop, val) {
            // to intercept property writing
            setEnv(String(prop), String(val));
            target[prop] = String(val);
            return true;
        }
    });

    class Process {
        argv = args();

        exit(num) {
            exit(num);
        }

        stdout = {
            isTTY: true,
            write: stdout
        };

        stdin = new STDIN();

        hrtime = hrtime;
        nextTick = queueMicrotask;
        suspense = suspense;
        env = envProxy;

        registerAlias(...args) {
            registerAlias(...args);
        }

        on() {}

        cwd() {
            return cwd();
        }

        get platform() {
            const _platform = platform();
            if (_platform === 'windows') {
                return 'win32';
            }

            return _platform;
        }

        constructor() {}
    }

    globalThis.process = new Process();
    globalThis.EventEmitter = EventEmitter;
};
