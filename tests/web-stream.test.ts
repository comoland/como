import { describe, assert } from '../runner';

describe("ReadableStream basics", async ({ test }) => {
    test('ReadableStream should be available', () => {
        assert.ok(ReadableStream, 'ReadableStream should be available');
        assert.equal(typeof ReadableStream, 'function', 'ReadableStream should be a constructor');
    });

    test('ReadableStream should create a readable stream', () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue('hello');
                controller.close();
            }
        });

        assert.ok(stream, 'ReadableStream should be created');
        assert.ok(stream instanceof ReadableStream, 'should be instance of ReadableStream');
    });

    test('ReadableStream should have locked property', () => {
        const stream = new ReadableStream();
        assert.equal(stream.locked, false, 'stream should not be locked initially');
    });

    test('ReadableStream should be lockable', () => {
        const stream = new ReadableStream();
        const reader = stream.getReader();

        assert.equal(stream.locked, true, 'stream should be locked after getReader');

        reader.releaseLock();
        assert.equal(stream.locked, false, 'stream should be unlocked after releaseLock');
    });

    test('ReadableStream should enqueue and read data', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue('chunk1');
                controller.enqueue('chunk2');
                controller.close();
            }
        });

        const reader = stream.getReader();

        const result1 = await reader.read();
        assert.equal(result1.done, false, 'first read should not be done');
        assert.equal(result1.value, 'chunk1', 'first read should return chunk1');

        const result2 = await reader.read();
        assert.equal(result2.done, false, 'second read should not be done');
        assert.equal(result2.value, 'chunk2', 'second read should return chunk2');

        const result3 = await reader.read();
        assert.equal(result3.done, true, 'third read should be done');
        assert.equal(result3.value, undefined, 'done read should have undefined value');
    });

    test('ReadableStream should support async iteration', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(1);
                controller.enqueue(2);
                controller.enqueue(3);
                controller.close();
            }
        });

        const chunks: number[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        assert.equal(chunks.length, 3, 'should read 3 chunks');
        assert.equal(chunks[0], 1, 'first chunk should be 1');
        assert.equal(chunks[1], 2, 'second chunk should be 2');
        assert.equal(chunks[2], 3, 'third chunk should be 3');
    });

    test('ReadableStream should handle pull method', async () => {
        let pullCount = 0;
        const stream = new ReadableStream({
            pull(controller) {
                pullCount++;
                if (pullCount <= 3) {
                    controller.enqueue(pullCount);
                } else {
                    controller.close();
                }
            }
        });

        const reader = stream.getReader();

        await reader.read();
        await reader.read();
        await reader.read();

        assert.ok(pullCount >= 3, 'pull should be called multiple times');
    });

    test('ReadableStream should handle cancel', async () => {
        let cancelReason: any;
        const stream = new ReadableStream({
            cancel(reason) {
                cancelReason = reason;
            }
        });

        await stream.cancel('test cancel');
        assert.equal(cancelReason, 'test cancel', 'cancel should receive reason');
    });
});

describe("ReadableStream advanced", async ({ test }) => {
    test('ReadableStream should support pipeTo', async () => {
        const chunks: any[] = [];

        const readable = new ReadableStream({
            start(controller) {
                controller.enqueue('a');
                controller.enqueue('b');
                controller.enqueue('c');
                controller.close();
            }
        });

        const writable = new WritableStream({
            write(chunk) {
                chunks.push(chunk);
            }
        });

        await readable.pipeTo(writable);

        assert.equal(chunks.length, 3, 'should pipe 3 chunks');
        assert.equal(chunks[0], 'a', 'first chunk should be a');
        assert.equal(chunks[1], 'b', 'second chunk should be b');
        assert.equal(chunks[2], 'c', 'third chunk should be c');
    });

    test('ReadableStream should support pipeThrough', async () => {
        const readable = new ReadableStream({
            start(controller) {
                controller.enqueue(1);
                controller.enqueue(2);
                controller.enqueue(3);
                controller.close();
            }
        });

        const transform = new TransformStream({
            transform(chunk, controller) {
                controller.enqueue(chunk * 2);
            }
        });

        const transformed = readable.pipeThrough(transform);
        const reader = transformed.getReader();

        const result1 = await reader.read();
        assert.equal(result1.value, 2, 'first transformed chunk should be 2');

        const result2 = await reader.read();
        assert.equal(result2.value, 4, 'second transformed chunk should be 4');

        const result3 = await reader.read();
        assert.equal(result3.value, 6, 'third transformed chunk should be 6');
    });

    test('ReadableStream should support tee', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue('a');
                controller.enqueue('b');
                controller.close();
            }
        });

        const [branch1, branch2] = stream.tee();

        const reader1 = branch1.getReader();
        const reader2 = branch2.getReader();

        const result1a = await reader1.read();
        const result2a = await reader2.read();

        assert.equal(result1a.value, 'a', 'branch1 should read a');
        assert.equal(result2a.value, 'a', 'branch2 should read a');

        const result1b = await reader1.read();
        const result2b = await reader2.read();

        assert.equal(result1b.value, 'b', 'branch1 should read b');
        assert.equal(result2b.value, 'b', 'branch2 should read b');
    });

    test('ReadableStream should handle errors', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.error(new Error('stream error'));
            }
        });

        const reader = stream.getReader();

        try {
            await reader.read();
            assert.ok(false, 'should throw error');
        } catch (err: any) {
            assert.ok(err instanceof Error, 'should throw Error');
            assert.equal(err.message, 'stream error', 'should have correct error message');
        }
    });
});

