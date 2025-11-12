import { describe, assert, expect } from './runner';
// @ts-ignore runtime module provided by Como
import { Reader, Writer, readerFromCallback, writerFromCallback, getReaderHandle, getWriterHandle } from 'std:io';

const ascii = (value: string) => new Uint8Array([...value].map((char) => char.charCodeAt(0) & 0xff));

const toArray = (value: Uint8Array | null) => (value == null ? null : Array.from(value));

const expectArrayDeepEqual = (actual: unknown, expected: unknown) => {
    assert.equal(JSON.stringify(actual), JSON.stringify(expected));
};

describe('std:io', async ({ test }) => {
    test('Reader.fromCallback yields sequential chunks and EOF', async () => {
        const chunks: Array<Uint8Array | null> = [ascii('hello'), ascii(' '), ascii('world'), null];
        const reader = readerFromCallback(() => chunks.shift() ?? null);

        const handle = getReaderHandle(reader);
        assert.equal(typeof handle, 'string');
        assert.ok(handle.length > 0);

        const first = await reader.read();
        expectArrayDeepEqual(toArray(first), toArray(ascii('hello')));

        const second = await reader.read();
        expectArrayDeepEqual(toArray(second), toArray(ascii(' ')));

        const third = await reader.read();
        expectArrayDeepEqual(toArray(third), toArray(ascii('world')));

        const eof = await reader.read();
        assert.equal(eof, null);
    });

    test('Reader.fromCallback supports { chunk, done } objects', async () => {
        let emitted = false;
        const reader = Reader.fromCallback(() => {
            if (emitted) {
                return { chunk: null, done: true };
            }
            emitted = true;
            return { chunk: ascii('done'), done: true };
        });

        const chunk = await reader.read();
        expectArrayDeepEqual(toArray(chunk), toArray(ascii('done')));

        const eof = await reader.read();
        assert.equal(eof, null);
    });

    test('Writer.fromCallback captures writes from different input types', async () => {
        const writes: number[][] = [];
        const writer = writerFromCallback((chunk: Uint8Array) => {
            writes.push(Array.from(chunk));
        });

        const handle = getWriterHandle(writer);
        assert.equal(typeof handle, 'string');
        assert.ok(handle.length > 0);

        await writer.write(ascii('hi'));
        await writer.write(' there');
        await writer.write(new Uint8Array());
        await writer.close();
        assert.ok(writer.closed);

        expectArrayDeepEqual(writes, [
            Array.from(ascii('hi')),
            Array.from(ascii(' there')),
        ]);
    });

    test('Reader.pipeTo transfers all data into Writer', async () => {
        const sourceChunks: Array<Uint8Array | null> = [ascii('foo'), ascii('bar'), ascii('baz'), null];
        const collected: number[][] = [];

        const reader = Reader.fromCallback(() => sourceChunks.shift() ?? null);
        const writer = Writer.fromCallback((chunk: Uint8Array) => {
            collected.push(Array.from(chunk));
        });

        await reader.pipeTo(writer, { chunkSize: 4 });
        await reader.close();
        await writer.close();

        expectArrayDeepEqual(collected, [
            Array.from(ascii('foo')),
            Array.from(ascii('bar')),
            Array.from(ascii('baz')),
        ]);
    });

    test('Reader async iterator streams until completion', async () => {
        const payloads: Array<Uint8Array | null> = [ascii('a'), ascii('b'), ascii('c'), null];
        const reader = Reader.fromCallback(() => payloads.shift() ?? null);
        const collected: string[] = [];

        for await (const chunk of reader) {
            collected.push(String.fromCharCode(...chunk));
        }

        expectArrayDeepEqual(collected, ['a', 'b', 'c']);
    });

    test('ReadableStream adapter bridges to WHATWG streams when available', async () => {
        if (typeof ReadableStream !== 'function') {
            assert.ok(true, 'ReadableStream not available; skipping');
            return;
        }

        const pieces: Array<Uint8Array | null> = [ascii('x'), ascii('y'), ascii('z'), null];
        const reader = Reader.fromCallback(() => pieces.shift() ?? null);
        const stream = reader.toReadableStream();

        const readerStream = stream.getReader();
        const result: string[] = [];

        while (true) {
            const { value, done } = await readerStream.read();
            if (done) {
                break;
            }
            result.push(String.fromCharCode(...value!));
        }

        expectArrayDeepEqual(result, ['x', 'y', 'z']);
    });

    test('WritableStream adapter accepts enqueued data', async () => {
        if (typeof WritableStream !== 'function') {
            assert.ok(true, 'WritableStream not available; skipping');
            return;
        }

        const chunks: number[][] = [];
        const writer = Writer.fromCallback((chunk: Uint8Array) => {
            chunks.push(Array.from(chunk));
        });

        const stream = writer.toWritableStream();
        const writerStream = stream.getWriter();

        await writerStream.write(ascii('stream'));
        await writerStream.write(' adapters');
        await writerStream.close();

        expectArrayDeepEqual(chunks, [
            Array.from(ascii('stream')),
            Array.from(ascii(' adapters')),
        ]);
    });

    test('typed array view respects byte offset', async () => {
        const raw = new Uint8Array([0x61, 0x62, 0x63, 0x64]); // "abcd"
        const view = raw.subarray(1, 3);                      // should be "bc"

        const reader = readerFromCallback(() => {
            return { chunk: view, done: true };
        });

        const chunk = await reader.read();
        expect(new TextDecoder().decode(chunk!)).toBe('bc');   // passes only with GetTypedArray
        expect(await reader.read()).toBe(null);
    });
});
