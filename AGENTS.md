# Como JavaScript Runtime - AI Agent Guide

## Project Overview

Como is a JavaScript runtime built on top of QuickJS, with a Go bridge for native functionality. The runtime provides Node.js-like APIs and Web APIs while leveraging Go's concurrency model (goroutines) instead of traditional event loops like libuv.

---

## Core Architecture

### Technology Stack
- **JavaScript Engine**: QuickJS (embedded C library)
- **Bridge Language**: Go (CGO for C interop)
- **Concurrency Model**: Go goroutines (NOT event loop based)
- **Module Support**: ESM (ES Modules) with partial CommonJS support

### Key Directories

```
como/
├── js/                    # QuickJS Go bridge (core engine)
├── lib/                   # Runtime modules grouped by domain
│   ├── como/              # Shared Como-specific helpers and tooling
│   │   ├── js/            # JS shims for Como internals
│   │   └── types/         # TypeScript type definitions for native modules
│   ├── core/              # Core runtime primitives (Go + JS layers)
│   ├── node/              # Node.js-like APIs (fs, buffer, etc.)
│   │   └── js/            # JavaScript layers & polyfills for node modules
│   ├── std/               # Standard library style utilities (timers, exec, ...)
│   │   └── js/
│   └── web/               # Web platform APIs (fetch, blob, URL, ...)
│       └── js/            # JavaScript layers for web modules
├── tests/                 # Test files (*.test.ts)
├── examples/              # Example usage files
└── docs/implementation/   # AI-generated implementation docs
```

---

## QuickJS Go Bridge (./js folder)

The `./js` folder contains the Go bridge to QuickJS C engine. Study these files to understand how Go and JavaScript interact:

### Key Files
- `context.go` - Main JS context, value conversion (Go ↔ JS)
- `promise.go` - Promise handling and async operations
- `modules.go` - Module system (import/export)
- `value.go` - JS value wrapper
- `function.go` - Go function → JS function bridge

### Critical Concepts

**Value Conversion**:
- `ctx.GoToJSValue(goValue)` - Convert Go value → JS value
- `ctx.JsToGoValue(jsValue)` - Convert JS value → Go value

**Context Management**:
- `ctx.Ref()` - Increment event loop reference counter
- `ctx.UnRef()` - Decrement event loop reference counter
- Loop exits when `ctx.refs == 0`

---

## Module Implementation Pattern

### Three-Layer Architecture

Most features use a **three-layer design**:

1. **Go Layer** (`*.go` files) - Heavy lifting, performance-critical code, native bindings
2. **JavaScript Layer** (`lib/core/js/*.js`, `lib/node/js/*.js`, or `lib/web/js/*.js`) - Class definitions, argument validation, developer API
3. **TypeScript Layer** (`lib/<domain>/types/*.ts`) - Type definitions for native modules and APIs

**Example**: Study `lib/web/blob.go` + `lib/web/js/blob.js` to see the Go/JS pattern in action.

**Note**: Not all modules have a JavaScript layer. Some modules (like `lib/como/sql.go`) are pure Go implementations that expose native bindings directly. In these cases, TypeScript types provide the developer-facing API documentation.

### Go Layer (Native Bindings)

**Purpose**: Handle performance-critical operations, memory management, native OS calls

**Pattern**:
```go
func goModuleName(ctx *js.Context) {
    mod := ctx.NewModule("module-name.go")

    mod.Export("op_something", func(args js.Arguments) interface{} {
        // Get arguments
        param := args.Get(0)

        // Do heavy work in Go
        result := heavyOperation(param)

        return result
    })
}
```

**Register in** the appropriate module entry point (for example, `lib/web/main.go` or `lib/node/main.go`):
```go
func Register(ctx *js.Context) {
    goModuleName(ctx)
}
```

### JavaScript Layer

**Purpose**: Provide clean developer API, validate arguments, handle edge cases

**Pattern**:
```javascript
import * as ops from 'module-name.go'

class MyClass {
    constructor(data) {
        // Validate arguments
        if (!data) throw new TypeError('data is required')

        // Call native ops for heavy work
        this._id = ops.op_create_thing(data)
    }

    someMethod() {
        // More validation
        // Call native ops
        return ops.op_do_something(this._id)
    }
}

export { MyClass }
```

