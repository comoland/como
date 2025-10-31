# Como Runtime Class Implementation

## Overview

The Como Runtime has been redesigned as a comprehensive class-based system that provides full control over JavaScript execution environment configuration. This implementation follows the QuickJS C API capabilities and provides a clean Go interface for managing JavaScript runtimes.

## Architecture

### Core Components

1. **ComoRuntime** - Main runtime class that manages the JavaScript execution environment
2. **RuntimeOptions** - Configuration structure for runtime parameters
3. **Error Handling** - Comprehensive error types for runtime operations

### Key Features

- **Memory Management**: Configurable memory limits and garbage collection thresholds
- **Stack Management**: Customizable stack size limits
- **Execution Control**: Timeout-based execution limits
- **Debug Options**: Source code and debug information stripping
- **Thread Safety**: Full thread-safe operations with proper locking
- **Resource Management**: Automatic cleanup and resource tracking

## API Reference

### ComoRuntime Class

#### Constructor Methods

```go
// Create runtime with default options
rt := runtime.NewComoRuntime()

// Create runtime with custom options
options := &runtime.RuntimeOptions{
    MemoryLimit:      100 * 1024 * 1024, // 100MB
    GCThreshold:      10 * 1024 * 1024,   // 10MB
    MaxStackSize:     2 * 1024 * 1024,    // 2MB
    ExecutionTimeout: 5 * time.Second,     // 5 seconds
    RuntimeInfo:      "My Custom Runtime",
    StripSource:      false,
    StripDebug:       false,
    CanBlock:         true,
}
rt := runtime.NewComoRuntimeWithOptions(options)
```

#### Configuration Methods

```go
// Memory management
err := rt.SetMemoryLimit(200 * 1024 * 1024)  // 200MB
err := rt.SetGCThreshold(20 * 1024 * 1024)   // 20MB

// Stack management
err := rt.SetMaxStackSize(4 * 1024 * 1024)   // 4MB

// Execution control
err := rt.SetExecutionTimeout(10 * time.Second)

// Runtime identification
err := rt.SetRuntimeInfo("Production Runtime")

// Get current configuration
options := rt.GetOptions()
```

#### Execution Methods

```go
// Evaluate JavaScript code
result, err := rt.Evaluate("script.js", `
    console.log("Hello World");
    const result = 42 + 8;
    result;
`)

// Evaluate JavaScript file
result, err := rt.EvaluateFile("path/to/script.js")

// Async execution
runner, err := rt.RunAsync("script.js", code)
runner(func() {
    fmt.Println("Execution completed")
})

// File-based async execution
runner, err := rt.RunFileAsync("path/to/script.js")
```

#### State Management

```go
// Get JavaScript context
ctx := rt.GetContext()

// Get underlying QuickJS runtime
jsRuntime := rt.GetRuntime()

// Check runtime state
if rt.IsClosed() {
    fmt.Println("Runtime is closed")
}

// Close runtime and free resources
err := rt.Close()
```

### RuntimeOptions Structure

```go
type RuntimeOptions struct {
    // Memory management
    MemoryLimit     int64  // Maximum memory usage in bytes (0 = unlimited)
    GCThreshold     int64  // Garbage collection threshold in bytes (0 = default)

    // Stack management
    MaxStackSize     int64  // Maximum stack size in bytes (0 = default)

    // Execution limits
    ExecutionTimeout time.Duration // Maximum execution time (0 = unlimited)

    // Runtime info
    RuntimeInfo      string // Runtime identification string

    // Debug options
    StripSource      bool   // Strip source code from compiled bytecode
    StripDebug       bool   // Strip all debug info including source code

    // Concurrency
    CanBlock         bool   // Allow blocking operations like Atomics.wait()
}
```

### Error Types

```go
var (
    ErrRuntimeClosed     = errors.New("runtime has been closed")
    ErrExecutionTimeout  = errors.New("execution timeout exceeded")
    ErrInvalidOptions    = errors.New("invalid runtime options")
    ErrContextNotFound   = errors.New("context not found")
    ErrEvaluationFailed  = errors.New("JavaScript evaluation failed")
)
```

## Usage Examples

### Basic Usage

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/comoland/como/runtime"
)

