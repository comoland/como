


(async function(){
    const worker = Como.worker('', (msg) => {
        console.log(msg)
    });

    await worker.postMessage("")

})()