### Main Entry Point

The file `lib/main.js` is loaded first. It:
- Imports and registers globals
- Sets up polyfills
- Initializes the runtime environment

---

## Async Operations & Concurrency

### Critical Rule: Thread Safety

**QuickJS is NOT thread-safe**. You CANNOT call JS context methods from goroutines.

### Using ctx.Async

`ctx.Async` automatically wraps your function in a goroutine. Do NOT wrap it again.

**Correct Pattern**:
```go
return ctx.Async(func(async js.Promise) {
    // This code runs in a goroutine automatically
    result, err := doSomethingExpensive()

    if err != nil {
        async.Reject(err.Error())
        return
    }

    // Simple values can be passed directly
    async.Resolve(result)
})
```

### Calling JS from Goroutines - THE PROBLEM

**WRONG** ❌ - This will crash:
```go
return ctx.Async(func(async js.Promise) {
    // ctx.ParseJSON is a JS context call - CRASH!
    async.Resolve(ctx.ParseJSON(jsonString))
})
```

**CORRECT** ✅ - Use function wrapper:
```go
return ctx.Async(func(async js.Promise) {
    // Pass a function - it will be called on the main thread
    async.Resolve(func() interface{} {
        // This runs on main thread, safe to call ctx methods
        return ctx.ParseJSON(jsonString)
    })
})
```

### How It Works

1. `ctx.Async` runs your function in a goroutine
2. When you call `async.Resolve(value)`:
   - If `value` is a simple type (string, number, bool, []byte) → sent directly to channel
   - If `value` is a function → scheduled to run on main thread
3. Main thread picks up from `ctx.Channel` and processes safely

### Example: Full Async Pattern

```go
mod.Export("op_read_file", func(args js.Arguments) interface{} {
    filename, ok := args.Get(0).(string)
    if !ok {
        return ctx.Throw("Filename must be a string")
    }

    return ctx.Async(func(async js.Promise) {
        // Heavy I/O in goroutine
        data, err := os.ReadFile(filename)

        if err != nil {
            async.Reject(err.Error())
            return
        }

        // Simple []byte can be resolved directly
        async.Resolve(data)
    })
})
```

### Example: Complex Return Values

```go
mod.Export("op_process_json", func(args js.Arguments) interface{} {
    jsonStr, ok := args.Get(0).(string)
    if !ok {
        return ctx.Throw("Input must be string")
    }

    return ctx.Async(func(async js.Promise) {
        // Heavy processing in goroutine
        processed := processJSON(jsonStr)

        // Need to parse JSON - requires JS context
        async.Resolve(func() interface{} {
            // This function runs on main thread
            return ctx.ParseJSON(processed)
        })
    })
})
```

---

## Testing Guide

### Test Structure

Tests are located in `./tests` folder with pattern `*.test.ts`.

**File Naming**: `test-feature-name.test.ts` (e.g., `test-blob.test.ts`)

### Test Framework

Como provides a custom test runner with two assertion styles:

1. **Assert style**: `assert(condition, message)`
2. **Expect style**: `expect(value).toBe(expected)`

### Test Pattern

```typescript
import { describe, test, expect, assert } from '../tests/runner.ts'

describe('Feature Name', async ({ test }) => {
    test('should do something', async ({ expect, assert }) => {
        const result = await someFunction()
        expect(result).toBe(expected)
        assert(result > 0, 'Result should be positive')
    })

    test('should handle errors', async ({ expect }) => {
        expect(() => {
            throwingFunction()
        }).toThrow()
    })
})
```

### Running Tests

```bash
go run . ./tests/test-name.test.ts
```

### Test Organization

- Multiple `describe` blocks can group related tests
- Use descriptive test names
- Test both happy paths and error cases
- Test edge cases and boundary conditions

---

## Implementation Workflow

### Step 1: Plan

Create a design document in `./docs/implementation/FEATURE_NAME.md` with:
- Feature overview
- API design
- Architecture decisions
- Implementation phases

### Step 2: Implement Go Layer

