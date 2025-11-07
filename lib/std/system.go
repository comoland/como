package std

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	netpprof "net/http/pprof"
	"runtime"
	rpprof "runtime/pprof"
	"sync"
	"time"

	"github.com/comoland/como/js"
)

var (
	pprofMu     sync.Mutex
	pprofSrv    *http.Server
	pprofCancel context.CancelFunc
	pprofRun    bool
)

func startPprofServer(port string) error {
	pprofMu.Lock()
	defer pprofMu.Unlock()
	if pprofRun {
		return fmt.Errorf("pprof server already running")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/debug/pprof/", netpprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", netpprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", netpprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", netpprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", netpprof.Trace)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	ctx, cancel := context.WithCancel(context.Background())
	pprofSrv = srv
	pprofCancel = cancel
	pprofRun = true

	go func() {
		// ListenAndServe will return on shutdown; ignore ErrServerClosed
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			// best-effort logging via stderr
			fmt.Printf("pprof server listen error: %v\n", err)
		}
		// ensure state cleared if server exits
		pprofMu.Lock()
		pprofRun = false
		pprofMu.Unlock()
	}()

	// keep a goroutine that waits for explicit cancel to shutdown
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	return nil
}

func stopPprofServer() error {
	pprofMu.Lock()
	defer pprofMu.Unlock()
	if !pprofRun || pprofSrv == nil {
		return nil
	}
	// cancel goroutine waiting on context and shutdown server
	if pprofCancel != nil {
		pprofCancel()
	}
	// Do a graceful shutdown (also handled by cancel goroutine)
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := pprofSrv.Shutdown(shutdownCtx)
	pprofSrv = nil
	pprofRun = false
	return err
}

// system: expose memory, goroutines, gc trigger and a pprof helper
func registerSystem(ctx *js.Context) {

	mod := ctx.NewModule("std:system")

	// memory(): { Alloc, TotalAlloc, Sys, NumGC, HeapAlloc, HeapSys, ... }
	mod.Export("memory", func(_ js.Arguments) interface{} {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		return map[string]interface{}{
			"Alloc":      m.Alloc,
			"TotalAlloc": m.TotalAlloc,
			"Sys":        m.Sys,
			"Lookups":    m.Lookups,
			"Mallocs":    m.Mallocs,
			"Frees":      m.Frees,
			"HeapAlloc":  m.HeapAlloc,
			"HeapSys":    m.HeapSys,
			"HeapIdle":   m.HeapIdle,
			"HeapInuse":  m.HeapInuse,
			"NumGC":      m.NumGC,
		}
	})

	// goroutines(): number
	mod.Export("goroutines", func(_ js.Arguments) interface{} {
		return runtime.NumGoroutine()
	})

	// gc(): trigger a GC
	mod.Export("gc", func(_ js.Arguments) interface{} {
		runtime.GC()
		return nil
	})

	// pprof namespace
	pp := ctx.Object()
	defer pp.Free()
	mod.Export("pprof", pp)

	// pprof.start(portString) -> Promise
	pp.Set("start", func(args js.Arguments) interface{} {
		port, ok := args.Get(0).(string)
		if !ok || port == "" {
			return ctx.Throw("pprof.start: first arg must be port string (e.g. '6060')")
		}

		return ctx.Async(func(p js.Promise) {
			if err := startPprofServer(port); err != nil {
				p.Reject(err.Error())
				return
			}
			p.Resolve(nil)

		})
	})

	// pprof.stop() -> Promise
	pp.Set("stop", func(_ js.Arguments) interface{} {
		return ctx.Async(func(p js.Promise) {
			if err := stopPprofServer(); err != nil {
				p.Reject(fmt.Sprintf("%v", err))
				return
			}
			p.Resolve(nil)
		})
	})

	// pprof.heapSnapshot(): Promise that resolves to base64-encoded heap profile
	pp.Set("heapSnapshot", func(_ js.Arguments) interface{} {
		return ctx.Async(func(p js.Promise) {
			var buf bytes.Buffer
			if err := rpprof.WriteHeapProfile(&buf); err != nil {
				p.Reject(fmt.Sprintf("pprof.heapSnapshot: %v", err))
				return
			}
			p.Resolve(base64.StdEncoding.EncodeToString(buf.Bytes()))

		})
	})

	// pprof.cpuProfile(durationMs): Promise that captures CPU profile for duration (ms), resolves to base64 string
	pp.Set("cpuProfile", func(args js.Arguments) interface{} {
		var durMs int
		if v, ok := args.Get(0).(int); ok {
			durMs = v
		} else if v, ok := args.Get(0).(float64); ok {
			durMs = int(v)
		} else {
			durMs = 1000 // default 1s
		}

		return ctx.Async(func(p js.Promise) {
			var buf bytes.Buffer
			if err := rpprof.StartCPUProfile(&buf); err != nil {
				p.Reject(fmt.Sprintf("pprof.cpuProfile start: %v", err))
				return
			}
			time.Sleep(time.Duration(durMs) * time.Millisecond)
			rpprof.StopCPUProfile()
			p.Resolve(base64.StdEncoding.EncodeToString(buf.Bytes()))
		})
	})
}