func main() {
    // Create runtime with custom options
    options := &runtime.RuntimeOptions{
        MemoryLimit:      50 * 1024 * 1024, // 50MB
        ExecutionTimeout: 5 * time.Second,    // 5 second timeout
        RuntimeInfo:      "My App Runtime",
    }

    rt := runtime.NewComoRuntimeWithOptions(options)
    defer rt.Close()

    // Evaluate JavaScript code
    result, err := rt.Evaluate("app.js", `
        const data = { message: "Hello from Como!" };
        JSON.stringify(data);
    `)

    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Result: %v\n", result)
}
```

### Advanced Configuration

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/comoland/como/runtime"
)

func main() {
    // Create runtime with production settings
    options := &runtime.RuntimeOptions{
        MemoryLimit:      500 * 1024 * 1024, // 500MB
        GCThreshold:      50 * 1024 * 1024,  // 50MB
        MaxStackSize:     8 * 1024 * 1024,   // 8MB
        ExecutionTimeout: 30 * time.Second,   // 30 seconds
        RuntimeInfo:      "Production Runtime v1.0",
        StripSource:      true,               // Strip source for production
        StripDebug:       true,               // Strip debug info
        CanBlock:         false,              // Disable blocking operations
    }

    rt := runtime.NewComoRuntimeWithOptions(options)
    defer rt.Close()

    // Dynamically adjust memory limit based on workload
    if heavyWorkload {
        rt.SetMemoryLimit(1 * 1024 * 1024 * 1024) // 1GB
    }

    // Execute with timeout protection
    result, err := rt.Evaluate("heavy.js", heavyComputationCode)
    if err == runtime.ErrExecutionTimeout {
        fmt.Println("Computation timed out")
    } else if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Computation result: %v\n", result)
}
```

### Error Handling

```go
package main

import (
    "fmt"
    "log"

    "github.com/comoland/como/runtime"
)

func main() {
    rt := runtime.NewComoRuntime()
    defer rt.Close()

    // Handle different error types
    result, err := rt.Evaluate("script.js", code)
    if err != nil {
        switch err {
        case runtime.ErrRuntimeClosed:
            fmt.Println("Runtime was closed")
        case runtime.ErrExecutionTimeout:
            fmt.Println("Script execution timed out")
        case runtime.ErrEvaluationFailed:
            fmt.Println("JavaScript evaluation failed")
        default:
            log.Fatal("Unexpected error:", err)
        }
        return
    }

    fmt.Printf("Success: %v\n", result)
}
```

## Implementation Details

### Thread Safety

The ComoRuntime class is fully thread-safe:
- All public methods use appropriate read/write locks
- Internal state is protected from concurrent access
- Context and runtime objects are safely managed

### Memory Management

- Memory limits are enforced at the QuickJS level
- Garbage collection thresholds control when GC runs
- Automatic cleanup on runtime closure
- Reference counting for JavaScript values

### Execution Control

- Timeout-based execution limits prevent infinite loops
- Async execution support for non-blocking operations
- Proper event loop management
- Error propagation from JavaScript to Go

### Resource Management

- Automatic resource cleanup on Close()
- Prevention of operations on closed runtimes
- Proper context lifecycle management
- Memory leak prevention

## Migration from Legacy API

The new class-based API is backward compatible with the legacy functions:

```go
// Legacy API (still supported)
ctx := runtime.ComoContext()
runner, ctx := runtime.Como("script.js")

// New class-based API (recommended)
rt := runtime.NewComoRuntime()
ctx := rt.GetContext()
runner, _ := rt.RunFileAsync("script.js")
```

## Performance Considerations

- Runtime creation overhead is minimal
- Configuration changes are applied immediately
- Memory limits prevent runaway memory usage
- Timeout protection prevents infinite execution
- Thread-safe operations have minimal overhead

## Best Practices

1. **Always close runtimes**: Use `defer rt.Close()` to ensure cleanup
2. **Set appropriate limits**: Configure memory and execution limits based on your use case
3. **Handle errors properly**: Check for specific error types and handle them appropriately
4. **Use timeouts**: Set execution timeouts to prevent infinite loops
5. **Monitor resource usage**: Use the configuration methods to monitor and adjust limits as needed

## Files Modified

- `runtime/main.go` - Main runtime class implementation
- `runtime/errors.go` - Error definitions
- `js/runtime.go` - Added runtime configuration methods
- `js/bridge.c` - Added C bridge functions for runtime configuration
- `js/bridge.h` - Added function declarations

## Testing

Comprehensive tests are available in:
- `test_runtime.go` - Basic functionality tests
- `runtime_demo.go` - Advanced usage demonstration

Run tests with:
```bash
go run test_runtime.go
go run runtime_demo.go
```

## Conclusion

The new ComoRuntime class provides a comprehensive, thread-safe, and feature-rich interface for managing JavaScript execution environments. It offers fine-grained control over memory usage, execution limits, and runtime behavior while maintaining backward compatibility with existing code.
