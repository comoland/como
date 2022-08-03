(_timeout, _unref) => {
    class Timeout {
        refed = true;
        args = [];
        trigger() {
            if (this.refed) {
                this.cb.call(this, ...this.args)
                if (this.isRepeat && this.refed) {
                    _timeout(this.trigger, this.timeout)
                }
            }

            return this.refed;
        }

        unref() {
            this.refed = false;
            delete this.cb;
            delete this.args;
            _unref();
        }

        constructor(cb, timeout, args, isRepeat) {
            this.cb = cb;
            this.args = args;
            this.timeout = timeout;
            this.isRepeat = isRepeat;
            this.trigger = this.trigger.bind(this)
            _timeout(this.trigger, timeout)
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
            handle.unref()
        }
    }

    globalThis.clearInterval = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.unref()
        }
    }
}
