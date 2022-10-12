import { suite, assert } from '../mod';

const test = suite('bundle');

test('nested async functions', async () => {
    const file = Como.path.resolve(import.meta.dir, '../fixtures/bundle.ts')
    try {
        const ret = await Como.build.bundle(file, {
            minify: true,
            plugins: [{
                name: 'env',
                setup: (build) => {
                    build.onResolve({ filter: `^env$` }, (o) => {
                        return {
                            path: o.path,
                            namespace: 'env',
                            external: false
                        }
                    })

                    build.onLoad({ filter: `^env$`, namespace: 'env' }, (o) => {
                        return {
                            contents: `export const env = {  ret: 'Hi from bundle' }`
                        }
                    })
                }
            }]
        })

        const code = eval(`${ret[0].content}`);
        assert.equal(ret[0].path, '/bundle.js');
        assert.equal(code, 'Hi from bundle');
    } catch(e) {
        assert.ok(false)
    }
});

test.run();