1. Create `lib/<domain>/feature.go` (e.g., `lib/web/feature.go` for web APIs or `lib/node/feature.go` for Node APIs)
2. Define native operations with `ctx.NewModule("feature.go")`
3. Export operations with `mod.Export("op_name", handler)`
4. Register the module in the matching entry file such as `lib/web/main.go`, `lib/node/main.go`, or another domain-specific `Register` function

**Example**:
```go
func goFeature(ctx *js.Context, global js.Value) {
    mod := ctx.NewModule("feature.go")

    mod.Export("op_create", func(args js.Arguments) interface{} {
        // Implementation
        return result
    })
}
```

### Step 3: Implement JavaScript Layer

1. Create `lib/<domain>/js/feature.js`
2. Import native operations: `import * as ops from 'feature.go'`
3. Create classes/functions with clean API
4. Handle argument validation and error checking
5. Call native operations for heavy work

### Step 4: Add to Main Entry

If global, add to `lib/main.js`:
```javascript
import { MyClass } from 'feature.js'
globalThis.MyClass = MyClass
```

### Step 5: Create Tests

Create `tests/test-feature.test.ts` with comprehensive test coverage.

### Step 6: Create Examples

Create `examples/feature-example.js` with practical usage examples.

### Step 7: Create TypeScript Types

1. Create `lib/<domain>/types/feature.ts` (or add to existing types file)
2. Define types that match the Go implementation's API
3. Export types for module consumers
4. Document complex types with JSDoc comments

**Pattern**:
```typescript
/**
 * Description of the feature module
 */

// Type definitions for native module exports
export interface FeatureModule {
    op_create(data: string): number
    op_doSomething(id: number): Promise<Result>
}

// Type definitions for returned objects
export interface Result {
    value: string
    count: number
}

// Re-export for convenience
export type { FeatureModule as default }
```

**Location**: Types go in `lib/<domain>/types/` folder, mirroring the module structure.

### Step 8: Document

Create summary in `docs/implementation/FEATURE_SUMMARY.md` with:
- What was implemented
- Files created/modified
- How to use
- Test results
- Any gotchas or limitations

---

## Code Style Guidelines

### Go Code

- Use `ctx.Async` for I/O operations
- Always check type assertions: `value, ok := args.Get(0).(string)`
- Return errors with `ctx.Throw("error message")`
- Free JavaScript values when done: `defer value.Free()`

### JavaScript Code

- Use modern ES6+ syntax
- Validate arguments at entry points
- Throw appropriate errors (TypeError, RangeError, Error)
- Use async/await for promises
- Export classes/functions explicitly

### Error Handling

**Go**:
```go
if err != nil {
    return ctx.Throw(err.Error())
}
```

**JavaScript**:
```javascript
if (typeof input !== 'string') {
    throw new TypeError('Input must be a string')
}
```

---

## Memory Management

### JavaScript Values

Always free JavaScript values in Go:
```go
value := ctx.String("hello")
defer value.Free()
```

### Reference Counting

- `ctx.Ref()` - Keep event loop alive
- `ctx.UnRef()` - Signal work is done
- `ctx.Async` handles ref counting automatically

### Garbage Collection

Use FinalizationRegistry in JavaScript for cleanup:
```javascript
const registry = new FinalizationRegistry((id) => {
    ops.op_cleanup(id)
})

class MyClass {
    constructor() {
        this._id = ops.op_create()
        registry.register(this, this._id)
    }
}
```

---

## Module Resolution

### Import Types

1. **Native Go modules**: `import * as mod from 'module.go'`
2. **Como JS modules**: `import { Blob } from 'web:blob'`
   - Every file in `lib/<domain>/js/<feature>.js` is exposed as `'<domain>:<feature>'`
   - Examples: `import colors from 'como:colors'`, `await import('std:timers')`, `await import('web:crypto')`
   - Node domain keeps Node-style resolution, so both `'path'` and `'node:path'` work (same for other built-ins)
3. **Relative modules**: `import { thing } from './path/to/file.js'`
4. **Third-party modules**: `import pkg from 'package-name'`

### Module Registration

**Register Go module**:
```go
mod := ctx.NewModule("my-module.go")
mod.Export("op_function", handler)
```

**Import in JavaScript**:
```javascript
import * as ops from 'my-module.go'
ops.op_function()
```

---

## Common Patterns

### Pattern 1: Synchronous Operation

