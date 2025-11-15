package internal

import (
	"sync"
	"sync/atomic"
)

type HandleStore struct {
	counter atomic.Uint64
	handles sync.Map
}

func NewStore() *HandleStore {
	h := new(HandleStore)
	return h
}

func (h *HandleStore) Store(s any) {
	d := h.counter.Add(1)
	h.handles.Store(d, s)
}

func (h *HandleStore) Get(id any) any {
	v, _ := h.handles.Load(id)
	return v
}
