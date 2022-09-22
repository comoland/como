const { path } = Como;

(() => {
    const apiDir = path.resolve(import.meta.dir, './units');
    path.walk(apiDir, async (path, o) => {
        if (!o.isDir && !path.endsWith('worker.ts')) {
            try {
                await import(path)
            } catch (e) {
                console.log(e.message)
                process.exit(1)
            }
        }
    })
})()
