# std:io Module

## Overview

The `std:io` module bridges Como's Go runtime with JavaScript-friendly stream primitives. It exposes Go `io.Reader` and `io.Writer` handles to JavaScript, offers adapters for JavaScript callbacks, and provides high-level utilities (classes, iterators, Web Stream facades, piping helpers) to orchestrate streaming workflows across domains.

The implementation follows the project-wide two-layer pattern:

- **Go layer (`lib/std/io.go`)** manages handle storage, async read/write operations, callback adapters, and exposes module ops.
- **JavaScript layer (`lib/std/js/io.js`)** wraps the ops in ergonomic classes (`Reader`, `Writer`) with helpers for pipelines, streams, and resource lifetime management.

## Go Layer Highlights (`lib/std/io.go`)

- Maintains a global handle store keyed by stable strings (`io:%d`). Each entry records optional reader, writer, and closer interfaces plus per-handle locking for thread safety.
- Exported helpers for other Go packages:
  - `NewReaderHandle`, `NewWriterHandle`, `NewReadWriterHandle` to register native handles.
  - `GetReader`, `GetWriter`, `ReleaseIOHandle` for retrieval and cleanup.
- Callback adapters:
  - `callbackReader` uses `ctx.Writer` to invoke JavaScript when Go requests bytes.
  - `callbackWriter` forwards Go writes into JavaScript callbacks.
- QuickJS-safe async ops: `op_readerRead`, `op_writerWrite`, and `op_readerPipe` run in goroutines and resolve via `ctx.Async`, never calling into the JS context directly.
- Handles can be closed explicitly (`op_closeHandle`) and automatically when callback readers report completion.

## JavaScript Layer Highlights (`lib/std/js/io.js`)

- `Reader` and `Writer` classes wrap handle strings, manage lifetimes, expose `handle` properties, and surface `closed` flags.
- Creation helpers:
  - `Reader.fromHandle`, `Writer.fromHandle` validate external handles.
  - `Reader.fromCallback`, `Writer.fromCallback` build Go adapters around JavaScript callbacks using `ctx.Writer` underneath.
  - Top-level helpers (`readerFromCallback`, etc.) provide ergonomic factory functions.
- Lifetime management:
  - `autoClose` (default `true`) optionally registers `FinalizationRegistry` finalizers and auto-closes handles when they naturally exhaust.
  - Manual `close()` calls always release the underlying handle.
- Data access patterns:
  - `Reader.read(size?)` resolves to `Uint8Array` chunks or `null` on EOF while ensuring Go buffers are copied.
  - `Reader[Symbol.asyncIterator]()` enables `for await ... of` consumption.
  - `Reader.pipeTo(writer, { chunkSize })` dispatches transfer to the Go layer for efficient zero-copy piping where possible.
  - `Reader.toReadableStream()` and `Writer.toWritableStream()` create WHATWG stream adapters when those globals exist.
- Utility exports: `getReaderHandle`, `getWriterHandle`, `DEFAULT_CHUNK_SIZE`, plus a default aggregate export.

## JS API Cheatsheet

```javascript
import {
    Reader,
    Writer,
    readerFromCallback,
    writerFromCallback,
    fromReaderHandle,
    fromWriterHandle,
    getReaderHandle,
    getWriterHandle,
    DEFAULT_CHUNK_SIZE,
} from 'std:io';
```

| Construct | Purpose |
|-----------|---------|
| `Reader.fromHandle(id, options?)` | Wrap an existing Go reader handle. |
| `Reader.fromCallback(fn, options?)` | Create a Go reader that pulls chunks from a JS callback. |
| `Reader.prototype.read(size?)` | Async chunk read; returns `Uint8Array` or `null` (EOF). |
| `Reader.prototype.pipeTo(writer, { chunkSize? })` | Stream data directly via Go's `io.Copy`. |
| `Reader.prototype.toReadableStream()` | Bridge into WHATWG `ReadableStream`. |
| `Writer.fromHandle(id, options?)` | Wrap an existing Go writer handle. |
| `Writer.fromCallback(fn, options?)` | Create a Go writer that pushes chunks into a JS callback. |
| `Writer.prototype.write(chunk)` | Async write (accepts `Uint8Array`, `ArrayBuffer`, view, or string). |
| `Writer.prototype.toWritableStream()` | Bridge into WHATWG `WritableStream`. |
| `getReaderHandle(value)` / `getWriterHandle(value)` | Obtain a validated handle string from either an instance or raw id. |

All constructors accept `{ autoClose?: boolean }` (default `true`). Set `autoClose: false` when another subsystem owns the handle and is responsible for release.

## Example Usage (`examples/std-io.js`)

```javascript
import { Reader, Writer, readerFromCallback, writerFromCallback } from 'std:io';

// Build a reader that streams "Hello, Como!" chunk by chunk
const messageParts = [
    new Uint8Array([72, 101, 108, 108, 111]), // Hello
    new Uint8Array([44, 32]),                 // ,
    new Uint8Array([67, 111, 109, 111, 33]),  // Como!
    null,
];
const reader = readerFromCallback(() => messageParts.shift() ?? null);

// Collect chunks via a writer that appends into an array
const received = [];
const writer = writerFromCallback((chunk) => {
    received.push(Buffer.from(chunk).toString('utf8'));
});

await reader.pipeTo(writer);
await Promise.all([reader.close(), writer.close()]);

console.log(received.join('')); // => "Hello, Como!"
```

See `examples/std-io.js` for a more detailed walkthrough that includes Web Stream adapters and manual read loops.

## Integration Guidance

- **Go modules**: wrap native readers/writers with `NewReaderHandle` / `NewWriterHandle` before exporting to JavaScript. Always call `ReleaseIOHandle` when the resource is no longer needed to avoid leaking entries in the store.
- **JavaScript consumers**: prefer `Reader`/`Writer` instances over raw handle strings to benefit from validation, automatic cleanup, and utility helpers.
- **Callback readers**: the callback receives the requested chunk size (hint) and may return:
  - `Uint8Array` / `ArrayBuffer` / typed array view
  - `null` to indicate EOF
  - `{ chunk, done }` objects for explicit completion signalling
- **Callback writers**: the callback receives a `Uint8Array` copy of the data. Throwing from the callback will reject the originating `write()` promise.
- **Pipelines**: `Reader.pipeTo(Writer)` dispatches to Go's `io.CopyBuffer`, minimizing JavaScript overhead for long transfers. Supply `{ chunkSize }` to tune the copy buffer.

## Testing

- Added `tests/std-io.test.ts` covering:
  - Callback-backed readers and writers
  - `{ chunk, done }` return contracts
  - Piping via Go and automatic cleanup
  - Async iteration and Web Stream adapters
  - Handle helper utilities (`getReaderHandle`, `getWriterHandle`)

Run targeted tests with:

```bash
go run . ./tests/std-io.test.ts
```

## Next Steps

- Integrate `std:io` with existing modules such as `std:exec` and `node:fs` so processes and files expose handles directly.
- Expose additional helpers for duplex streams if/when Go subsystems provide bidirectional interfaces.
