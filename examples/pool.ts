export function pool<A extends Record<string, (data: any) => Promise<any>>>(worker: string, pool: number =1) {
    if (pool < 1) {
        throw new Error('pool size must be greater than 0')
    }

    let _messageId = 0;
    const generateNewMessageId = () => ++_messageId;

    const _pool : ReturnType<typeof Como.worker>[] = [];
    const _inProgress : ReturnType<typeof Como.worker>[] = [];

    const _tasks: any = {};
    const _queue: any = [];

    for (let i = 0; i < pool; i++) {
        const w = Como.worker(worker, (args) => {
            const { messageId, error, data } = args;
            const task = _tasks[messageId];
            if (task) {
                if (error) {
                    const err = new Error()
                    Object.assign(err, { message: error.message, stack: error.stack })
                    task.reject(err);
                } else {
                    task.resolve(data);
                }

                delete _tasks[messageId];
            }

            if (_queue.length > 0) {
                const  nextTask = _queue.shift();
                w.postMessage(nextTask);
            } else {
                _inProgress.splice(_inProgress.indexOf(w), 1);
                _pool.push(w)
            }
        })

        _pool.push(w);
    }

    const exec = async <T extends keyof A>(action: T, args: Parameters<A[T]>[0]) : Promise<Awaited<ReturnType<A[T]>>> => {
        const messageId = generateNewMessageId();
        const worker = _pool.shift();
        return new Promise((resolve, reject) => {
            _tasks[messageId] = {
                resolve,
                reject
            }

            if (!worker) {
                _queue.push({
                    messageId,
                    action,
                    data: args
                })
            } else {
                worker.postMessage({
                    messageId,
                    action,
                    data: args
                })

                _inProgress.push(worker)
            }
        })
    }

    return {
        exec,
        terminate: () => {
            _pool.forEach(w => w.terminate())
            _inProgress.forEach(w => w.terminate())
        }
    }
}

const actions :any = {}
if (typeof Como.onMessage === 'function') {
    Como.onMessage(({ messageId, action, data }) => {
        if (actions[action]) {
            actions[action](data).then((res: any) => {
                Como.postMessage({
                    messageId,
                    data: res
                });
            }).catch((error: any) => {
                Como.postMessage({
                    messageId,
                    error: { message: error.message, stack: error.stack },
                    data: null
                });
            })
        } else {
            Como.postMessage({
                messageId,
                error: { message: `Action ${action} not found` },
                data: null
            });
        }
    })
}

export function worker<T extends Record<string, (data: any) => Promise<any>>, E = keyof T>(name: E, action: T[keyof T]) {
    actions[name] = action;
}

export function workers<T extends Record<string, (data: any) => Promise<any>>>(obj: T)  {
    Object.assign(actions, obj)
    return {} as T
}

export interface Pool<T extends Record<string, (data: any) => Promise<any>>> extends ReturnType<typeof pool> {
    exec: <E extends keyof T>(action: E, args: Parameters<T[E]>[0]) => Promise<Awaited<ReturnType<T[E]>>>
}
