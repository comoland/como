package web

import (
	"fmt"
	"sync"

	"github.com/comoland/como/js"
)

const (
	bodyKindNone  = "none"
	bodyKindBytes = "bytes"
	bodyKindBlob  = "blob"
)

type requestRecord struct {
	id          string
	url         string
	method      string
	headers     map[string]string
	credentials string
	mode        string
	cache       string
	redirect    string
	referrer    string
	integrity   string
	keepalive   bool
	bodyKind    string
	body        []byte
	blobParts   []string
	contentType string
	bodyUsed    bool
}

func (r *requestRecord) cloneHeaders() map[string]string {
	if len(r.headers) == 0 {
		return map[string]string{}
	}

	cloned := make(map[string]string, len(r.headers))
	for k, v := range r.headers {
		cloned[k] = v
	}
	return cloned
}

func (r *requestRecord) hasBody() bool {
	return r.bodyKind != bodyKindNone
}

func (r *requestRecord) cloneWithoutID() *requestRecord {
	var bodyCopy []byte
	if len(r.body) > 0 {
		bodyCopy = make([]byte, len(r.body))
		copy(bodyCopy, r.body)
	}

	var blobPartsCopy []string
	if len(r.blobParts) > 0 {
		blobPartsCopy = make([]string, len(r.blobParts))
		copy(blobPartsCopy, r.blobParts)
	}

	return &requestRecord{
		url:         r.url,
		method:      r.method,
		headers:     r.cloneHeaders(),
		credentials: r.credentials,
		mode:        r.mode,
		cache:       r.cache,
		redirect:    r.redirect,
		referrer:    r.referrer,
		integrity:   r.integrity,
		keepalive:   r.keepalive,
		bodyKind:    r.bodyKind,
		body:        bodyCopy,
		blobParts:   blobPartsCopy,
		contentType: r.contentType,
		bodyUsed:    false,
	}
}

type requestStore struct {
	mu      sync.RWMutex
	records map[string]*requestRecord
}

func newRequestStore() *requestStore {
	return &requestStore{
		records: make(map[string]*requestRecord),
	}
}

func (s *requestStore) insert(record *requestRecord) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	record.id = generateUUID()
	s.records[record.id] = record
	return record.id
}

func (s *requestStore) snapshot(id string) (*requestRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	record, ok := s.records[id]
	if !ok {
		return nil, fmt.Errorf("request not found: %s", id)
	}

	copyRecord := record.cloneWithoutID()
	copyRecord.id = record.id
	copyRecord.bodyUsed = record.bodyUsed
	return copyRecord, nil
}

func (s *requestStore) clone(id string) (*requestRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	record, ok := s.records[id]
	if !ok {
		return nil, fmt.Errorf("request not found: %s", id)
	}

	if record.bodyUsed {
		return nil, fmt.Errorf("cannot clone a disturbed Request")
	}

	cloned := record.cloneWithoutID()
	cloned.id = generateUUID()
	s.records[cloned.id] = cloned
	return cloned, nil
}

func (s *requestStore) consumeBody(id string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	record, ok := s.records[id]
	if !ok {
		return nil, fmt.Errorf("request not found: %s", id)
	}

	if record.bodyUsed {
		return nil, fmt.Errorf("body already used")
	}

	data, err := record.readBody()
	if err != nil {
		return nil, err
	}

	record.bodyUsed = true
	// Store concrete bytes for potential future snapshots/clones
	if len(data) > 0 {
		record.bodyKind = bodyKindBytes
		record.body = make([]byte, len(data))
		copy(record.body, data)
		record.blobParts = nil
	} else {
		record.body = nil
		record.blobParts = nil
		record.bodyKind = bodyKindNone
	}

	return data, nil
}

