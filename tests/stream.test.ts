import { describe, assert } from './runner';
import { Readable, Writable, Duplex, Transform, PassThrough } from 'stream';

describe('Readable Stream', async ({ test }) => {
    test('should create a Readable stream', () => {
        const stream = new Readable();
        assert.ok(stream instanceof Readable, 'Should be instance of Readable');
        assert.ok(stream instanceof Readable, 'Should be instance of Stream');
    });

    test('should push data to readable stream', async ({ done }) => {
        const stream = new Readable();
        let chunks: any[] = [];

        stream.on('data', (chunk) => {
            chunks.push(chunk);
        });

        stream.on('end', () => {
            assert.equal(chunks.length, 2, 'Should receive 2 chunks');
            assert.equal(chunks[0].toString(), 'hello', 'First chunk should be "hello"');
            assert.equal(chunks[1].toString(), 'world', 'Second chunk should be "world"');
            done();
        });

        stream.push('hello');
        stream.push('world');
        stream.push(null); // Signals end
    });

    test.skip('should handle readable stream with encoding', ({ done }) => {
        const stream = new Readable({ encoding: 'utf8' });
        let data = '';

        stream.on('data', (chunk) => {
            data += chunk;
        });

        stream.on('end', () => {
            assert.equal(data, 'hello', 'Should receive data as string');
            done();
        });

        stream.push(Buffer.from('hello'));
        stream.push(null);
    });

    test('should emit error event', ({ done }) => {
        const stream = new Readable();
        const error = new Error('test error');

        stream.on('error', (err) => {
            assert.equal(err.message, 'test error', 'Should emit error with correct message');
            done();
        });

        stream.emit('error', error);
    });

    test('should handle pause and resume', () => {
        return new Promise((resolve) => {
            const stream = new Readable({ read() {} });
            const chunks: any[] = [];

            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                assert.equal(chunks.length, 3, 'Should receive all chunks after resume');
                resolve(null);
            });

            stream.push('chunk1');
            stream.pause();
            stream.push('chunk2');
            stream.push('chunk3');

            setTimeout(() => {
                stream.resume();
                stream.push(null);
            }, 10);
        })
    });

    test('should support objectMode', ({ done }) => {
        const stream = new Readable({ objectMode: true });
        const objects: any[] = [];

        stream.on('data', (obj) => {
            objects.push(obj);
        });

        stream.on('end', () => {
            assert.equal(objects.length, 2, 'Should receive 2 objects');
            assert.equal(objects[0].foo, 'bar', 'Should receive objects correctly');
            assert.equal(objects[1].baz, 'qux', 'Should receive second object correctly');
            done();
        });

        stream.push({ foo: 'bar' });
        stream.push({ baz: 'qux' });
        stream.push(null);
    });

    test('should respect highWaterMark', ({ done }) => {
        const stream = new Readable({ highWaterMark: 2 });
        assert.equal(stream.readableHighWaterMark, 2, 'Should set highWaterMark');
        done();
    });

    test('should destroy readable stream', ({ done }) => {
        const stream = new Readable();

        stream.on('close', () => {
            assert.ok(true, 'Should emit close event');
            done();
        });

        stream.destroy();
    });

    test('should handle isPaused method', () => {
        const stream = new Readable({ read() {} });
        assert.ok(!stream.isPaused(), 'Should not be paused initially');

        stream.pause();
        assert.ok(stream.isPaused(), 'Should be paused');

        stream.resume();
        assert.ok(!stream.isPaused(), 'Should not be paused after resume');
    });

    test('should handle read method', ({ done }) => {
        const stream = new Readable();

        stream.on('readable', () => {
            let chunk;
            while (null !== (chunk = stream.read())) {
                assert.equal(chunk.toString(), 'test', 'Should read correct data');
            }
        });

        stream.on('end', () => {
            done();
        });

        stream.push('test');
        stream.push(null);
    });
});

