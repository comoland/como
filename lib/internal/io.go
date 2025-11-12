package io

import (
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
)

const (
	DefaultChunkSize = 64 * 1024
)

var (
	errHandleNotFound = errors.New("std:io handle not found")
	errHandleMismatch = errors.New("std:io handle does not support requested operation")
	errReaderClosed   = errors.New("std:io reader is closed")
	errWriterClosed   = errors.New("std:io writer is closed")
	globalIOStore     = newIOStore()
	_                 = errHandleMismatch // silence unused in case of build tags tweaking exports
)

type ioHandle struct {
	id        string
	reader    io.Reader
	writer    io.Writer
	closer    io.Closer
	readMu    sync.Mutex
	writeMu   sync.Mutex
	closeOnce sync.Once
	closeErr  error
}

func newIOHandle(reader io.Reader, writer io.Writer, closer io.Closer) *ioHandle {
	handle := &ioHandle{
		reader: reader,
		writer: writer,
	}

	if closer != nil {
		handle.closer = closer
		return handle
	}

	if reader != nil {
		if c, ok := reader.(io.Closer); ok {
			handle.closer = c
		}
	}

	if handle.closer == nil && writer != nil {
		if c, ok := writer.(io.Closer); ok {
			handle.closer = c
		}
	}

	return handle
}

func (h *ioHandle) Read(p []byte) (int, error) {
	if h.reader == nil {
		return 0, errHandleMismatch
	}

	h.readMu.Lock()
	defer h.readMu.Unlock()

	return h.reader.Read(p)
}

func (h *ioHandle) Write(p []byte) (int, error) {
	if h.writer == nil {
		return 0, errHandleMismatch
	}

	h.writeMu.Lock()
	defer h.writeMu.Unlock()

	return h.writer.Write(p)
}

func (h *ioHandle) Close() error {
	h.closeOnce.Do(func() {
		if h.closer != nil {
			h.closeErr = h.closer.Close()
		}
	})

	return h.closeErr
}

type ioStore struct {
	counter atomic.Uint64
	mu      sync.RWMutex
	handles map[string]*ioHandle
}

func newIOStore() *ioStore {
	return &ioStore{
		handles: make(map[string]*ioHandle),
	}
}

func (s *ioStore) nextID() string {
	id := s.counter.Add(1)
	return fmt.Sprintf("io:%d", id)
}

func (s *ioStore) add(handle *ioHandle) string {
	if handle == nil {
		return ""
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	id := s.nextID()
	handle.id = id
	s.handles[id] = handle
	return id
}

func (s *ioStore) get(id string) (*ioHandle, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	handle, ok := s.handles[id]
	if !ok {
		return nil, errHandleNotFound
	}

	return handle, nil
}

func (s *ioStore) remove(id string) (*ioHandle, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	handle, ok := s.handles[id]
	if !ok {
		return nil, errHandleNotFound
	}

	delete(s.handles, id)
	return handle, nil
}

// NewReaderHandle registers an io.Reader and returns a handle identifier.
func NewReaderHandle(reader io.Reader) string {
	if reader == nil {
		return ""
	}

	return globalIOStore.add(newIOHandle(reader, nil, nil))
}

// NewWriterHandle registers an io.Writer and returns a handle identifier.
func NewWriterHandle(writer io.Writer) string {
	if writer == nil {
		return ""
	}

	return globalIOStore.add(newIOHandle(nil, writer, nil))
}

// NewReadWriterHandle registers an io.ReadWriter and returns a handle identifier.
func NewReadWriterHandle(rw io.ReadWriter) string {
	if rw == nil {
		return ""
	}

	return globalIOStore.add(newIOHandle(rw, rw, nil))
}

// ReleaseIOHandle removes the handle from the store and closes it if possible.
func ReleaseIOHandle(id string) error {
	if id == "" {
		return errHandleNotFound
	}

	handle, err := globalIOStore.remove(id)
	if err != nil {
		return err
	}

	return handle.Close()
}

// GetReader returns the io.Reader associated with a handle id.
func GetReader(id string) (io.Reader, error) {
	handle, err := globalIOStore.get(id)
	if err != nil {
		return nil, err
	}

	if handle.reader == nil {
		return nil, errHandleMismatch
	}

	return handle.reader, nil
}

// GetWriter returns the io.Writer associated with a handle id.
func GetWriter(id string) (io.Writer, error) {
	handle, err := globalIOStore.get(id)
	if err != nil {
		return nil, err
	}

	if handle.writer == nil {
		return nil, errHandleMismatch
	}

	return handle.writer, nil
}

func NewHandle(reader io.Reader, writer io.Writer, closer io.Closer) string {
	return globalIOStore.add(newIOHandle(reader, writer, closer))
}

func checkInterfaces(val any) {
	handle := &ioHandle{}

	if r, ok := val.(io.Reader); ok {
		handle.reader = r
	}

	if w, ok := val.(io.Writer); ok {
		handle.writer = w
	}

	if c, ok := val.(io.Closer); ok {
		handle.closer = c
	}
}
