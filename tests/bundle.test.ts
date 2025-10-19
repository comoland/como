import { describe, assert } from './runner';
import path from 'path';
import * as esbuild from 'como/build';

describe("bundle basics", async ({ test }) => {
    test('bundle', async () => {
        const file = path.resolve(import.meta.dir, './fixtures/bundle.ts');
        console.log({ file })
        const ret = await esbuild.build({
            entryPoints: [file],
            bundle: true,
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
    });

    test('bundle stdin', async () => {
        const ret = await esbuild.build({
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
            bundle: true,
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
    });

    test('bundle multiple resolvers', async () => {
        const file = Como.path.resolve(import.meta.dir, './fixtures/bundle.ts');
        const ret = await esbuild.build({
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
            bundle: true,
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
    });
})
