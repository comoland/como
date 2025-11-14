package std

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/comoland/como/js"
	iohandle "github.com/comoland/como/lib/internal"
)

const (
	defaultServerAddress     = ":3000"
	defaultStaticPrefix      = "/static/"
	requestChannelBufferSize = 128 // Increased to reduce blocking on high concurrency
)

type serverOptions struct {
	Address      string `mapstructure:"address"`
	StaticDir    string `mapstructure:"staticDir"`
	StaticPrefix string `mapstructure:"staticPrefix"`
	ReadTimeout  int    `mapstructure:"readTimeout"`
	WriteTimeout int    `mapstructure:"writeTimeout"`
	IdleTimeout  int    `mapstructure:"idleTimeout"`
}

type httpServer struct {
	id        string
	ctx       *js.Context
	server    *http.Server
	listener  net.Listener
	requests  chan *serverRequest
	shutdown  chan struct{}
	closing   atomic.Bool
	wg        sync.WaitGroup
	staticDir string
}

type serverRequest struct {
	id           string
	server       *httpServer
	req          *http.Request
	response     *responseAdapter
	bodyHandle   string
	writerHandle string
	done         chan struct{}
	closed       atomic.Bool
}

type responseAdapter struct {
	req        *serverRequest
	writer     http.ResponseWriter
	status     int
	mu         sync.Mutex
	committed  bool
	hasStarted bool // True if any response operation has been called
}

type serverRegistry struct {
	mu      sync.RWMutex
	items   map[string]*httpServer
	counter atomic.Uint64
}

type requestRegistry struct {
	counter atomic.Uint64
	mu      sync.RWMutex
	items   map[string]*serverRequest
}

var (
	globalServers   = newServerRegistry()
	globalRequests  = newRequestRegistry()
	errServerClosed = errors.New("std:server server closed")
)

func newServerRegistry() *serverRegistry {
	return &serverRegistry{
		items: make(map[string]*httpServer),
	}
}

func (r *serverRegistry) add(server *httpServer) string {
	id := fmt.Sprintf("server:%d", r.counter.Add(1))
	r.mu.Lock()
	server.id = id
	r.items[id] = server
	r.mu.Unlock()
	return id
}

func (r *serverRegistry) get(id string) (*httpServer, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	server, ok := r.items[id]
	return server, ok
}

func (r *serverRegistry) remove(id string) (*httpServer, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	server, ok := r.items[id]
	if ok {
		delete(r.items, id)
	}
	return server, ok
}

func newRequestRegistry() *requestRegistry {
	return &requestRegistry{
		items: make(map[string]*serverRequest),
	}
}

func (r *requestRegistry) add(req *serverRequest) string {
	id := fmt.Sprintf("request:%d", r.counter.Add(1))
	req.id = id
	r.mu.Lock()
	r.items[id] = req
	r.mu.Unlock()
	return id
}

func (r *requestRegistry) get(id string) (*serverRequest, bool) {
	r.mu.RLock()
	req, ok := r.items[id]
	r.mu.RUnlock()
	return req, ok
}

func (r *requestRegistry) remove(id string) {
	r.mu.Lock()
	delete(r.items, id)
	r.mu.Unlock()
}

