import url from "@kamilkisiela/fast-url-parser";

const bench = (name, fn, times) => {
    console.time(name)
    const start = Date.now()
    for (let i = 0; i < times; i++) {
        fn()
    }

    console.timeEnd(name)
}


bench("go", () => {
    const urlx = url.parse('https://example.com')
}, 10000)

