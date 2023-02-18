_timeout => {
    class Timeout {
        _cleared = false;
        args = [];
        trigger() {
            if (this._cleared) {
                return;
            }

            this.cb.call(this, ...this.args);

            /* we check if cleared here because the callback could have cleared it */
            if (this.isRepeat && !this._cleared) {
                this.again();
            }

            if (!this.isRepeat && this._cleared === false) {
                this.clear();
            }
        }

        clear() {
            if (this._cleared) {
                return;
            }

            this._cleared = true;
            delete this.cb;
            delete this.args;
            this.unref();
        }

        constructor(cb, timeout, args, isRepeat) {
            this.cb = cb;
            this.args = args;
            this.timeout = timeout;
            this.isRepeat = isRepeat;
            this.trigger = this.trigger.bind(this);
            this.again = _timeout(this);
        }
    }

    const _timeouts = {};

    globalThis.setTimeout = function setTimeout(cb, timeout, ...args) {
        return new Timeout(cb, timeout, args, false);
    };

    globalThis.setTimeout2 = function setTimeout(cb, timeout, ...args) {
        const nextTimeout = Date.now() + timeout;
        const old = _timeouts[nextTimeout];
        delete _timeouts[nextTimeout];
        _timeouts[nextTimeout] = () => {
            cb.call(this, ...args);
            if (old) {
                process.nextTick(old);
            }
        };

        // return new Timeout(cb, timeout, args, false);
    };

    globalThis.setInterval = function setInterval(cb, timeout, ...args) {
        return new Timeout(cb, timeout, args, true);
    };

    globalThis.setImmediate = function setInterval(cb, ...args) {
        return new Timeout(cb, 0, args, false);
    };

    globalThis.clearTimeout = function clearTimeout(handle) {
        if (handle instanceof Timeout) {
            handle.clear();
        }
    };

    globalThis.clearInterval = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.clear();
        }
    };

    globalThis.clearImmediate = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.clear();
        }
    };

    // let ticked = null
    // const ticker = () => {
    //     // const keys = Object.keys(_timeouts);
    //     // if (keys.length === 0 || ticked) return;

    //     ticked = setInterval(() => {
    //         const timeout = Date.now()
    //         Object.keys(_timeouts).forEach(_timeout => {
    //             if (_timeout < timeout) {
    //                 // console.log(_timeouts[_timeout])
    //                 _timeouts[_timeout]()
    //                 delete _timeouts[_timeout]
    //             }
    //         })
    //     }, 1)
    // }

    // ticker()
};
