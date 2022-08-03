
const { build, path } = Como;

const file = path.resolve(import.meta.dir, './fixtures/bundle.ts');

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

(async function(){
    // build.plugin()
    const code =  await build.bundle(file, {
        plugins: [
            {
                name: "api-call",
                setup: async function(setup){

                    setup.onResolve({ filter: '^en' }, (a) => {
                        // await sleep(1000)
                        console.log("should be called\n\n", a)
                        return {
                            path:       a.path,
                            pluginName: "test",
                            namespace:  "env-ns",
                            external: false
                        }
                    })

                    setup.onLoad({ filter: `.*`, namespace: "env-ns" }, (a) => {
                        console.log("should be called\n\n", a)

                        return {
                            contents: "export const hi = 'there'",
                            Loader: 4
                        }
                    })
                }
            }
        ]
    })

    console.log(code)
})();