```go
mod.Export("op_sync_task", func(args js.Arguments) interface{} {
    input := args.Get(0)
    result := process(input)
    return result
})
```

### Pattern 2: Async Operation (Simple Return)

```go
mod.Export("op_async_simple", func(args js.Arguments) interface{} {
    return ctx.Async(func(async js.Promise) {
        result := expensiveWork()
        async.Resolve(result)
    })
})
```

### Pattern 3: Async Operation (Complex Return)

```go
mod.Export("op_async_complex", func(args js.Arguments) interface{} {
    return ctx.Async(func(async js.Promise) {
        data := expensiveWork()

        async.Resolve(func() interface{} {
            // This runs on main thread
            return ctx.ParseJSON(data)
        })
    })
})
```

### Pattern 4: Store Management

```go
type Store struct {
    items sync.Map // Thread-safe map
}

var globalStore = &Store{}

mod.Export("op_store", func(args js.Arguments) interface{} {
    id := generateID()
    globalStore.items.Store(id, data)
    return id
})
```

---

## Debugging Tips

### Enable Verbose Output

Check for debug flags or add logging:
```go
log.Printf("Debug: value = %v", value)
```

### Check Type Conversions

```go
value, ok := args.Get(0).(string)
if !ok {
    log.Printf("Type assertion failed, got: %T", args.Get(0))
}
```

### Trace Async Issues

Add logging in goroutines:
```go
ctx.Async(func(async js.Promise) {
    log.Println("Goroutine started")
    // work
    log.Println("Goroutine finished")
    async.Resolve(result)
})
```

---

## Examples to Study

### Best Reference Implementations

1. **Blob** (`lib/web/blob.go` + `lib/web/js/blob.js`)
   - Two-layer architecture
   - Store management (sync.Map)
   - Zero-copy optimization
   - GC integration

2. **Timers** (`core/timers.go` + `core/js/timers.js`)
   - Goroutine-based timing
   - Class definitions in JS
   - Ref counting

3. **Fetch** (`core/fetch.go` + `core/js/fetch.js`)
   - Async operations
   - HTTP handling in Go
   - Complex response types

---

## Documentation Standards

### For Each Feature

Create in `docs/implementation/`:

1. **FEATURE_NAME.md** - Design document (before implementation)
2. **FEATURE_NAME_SUMMARY.md** - Implementation summary (after completion)

### Summary Should Include

- Files created/modified
- Features implemented
- Test results
- Usage examples
- Known limitations
- Performance characteristics

---

## Quick Reference

### Go Imports

```go
import (
    "github.com/comoland/como/js"
)
```

### Create Module

```go
mod := ctx.NewModule("module-name.go")
mod.Export("op_name", handler)
```

### Get Arguments

```go
args.Get(0)           // Get first argument (interface{})
args.GetValue(0)      // Get as js.Value
args.GetTypedArray(0) // Get Uint8Array as []byte
args.Len()            // Number of arguments
```

### Decode Argument Maps

Use `args.GetMap(index, &output)` when a JavaScript caller passes a plain object or array and you want Go to receive a typed struct or slice. The helper delegates to `mapstructure.Decode`, so the target must be a pointer, and you may rely on `mapstructure` tags such as `mapstructure:",squash"` for nested embedding. Always check the returned error and surface it with `ctx.Throw`.

- `lib/std/exec.go` decodes the array of CLI arguments and the optional env list into `[]string`, keeping the Go `exec.Command` call ergonomic while letting JavaScript supply plain arrays.
- `lib/como/build.go` maps complex esbuild options into the strongly typed `buildOptions` struct and later plugin callbacks (`api.OnResolveOptions`, `api.OnLoadOptions`), showing how `GetMap` scales when bridging nested configuration objects.

When you already hold a value (for example, something returned from a JS callback), call `ctx.GetMap(value, &output)`; it uses the same decoder but is not tied to an argument index.

### Return Values

```go
return simpleValue              // Sync return
return ctx.Throw("error")       // Throw error
return ctx.Async(func(async js.Promise) {
    async.Resolve(value)
    async.Reject(error)
})
```

---

## TypeScript Types Layer

### Overview

