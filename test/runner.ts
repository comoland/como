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

let GLOBAL_PARALL_TESTS = Number(process.env.TEST_PARALLEL ?? 10);
let allTestsFinished = false;

function printResults() {
    const totalTests = suites.map((suite) => suite.tests).flat();
    const passedTests = totalTests.filter((t) => t.status === "done");
    const failedTests = totalTests.filter((t) => t.status === "error");
    const skippedTests = totalTests.filter((t) => t.status === "skipped");
    const totalDuration = totalTests.reduce((sum, t) => sum + (t.duration || 0), 0);

    write('\n');
    write(colors.bgBlue(' TEST RESULTS '));
    write('\n');
    write('═'.repeat(70) + '\n');

    for (let suite of suites) {
        const tests = suite.tests.filter((t) => t)
        if (!tests.length) {
            continue
        }

        if (suite.name !== "X") {
            write('\n' + colors.bold(colors.cyan('Suite: ' + suite.name)) + '\n');
            write('─'.repeat(70) + '\n');
        }

        for (let test of tests) {
            if (test.status === 'skipped') {
                write('  ⊘ ' + colors.gray(colors.strikethrough(test.name)));
            } else if (test.status === 'done') {
                write('  ✓ ' + colors.green(test.name));
            } else if (test.status === 'error') {
                write('  ✗ ' + colors.red(test.name));
            }

            if (test.status === 'done' || test.status === 'error') {
                write(colors.gray(` (${test.duration}ms)`));
            }

            write('\n');

            if (test.error) {
                write('\n');
                write(colors.red('    Error: '));
                const errorMessage = test.error.message || String(test.error);
                write(colors.red(errorMessage) + '\n');

                const {details, message, ...rest} = (test.error ?? {}) as any;
                if (details) {
                    write(colors.gray('    Details: ' + JSON.stringify(details, null, 2)) + '\n');
                }

                const restKeys = Object.keys(rest);
                if (restKeys.length > 0 && restKeys.some(k => k !== 'stack')) {
                    write(colors.gray('    ' + JSON.stringify(rest, null, 2)) + '\n');
                }

                if ((test.error as any).stack) {
                    write(colors.gray('    Stack:\n'));
                    const stackLines = (test.error as any).stack.split('\n').slice(1, 4);
                    stackLines.forEach((line: string) => {
                        write(colors.gray('      ' + line.trim()) + '\n');
                    });
                }
                write('\n');
            }
        }
    }

    write('═'.repeat(70) + '\n');
    write('\n');
    write(colors.bold('Summary:\n'));
    write(`  Total:   ${totalTests.length}\n`);
    write(`  ${colors.green('Passed:')}  ${passedTests.length}\n`);
    if (failedTests.length > 0) {
        write(`  ${colors.red('Failed:')}  ${failedTests.length}\n`);
    }
    if (skippedTests.length > 0) {
        write(`  ${colors.gray('Skipped:')} ${skippedTests.length}\n`);
    }
    write(`  Duration: ${totalDuration}ms\n`);
    write('\n');

    if (failedTests.length > 0) {
        write(colors.red('✗ Tests failed\n'));
        process.exit(1);
    } else {
        write(colors.green('✓ All tests passed\n'));
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

        if (stillPending.length > 0) {
            process.nextTick(run);
        } else if (stillRunning.length === 0) {
            // All tests done
            allTestsFinished = true;
            printResults();
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
                }).finally(() => {
                });
        }
    }
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
        const binds = this || {};
        const fnCopy = testFn;
        const fn = async (ctx: any) => {
            if ((fnCopy as any).then) {
                return fnCopy(ctx);
            } else {
                try {
                    return fnCopy(ctx);
                } catch (e) {
                    throw e;
                }
            }
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
