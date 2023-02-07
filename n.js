(async () => {
    for (let i = 0; i < 10; i++) {
         await import("./test/load.js")
    }
})();
