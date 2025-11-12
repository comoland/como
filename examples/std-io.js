import { Reader, Writer, readerFromCallback, writerFromCallback } from 'std:io';

const textDecoder = typeof TextDecoder === 'function' ? new TextDecoder() : null;
const ascii = (text) => new Uint8Array([...text].map((ch) => ch.charCodeAt(0) & 0xff));

async function manualReadExample() {
    const chunks = ["hello", ascii(', '), ascii('Como!'), null];
    const reader = readerFromCallback(() => chunks.shift() ?? null);

    let result = '';
    while (true) {
        const chunk = await reader.read();
        if (chunk === null) {
            break;
        }
        result += textDecoder ? textDecoder.decode(chunk) : String.fromCharCode(...chunk);
    }

    await reader.close();
    console.log('[manual read] %s', result);
}

async function pipeExample() {
    const payload = ["stream ", ascii('all '), ascii('the things')];
    const reader = Reader.fromFile("/home/mamod/Desktop/projects/ai/project");

    const pieces = [];
    let writer = Writer.fromFile('/home/mamod/Desktop/projects/ai/project-copy')
    // let writer = Writer.fromCallback(async (chunk) => {
    //     // console.log(chunk.length)
    //     pieces.push(chunk);
    //     // writer.close()

    //     // return null

    //     if (Buffer.from(chunk).toString().includes("exit")) {
    //         // await writer.close()
    //         // throw new Error("EEEe")
    //     } else {
    //         console.log(chunk.byteLength)
    //     }
    // });


    await reader.pipeTo(writer, { chunkSize: 100 });
    await Promise.all([reader.close(), writer.close()]);

    // console.log('[pipeTo] %s', pieces.join(''));
}

async function webStreamExample() {
    if (typeof ReadableStream !== 'function') {
        console.log('[streams] ReadableStream not available, skipping');
        return;
    }

    const chunks = [ascii('web '), ascii('streams '), ascii('rock'), null];
    const reader = Reader.fromCallback(() => chunks.shift() ?? null);
    const stream = reader.toReadableStream();
    const readerStream = stream.getReader();
    const parts = [];

    while (true) {
        const { value, done } = await readerStream.read();
        if (done) {
            break;
        }
        parts.push(textDecoder ? textDecoder.decode(value) : String.fromCharCode(...value));
    }

    await reader.close();
    console.log('[streams] %s', parts.join(''));
}

async function main() {
    await manualReadExample();
    await pipeExample();
    await webStreamExample();
}

await main()


// setTimeout(() => {

// }, 90000)