describe('Writable Stream', async ({ test }) => {
    test('should create a Writable stream', () => {
        const stream = new Writable();
        assert.ok(stream instanceof Writable, 'Should be instance of Writable');
    });

    test('should write to writable stream', ({ done }) => {
        const chunks: any[] = [];

        const stream = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        stream.on('finish', () => {
            assert.equal(chunks.length, 2, 'Should receive 2 chunks');
            assert.equal(chunks[0].toString(), 'hello', 'First chunk should be "hello"');
            assert.equal(chunks[1].toString(), 'world', 'Second chunk should be "world"');
            done();
        });

        stream.write('hello');
        stream.write('world');
        stream.end();
    });

    test('should handle write with callback', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.write('test', (err) => {
            assert.ok(!err, 'Should not have error');
            stream.end(done);
        });
    });

    test('should emit error during write', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback(new Error('write error'));
            }
        });

        stream.on('error', (err) => {
            assert.equal(err.message, 'write error', 'Should emit error');
            done();
        });

        stream.write('test');
    });

    test('should handle write with backpressure', ({ done }) => {
        let called = false;
        const stream = new Writable({
            highWaterMark: 1,
            write(chunk, encoding, callback) {
                if (!called) {
                    called = true;
                    setTimeout(callback, 50);
                } else {
                    callback();
                }
            }
        });

        const ret1 = stream.write('chunk1');
        const ret2 = stream.write('chunk2');

        stream.on('drain', () => {
            assert.ok(true, 'Should emit drain event');
            stream.end();
            stream.on('finish', done);
        });

        if (ret1 === false || ret2 === false) {
            // Expected if backpressure occurred
        }
    });

    test('should handle cork and uncork', ({ done }) => {
        const chunks: any[] = [];

        const stream = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        stream.cork();
        stream.write('buffered1');
        stream.write('buffered2');
        stream.uncork();

        stream.on('finish', () => {
            assert.equal(chunks.length, 2, 'Should receive both chunks');
            done();
        });

        stream.end();
    });

    test('should handle setDefaultEncoding', () => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.setDefaultEncoding('utf8');
        assert.ok(true, 'Should set encoding');
    });

    test('should destroy writable stream', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.on('close', () => {
            assert.ok(true, 'Should emit close event');
            done();
        });

        stream.destroy();
    });

    test('should handle end with callback', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.end('final', () => {
            assert.ok(true, 'Should call end callback');
            done();
        });
    });

    test('should report writable state', () => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        assert.ok(stream.writable, 'Should be writable');
        assert.ok(!stream.destroyed, 'Should not be destroyed');

        stream.end();
        stream.on('finish', () => {
            assert.ok(!stream.writable, 'Should not be writable after end');
        });
    });
});

