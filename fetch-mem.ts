

(async () => {
    // setInterval(() => {
    //     console.log("running")
    // }, 100)

    console.time("Bench")
    for (let i = 0; i < 70000; i++) {
        const res = await fetch('http://localhost:8080/static/v1/bootstrap.js').then((res) => res).catch((e) => { console.log(e) });
        const js = await res.text()
        // console.log(js)
        // console.log(res.statusText, i)
        // console.log(res)
    }

    console.timeEnd("Bench")

    console.log("done!!!!!")
})();
