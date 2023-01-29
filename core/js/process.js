({ exit, env, stdout, registerAlias, cwd, args }) => {
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

        _env = null;
        get env() {
            if (!this._env) {
                this._env = env();
            }

            return this._env;
        }

        registerAlias(...args) {
            registerAlias(...args);
        }

        cwd() {
            return cwd();
        }

        constructor() {}
    }

    globalThis.process = new Process();
};
