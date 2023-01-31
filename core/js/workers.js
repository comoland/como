() => {
    const getFilePath = url => {
        const err = new Error();
        let stack = err.stack.split('\n');
        stack = stack[2];

        return stack.replace(/.*?\((.*?):\w+\)/, '$1');
    };

    globalThis.Como.createWorker = (fn, options = { pool: 1 }) => {
        const filename = getFilePath();
        const workerCode = ` /* 1 */    (async () => {
                const _workerFunction = ${fn.toString()}
                Como.onMessage(async ({ messageId, data }) => {
                    try {
                        const ret = await _workerFunction(data);
                        Como.postMessage({ messageId, error: null, data: ret });
                    } catch (err) {
                        Como.postMessage({ messageId, error: { message: err.message, stack: err.stack }, data: null });
                    }
                })
            })();
        `;

        let _messageId = 0;
        const generateNewMessageId = () => ++_messageId;

        const _pool = [];
        const _inProgress = [];
        const _tasks = {};
        const _queue = [];
        let pool = options.pool || 1;

        if (typeof pool !== 'number' || pool < 1) {
            throw new Error('pool must be a number greater than 0');
        }

        const createWorker = () => {
            const worker = Como.worker(
                workerCode,
                args => {
                    const { messageId, error, data } = args;
                    const task = _tasks[messageId];

                    if (task) {
                        if (error) {
                            let { stack, message } = error;
                            if (stack) {
                                let stop = false;
                                stack.split('\n').forEach(line => {
                                    if (stop) {
                                        return;
                                    }

                                    if (line.includes('_workerFunction')) stop = true;
                                    if (line.replace(/.*?\((.*?):\w+\)/, '$1') === filename) {
                                        const num = line.replace(/.*?\(.*?:(\w+)\)/, '$1');
                                        stack = stack + `\n (at) ===> ${workerCode.split('\n')[parseInt(num) - 1]}`;
                                    }
                                });
                            }

                            const err = new Error(message);
                            err.stack = stack;
                            task.reject(err);
                        } else {
                            task.resolve(data);
                        }
                    }

                    if (_queue.length > 0) {
                        const nextTask = _queue.shift();
                        worker.postMessage(nextTask);
                    } else {
                        _inProgress.splice(_inProgress.indexOf(worker), 1);
                        _pool.push(worker);
                    }
                },
                {
                    isCode: true,
                    filename
                }
            );

            return worker;
        };

        for (let i = 0; i < pool; i++) {
            const worker = createWorker();
            _pool.push(worker);
        }

        return {
            terminate: () => {
                _pool.forEach(w => w.terminate());
                _inProgress.forEach(w => w.terminate());
            },
            exec: async data => {
                const messageId = generateNewMessageId();
                const worker = _pool.shift();
                return new Promise((resolve, reject) => {
                    _tasks[messageId] = {
                        resolve,
                        reject
                    };

                    if (!worker) {
                        _queue.push({
                            messageId,
                            data
                        });
                    } else {
                        worker.postMessage({
                            messageId,
                            data
                        });

                        _inProgress.push(worker);
                    }
                });
            }
        };
    };

    globalThis.Como.asyncWorker = fn => {
        const filename = getFilePath();
        const workerCode = `
            (async () => {
                try {
                    const fn = ${fn.toString()}
                    const ret = await fn();
                    Como.postMessage({ret});
                } catch (err) {
                    Como.postMessage({err: {message: err.message, stack: err.stack}});
                }
            })();
        `;

        let _resolve, _reject;
        const promise = new Promise((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
        });

        const worker = Como.worker(
            workerCode,
            data => {
                if (data.err) {
                    _reject(data.err);
                } else {
                    _resolve(data.ret);
                }
                worker.terminate();
            },
            {
                isCode: true,
                filename
            }
        );

        return promise;
    };
};
