(_timeout, _ref, _unref) => {
    class Timeout {
        _cleared = false
        args = [];
        trigger() {
            if (this._cleared) {
                return;
            }

            // might call clear() in cb
            this.cb.call(this, ...this.args);

            // we check if cleared here because the callback could have cleared it
            if (this.isRepeat && !this._cleared) {
                // _timeout(this.trigger, this.timeout)
                this.again()
            }

            if (!this.isRepeat && this._cleared === false) {
                _unref()
            }

            return this._cleared;
        }

        clear() {
            if (this._cleared) {
                return;
            }

            this._cleared = true;
            delete this.cb;
            delete this.args;
            _unref()
        }

        constructor(cb, timeout, args, isRepeat) {
            _ref()
            this.cb = cb;
            this.args = args;
            this.timeout = timeout;
            this.isRepeat = isRepeat;
            this.trigger = this.trigger.bind(this)
            this.again = _timeout(this.trigger, timeout)
        }
    }

    globalThis.setTimeout = function setTimeout(cb, timeout, ...args) {
        return new Timeout(cb, timeout, args, false)
    }

    globalThis.setInterval = function setInterval(cb, timeout, ...args) {
        return new Timeout(cb, timeout, args, true)
    }

    globalThis.setImmediate = function setInterval(cb, ...args) {
        return new Timeout(cb, 0, args, false)
    }

    globalThis.clearTimeout = function clearTimeout(handle) {
        if (handle instanceof Timeout) {
            handle.clear()
        }
    }

    globalThis.clearInterval = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.clear()
        }
    }

    globalThis.clearImmediate = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.clear()
        }
    }
}
