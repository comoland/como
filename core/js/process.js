({ exit, env, setEnv, stdout, registerAlias, cwd, args, platform, suspense }) => {
    let promise;

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
        set(target, prop, val) { // to intercept property writing
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

        hrtime = hrtime;
        nextTick = queueMicrotask;
        suspense = suspense;
        env = envProxy;

        registerAlias(...args) {
            registerAlias(...args);
        }

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
};
