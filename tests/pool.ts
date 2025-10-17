export const Semaphore = (maxConcurrentRequests = 1) => {
    let currentRequests: any[] = [];
    let runningRequests = 0;

    const tryRun = async () => {
        if (runningRequests >= maxConcurrentRequests) {
            return;
        }

        const first = currentRequests.shift();
        if (first) {
            try {
                runningRequests++;
                const r = await first.fn();
                first.resolve(r);
            } catch (e: any) {
                first.reject(e);
            }
        }
    };

    return {
        aquire: async <T extends any>(fn: () => Promise<T>) => {
            return new Promise<T>((resolve, reject) => {
                currentRequests.push({
                    resolve,
                    reject,
                    fn
                });

                tryRun();
            });
        },
        release: async (cb?: any) => {
            runningRequests--;
            if (cb) {
                await cb();
            }
            tryRun();
        },
        running() {
            return runningRequests;
        }
    };
};

export const poolManager = async <T extends any>(
    maxConcurrentRequests: number,
    fn: () => Promise<T>
) => {
    const clients: Array<Awaited<T>> = [];
    const sema = Semaphore(maxConcurrentRequests);

    const acquire = async () => {
        return sema.aquire(async () => {
            const m = clients.pop();
            if (m) {
                return m;
            } else {
                const m = await fn();
                clients.push(m);
                return m;
            }
        });
    };

    const release = async (m: Awaited<T>) => {
        await sema.release();
        clients.push(m);
    };

    const run = async <R extends any>(fn: (client: T) => Promise<R>) => {
        const c = await acquire();
        return fn(c).finally(async () => {
            await release(c);
        });
    };

    return {
        run,
        release,
        acquire
    };
};
