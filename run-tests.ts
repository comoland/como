const { path } = Como;

(() => {
    const testsPath = path.resolve('./tests');
    path.walk(testsPath, async (path, o) => {
        if (!o.isDir && path.endsWith('.test.ts')) {
            try {
                await import(path);
            } catch (e: any) {
                console.log(e);
                process.exit(1);
            }
        }
    });
})();