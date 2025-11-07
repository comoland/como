package web

import (
	"github.com/comoland/como/js"
)

func Register(ctx *js.Context) {
	registerBlob(ctx)
	registerURL(ctx)
	registerTextEncoder(ctx)
	registerFetch(ctx)
	registerCrypto(ctx)
}