func (r *requestRecord) readBody() ([]byte, error) {
	switch r.bodyKind {
	case bodyKindNone:
		return []byte{}, nil
	case bodyKindBytes:
		if len(r.body) == 0 {
			return []byte{}, nil
		}
		data := make([]byte, len(r.body))
		copy(data, r.body)
		return data, nil
	case bodyKindBlob:
		if len(r.blobParts) == 0 {
			return []byte{}, nil
		}

		var result []byte
		for _, partID := range r.blobParts {
			part, err := globalBlobStore.GetPart(partID)
			if err != nil {
				return nil, err
			}

			chunk, err := part.Read()
			if err != nil {
				return nil, err
			}
			result = append(result, chunk...)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("unknown body kind: %s", r.bodyKind)
	}
}

type requestCreatePayload struct {
	URL         string            `mapstructure:"url"`
	Method      string            `mapstructure:"method"`
	Headers     map[string]string `mapstructure:"headers"`
	Credentials string            `mapstructure:"credentials"`
	Mode        string            `mapstructure:"mode"`
	Cache       string            `mapstructure:"cache"`
	Redirect    string            `mapstructure:"redirect"`
	Referrer    string            `mapstructure:"referrer"`
	Integrity   string            `mapstructure:"integrity"`
	Keepalive   bool              `mapstructure:"keepalive"`
	BodyKind    string            `mapstructure:"bodyKind"`
	BlobParts   []string          `mapstructure:"blobParts"`
	ContentType string            `mapstructure:"contentType"`
}

var globalRequestStore = newRequestStore()

func registerRequest(ctx *js.Context) {
	mod := ctx.NewModule("request.go")
	store := globalRequestStore

	mod.Export("op_request_create", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_request_create requires payload")
		}

		payload := requestCreatePayload{}
		if err := args.GetMap(0, &payload); err != nil {
			return ctx.Throw(err.Error())
		}

		if payload.URL == "" {
			return ctx.Throw("Request URL is required")
		}

		if payload.Method == "" {
			payload.Method = "GET"
		}

		if payload.Headers == nil {
			payload.Headers = map[string]string{}
		}

		bodyKind := payload.BodyKind
		if bodyKind == "" {
			bodyKind = bodyKindNone
		}

		var bodyBytes []byte
		switch bodyKind {
		case bodyKindNone:
			// no-op
		case bodyKindBytes:
			if args.Len() < 2 {
				return ctx.Throw("body bytes are required for bodyKind 'bytes'")
			}
			raw, err := args.GetTypedArray(1)
			if err != nil {
				return ctx.Throw("body must be Uint8Array")
			}
			bodyBytes = make([]byte, len(raw))
			copy(bodyBytes, raw)
		case bodyKindBlob:
			if len(payload.BlobParts) == 0 {
				return ctx.Throw("blob body requires part IDs")
			}
		default:
			return ctx.Throw(fmt.Sprintf("unsupported bodyKind '%s'", bodyKind))
		}

		record := &requestRecord{
			url:         payload.URL,
			method:      payload.Method,
			headers:     payload.Headers,
			credentials: payload.Credentials,
			mode:        payload.Mode,
			cache:       payload.Cache,
			redirect:    payload.Redirect,
			referrer:    payload.Referrer,
			integrity:   payload.Integrity,
			keepalive:   payload.Keepalive,
			bodyKind:    bodyKind,
			body:        bodyBytes,
			blobParts:   payload.BlobParts,
			contentType: payload.ContentType,
			bodyUsed:    false,
		}

		return store.insert(record)
	})

	mod.Export("op_request_snapshot", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_request_snapshot requires request id")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("request id must be a string")
		}

		record, err := store.snapshot(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return map[string]interface{}{
			"id":          record.id,
			"url":         record.url,
			"method":      record.method,
			"headers":     record.headers,
			"credentials": record.credentials,
			"mode":        record.mode,
			"cache":       record.cache,
			"redirect":    record.redirect,
			"referrer":    record.referrer,
			"integrity":   record.integrity,
			"keepalive":   record.keepalive,
			"bodyUsed":    record.bodyUsed,
			"hasBody":     record.hasBody(),
			"contentType": record.contentType,
		}
	})

	mod.Export("op_request_clone", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_request_clone requires request id")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("request id must be string")
		}

		cloned, err := store.clone(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return cloned.id
	})

	mod.Export("op_request_consume_body", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_request_consume_body requires request id")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("request id must be string")
		}

		data, err := store.consumeBody(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return data
	})
}
