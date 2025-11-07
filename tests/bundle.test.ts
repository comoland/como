import { describe, assert } from './runner';
import path from 'path';
import * as esbuild from 'como:build';

describe("bundle basics", async ({ test }) => {
    test('bundle', async () => {
        const file = path.resolve(import.meta.dir, './fixtures/bundle.ts');
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

    test('bundle with external dependencies', async () => {
        const ret = await esbuild.build({
            stdin: {
                contents: `
                    import { external } from 'external-module';
                    export default external;
                `
            },
            bundle: true,
            external: ['external-module'],
            plugins: [
                {
                    name: 'external-test',
                    setup: build => {
                        build.onResolve({ filter: `^external-module$` }, o => {
                            return {
                                path: o.path,
                                external: true
                            };
                        });
                    }
                }
            ]
        });

        assert.equal(ret[0].path, '/stdin.js');
        assert.ok(ret[0].content.includes('external-module'));
        assert.ok(!ret[0].content.includes('export const external'));
    });

    test('bundle with loader configuration', async () => {
        const ret = await esbuild.build({
            stdin: {
                contents: `
                    import data from './data.json';
                    module.exports = data
                `
            },
            bundle: true,
            minify: false,
            format: 2,
            loader: {
                '.json': esbuild.loader.json
            },
            plugins: [
                {
                    name: 'json-loader',
                    setup: build => {
                        build.onResolve({ filter: '\.json$' }, o => {
                            return {
                                path: o.path,
                                namespace: 'json',
                                external: false
                            };
                        });

                        build.onLoad({ filter: '\.json$', namespace: 'json' }, o => {
                            return {
                                contents: JSON.stringify({ message: 'Hello from JSON!' }),
                                loader: esbuild.loader.json
                            };
                        });
                    }
                }
            ]
        });

        const code = eval(`${ret[0].content}`);
        assert.equal(ret[0].path, '/stdin.js');
        assert.equal(code.message, 'Hello from JSON!');
    });

    test('bundle with plugin data passing', async () => {
        const ret = await esbuild.build({
            stdin: {
                contents: `
                    import { data } from 'data-plugin';
                    export default data;
                `
            },
            bundle: true,
            format: esbuild.format.commonjs,
            plugins: [
                {
                    name: 'data-plugin',
                    setup: build => {
                        build.onResolve({ filter: `^data-plugin$` }, o => {
                            return {
                                path: o.path,
                                namespace: 'data-plugin',
                                pluginData: { version: '1.0.0', source: 'test' }
                            };
                        });

                        build.onLoad({ filter: `^data-plugin$`, namespace: 'data-plugin' }, o => {
                            const pluginData = o.pluginData;
                            return {
                                contents: `export const data = {
                                    version: '${pluginData.version}',
                                    source: '${pluginData.source}',
                                    path: '${o.path}'
                                }`
                            };
                        });
                    }
                }
            ]
        });

        const code = eval(`${ret[0].content}`).default;
        assert.equal(ret[0].path, '/stdin.js');
        assert.equal(code.version, '1.0.0');
        assert.equal(code.source, 'test');
        assert.equal(code.path, 'data-plugin');
    });

    test('bundle with error handling', async () => {
        try {
            await esbuild.build({
                stdin: {
                    contents: `
                        import { invalid } from 'error-plugin';
                        export default invalid;
                    `
                },
                bundle: true,
                plugins: [
                    {
                        name: 'error-plugin',
                        setup: build => {
                            build.onResolve({ filter: `^error-plugin$` }, o => {
                                return {
                                    path: o.path,
                                    namespace: 'error-plugin'
                                };
                            });

                            build.onLoad({ filter: `^error-plugin$`, namespace: 'error-plugin' }, o => {
                                // Intentionally cause an error
                                throw new Error('Plugin error from onLoad for testing');
                            });
                        }
                    }
                ]
            });
            assert.ok(false, 'Should have thrown an error');
        } catch (error: any) {
            assert.ok(error.message.includes('Plugin error from onLoad for testing'));
        }
    });

    test('bundle with multiple entry points', async () => {
        const ret = await esbuild.build({
            entryPoints: [
                './tests/fixtures/bundle.ts',
                './tests/fixtures/bundle2.ts'
            ],
            bundle: true,
            plugins: [
                {
                    name: 'multi-entry',
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
                                contents: `export const env = { ret: 'Multi-entry test' }`
                            };
                        });
                    }
                }
            ]
        });

        assert.equal(ret.length, 2);
        assert.equal(ret[0].path, '/bundle.js');
        assert.equal(ret[1].path, '/bundle2.js');

        const code1 = eval(`${ret[0].content}`);
        const code2 = eval(`${ret[1].content}`);
        assert.equal(code1, 'Multi-entry test');
        assert.equal(code2, 'Multi-entry test');
    });

    test('bundle with source map', async () => {
        const ret = await esbuild.build({
            stdin: {
                contents: `
                    function test() {
                        return 'source map test';
                    }
                    export default test();
                `
            },
            bundle: true,
            sourcemap: esbuild.sourceMap.inline,
            plugins: []
        });

        assert.equal(ret[0].path, '/stdin.js');
        assert.ok(ret[0].content.includes('sourceMappingURL'));
        assert.ok(ret[0].content.includes('data:application/json'));
    });

    test('bundle with minification disabled', async () => {
        const ret = await esbuild.build({
            stdin: {
                contents: `
                    function   testFunction   (   )   {
                        const   message   =   '   unminified   test   ';
                        return   message;
                    }
                    export default testFunction();
                `
            },
            bundle: true,
            minify: false,
            plugins: []
        });

        assert.equal(ret[0].path, '/stdin.js');
        // Should preserve whitespace and formatting when minify is false
        assert.ok(ret[0].content.includes('   '));
        assert.ok(ret[0].content.includes('function testFunction()'));
    });
})