func registerServer(ctx *js.Context) {
	mod := ctx.NewModule("std:server.go")

	mod.Export("op_createServer", func(args js.Arguments) interface{} {
		opts, err := parseServerOptions(ctx, args)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		server, err := newHTTPServer(ctx, opts)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		serverID := globalServers.add(server)
		return map[string]any{
			"id":      serverID,
			"address": server.address(),
		}
	})

	mod.Export("op_server_accept", func(args js.Arguments) interface{} {
		serverID := args.GetString(0)
		if serverID == "" {
			return ctx.Throw("server id must be a non-empty string")
		}

		server, ok := globalServers.get(serverID)
		if !ok {
			return ctx.Throw("std:server unknown server id")
		}

		return ctx.Async(func(async js.Promise) {
			select {
			case <-server.shutdown:
				async.Resolve(nil)
			case req, ok := <-server.requests:
				if !ok || req == nil {
					async.Resolve(nil)
					return
				}

				async.Resolve(func() interface{} {
					return buildRequestPayload(req)
				})
			}
		})
	})

	mod.Export("op_request_set_status", func(args js.Arguments) interface{} {
		requestID := args.GetString(0)
		if requestID == "" {
			return ctx.Throw("request id must be a non-empty string")
		}

		statusNumber, ok := args.GetNumber(1)
		if !ok {
			return ctx.Throw("status must be a number")
		}

		req := lookupRequestFast(requestID)
		if req == nil {
			return ctx.Throw("std:server unknown or completed request id")
		}

		if err := req.response.setStatus(int(statusNumber)); err != nil {
			return ctx.Throw(err.Error())
		}

		return true
	})

	mod.Export("op_request_set_header", func(args js.Arguments) interface{} {
		requestID := args.GetString(0)
		if requestID == "" {
			return ctx.Throw("request id must be a non-empty string")
		}

		key := strings.TrimSpace(args.GetString(1))
		if key == "" {
			return ctx.Throw("header name must be a non-empty string")
		}

		value := args.GetString(2)

		req := lookupRequestFast(requestID)
		if req == nil {
			return ctx.Throw("std:server unknown or completed request id")
		}

		req.response.setHeader(key, value)
		return true
	})

	mod.Export("op_request_add_header", func(args js.Arguments) interface{} {
		requestID := args.GetString(0)
		if requestID == "" {
			return ctx.Throw("request id must be a non-empty string")
		}

		key := strings.TrimSpace(args.GetString(1))
		if key == "" {
			return ctx.Throw("header name must be a non-empty string")
		}

		value := args.GetString(2)

		req := lookupRequestFast(requestID)
		if req == nil {
			return ctx.Throw("std:server unknown or completed request id")
		}

		req.response.addHeader(key, value)
		return true
	})

	mod.Export("op_request_flush", func(args js.Arguments) interface{} {
		requestID := args.GetString(0)
		if requestID == "" {
			return ctx.Throw("request id must be a non-empty string")
		}

		req := lookupRequestFast(requestID)
		if req == nil {
			return ctx.Throw("std:server unknown or completed request id")
		}

		if err := req.response.flush(); err != nil {
			return ctx.Throw(err.Error())
		}

		return true
	})

	mod.Export("op_request_end", func(args js.Arguments) interface{} {
		requestID := args.GetString(0)
		if requestID == "" {
			return ctx.Throw("request id must be a non-empty string")
		}

		if req, ok := globalRequests.get(requestID); ok && req != nil {
			req.complete()
		}
		return true
	})

	mod.Export("op_request_has_started", func(args js.Arguments) interface{} {
		requestID := args.GetString(0)
		if requestID == "" {
			return ctx.Throw("request id must be a non-empty string")
		}

		req := lookupRequestFast(requestID)
		if req == nil {
			return false
		}

		req.response.mu.Lock()
		started := req.response.hasStarted
		req.response.mu.Unlock()

		return started
	})

	mod.Export("op_closeServer", func(args js.Arguments) interface{} {
		serverID := args.GetString(0)
		if serverID == "" {
			return ctx.Throw("server id must be a non-empty string")
		}

		server, ok := globalServers.remove(serverID)
		if !ok {
			return ctx.Throw("std:server unknown server id")
		}

		if err := server.close(); err != nil {
			return ctx.Throw(err.Error())
		}

		return true
	})

	mod.Export("op_server_address", func(args js.Arguments) interface{} {
		serverID := args.GetString(0)
		if serverID == "" {
			return ctx.Throw("server id must be a non-empty string")
		}

		server, ok := globalServers.get(serverID)
		if !ok {
			return ctx.Throw("std:server unknown server id")
		}

		return server.address()
	})
}

func parseServerOptions(ctx *js.Context, args js.Arguments) (serverOptions, error) {
	opts := serverOptions{
		Address:      defaultServerAddress,
		StaticPrefix: defaultStaticPrefix,
	}

	if args.Len() == 0 {
		return opts, nil
	}

	switch val := args.Get(0).(type) {
	case string:
		if strings.TrimSpace(val) != "" {
			opts.Address = val
		}
	case map[string]interface{}:
		if err := args.GetMap(0, &opts); err != nil {
			return serverOptions{}, err
		}
	default:
		return serverOptions{}, fmt.Errorf("unsupported server options type: %T", val)
	}

	if strings.TrimSpace(opts.Address) == "" {
		opts.Address = defaultServerAddress
	}

	if strings.TrimSpace(opts.StaticPrefix) == "" {
		opts.StaticPrefix = defaultStaticPrefix
	}

	return opts, nil
}

