import { suite, assert } from '../../mod';

const test = suite('web streams');

async function readableStreamToText(stream: ReadableStream) {
    const reader = stream.getReader();
    const chunks: any = [];
    let processor = async ({ done, value }: ReadableStreamReadResult<any>) => {
        if (done) {
            return;
        }

        chunks.push(value);
        await reader.read().then(processor);
    };

    await reader.read().then(processor);
    return chunks.join('');
}

test('WritableStream works', async () => {
    try {
        let chunks: any = [];
        let writable = new WritableStream({
            write(chunk, controller) {
                chunks.push(chunk);
            },
            abort(reason) {
                console.log('aborted!');
                console.log(reason);
            }
        });

        let writer = writable.getWriter();
        writer.write(new Uint8Array([1, 2, 3]));
        writer.write(new Uint8Array([4, 5, 6]));

        await writer.close();

        assert.equal(JSON.stringify(Array.from(Buffer.concat(chunks))), JSON.stringify([1, 2, 3, 4, 5, 6]));
    } catch (e: any) {
        console.log(e);
        console.log(e.stack);
        throw e;
    }
});

test('ReadableStream works', async () => {
    const result: any = [];
    const readableStream = new ReadableStream({
        start(controller) {
            controller.enqueue('First chunk');
            controller.enqueue('Second chunk');
            controller.close();
        }
    });

    await readableStream.pipeTo(
        new WritableStream({
            write(chunk) {
                result.push('WRITE ' + JSON.stringify(chunk));
            },
            close() {
                result.push('CLOSE');
            },
            abort(err) {
                result.push('ABORT ' + err);
            }
        })
    );

    assert.equal(result, ['WRITE "First chunk"', 'WRITE "Second chunk"', 'CLOSE']);
});

test('ReadableStream yields', async () => {
    const result: any = [];

    const stream = new ReadableStream({
        async start(controller) {
            controller.enqueue('one');
            controller.enqueue('two');
            controller.enqueue('three');
            controller.close();
        }
    });

    async function* prefixChunks(prefix: string, asyncIterable: any) {
        for await (const chunk of asyncIterable) {
            yield prefix + chunk;
        }
    }

    const transformedAsyncIterable = prefixChunks('> ', stream);
    for await (const transformedChunk of transformedAsyncIterable) {
        result.push(transformedChunk);
    }

    assert.equal(result, ['> one', '> two', '> three']);
});

test('ReadableStream.prototype[Symbol.asyncIterator]', async () => {
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue('hello');
            controller.enqueue('world');
            controller.close();
        },
        cancel(reason) {}
    });

    const chunks: any = [];
    try {
        for await (const chunk of stream as any) {
            chunks.push(chunk);
        }
    } catch (e: any) {
        console.log(e.message);
        console.log(e.stack);
    }

    assert.equal(chunks.join(''), 'helloworld');
});

test('ReadableStream tee', async () => {
    try {
        let [a, b] = new ReadableStream({
            start(controller) {
                controller.enqueue('a');
                controller.enqueue('b');
                controller.enqueue('c');
                controller.close();
            }
        }).tee();

        assert.equal(await readableStreamToText(a), 'abc');
        assert.equal(await readableStreamToText(b), 'abc');
    } catch (e: any) {
        console.log(e.message);
        console.log(e.stack);
        throw e;
    }
});

test('ReadableStream tee 2', async () => {
    try {
        let [a, b] = new ReadableStream({
            pull(controller) {
                controller.enqueue('a');
                controller.enqueue('b');
                controller.enqueue('c');
                controller.close();
            }
        }).tee();

        assert.equal(await readableStreamToText(a), 'abc');
        assert.equal(await readableStreamToText(b), 'abc');
    } catch (e: any) {
        console.log(e.message);
        console.log(e.stack);
        throw e;
    }
});

test.run();
