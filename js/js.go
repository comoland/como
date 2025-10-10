package js

/*
#cgo CFLAGS: -D_GNU_SOURCE
#cgo CFLAGS: -DCONFIG_BIGNUM
#cgo CFLAGS: -I./deps/include
#cgo darwin,amd64 LDFLAGS: -L${SRCDIR}/deps/libs/darwin_amd64 -lquickjs -lm
#cgo darwin,arm64 LDFLAGS: -L${SRCDIR}/deps/libs/darwin_arm64 -lquickjs -lm
#cgo linux,amd64 LDFLAGS: -L${SRCDIR}/deps/libs/linux_amd64 -lquickjs -lm
#cgo linux,arm64 LDFLAGS: -L${SRCDIR}/deps/libs/linux_arm64 -lquickjs -lm
#cgo windows,amd64 LDFLAGS: -L${SRCDIR}/deps/libs/windows_amd64 -lquickjs -lm
#cgo windows,386 LDFLAGS: -L${SRCDIR}/deps/libs/windows_386 -lquickjs -lm
#include "bridge.c"
*/
import "C"

type Error struct {
	Cause string
	Stack string
}

func (err Error) Error() string      { return err.Cause }
func (err Error) StackTrace() string { return err.Stack }

type JSValue C.JSValue

func (v JSValue) IsException() bool { return C.JS_IsException(C.JSValue(v)) == 1 }