TypeScript type definitions provide developer-facing API documentation and type safety for native Go modules. They serve as the contract between the Go implementation and TypeScript/JavaScript consumers.

### Directory Structure

Type definitions are organized by domain, mirroring the module structure:

```
lib/
├── como/
│   └── types/
│       └── sqlite.d.ts     # Types for como:sqlite module
├── core/
│   └── types/              # Types for core modules (if needed)
├── node/
│   └── types/              # Types for node modules (if needed)
└── web/
    └── types/               # Types for web modules (if needed)
```

### When to Create Types

Create TypeScript types for:
- **Native Go modules** that don't have a JavaScript wrapper layer
- **Complex APIs** that benefit from type documentation
- **New implementations** that need type safety
- **Fixed implementations** where types clarify the corrected API

### Type Definition Pattern

**For Native Modules** (like `como:sqlite`):

Create a single `.d.ts` file with the module declaration and all types inside:

```typescript
/**
 * SQLite database module types
 *
 * Module: como:sqlite
 * Usage: import * as sqlite from 'como:sqlite'
 */

// Module declaration - enables TypeScript to recognize 'como:sqlite' imports
declare module 'como:sqlite' {
    // All type definitions go inside the module declaration

    export interface ExecResult {
        lastInsertId: number
        rowsAffected: number
        error: string | null
    }

    export type TRecord = Record<string, any>

    export interface SQLiteModule {
        database(driver: string, options: string): Database
        register(name: string, extensions: string[]): void
    }

    export interface Database {
        close(): void
        begin(): Transaction
        exec: ExecFunction
        query(sql: string, ...bindArgs: any[]): Promise<TRecord[]>
        query2(sql: string, ...bindArgs: any[]): QueryStreamResult
    }

    // ... other types ...

    const sqlite: SQLiteModule
    export default sqlite
}
```

**Key Points**:
- Use `.d.ts` extension (TypeScript declaration file)
- Wrap all types in `declare module 'module:name' { ... }`
- Export all types that should be available to consumers
- Include default export for the module instance

### Type Definition Guidelines

1. **Match Go Implementation**: Types must accurately reflect the Go code's actual behavior
2. **Document Complex APIs**: Use JSDoc comments for methods and complex types
3. **Export Everything**: Export all types that consumers might need
4. **Use Descriptive Names**: Choose clear, self-documenting type names
5. **Handle Promises**: Mark async operations as returning `Promise<T>`
6. **Support Variadic Args**: Use rest parameters (`...args: any[]`) when appropriate
7. **Include Error Types**: Document error return types (e.g., `error: string | null`)

### File Naming Convention

- One `.d.ts` file per native module: `sqlite.d.ts` for `como:sqlite`
- **No namespace prefix** in filename (e.g., `sqlite.d.ts` not `como-sqlite.d.ts`) since it's already in the domain folder (`lib/como/types/`)
- Use kebab-case for multi-word modules: `text-encoder.d.ts`
- Match the module name when possible (without the namespace prefix)

### Usage in TypeScript Projects

Consumers can import types directly from the module:

```typescript
// Import the module - types are automatically available
import sqlite from 'como:sqlite'
const db = sqlite.database("sqlite3", "file:app.db")

// Import specific types
import type { Database, ExecResult, Transaction } from 'como:sqlite'
```

**TypeScript Configuration**: Add a path mapping in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "como:sqlite": ["./lib/como/types/sqlite.d.ts"]
    }
  }
}
```

This enables TypeScript to resolve types for `'como:sqlite'` imports from any location in the project.

### Integration with Module System

Types are separate from the runtime implementation. They:
- Don't affect runtime behavior
- Provide IDE autocomplete and type checking
- Serve as documentation for the API
- Help catch type errors at compile time

### Example: Complete Type Definition

See `lib/como/types/sqlite.d.ts` for a complete example of typing a native Go module with module declaration.

---

## Final Notes

- **Study existing implementations** before creating new ones
- **Ask questions** if unclear about thread safety or async patterns
- **Document everything** for future agents
- **Test thoroughly** including edge cases
- **Keep Go layer thin** - push complexity to JS when possible
- **Use goroutines wisely** - remember the thread-safety rules

---

*This guide is for AI agents working on Como. Keep it updated as patterns evolve.*
