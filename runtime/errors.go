package runtime

import "errors"

// Runtime errors
var (
	ErrRuntimeClosed    = errors.New("runtime has been closed")
	ErrExecutionTimeout = errors.New("execution timeout exceeded")
	ErrInvalidOptions   = errors.New("invalid runtime options")
	ErrContextNotFound  = errors.New("context not found")
	ErrEvaluationFailed = errors.New("JavaScript evaluation failed")
)
