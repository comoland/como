import { colors, expect, assert, sleep, timeThis, promiso } from '../test/mod';
export { sleep, assert, expect, timeThis, promiso }
/* eslint-disable no-console */

type TestFunction = (ctx: { expect: typeof expect; assert: typeof assert, done: () => void }) => Promise<any> | any;
export const test = (name: string, fn: TestFunction, options?: { timeout?: number }) => {
    describe("X", async ({ test }) => {
        test(name, fn, options)
    })
};

test.only = test;
test.skip = test;


const clearLastLine = (num = 1) => {
    process.stdout.write(`\x1b[${num}A`); // Move cursor up one line
    process.stdout.write('\x1b[2K'); // Clear the entire line
};

type ITest = {
    name: string;
    id: number;
    status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
    duration: number;
    error?: Error;
    only?: boolean;
    suiteName?: string;
    reported?: boolean;
    fn: (...args: any[]) => Promise<any>;
    startTime: number;
};

let suites: Array<{ name: string; tests: ITest[] }> = [];

const write = (str: string) => {
    process.stdout.write(str);
};

let GLOBAL_PARALL_TESTS = Number(process.env.TEST_PARALLEL ?? 1);
let allTestsFinished = false;
const startTime = Date.now()
let tim: any = null;
let currentRunningTests : ITest[] = [];

const statuses = {
    done: {
        symbol: () => colors.green('✓'),
    },
    error: {
        symbol: () => colors.red('✗'),
    },
    pending: {
        symbol: () => colors.red('|'),
    },
    running: {
        symbol: () => colors.cyan( ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(Date.now() / 100) % 10]),
    },
    skipped: {
        symbol: () => colors.gray('⊘'),
    }
}

function printTestResult(test: ITest) {
    let formatTestName = colors.white(test.name)
    let suiteName =  test.suiteName ? colors.gray(` ${test.suiteName} > `) : ' ';

    if (test.status === "skipped") {
        formatTestName = colors.gray().strikethrough(test.name)
    } else if (test.status === "running") {
        formatTestName = colors.gray(test.name)
    }

    let duration = test.status === "skipped" || test.status === "running" ? '' : colors.gray(` (${test.duration}ms)`);

    write(` ${statuses[test.status].symbol()}` + suiteName + formatTestName + duration + '\n');

    if (test.error) {
        write('\n');
        const errorMessage = test.error.message || String(test.error);
        write(colors.red('    ' + errorMessage) + '\n');

        const {details, message, ...rest} = (test.error ?? {}) as any;
        if (details) {
            write(colors.gray('    Details: ' + JSON.stringify(details, null, 2)) + '\n');
        }

        const restKeys = Object.keys(rest);
        if (restKeys.length > 0 && restKeys.some(k => k !== 'stack')) {
            write(colors.gray('    ' + JSON.stringify(rest, null, 2)) + '\n');
        }

        if ((test.error as any).stack) {
            const stackLines = (test.error as any).stack.split('\n').slice(1, 4);
            stackLines.forEach((line: string) => {
                write(colors.gray('      ' + line.trim()) + '\n');
            });
        }
        write('\n');
    }
}

function printFinalSummary() {
    const totalTests = suites.map((suite) => suite.tests).flat();
    const passedTests = totalTests.filter((t) => t.status === "done");
    const failedTests = totalTests.filter((t) => t.status === "error");
    const skippedTests = totalTests.filter((t) => t.status === "skipped");
    const totalDuration = Date.now() - startTime;

    write('\n' + '─'.repeat(70) + '\n');
    write(colors.bold('\nTest Summary:\n'));
    write(`  Total:    ${totalTests.length}\n`);
    write(`  ${colors.green('✓ Passed:')}  ${passedTests.length}\n`);

    if (failedTests.length > 0) {
        write(`  ${colors.red('✗ Failed:')}  ${failedTests.length}\n`);
    }

    if (skippedTests.length > 0) {
        write(`  ${colors.gray('⊘ Skipped:')} ${skippedTests.length}\n`);
    }

    write(`  Duration: ${totalDuration}ms\n\n`);

    if (failedTests.length > 0) {
        write(colors.red('Tests failed!\n\n'));
        process.exit(1);
    } else {
        write(colors.green('All tests passed!\n\n'));
        process.exit(0);
    }
}

