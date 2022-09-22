obj => {
    const { isWorker, workerRun, workerCB, terminate } = obj;
    const run = (file, parent) => {
        const { channel } = workerRun(file);
        parent.workerId = channel;
        // (async function(){
        //     for await (let msg of itr) {
        //         if (parent._terminate || msg === "exit") {
        //             break;
        //         } else {
        //             parent._onmessage(msg);
        //         }
        //     }
        // })();

        // return channel;
    };

    class Worker {
        constructor(file) {
            this._onmessage = () => {};
            this.channel = run(file, this);
            return this;
        }

        onmessage(cb) {
            console.log('ssssssssssssssss => ', this.workerId);
            obj[this.workerId] = cb;
            // this._onmessage = cb;
        }

        terminate() {
            terminate(this.workerId);
            // this._terminate = true;
        }

        postMessage(msg) {
            console.log('ssssssssssssssss => ', this.workerId);
            workerCB(msg, this.workerId);
        }
    }

    globalThis.Worker = Worker;
};
