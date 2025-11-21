import * as esbuild from 'como:build';
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
        bundle: true,
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

    return ret
}


setInterval(async () => {
     stressTestBundeler().then((res) => {
        console.log('======================> ', res.length)
     })
}, 100)

setInterval(async () => {
    await stressTestBundeler()
}, 10)


setInterval(async () => {
    await stressTestBundeler()
}, 10)


setInterval(async () => {
    await stressTestBundeler()
}, 10)

console.log("Ended!!!")
