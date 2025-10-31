package runtime

import (
	_ "embed"
	"runtime"
	"sync"
	"time"

	"github.com/comoland/como/js"
	"github.com/comoland/como/node"
)

//go:embed main.js
var main string

// RuntimeOptions contains configuration options for the Como runtime
type RuntimeOptions struct {
	// Memory management
	MemoryLimit int64 // Maximum memory usage in bytes (0 = unlimited)
	GCThreshold int64 // Garbage collection threshold in bytes (0 = default)

	// Stack management
	MaxStackSize int64 // Maximum stack size in bytes (0 = default)

	// Execution limits
	ExecutionTimeout time.Duration // Maximum execution time (0 = unlimited)

	// Runtime info
	RuntimeInfo string // Runtime identification string

	// Debug options
	StripSource bool // Strip source code from compiled bytecode
	StripDebug  bool // Strip all debug info including source code

	// Concurrency
	CanBlock bool // Allow blocking operations like Atomics.wait()
}

// DefaultRuntimeOptions returns sensible default options
func DefaultRuntimeOptions() *RuntimeOptions {
	return &RuntimeOptions{
		MemoryLimit:      0, // Unlimited
		GCThreshold:      0, // Default
		MaxStackSize:     0, // Default (1MB)
		ExecutionTimeout: 0, // Unlimited
		RuntimeInfo:      "Como JavaScript Runtime",
		StripSource:      false,
		StripDebug:       false,
		CanBlock:         true,
	}
}

// ComoRuntime represents a JavaScript runtime instance
type ComoRuntime struct {
	rt      *js.JSRunTime
	ctx     *js.Context
	options *RuntimeOptions
	mu      sync.RWMutex
	closed  bool
}

// NewComoRuntime creates a new Como runtime instance with default options
func NewComoRuntime() *ComoRuntime {
	return NewComoRuntimeWithOptions(DefaultRuntimeOptions())
}

// NewComoRuntimeWithOptions creates a new Como runtime instance with custom options
func NewComoRuntimeWithOptions(options *RuntimeOptions) *ComoRuntime {
	runtime.LockOSThread()

	// Create QuickJS runtime
	rt := js.NewRuntime()

	// Apply runtime options
	if options.MemoryLimit > 0 {
		rt.SetMemoryLimit(options.MemoryLimit)
	}
	if options.GCThreshold > 0 {
		rt.SetGCThreshold(options.GCThreshold)
	}
	if options.MaxStackSize > 0 {
		rt.SetMaxStackSize(options.MaxStackSize)
	}
	if options.RuntimeInfo != "" {
		rt.SetRuntimeInfo(options.RuntimeInfo)
	}

	// Set debug options
	stripFlags := 0
	if options.StripSource {
		stripFlags |= 1 << 0 // JS_STRIP_SOURCE
	}
	if options.StripDebug {
		stripFlags |= 1 << 1 // JS_STRIP_DEBUG
	}
	if stripFlags > 0 {
		rt.SetStripInfo(stripFlags)
	}

	// Set blocking behavior
	rt.SetCanBlock(options.CanBlock)

	// Create context
	ctx := rt.NewContext()
	node.InitNode(ctx)

	return &ComoRuntime{
		rt:      rt,
		ctx:     ctx,
		options: options,
		closed:  false,
	}
}

// GetContext returns the JavaScript context
func (cr *ComoRuntime) GetContext() *js.Context {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	if cr.closed {
		return nil
	}
	return cr.ctx
}

// GetRuntime returns the underlying QuickJS runtime
func (cr *ComoRuntime) GetRuntime() *js.JSRunTime {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	if cr.closed {
		return nil
	}
	return cr.rt
}

// SetMemoryLimit sets the maximum memory usage limit
func (cr *ComoRuntime) SetMemoryLimit(limit int64) error {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if cr.closed {
		return ErrRuntimeClosed
	}
	cr.rt.SetMemoryLimit(limit)
	cr.options.MemoryLimit = limit
	return nil
}

// SetGCThreshold sets the garbage collection threshold
func (cr *ComoRuntime) SetGCThreshold(threshold int64) error {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if cr.closed {
		return ErrRuntimeClosed
	}
	cr.rt.SetGCThreshold(threshold)
	cr.options.GCThreshold = threshold
	return nil
}

// SetMaxStackSize sets the maximum stack size
func (cr *ComoRuntime) SetMaxStackSize(size int64) error {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if cr.closed {
		return ErrRuntimeClosed
	}
	cr.rt.SetMaxStackSize(size)
	cr.options.MaxStackSize = size
	return nil
}

// SetExecutionTimeout sets the maximum execution time
func (cr *ComoRuntime) SetExecutionTimeout(timeout time.Duration) error {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if cr.closed {
		return ErrRuntimeClosed
	}
	cr.options.ExecutionTimeout = timeout
	return nil
}

// SetRuntimeInfo sets the runtime identification string
func (cr *ComoRuntime) SetRuntimeInfo(info string) error {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if cr.closed {
		return ErrRuntimeClosed
	}
	cr.rt.SetRuntimeInfo(info)
	cr.options.RuntimeInfo = info
	return nil
}

