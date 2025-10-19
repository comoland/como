import esbuild from 'como/build';

const stressTestBundeler = async () => {
    const ret = await esbuild.build({
        stdin: {
            contents: `
            console.log("")
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

    // const code = eval(`${ret[0].content}`);
    console.log(ret)
    // assert.equal(ret[0].path, '/stdin.js');
    // assert.equal(code.bundle1, 'Hi from bundle 1');
    // assert.equal(code.bundle2, 'Hi from bundle 2');
}



for (let i = 0; i < 100; i++) {
     stressTestBundeler()
}

console.log("Ended!!!")





// setTimeout(() => {

// }, 30000000)