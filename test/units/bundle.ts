import { suite, assert } from '../mod';

const test = suite('bundle');

test('bundle', async () => {
    const file = Como.path.resolve(import.meta.dir, '../fixtures/bundle.ts');
    try {
        const ret = await Como.build.bundle('', {
            entryPoints: [file],
            minify: true,
            plugins: [
                {
                    name: 'env',
                    setup: build => {
                        build.onResolve({ filter: `^env$` }, o => {
                            return {
                                path: o.path,
                                namespace: 'env',
                                external: false
                            };
                        });

                        build.onLoad({ filter: `^env$`, namespace: 'env' }, o => {
                            return {
                                contents: `export const env = {  ret: 'Hi from bundle' }`
                            };
                        });
                    }
                }
            ]
        });

        const code = eval(`${ret[0].content}`);
        assert.equal(ret[0].path, '/bundle.js');
        assert.equal(code, 'Hi from bundle');
    } catch (e) {
        console.log(e);
        assert.ok(false);
    }
});

test('bundle stdin', async () => {
    try {
        const ret = await Como.build.bundle('', {
            stdin: {
                contents: `
                import { env as ENV } from 'env';
                import { env as ENV2 } from 'env2';
                (function() {
                    return {
                        bundle1: ENV.ret,
                        bundle2: ENV2.ret
                    };
                })();
                `
            },
            minify: true,
            plugins: [
                {
                    name: 'env',
                    setup: build => {
                        build.onResolve({ filter: `^env$` }, o => {
                            return {
                                path: o.path,
                                namespace: 'env',
                                external: false
                            };
                        });

                        build.onLoad({ filter: `^env$`, namespace: 'env' }, o => {
                            return {
                                contents: `export const env = {  ret: 'Hi from bundle 1' }`
                            };
                        });

                        build.onResolve({ filter: `^env2$` }, o => {
                            return {
                                path: o.path,
                                namespace: 'env2',
                                external: false
                            };
                        });

                        build.onLoad({ filter: `^env2$`, namespace: 'env2' }, o => {
                            return {
                                contents: `export const env = {  ret: 'Hi from bundle 2' }`
                            };
                        });
                    }
                }
            ]
        });

        const code = eval(`${ret[0].content}`);
        assert.equal(ret[0].path, '/stdin.js');
        assert.equal(code.bundle1, 'Hi from bundle 1');
        assert.equal(code.bundle2, 'Hi from bundle 2');
    } catch (e) {
        console.log(e);
        assert.ok(false);
    }
});

test('bundle multiple resolvers', async () => {
    const file = Como.path.resolve(import.meta.dir, '../fixtures/bundle.ts');
    try {
        const ret = await Como.build.bundle('', {
            entryPoints: [file],
            stdin: {
                contents: `
                    import { env } from 'env2';
                    (function() {
                        return env.ret;
                    })();
                `
            },
            minify: true,
            plugins: [
                {
                    name: 'env',
                    setup: build => {
                        build.onResolve({ filter: `^env$` }, o => {
                            return {
                                path: o.path,
                                namespace: 'env',
                                external: false
                            };
                        });

                        build.onLoad({ filter: `^env$`, namespace: 'env' }, o => {
                            return {
                                contents: `export const env = {  ret: 'Hi from file' }`
                            };
                        });

                        build.onResolve({ filter: `^env2$` }, o => {
                            return {
                                path: o.path,
                                namespace: 'env2',
                                external: false
                            };
                        });

                        build.onLoad({ filter: `^env2$`, namespace: 'env2' }, o => {
                            return {
                                contents: `export const env = {  ret: 'Hi from stdin' }`
                            };
                        });
                    }
                }
            ]
        });

        const code = eval(`${ret[0].content}`);
        assert.equal(ret[0].path, '/stdin.js');
        assert.equal(code, 'Hi from stdin');

        const code2 = eval(`${ret[1].content}`);
        assert.equal(ret[1].path, '/bundle.js');
        assert.equal(code2, 'Hi from file');
    } catch (e) {
        console.log(e);
        assert.ok(false);
    }
});

test.run();
