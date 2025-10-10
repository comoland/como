import { colors, expect, assert, sleep, timeThis, promiso } from '../test/mod';
export { sleep, assert, expect, timeThis, promiso }
/* eslint-disable no-console */

type TestFunction = (ctx: { expect: typeof expect; assert: typeof assert }) => Promise<any> | any;
export const test = (name: string, fn: TestFunction, options?: { timeout?: number }) => {
    describe("X", async ({ test }) => {
        test(name, fn, options)
    })
};

test.only = test;
test.skip = test;

type ITest = {
    name: string;
    id: number;
    status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
    duration: number;
    error?: Error;
    only?: boolean;
    fn: (...args: any[]) => Promise<any>;
    startTime: number;
};

let suites: Array<{ name: string; tests: ITest[] }> = [];

const write = (str: string) => {
    process.stdout.write(str);
};

let timer: any = null;
let GLOBAL_PARALL_TESTS = Number(process.env.TEST_PARALLEL ?? 1);

export function run(parallel = GLOBAL_PARALL_TESTS) {
    const onlySuites = suites
        .filter(s => s.tests.find(t => t.only))
        .map(s => {
            return { name: s.name, tests: s.tests.filter(t => t.only) };
        });

    if (onlySuites.length) {
        suites = onlySuites;
    }

    let totalTests = suites.map((suite) => suite.tests).flat();
    let runningTests = totalTests.filter((t) => t.status === "running")
    let totalTestsToRun = totalTests.filter((t) => t.status === "pending")
    let failedTests = totalTests.filter((t) => t.status === "error")

    let runningTestsCounter = runningTests.length;

    const handleTestRun = (test: ITest, error?: Error) => {
        if (error) {
            test.error = error;
            test.status = 'error';
        } else {
            test.status = 'done';
        }

        test.duration = Date.now() - test.startTime;
        if (totalTestsToRun.length > 0) {
            process.nextTick(run);
        }
    };

    for (let suite of suites) {
        for (let test of suite.tests) {
            if (test.status !== 'pending') {
                continue;
            }

            if (runningTestsCounter >= parallel) {
                break;
            }

            test.status = 'running';
            ++runningTestsCounter;
            test.startTime = Date.now();
            test.duration = 0;
            test.fn({ expect, assert })
                .then(() => {
                    handleTestRun(test);
                })
                .catch((w: any) => {
                    handleTestRun(test, w);
                });
        }
    }

    if (timer) {
        clearInterval(timer);
    }

    timer = setInterval(() => {
        write('\x1Bc');

        for (let suite of suites) {
            const tests = suite.tests.filter((t) => t)
            if (!tests.length) {
                continue
            }

            if (suite.name !== "X") {
                write('='.repeat(50) + '\n');
                write(colors.bgBlue(' Suite: ' + suite.name + '\n'));
                write('='.repeat(50) + '\n');
            } else {
                write('*'.repeat(50) + '\n');
            }


            for (let test of tests) {
                write('\n');
                if (test.status === 'skipped') {
                    write('[ 0 ]');
                    write(colors.gray(colors.strikethrough('Skipped'.padStart(10, ' ').padEnd(15, ' '))));
                } else if (test.status === 'pending') {
                    write('[ ⏳ ]');
                    write(colors.gray('Pending'.padStart(10, ' ').padEnd(15, ' ')));
                } else if (test.status === 'running') {
                    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(Date.now() / 100) % 10];
                    write('[ ' + spinner + ' ]');
                    write('Running'.padStart(10, ' ').padEnd(15, ' '));
                } else if (test.status === 'done') {
                    write('[ 🟢 ]');
                    write(colors.green('Done'.padStart(10, ' ').padEnd(15, ' ')));
                } else if (test.status === 'error') {
                    write('[ 🔴 ]');
                    write(colors.red('Error'.padStart(10, ' ').padEnd(15, ' ')));
                }

                if (test.status === 'running') {
                    const runningTime = Date.now() - test.startTime;
                    write(` ` + colors.bgYellow(`[ ${String(runningTime).padStart(6, ' ').padEnd(6, ' ') + 'ms'} ]`));
                } else if (test.status === 'done' || test.status === 'error') {
                    write(` [ ${test.duration}ms ]`);
                } else {
                    write(`[ ${String('0').padStart(6, ' ').padEnd(6, ' ')}ms ]`);
                }

                write('.'.repeat(10) + ' ' + test.name);

                if (test.error) {
                    write('\n\t');
                    console.log(test.error);

                    const {details, message, ...rest} = (test.error ?? {}) as any
                    if (details) {
                        console.log(details)
                    }

                    console.log(JSON.parse(JSON.stringify(rest)))
                }
            }

            write('\n');
        }

        write('\n');

        console.log({ totalTests: totalTests.length, runningTests: runningTests.length, totalTestsToRun: totalTestsToRun.length, failedTests: failedTests.length });
        if (totalTestsToRun.length === 0 && runningTests.length === 0) {
            clearInterval(timer);
            process.exit(0);
        }
    }, 150);
}

export async function describe(
    name: string,
    fn: (ctx: {
        test: typeof test;
        assert: typeof assert;
        expect: typeof expect;
    }) => Promise<void>
) {
    let _id = 0;
    const tests: any[] = [];
    const test = function (this: any, name: string, testFn: TestFunction, options?: { timeout?: number }) {
        options = options ?? { timeout: 5000 };
        const binds = this || {};
        const fnCopy = testFn;
        const fn = async (ctx: any) => {
            return new Promise(async (resolve, reject) => {
                setTimeout(() => {
                    reject(new Error('timedout'));
                }, options.timeout);

                if ((fnCopy as any).then) {
                    return fnCopy(ctx)
                        .then(resolve)
                        .catch((e: any) => reject(e));
                } else {
                    try {
                        const ret = fnCopy(ctx);
                        resolve(ret)
                    } catch (e) {
                        reject(e)
                    }
                }

            });
        };

        tests.push({ name, fn, id: _id++, status: 'pending', ...binds });
    };

    test.only = test.bind({ only: true });
    test.skip = test.bind({ status: 'skipped' });

    await fn({ test, assert, expect });
    suites.push({
        name,
        tests
    });

    process.nextTick(run);
}
