import * as esbuild from 'como/build';
let i = 0
const stressTestBundeler = async () => {
    const ret =  await esbuild.build({
        entryPoints: ["react", "react-dom", "react-dom/server"],
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
        splitting: false,
        bundle: false,
        minify: true,
        plugins: [
            {
                name: 'env',
                setup: build => {
                    console.log(build)
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
                            contents: `export const env = {  ret: 'Hi from bundle ${i++}' }`
                        };
                    });
                }
            }
        ]
    });

    console.log(ret.length)
}

for (let i = 0; i < 2000; i++) {
    await stressTestBundeler()
}

console.log("Ended!!!")