func newHTTPServer(ctx *js.Context, opts serverOptions) (*httpServer, error) {
	instance := &httpServer{
		ctx:       ctx,
		requests:  make(chan *serverRequest, requestChannelBufferSize),
		shutdown:  make(chan struct{}),
		staticDir: strings.TrimSpace(opts.StaticDir),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", instance.handleRequest)

	if instance.staticDir != "" {
		prefix := opts.StaticPrefix
		if !strings.HasSuffix(prefix, "/") {
			prefix += "/"
		}
		staticHandler := http.StripPrefix(prefix, http.FileServer(http.Dir(instance.staticDir)))
		mux.Handle(prefix, staticHandler)
	}

	httpServer := &http.Server{
		Addr:    opts.Address,
		Handler: mux,
	}

	if opts.ReadTimeout > 0 {
		httpServer.ReadTimeout = time.Duration(opts.ReadTimeout) * time.Millisecond
	}

	if opts.WriteTimeout > 0 {
		httpServer.WriteTimeout = time.Duration(opts.WriteTimeout) * time.Millisecond
	}

	if opts.IdleTimeout > 0 {
		httpServer.IdleTimeout = time.Duration(opts.IdleTimeout) * time.Millisecond
	}

	instance.server = httpServer

	listener, err := net.Listen("tcp", opts.Address)
	if err != nil {
		return nil, err
	}

	instance.listener = listener

	ctx.Ref()
	go func() {
		err := httpServer.Serve(listener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			ctx.Channel <- func() {
				defer ctx.UnRef()
				ctx.Throw2(err.Error())
			}
			return
		}

		ctx.Channel <- func() {
			ctx.UnRef()
		}
	}()

	return instance, nil
}

func (server *httpServer) handleRequest(w http.ResponseWriter, req *http.Request) {
	select {
	case <-server.shutdown:
		http.Error(w, "server shutting down", http.StatusServiceUnavailable)
		return
	default:
	}

	server.wg.Add(1)
	defer server.wg.Done()

	request := newServerRequest(server, w, req)
	globalRequests.add(request)

	select {
	case server.requests <- request:
		<-request.done
	case <-server.shutdown:
		request.complete()
		http.Error(w, "server shutting down", http.StatusServiceUnavailable)
	case <-req.Context().Done():
		request.complete()
	}
}

func (server *httpServer) close() error {
	if server.closing.Load() {
		return nil
	}

	if !server.closing.CompareAndSwap(false, true) {
		return nil
	}

	close(server.shutdown)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := server.server.Shutdown(ctx)
	if server.listener != nil {
		_ = server.listener.Close()
	}
	server.wg.Wait()
	close(server.requests)

	return err
}

func (server *httpServer) address() string {
	if server.listener != nil {
		return server.listener.Addr().String()
	}
	return server.server.Addr
}

func newServerRequest(server *httpServer, w http.ResponseWriter, req *http.Request) *serverRequest {
	bodyHandle := ""
	if req.Body != nil {
		bodyHandle = iohandle.NewHandle(req.Body, nil, req.Body)
	}

	resAdapter := newResponseAdapter(w)

	writerHandle := iohandle.NewHandle(nil, resAdapter, resAdapter)

	request := &serverRequest{
		server:       server,
		req:          req,
		response:     resAdapter,
		bodyHandle:   bodyHandle,
		writerHandle: writerHandle,
		done:         make(chan struct{}),
	}

	resAdapter.req = request

	go func() {
		select {
		case <-req.Context().Done():
			request.complete()
		case <-server.shutdown:
			request.complete()
		case <-request.done:
		}
	}()

	return request
}

func (req *serverRequest) complete() {
	if !req.closed.CompareAndSwap(false, true) {
		return
	}

	req.response.markComplete()

	if id := req.bodyHandle; id != "" {
		req.bodyHandle = ""
		_ = iohandle.ReleaseIOHandle(id)
	}

	if id := req.writerHandle; id != "" {
		req.writerHandle = ""
		_ = iohandle.ReleaseIOHandle(id)
	}

	globalRequests.remove(req.id)

	select {
	case <-req.done:
	default:
		close(req.done)
	}
}

func lookupActiveRequest(id string) (*serverRequest, error) {
	req, ok := globalRequests.get(id)
	if !ok {
		return nil, errors.New("std:server unknown request id")
	}

	if req.closed.Load() {
		return nil, errors.New("std:server request already completed")
	}

	return req, nil
}

// Optimized: inline lookup for hot path operations
func lookupRequestFast(id string) *serverRequest {
	req, ok := globalRequests.get(id)
	if !ok || req == nil || req.closed.Load() {
		return nil
	}
	return req
}

func buildRequestPayload(req *serverRequest) map[string]interface{} {
	// Pre-allocate with estimated capacity to reduce allocations
	headerCount := len(req.req.Header)
	headers := make(map[string][]string, headerCount)
	for key, values := range req.req.Header {
		// Use original key to avoid CanonicalHeaderKey overhead unless needed
		headers[key] = values
	}

	query := req.req.URL.Query()
	queryCount := len(query)
	queryValues := make(map[string][]string, queryCount)
	for key, values := range query {
		queryValues[key] = values
	}

	payload := map[string]interface{}{
		"id":           req.id,
		"method":       req.req.Method,
		"url":          req.req.URL.String(),
		"path":         req.req.URL.Path,
		"queryString":  req.req.URL.RawQuery,
		"remoteAddr":   req.req.RemoteAddr,
		"headers":      headers,
		"query":        queryValues,
		"bodyHandle":   req.bodyHandle,
		"writerHandle": req.writerHandle,
		"host":         req.req.Host,
		"protocol":     req.req.Proto,
	}

	if req.req.URL != nil {
		payload["pathname"] = path.Clean(req.req.URL.Path)
	}

	return payload
}

func newResponseAdapter(w http.ResponseWriter) *responseAdapter {
	return &responseAdapter{
		writer: w,
		status: http.StatusOK,
	}
}

func (adapter *responseAdapter) setStatus(status int) error {
	if status < 100 || status > 999 {
		return fmt.Errorf("std:server invalid status code %d", status)
	}

	adapter.mu.Lock()
	defer adapter.mu.Unlock()

	if adapter.committed {
		return errors.New("std:server response already sent")
	}

	adapter.status = status
	adapter.hasStarted = true
	return nil
}

func (adapter *responseAdapter) setHeader(key, value string) {
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	adapter.writer.Header().Set(key, value)
	adapter.hasStarted = true
}

func (adapter *responseAdapter) addHeader(key, value string) {
	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	adapter.writer.Header().Add(key, value)
	adapter.hasStarted = true
}

func (adapter *responseAdapter) flush() error {
	adapter.mu.Lock()
	defer adapter.mu.Unlock()

	if !adapter.committed {
		adapter.commitLocked()
	}

	flusher, ok := adapter.writer.(http.Flusher)
	if !ok {
		return errors.New("std:server response writer does not support flush")
	}

	flusher.Flush()
	return nil
}

func (adapter *responseAdapter) Close() error {
	if adapter.req != nil {
		adapter.req.complete()
	}
	return nil
}

func (adapter *responseAdapter) markComplete() {
	adapter.mu.Lock()
	defer adapter.mu.Unlock()

	if !adapter.committed {
		adapter.commitLocked()
	}
}

func (adapter *responseAdapter) commitLocked() {
	if adapter.committed {
		return
	}

	status := adapter.status
	if status == 0 {
		status = http.StatusOK
	}

	adapter.writer.WriteHeader(status)
	adapter.committed = true
}

func (adapter *responseAdapter) Write(p []byte) (int, error) {
	adapter.mu.Lock()
	defer adapter.mu.Unlock()

	if !adapter.committed {
		adapter.commitLocked()
	}

	adapter.hasStarted = true
	n, err := adapter.writer.Write(p)
	if err != nil {
		return n, err
	}

	if flusher, ok := adapter.writer.(http.Flusher); ok {
		flusher.Flush()
	}

	return n, nil
}