export function run(parallel = GLOBAL_PARALL_TESTS) {
    if (allTestsFinished) {
        return;
    }

    const onlySuites = suites
        .filter(s => s.tests.find(t => t.only))
        .map(s => {
            return { name: s.name, tests: s.tests.filter(t => t.only) };
        });

    if (onlySuites.length) {
        suites = onlySuites;
    }

    let totalTests = suites.map((suite) => suite.tests).flat();
    let runningTests = totalTests.filter((t) => t.status === "running");
    let runningTestsCounter = runningTests.length;

    const clearRunning = () => {
        if (tim) clearInterval(tim)
        currentRunningTests.forEach(() => {
            clearLastLine()
        })
    }

    const printRunning = () => {
        currentRunningTests.forEach((test) => {
            printTestResult(test);
        })

        if (tim) clearInterval(tim);
        tim = setInterval(() => {
            currentRunningTests.forEach(() => {
                clearLastLine()
            })

            currentRunningTests.forEach((test) => {
                printTestResult(test);
            })
        }, 250);
    }

    const handleTestRun = (test: ITest, error?: Error) => {
        if (error) {
            test.error = error;
            test.status = 'error';
        } else {
            test.status = 'done';
        }

        test.duration = Date.now() - test.startTime;

        // Recalculate after this test finishes
        const allTests = suites.map((suite) => suite.tests).flat();
        const stillRunning = allTests.filter((t) => t.status === "running");
        const stillPending = allTests.filter((t) => t.status === "pending");

        clearRunning();

        // Print result immediately
        printTestResult(test);

        printRunning();

        if (stillPending.length > 0) {
            process.nextTick(run);
        } else if (stillRunning.length === 0) {
            // All tests done
            allTestsFinished = true;
            printFinalSummary();
        }
    };

    clearRunning();
    for (let suite of suites) {
        for (let test of suite.tests) {
            if (test.status !== 'pending' && test.status !== "skipped") {
                continue;
            }

            if (runningTestsCounter >= parallel) {
                break;
            }

            if (test.status === "skipped") {
                if (test.reported) {
                    continue;
                }

                test.reported = true;
                printTestResult(test);
                continue;
            }

            test.status = 'running';
            ++runningTestsCounter;
            test.startTime = Date.now();
            test.duration = 0;

            currentRunningTests.push(test);
            let error: any = null
            test.fn({ expect, assert })
                .catch((err: any) => {
                    error = err;
                }).finally(() => {
                    const previousRunning = currentRunningTests.length;
                    currentRunningTests = currentRunningTests.filter((t) => t !== test);
                    if (previousRunning - currentRunningTests.length === 1) {
                        clearLastLine();
                    }

                    handleTestRun(test, error);
                });
        }
    }

    printRunning()
}

export async function describe(
    name: string,
    fn: (ctx: {
        test: typeof test;
        assert: typeof assert;
        expect: typeof expect;
    }) => Promise<void>
) {

    let suiteName = name;
    let _id = 0;
    const tests: any[] = [];
    const test = function (this: any, name: string, testFn: TestFunction, options?: { timeout?: number }) {
        const binds = this || {};
        const fnCopy = testFn;
        const fn = async (ctx: any) => {
            const p = promiso();
            let promise = Promise.resolve();

            const done = () => {
                p.resolve()
            }

            ctx.done = done;
            const proxiedObject = new Proxy(ctx, {
                get: function(target: any, prop: any, receiver: any) {
                    if (prop === 'done') {
                        promise= p.promise;
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });

            return new Promise(async (resolve, reject) => {
                const t = setTimeout(() => {
                    reject(new Error('timedout'));
                }, options?.timeout ?? 5000);

                try {
                    await fnCopy(proxiedObject);
                    await promise;
                    resolve(null)
                } catch (e) {
                    reject(e);
                } finally {
                    clearTimeout(t)
                }
            });
        };

        tests.push({ name, fn, id: _id++, status: 'pending', duration: 0, startTime: 0, suiteName, ...binds });
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
