import { writeFileSync } from 'fs'

const ret = await Como.build.bundle('', {
    stdin: {
        resolveDir: '.',
        contents: `
            import 'fastestsmallesttextencoderdecoder-encodeinto';
            import { test, suite } from 'uvu';
            import * as assert from 'uvu/assert';

            globalThis.Como.suite = suite;
            globalThis.Como.test = test;
            globalThis.Como.assert = assert;
        `
    },
    target: Como.build.target.ESNext,
    bundle: true,
    minify: false,
    plugins: []
});

const polyfillFile = Como.path.resolve('./core/js', 'polyfills.js');

const code = `
globalThis.global = globalThis;
${ret[0].content}
`;

writeFileSync(polyfillFile, code);