describe("WritableStream", async ({ test }) => {
    test('WritableStream should be available', () => {
        assert.ok(WritableStream, 'WritableStream should be available');
        assert.equal(typeof WritableStream, 'function', 'WritableStream should be a constructor');
    });

    test('WritableStream should create a writable stream', () => {
        const stream = new WritableStream({
            write(chunk) {
                // no-op
            }
        });

        assert.ok(stream, 'WritableStream should be created');
        assert.ok(stream instanceof WritableStream, 'should be instance of WritableStream');
    });

    test('WritableStream should have locked property', () => {
        const stream = new WritableStream();
        assert.equal(stream.locked, false, 'stream should not be locked initially');
    });

    test('WritableStream should write data', async () => {
        const chunks: any[] = [];

        const stream = new WritableStream({
            write(chunk) {
                chunks.push(chunk);
            }
        });

        const writer = stream.getWriter();

        await writer.write('chunk1');
        await writer.write('chunk2');
        await writer.close();

        assert.equal(chunks.length, 2, 'should write 2 chunks');
        assert.equal(chunks[0], 'chunk1', 'first chunk should be chunk1');
        assert.equal(chunks[1], 'chunk2', 'second chunk should be chunk2');
    });

    test('WritableStream should handle abort', async () => {
        let abortReason: any;

        const stream = new WritableStream({
            abort(reason) {
                abortReason = reason;
            }
        });

        const writer = stream.getWriter();
        await writer.abort('test abort');

        assert.equal(abortReason, 'test abort', 'abort should receive reason');
    });

    test('WritableStream should handle close', async () => {
        let closed = false;

        const stream = new WritableStream({
            close() {
                closed = true;
            }
        });

        const writer = stream.getWriter();
        await writer.close();

        assert.ok(closed, 'close should be called');
    });
});

describe("TransformStream", async ({ test }) => {
    test('TransformStream should be available', () => {
        assert.ok(TransformStream, 'TransformStream should be available');
        assert.equal(typeof TransformStream, 'function', 'TransformStream should be a constructor');
    });

    test('TransformStream should create readable and writable', () => {
        const transform = new TransformStream();

        assert.ok(transform.readable, 'should have readable side');
        assert.ok(transform.writable, 'should have writable side');
        assert.ok(transform.readable instanceof ReadableStream, 'readable should be ReadableStream');
        assert.ok(transform.writable instanceof WritableStream, 'writable should be WritableStream');
    });

    test('TransformStream should transform data', async () => {
        const transform = new TransformStream({
            transform(chunk, controller) {
                controller.enqueue(chunk.toUpperCase());
            }
        });

        const writer = transform.writable.getWriter();
        const reader = transform.readable.getReader();

        // Write and read concurrently to avoid deadlock
        const writePromise = (async () => {
            await writer.write('hello');
            await writer.write('world');
            await writer.close();
        })();

        const result1 = await reader.read();
        assert.equal(result1.value, 'HELLO', 'first chunk should be HELLO');

        const result2 = await reader.read();
        assert.equal(result2.value, 'WORLD', 'second chunk should be WORLD');

        await writePromise;
    });

    test('TransformStream should handle flush', async () => {
        let flushed = false;

        const transform = new TransformStream({
            flush(controller) {
                flushed = true;
                controller.enqueue('flushed');
            }
        });

        const writer = transform.writable.getWriter();
        const reader = transform.readable.getReader();

        await writer.close();

        const result = await reader.read();
        assert.ok(flushed, 'flush should be called');
        assert.equal(result.value, 'flushed', 'should receive flushed chunk');
    });

    test('TransformStream should support multiple enqueues per chunk', async () => {
        const transform = new TransformStream({
            transform(chunk, controller) {
                // Split each chunk into characters
                for (const char of chunk) {
                    controller.enqueue(char);
                }
            }
        });

        const writer = transform.writable.getWriter();
        const reader = transform.readable.getReader();

        // Write and read concurrently
        const writePromise = (async () => {
            await writer.write('ab');
            await writer.close();
        })();

        const result1 = await reader.read();
        assert.equal(result1.value, 'a', 'first char should be a');

        const result2 = await reader.read();
        assert.equal(result2.value, 'b', 'second char should be b');

        await writePromise;
    });
});

describe("Byte streams", async ({ test }) => {
    test('ReadableStream with type "bytes" should work', async () => {
        const stream = new ReadableStream({
            type: 'bytes',
            pull(controller) {
                const view = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
                controller.enqueue(view);
                controller.close();
            }
        });

        const reader = stream.getReader({ mode: 'byob' });
        const buffer = new Uint8Array(10);

        const result = await reader.read(buffer);

        assert.ok(!result.done, 'should not be done');
        assert.ok(result.value instanceof Uint8Array, 'should return Uint8Array');
    });

    test('ReadableStream should handle Uint8Array chunks', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3]));
                controller.enqueue(new Uint8Array([4, 5, 6]));
                controller.close();
            }
        });

        const reader = stream.getReader();

        const result1 = await reader.read();
        assert.ok(result1.value instanceof Uint8Array, 'first chunk should be Uint8Array');
        assert.equal(result1.value[0], 1, 'first byte should be 1');

        const result2 = await reader.read();
        assert.ok(result2.value instanceof Uint8Array, 'second chunk should be Uint8Array');
        assert.equal(result2.value[0], 4, 'first byte should be 4');
    });
});