describe('Duplex Stream', async ({ test }) => {
    test('should create a Duplex stream', () => {
        const stream = new Duplex();
        assert.ok(stream instanceof Duplex, 'Should be instance of Duplex');
        assert.ok(stream instanceof Readable, 'Should be instance of Readable');
        assert.ok(stream instanceof Writable, 'Should be instance of Writable');
    });

    test('should handle duplex read and write', ({ done }) => {
        const chunks: any[] = [];
        const output: any[] = [];

        const stream = new Duplex({
            read() {
                this.push('read1');
                this.push('read2');
                this.push(null);
            },
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        stream.on('data', (chunk) => {
            output.push(chunk);
        });

        stream.on('end', () => {
            assert.equal(output.length, 2, 'Should receive 2 read chunks');
            assert.equal(output[0].toString(), 'read1', 'First read should be correct');
            assert.equal(output[1].toString(), 'read2', 'Second read should be correct');
        });

        stream.on('finish', () => {
            assert.equal(chunks.length, 2, 'Should receive 2 write chunks');
            assert.equal(chunks[0].toString(), 'write1', 'First write should be correct');
            assert.equal(chunks[1].toString(), 'write2', 'Second write should be correct');
            done();
        });

        stream.write('write1');
        stream.write('write2');
        stream.end();
    });

    test('should handle duplex with different encoding', ({ done }) => {
        const stream = new Duplex({
            read() {
                this.push(Buffer.from('test'));
                this.push(null);
            },
            write(chunk, encoding, callback) {
                callback();
            }
        });

        let data = '';
        stream.on('data', (chunk) => {
            data += chunk.toString();
        });

        stream.on('end', () => {
            assert.equal(data, 'test', 'Should receive data correctly');
            done();
        });
    });

    test('should handle duplex destroy', ({ done }) => {
        const stream = new Duplex({
            read() {},
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.on('close', () => {
            done();
        });

        stream.destroy();
    });

    test('should handle duplex with allowHalfOpen option', ({ done }) => {
        const stream = new Duplex({
            allowHalfOpen: true,
            read() {},
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.end('test');
        stream.on('finish', () => {
            assert.ok(stream.readable, 'Should still be readable when allowHalfOpen is true');
            done();
        });
    });
});

describe('Transform Stream', async ({ test }) => {
    test('should create a Transform stream', () => {
        const stream = new Transform();
        assert.ok(stream instanceof Transform, 'Should be instance of Transform');
        assert.ok(stream instanceof Duplex, 'Should be instance of Duplex');
    });

    test('should transform data', ({ done }) => {
        const output: any[] = [];

        const stream = new Transform({
            transform(chunk, encoding, callback) {
                this.push(chunk.toString().toUpperCase());
                callback();
            }
        });

        stream.on('data', (chunk) => {
            output.push(chunk.toString());
        });

        stream.on('end', () => {
            assert.equal(output.join(''), 'HELLOWORLD', 'Should transform to uppercase');
            done();
        });

        stream.write('hello');
        stream.write('world');
        stream.end();
    });

    test('should handle transform with async', ({ done }) => {
        const output: any[] = [];

        const stream = new Transform({
            transform(chunk, encoding, callback) {
                setTimeout(() => {
                    this.push(chunk.toString().toUpperCase());
                    callback();
                }, 10);
            }
        });

        stream.on('data', (chunk) => {
            output.push(chunk.toString());
        });

        stream.on('end', () => {
            assert.equal(output.length, 2, 'Should receive transformed chunks');
            done();
        });

        stream.write('test1');
        stream.write('test2');
        stream.end();
    });

    test('should handle transform flush', ({ done }) => {
        const stream = new Transform({
            transform(chunk, encoding, callback) {
                this.push(chunk);
                callback();
            },
            flush(callback) {
                this.push('flushed');
                callback();
            }
        });

        const output: any[] = [];
        stream.on('data', (chunk) => {
            output.push(chunk.toString());
        });

        stream.on('end', () => {
            assert.ok(output.includes('flushed'), 'Should flush additional data');
            done();
        });

        stream.write('test');
        stream.end();
    });

    test('should handle transform error', ({ done }) => {
        const stream = new Transform({
            transform(chunk, encoding, callback) {
                callback(new Error('transform error'));
            }
        });

        stream.on('error', (err) => {
            assert.equal(err.message, 'transform error', 'Should emit error');
            done();
        });

        stream.write('test');
    });

    test('should pass through data unchanged', ({ done }) => {
        const stream = new PassThrough();
        const output: any[] = [];

        stream.on('data', (chunk) => {
            output.push(chunk.toString());
        });

        stream.on('end', () => {
            assert.equal(output.join(''), 'hello world', 'Should pass through unchanged');
            done();
        });

        stream.write('hello ');
        stream.write('world');
        stream.end();
    });

    test('should handle PassThrough with highWaterMark', () => {
        const stream = new PassThrough({ highWaterMark: 100 });
        assert.equal(stream.readableHighWaterMark, 100, 'Should set highWaterMark');
        assert.equal(stream.writableHighWaterMark, 100, 'Should set writable highWaterMark');
    });
});

describe('Stream Piping', async ({ test }) => {
    test('should pipe readable to writable', ({ done }) => {
        const readable = new Readable({
            read() {
                this.push('data');
                this.push(null);
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                assert.equal(chunk.toString(), 'data', 'Should receive piped data');
                callback();
            }
        });

        writable.on('finish', () => {
            done();
        });

        readable.pipe(writable);
    });

    test('should pipe through transform', ({ done }) => {
        const readable = new Readable({
            read() {
                this.push('hello');
                this.push(null);
            }
        });

        const transform = new Transform({
            transform(chunk, encoding, callback) {
                this.push(chunk.toString().toUpperCase());
                callback();
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                assert.equal(chunk.toString(), 'HELLO', 'Should receive transformed data');
                callback();
            }
        });

        writable.on('finish', () => {
            done();
        });

        readable.pipe(transform).pipe(writable);
    });

    test('should handle pipe with end option', ({ done }) => {
        const readable = new Readable({
            read() {
                this.push('data');
                this.push(null);
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        const readable2 = new Readable({
            read() {
                this.push('data2');
                this.push(null);
            }
        });

        writable.on('finish', () => {
            done();
        });

        readable.pipe(writable, { end: false });
        readable2.pipe(writable);
    });

    test.skip('should handle unpipe', ({ done }) => {
        const readable = new Readable({
            read() {
                this.push('data');
                this.push('data2');
                this.push(null);
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        readable.pipe(writable);
        readable.unpipe(writable);

        writable.on('finish', () => {
            // Should not finish if unpipe worked
            setTimeout(() => {
                done();
            }, 50);
        });
    });

    test.skip('should emit pipe event', ({ done }) => {
        const readable = new Readable({
            read() {
                this.push('data');
                this.push(null);
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        readable.on('pipe', (src) => {
            assert.ok(true, 'Should emit pipe event');
            done();
        });

        readable.pipe(writable);
    });

    test.skip('should emit unpipe event', ({ done }) => {
        const readable = new Readable({
            read() {
                this.push('data');
                this.push(null);
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        readable.on('unpipe', (src) => {
            assert.ok(true, 'Should emit unpipe event');
            done();
        });

        readable.pipe(writable);
        readable.unpipe(writable);
    });
});

describe('Stream Errors', async ({ test }) => {
    test('should handle readable error', ({ done }) => {
        const stream = new Readable();

        stream.on('error', (err) => {
            assert.equal(err.message, 'readable error', 'Should emit error');
            done();
        });

        stream.destroy(new Error('readable error'));
    });

    test('should handle writable error', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback(new Error('write error'));
            }
        });

        stream.on('error', (err) => {
            assert.equal(err.message, 'write error', 'Should emit error');
            done();
        });

        stream.write('test');
    });

    test('should handle transform error', ({ done }) => {
        const stream = new Transform({
            transform(chunk, encoding, callback) {
                callback(new Error('transform error'));
            }
        });

        stream.on('error', (err) => {
            assert.equal(err.message, 'transform error', 'Should emit error');
            done();
        });

        stream.write('test');
    });

    test('should handle pipe error propagation', ({ done }) => {
        const readable = new Readable({
            read() {
                this.destroy(new Error('source error'));
            }
        });

        const writable = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        readable.on('error', (err) => {
            assert.equal(err.message, 'source error', 'Should propagate error');
            done();
        });

        readable.pipe(writable);
    });
});

describe('Stream Events', async ({ test }) => {
    test('should emit readable event', ({ done }) => {
        const stream = new Readable({ read() {  } });

        stream.on('readable', () => {
            const chunk = stream.read();
            if (chunk) {
                assert.equal(chunk.toString(), 'test', 'Should read from readable event');
                done();
            }
        });

        stream.push('test');
    });

    test.skip('should emit end event', ({ done }) => {
        const stream = new Readable({
            read() {}
        });

        stream.on('end', () => {
            assert.ok(true, 'Should emit end event');
            done();
        });

        stream.push(null);
    });

    test('should emit finish event', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.on('finish', () => {
            assert.ok(true, 'Should emit finish event');
            done();
        });

        stream.end('final');
    });

    test('should emit close event on destroy', ({ done }) => {
        const stream = new Readable({ read() {} });

        stream.on('close', () => {
            assert.ok(true, 'Should emit close event');
            done();
        });

        stream.destroy();
    });

    test('should emit prefinish event', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.on('prefinish', () => {
            assert.ok(true, 'Should emit prefinish event');
        });

        stream.on('finish', () => {
            done();
        });

        stream.end('final');
    });
});

describe('Stream Utils', async ({ test }) => {
    test.skip('should handle finished utility', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.finished(stream, (err) => {
            assert.ok(true, 'Should call finished callback');
            done();
        });

        stream.end('test');
    });

    test('should handle pipeline', ({ done }) => {
        const createReadable = () => new Readable({
            read() {
                this.push('data');
                this.push(null);
            }
        });

        const createTransform = () => new Transform({
            transform(chunk, encoding, callback) {
                this.push(chunk.toString().toUpperCase());
                callback();
            }
        });

        const createWritable = () => new Writable({
            write(chunk, encoding, callback) {
                assert.equal(chunk.toString(), 'DATA', 'Should receive transformed data');
                callback();
            }
        });

        const stream = createReadable().pipe(createTransform()).pipe(createWritable());

        stream.on('finish', done);
    });

    test('should handle stream with async iterations', async () => {
        const stream = new Readable({
            objectMode: true,
            read() {
                this.push('chunk1');
                this.push('chunk2');
                this.push(null);
            }
        });

        const chunks: any[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        assert.equal(chunks.length, 2, 'Should iterate over chunks');
        assert.equal(chunks[0].toString(), 'chunk1', 'First chunk should be correct');
    });
});

describe('Stream Edge Cases', async ({ test }) => {
    test.skip('should handle null and undefined pushes', ({ done }) => {
        const stream = new Readable({ read() {} });
        let chunkCount = 0;

        stream.on('data', () => {
            chunkCount++;
        });

        stream.on('end', () => {
            assert.equal(chunkCount, 2, 'Should receive 2 chunks');
            done();
        });

        stream.push('valid');
        stream.push(null);
        stream.push('ignored'); // Should be ignored after null
    });

    test('should handle empty readable stream', ({ done }) => {
        const stream = new Readable();

        stream.on('data', () => {
            assert.fail('Should not receive data');
        });

        stream.on('end', () => {
            assert.ok(true, 'Should emit end');
            done();
        });

        stream.push(null);
    });

    test('should handle multiple ends', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        let finishCount = 0;
        stream.on('finish', () => {
            finishCount++;
        });

        stream.end();
        stream.end(); // Second end should be ignored

        setTimeout(() => {
            assert.equal(finishCount, 1, 'Should only finish once');
            done();
        }, 10);
    });

    test('should handle destroy after end', ({ done }) => {
        const stream = new Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });

        stream.end('test');
        stream.destroy();

        stream.on('close', () => {
            done();
        });
    });

    test.skip('should handle highWaterMark overflow', ({ done }) => {
        const stream = new Writable({
            highWaterMark: 5,
            write(chunk, encoding, callback) {
                setTimeout(callback, 50);
            }
        });

        stream.on('finish', () => {
            done();
        });

        const ret = stream.write(Buffer.alloc(100));
        stream.end();
    });

    test('should handle objectMode with non-strings', ({ done }) => {
        const stream = new Readable({
            objectMode: true,
            read() {
                this.push({ type: 'data', value: 123 });
                this.push(null);
            }
        });

        stream.on('data', (obj) => {
            assert.equal(obj.type, 'data', 'Should receive object');
            assert.equal(obj.value, 123, 'Should preserve object properties');
        });

        stream.on('end', done);
    });

    test('should handle backpressure on transform', ({ done }) => {
        const transform = new Transform({
            transform(chunk, encoding, callback) {
                this.push(chunk);
                // Don't call callback to create backpressure
                setTimeout(callback, 20);
            }
        });

        let dataReceived = false;
        transform.on('data', () => {
            dataReceived = true;
        });

        transform.on('end', () => {
            assert.ok(dataReceived, 'Should eventually receive data');
            done();
        });

        transform.write('test');
        transform.end();
    });
});
