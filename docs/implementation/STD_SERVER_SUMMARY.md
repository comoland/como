# std:server Refresh Summary

## Overview

The std:server module was rebuilt to use Como's shared IO handle infrastructure and to present a modern JavaScript facade. Requests now surface Reader/Writer handles instead of bespoke helpers, and the server lifecycle cleanly follows the two-layer pattern.

## Go Layer (`lib/std/server.go`)

- Replaced the legacy HTTP adapter with a listener-backed `httpServer` that registers body readers and response writers via `iohandle.NewHandle`.
- Added operations for creating servers, awaiting incoming requests, mutating response metadata, flushing, and closing servers/requests (`op_createServer`, `op_server_accept`, `op_request_*`, `op_closeServer`, `op_server_address`).
- Each request is tracked with a unique ID, a registered body reader, and a writer adapter that commits headers exactly once and integrates with QuickJS-safe completion signalling.
- Server instances retain a dedicated TCP listener to expose the bound address (useful for ephemeral ports during testing).

## JavaScript Layer (`lib/std/js/server.js`)

- Introduced `createServer`, `Server`, `ServerRequest`, and `ServerResponse` wrappers that bind to the new ops.
- `ServerRequest` exposes ergonomic `text()`, `json()`, `bytes()`, `stream()`, and `header()` helpers on top of the shared `Reader` implementation.
- `ServerResponse` wraps the Writer handle, supporting `status()`, `setHeader()`, `appendHeader()`, `write()`, `flush()`, and `end()` with automatic resource cleanup.
- The server accept loop runs requests concurrently while tracking in-flight handlers; shutdown waits for graceful completion and releases handles when context cancellation or client disconnects occur.

## Tests (`tests/std-server.test.ts`)

- Added integration coverage for basic request/response handling, including body consumption and status/header propagation.
- Verified streaming responses by writing multiple chunks and asserting the aggregated fetch result.
- Tests rely on ephemeral loopback addresses exposed by `Server.address` to avoid port conflicts and to exercise the IO-backed pathway end-to-end.

## Notes

- The JS facade currently requires an explicit `server.listen()` call; future work may add middleware helpers or higher-level routing on top.
- Static file support is still handled in the Go mux via the `staticDir`/`staticPrefix` options, ready for composition from the JS layer.
