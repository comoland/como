import { exit, env, setEnv, stdout, stdin, registerAlias, cwd, args, platform, suspense } from 'process.go'
import EventEmitter from 'events';
let promise;

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
    _destroied = false;
    constructor() {
        super();
        this._on = this.on.bind(this);
        this._once = this.once.bind(this);

        this.on = (event, ...args) => {
            this._on(event, ...args);
            if (event === 'data') {
                if (this._destroied) {
                    return;
                }

                const asy = stdin(data => {
                    this.emit('data', Buffer.from(data));
                    this.removeListener(event, ...args);
                    this.on(event, ...args);
                });

                this.destroy = () => {
                    asy.resolve();
                    this._destroied = true;
                };
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
export default globalThis.process;
