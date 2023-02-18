() => {
    const getFilePath = url => {
        const err = new Error();
        let stack = err.stack.split('\n');
        stack = stack[2];

        return stack.replace(/.*?\((.*?):\w+\)/, '$1');
    };

    globalThis.Como.createWorker = (fn, options = { pool: 1 }) => {
        const filename = getFilePath();

        let _messageId = 0;
        const generateNewMessageId = () => ++_messageId + '_worker';

        let _pool = [];
        let _inProgress = [];
        const _tasks = {};
        const _queue = [];
        let pool = options.pool || 1;

        if (typeof pool !== 'number' || pool < 1) {
            throw new Error('pool must be a number greater than 0');
        }

        const createWorker = () => {
            const workerId = generateNewMessageId();
            const workerCode = ` /* 1 */    (async () => {
                    const workerId = ${JSON.stringify(workerId)};
                    process.exit = (status) => {
                        globalThis.postMessage({ workerId, action: { exit: status } });
                        // throw new Error('exit');
                    }
                    const _workerFunction = ${fn.toString()}
                    globalThis.onmessage = async ({ messageId, data }) => {
                        try {
                            const ret = await _workerFunction(data);
                            globalThis.postMessage({ workerId, messageId, error: null, data: ret });
                        } catch (err) {
                            globalThis.postMessage({ workerId, messageId, error: { message: err.message, stack: err.stack }, data: null });
                        }
                    }
                })();
            `;

            const worker = Como.worker2(
                workerCode,
                args => {
                    const { messageId, error, data, workerId, action } = args;

                    const task = _tasks[messageId];
                    delete _tasks[messageId];

                    if (action && typeof action.exit === 'number') {
                        console.log('got exit message from worker', workerId, action.exit);
                        [..._inProgress, ..._pool].forEach(w => {
                            if (w.id === workerId) {
                                console.log('terminate worker', w.id);
                                w.terminate();
                                const err = new Error('terminated');
                                if (task) task.reject(err);
                            }
                        });
                        return;
                    }

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

            worker.id = workerId;
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
                _pool = [];
                _inProgress = [];
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
            globalThis.onmessage = () => {
                (async () => {
                    try {
                        const fn = ${fn.toString()}
                        const ret = await fn();
                        globalThis.postMessage({ret});
                    } catch (err) {
                        console.log("an error occured")
                        globalThis.postMessage({err: {message: err.message, stack: err.stack}});
                    }
                })();
            };
        `;

        let _resolve, _reject;
        const promise = new Promise((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
        });

        const worker = Como.worker2(
            workerCode,
            data => {
                if (data.err) {
                    _reject(data.err);
                } else {
                    _resolve(data.ret);
                }

                setTimeout(() => {
                    worker.terminate();
                });
            },
            {
                isCode: true,
                filename
            }
        );

        worker.postMessage('');

        return promise;
    };
};
