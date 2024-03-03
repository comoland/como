package js

/*
#cgo CFLAGS: -I.
#cgo LDFLAGS: -L.
#cgo CFLAGS: -D_GNU_SOURCE
#cgo CFLAGS: -DCONFIG_BIGNUM
#cgo LDFLAGS: -lquickjs -lm -lpthread -ldl
#include "bridge.c"
*/
import "C"

type Error struct {
	Cause string
	Stack string
}

func (err Error) Error() string       { return err.Cause }
func (err Error) StackTrace() string  { return err.Stack }
func (v C.JSValue) IsException() bool { return C.JS_IsException(v) == 1 }
