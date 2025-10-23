# Esbuild Plugin Race Condition Fix - Implementation Summary

## Problem Description

The esbuild plugin in `./node/build.go` was experiencing race conditions during high-concurrency operations. The issue manifested as crashes when running multiple concurrent builds, as demonstrated by `./examples/bundler-stress-test.js`.

### Root Cause Analysis

The race condition occurred because:

1. **Multiple goroutines**: Esbuild calls plugin callbacks (`onResolve`, `onLoad`) from multiple goroutines simultaneously
2. **Single channel bottleneck**: All `js.Writer.Call()` operations send to the same `ctx.Channel`
3. **Thread safety violation**: QuickJS is NOT thread-safe, and `js.Writer` operations were being called from goroutines
4. **Memory management issues**: Improper handling of JavaScript function references led to `free_zero_refcount` assertion failures

## Solution Implemented

The fix involved a complete architectural change from using `js.Writer` to using `ctx.WaitCall` with proper memory management:

### Key Changes Made

1. **Replaced `js.Writer` with `ctx.WaitCall`**:
   - `ctx.WaitCall` is thread-safe and designed for goroutine usage
   - It properly serializes JavaScript context operations to the main thread

2. **Proper Memory Management**:
   - Added `fn.Dup()` before storing function references
   - Added `fn.Free()` after each callback execution
   - Added `plugin.Setup.Dup()` and `plugin.Setup.Free()` for plugin setup functions

3. **Simplified Object Creation**:
   - Replaced `ctx.Object()` with plain Go `map[string]interface{}`
   - Direct function calls instead of complex Writer operations

4. **Added Garbage Collection**:
   - Added `runtime.GC()` after build completion to help with memory cleanup

### Code Changes Summary

**Before (Problematic)**:
```go
writer := ctx.Writer(v)
buildObject := ctx.Object()
buildObject.Set("onResolve", func(args js.Arguments) interface{} {
    // Complex Writer-based callback handling
    fnWriter := ctx.Writer(jsCallback)
    fnWriter.Call(...)
    // Race condition: multiple goroutines sending to ctx.Channel
})
writer.Call(buildObject)
```

**After (Fixed)**:
```go
plugin.Setup.Dup()
obj := map[string]interface{}{}
obj["onResolve"] = func(args js.Arguments) any {
    fn, ok := args.Get(1).(js.Function)
    fn.Dup()

    build.OnResolve(OnResolveOptions,
        func(resolveArgs api.OnResolveArgs) (api.OnResolveResult, error) {
            ctx.WaitCall(func() {
                ret := fn.Call(map[string]interface{}{...})
                ctx.GetMap(ret, &onResolve)
                fn.Free() // Proper cleanup
            }).Wait()
            return result, error
        },
    )
}

ctx.WaitCall(func() {
    plugin.Setup.Call(obj)
    plugin.Setup.Free()
}).Wait()
```

## Technical Details

### Why `ctx.WaitCall` Works

1. **Thread Safety**: `ctx.WaitCall` creates a goroutine that sends a function to `ctx.Channel` and waits for completion
2. **Serialization**: All JavaScript context operations are executed sequentially on the main thread
3. **Proper Synchronization**: Uses `WaitGroup` internally to ensure completion before returning

### Memory Management Pattern

```go
// Before using a function reference
fn.Dup()

// Use the function
ctx.WaitCall(func() {
    ret := fn.Call(args)
    // Process result
    fn.Free() // Always free after use
}).Wait()
```

### Error Handling Improvements

- Proper type assertions: `fn, ok := args.Get(1).(js.Function)`
- Consistent error handling in both `onResolve` and `onLoad` callbacks
- Proper cleanup even when errors occur

## Test Results

### Stress Test Results
- **Before**: Crashed with `free_zero_refcount` assertion failure
- **After**: Successfully runs 100 concurrent builds without crashes
- **Performance**: Maintains good performance despite serialization

### Regression Tests
- All existing bundle tests pass: `./tests/bundle.test.ts`
- No functionality regression detected
- Plugin API remains unchanged from JavaScript perspective

## Files Modified

1. **`/home/mamod/Desktop/projects/ai/como/node/build.go`**:
   - Complete rewrite of plugin callback handling
   - Replaced `js.Writer` with `ctx.WaitCall`
   - Added proper memory management
   - Added `runtime.GC()` call

## Key Learnings

1. **Thread Safety is Critical**: QuickJS is NOT thread-safe - never call context methods from goroutines
2. **Use `ctx.WaitCall` for Goroutines**: This is the correct pattern for calling JavaScript from Go goroutines
3. **Memory Management Matters**: Always `Dup()` before storing references and `Free()` after use
4. **Serialization vs Concurrency**: Sometimes serializing operations is better than dealing with race conditions

## Future Considerations

1. **Performance Monitoring**: Monitor if the serialization affects performance under extreme load
2. **Memory Leak Prevention**: Continue using the `Dup()`/`Free()` pattern consistently
3. **Error Handling**: Consider adding more robust error handling for edge cases
4. **Documentation**: Update plugin development docs to emphasize thread safety requirements

## References

- Original working implementation: `./core/build.go` (uses different approach with `js.RPC`)
- Stress test: `./examples/bundler-stress-test.js`
- Passing tests: `./tests/bundle.test.ts`
- QuickJS bridge documentation: `./js/context.go`, `./js/value.go`

---

**Status**: ✅ **RESOLVED** - Race condition fixed, stress test passes, no regressions detected
**Date**: Current implementation
**Tested By**: AI Agent + User verification
