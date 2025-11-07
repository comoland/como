import fs from 'fs'
import esbuild from 'como:build';
import { path } from 'como';

const ret = await esbuild.build({
    // entryPoints: ["readable-stream"],
    stdin: {
        resolveDir: '.',
        contents: `
            const x = require('readable-stream');
            export * from 'readable-stream'
            export default x;
            export const Transform = x.Transform;
            export const Stream = x.Stream;
            export const Readable = x.Readable;
            export const Duplex = x.Duplex;
            export const Writable = x.Writable;
            export const PassThrough = x.PassThrough;
        `
    },
    target: esbuild.target.ESNext,
    // format: esbuild.format.commonjs,
    // platform: esbuild.platform.node,
    bundle: true,
    minify: false,
    external: [
        'process',
        'assert',
        'buffer',
        'child_process',
        'cluster',
        'crypto',
        'dgram',
        'dns',
        'domain',
        'events',
        'fs',
        'http',
        'https',
        'net',
        'os',
        'path',
        'punycode',
        'querystring',
        'readline',
        'stream',
        'string_decoder',
        'tls',
        'tty',
        'url',
        'util',
        'v8',
        'vm',
        'zlib'
    ],
    plugins: []
});

const polyfillFile = path.resolve('./node/js', 'stream.js');

const code = `
globalThis.global = globalThis;
${ret[0].content}
`;

fs.writeFileSync(polyfillFile, code);
