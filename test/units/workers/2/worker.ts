globalThis.onmessage = arg => {
    globalThis.postMessage({ foo: arg });
};