// GetOptions returns a copy of the current runtime options
func (cr *ComoRuntime) GetOptions() *RuntimeOptions {
	cr.mu.RLock()
	defer cr.mu.RUnlock()

	// Return a copy to prevent external modification
	options := *cr.options
	return &options
}

// Evaluate evaluates JavaScript code and returns the result
func (cr *ComoRuntime) Evaluate(filename, code string) (interface{}, error) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	if cr.closed {
		return nil, ErrRuntimeClosed
	}

	// Load the module
	if len(filename) > 0 {
		cr.ctx.LoadModuleStr(filename, code, 1)
	} else {
		cr.ctx.LoadModuleStr("<eval>", code, 1)
	}

	// Set up timeout if specified
	if cr.options.ExecutionTimeout > 0 {
		done := make(chan interface{}, 1)
		errChan := make(chan error, 1)

		go func() {
			cr.ctx.Loop()
			done <- nil
		}()

		select {
		case <-done:
			return nil, nil
		case err := <-errChan:
			return nil, err
		case <-time.After(cr.options.ExecutionTimeout):
			return nil, ErrExecutionTimeout
		}
	}

	// Run the event loop
	cr.ctx.Loop()
	return nil, nil
}

// evaluateInternal performs the actual evaluation
func (cr *ComoRuntime) evaluateInternal(filename, code string) (interface{}, error) {
	if len(filename) > 0 {
		cr.ctx.LoadModuleStr(filename, code, 1)
	} else {
		cr.ctx.LoadModuleStr("<eval>", code, 1)
	}

	// Don't call Loop() here as it might cause infinite recursion
	// The caller should handle the event loop
	return nil, nil
}

// EvaluateFile evaluates a JavaScript file
func (cr *ComoRuntime) EvaluateFile(filename string) (interface{}, error) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	if cr.closed {
		return nil, ErrRuntimeClosed
	}

	// Load the module
	cr.ctx.LoadModule(filename, 1)

	if cr.options.ExecutionTimeout > 0 {
		done := make(chan interface{}, 1)
		errChan := make(chan error, 1)

		go func() {
			cr.ctx.Loop()
			done <- nil
		}()

		select {
		case <-done:
			return nil, nil
		case err := <-errChan:
			return nil, err
		case <-time.After(cr.options.ExecutionTimeout):
			return nil, ErrExecutionTimeout
		}
	}

	// Run the event loop
	cr.ctx.Loop()
	return nil, nil
}

// evaluateFileInternal performs the actual file evaluation
func (cr *ComoRuntime) evaluateFileInternal(filename string) (interface{}, error) {
	cr.ctx.LoadModule(filename, 1)
	// Don't call Loop() here as it might cause infinite recursion
	// The caller should handle the event loop
	return nil, nil
}

// RunAsync runs code asynchronously and returns a function to execute it
func (cr *ComoRuntime) RunAsync(filename, code string) (func(func()), error) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	if cr.closed {
		return nil, ErrRuntimeClosed
	}

	return func(fn func()) {
		if len(filename) > 0 {
			cr.ctx.LoadModuleStr(filename, code, 1)
		}

		cr.ctx.Loop()

		defer func() {
			fn()
		}()
	}, nil
}

// RunFileAsync runs a file asynchronously and returns a function to execute it
func (cr *ComoRuntime) RunFileAsync(filename string) (func(func()), error) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	if cr.closed {
		return nil, ErrRuntimeClosed
	}

	return func(fn func()) {
		if len(filename) > 0 {
			cr.ctx.LoadModule(filename, 1)
		}

		cr.ctx.Loop()

		defer func() {
			fn()
		}()
	}, nil
}

// Close closes the runtime and frees all resources
func (cr *ComoRuntime) Close() error {
	cr.mu.Lock()
	defer cr.mu.Unlock()

	if cr.closed {
		return nil
	}

	cr.ctx.Free()
	cr.closed = true
	return nil
}

// IsClosed returns true if the runtime has been closed
func (cr *ComoRuntime) IsClosed() bool {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	return cr.closed
}

// Legacy functions for backward compatibility

func ComoContext() *js.Context {
	runtime := NewComoRuntime()
	return runtime.GetContext()
}

func Como(filename string) (func(func()), *js.Context) {
	runtime := NewComoRuntime()
	ctx := runtime.GetContext()

	runner, _ := runtime.RunFileAsync(filename)
	return runner, ctx
}

func ComoStr(filename string, codeStr string) (func(func()), *js.Context) {
	runtime := NewComoRuntime()
	ctx := runtime.GetContext()

	runner, _ := runtime.RunAsync(filename, codeStr)
	return runner, ctx
}

func ComoStr2(filename string, codeStr string) *js.Context {
	runtime := NewComoRuntime()
	ctx := runtime.GetContext()
	if len(filename) > 0 {
		ctx.LoadModuleStr(filename, codeStr, 1)
	}
	return ctx
}
