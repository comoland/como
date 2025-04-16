import { writeFileSync } from 'fs'

const ret = await Como.build.bundle('', {
    stdin: {
        resolveDir: '.',
        contents: `
            import { URL } from './core/js/polyfills/url.js';
            import 'fastestsmallesttextencoderdecoder-encodeinto';

            import { Buffer } from 'buffer/';

            globalThis.Buffer = Buffer;
            globalThis.URL = URL;
        `
    },
    target: Como.build.target.ESNext,
    bundle: true,
    minify: true,
    plugins: []
});

const polyfillFile = Como.path.resolve('./core/js', 'polyfills.js');

const code = `
globalThis.global = globalThis;
${ret[0].content}
`;

writeFileSync(polyfillFile, code);
