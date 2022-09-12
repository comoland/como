(ref, unref, _timeout) => {
    // function timer(cb, timeout, isRepeat, ...args) {

    // }

    const _timers = {}
    let _id = 0
    let _tikcer = 1000000;

    class Timeout {
        trigger() {
            this.cb.call(this, ...this.args);
            if (!this.isRepeat) {
                this.clear();
            }

            return this;
        }

        clear(){
            if (!_timers[this.id]) {
                return;
            }

            // console.log(' numbers ========> ', Object.keys(_timers).length)

            delete _timers[this.id];
            // console.log(_timers)
            if (Object.keys(_timers).length === 0) {
                unref()
            }

            return this;
        }

        constructor(cb, timeout = 1, args, isRepeat) {
            if (timeout < 1) {
                timeout = 1
            }

            _id++;
            this.id = _id;
            this.cb = cb;
            this.args = args;
            this.timeout = timeout;
            this.expire = Date.now() + timeout;
            this.isRepeat = isRepeat;
            this.trigger = this.trigger.bind(this)

            if (timeout < _tikcer) {
                _tikcer = timeout;
                _timeout(_tikcer);
            }

            if (Object.keys(_timers).length === 0) {
                ref()
            }

            _timers[this.id] = this;
            return this
        }
    }

    globalThis.setTimeout = function(cb, timeout, ...args) {
        // ref()return new Timeout(cb, timeout, args, false)
        return new Timeout(cb, timeout, args, false)
    }

    globalThis.setInterval = function(cb, timeout, ...args) {
        // ref()return new Timeout(cb, timeout, args, false)
        return new Timeout(cb, timeout, args, true)
    }

    globalThis.setImmediate = function setInterval(cb, ...args) {
        return new Timeout(cb, 1, args, false)
    }

    globalThis.clearTimeout = function clearTimeout(handle) {
        if (handle instanceof Timeout) {
            handle.clear()
        }

        return handle;
    }

    globalThis.clearInterval = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.clear()
        }

        return handle;
    }

    globalThis.clearImmediate = function clearInterval(handle) {
        if (handle instanceof Timeout) {
            handle.clear()
        }

        return handle;
    }


    globalThis.__g = function(timeout) {
        // console.log('called')
        let _newTicker = 1000000000;
        Object.keys(_timers).forEach(key => {
            if (_timers[key].expire < Date.now()) {
                _timers[key].trigger()
            }

            if (_timers[key] && _timers[key].timeout < _newTicker) {
                _newTicker = _timers[key].timeout
            }
        })

        console.log('new ticker', _newTicker)

        if (_newTicker !== _tikcer) {
            _tikcer = _newTicker;
            _timeout(_tikcer);
        }


        // console.log('called', timeout)
    }

    return globalThis.__g;
}
