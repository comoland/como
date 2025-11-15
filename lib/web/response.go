package web

import (
	"fmt"
	"sync"

	"github.com/comoland/como/js"
)

const (
	responseTypeBasic              = "basic"
	responseTypeCors               = "cors"
	responseTypeOpaque             = "opaque"
	responseTypeOpaqueRedirect     = "opaqueredirect"
	responseTypeDefault            = responseTypeBasic
	responseTypeError              = "error"
	responseBodyKindNone           = "none"
	responseBodyKindBytes          = "bytes"
	responseBodyKindBlob           = "blob"
	maxResponseStatus          int = 599
	minResponseStatus          int = 200
)

type responseRecord struct {
	id          string
	status      int
	statusText  string
	headers     map[string]string
	url         string
	respType    string
	bodyKind    string
	body        []byte
	blobParts   []string
	contentType string
	bodyUsed    bool
}

func (r *responseRecord) cloneHeaders() map[string]string {
	if len(r.headers) == 0 {
		return map[string]string{}
	}
	cloned := make(map[string]string, len(r.headers))
	for k, v := range r.headers {
		cloned[k] = v
	}
	return cloned
}

func (r *responseRecord) hasBody() bool {
	return r.bodyKind != responseBodyKindNone
}

func (r *responseRecord) cloneWithoutID() *responseRecord {
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

	return &responseRecord{
		status:      r.status,
		statusText:  r.statusText,
		headers:     r.cloneHeaders(),
		url:         r.url,
		respType:    r.respType,
		bodyKind:    r.bodyKind,
		body:        bodyCopy,
		blobParts:   blobPartsCopy,
		contentType: r.contentType,
		bodyUsed:    false,
	}
}

type responseStore struct {
	mu      sync.RWMutex
	records map[string]*responseRecord
}

func newResponseStore() *responseStore {
	return &responseStore{
		records: make(map[string]*responseRecord),
	}
}

func (s *responseStore) insert(record *responseRecord) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	record.id = generateUUID()
	s.records[record.id] = record
	return record.id
}

func (s *responseStore) snapshot(id string) (*responseRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	record, ok := s.records[id]
	if !ok {
		return nil, fmt.Errorf("response not found: %s", id)
	}

	copyRecord := record.cloneWithoutID()
	copyRecord.id = record.id
	copyRecord.bodyUsed = record.bodyUsed
	return copyRecord, nil
}

func (s *responseStore) clone(id string) (*responseRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	record, ok := s.records[id]
	if !ok {
		return nil, fmt.Errorf("response not found: %s", id)
	}

	if record.bodyUsed {
		return nil, fmt.Errorf("cannot clone a disturbed Response")
	}

	cloned := record.cloneWithoutID()
	cloned.id = generateUUID()
	s.records[cloned.id] = cloned
	return cloned, nil
}

func (s *responseStore) consumeBody(id string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	record, ok := s.records[id]
	if !ok {
		return nil, fmt.Errorf("response not found: %s", id)
	}

	if record.bodyUsed {
		return nil, fmt.Errorf("body already used")
	}

	data, err := record.readBody()
	if err != nil {
		return nil, err
	}

	record.bodyUsed = true
	if len(data) > 0 {
		record.bodyKind = responseBodyKindBytes
		record.body = make([]byte, len(data))
		copy(record.body, data)
		record.blobParts = nil
	} else {
		record.body = nil
		record.blobParts = nil
		record.bodyKind = responseBodyKindNone
	}

	return data, nil
}

func (r *responseRecord) readBody() ([]byte, error) {
	switch r.bodyKind {
	case responseBodyKindNone:
		return []byte{}, nil
	case responseBodyKindBytes:
		if len(r.body) == 0 {
			return []byte{}, nil
		}
		data := make([]byte, len(r.body))
		copy(data, r.body)
		return data, nil
	case responseBodyKindBlob:
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

type responseCreatePayload struct {
	Status       int               `mapstructure:"status"`
	StatusText   string            `mapstructure:"statusText"`
	Headers      map[string]string `mapstructure:"headers"`
	URL          string            `mapstructure:"url"`
	ResponseType string            `mapstructure:"type"`
	BodyKind     string            `mapstructure:"bodyKind"`
	BlobParts    []string          `mapstructure:"blobParts"`
	ContentType  string            `mapstructure:"contentType"`
}

var globalResponseStore = newResponseStore()

func registerResponse(ctx *js.Context) {
	mod := ctx.NewModule("response.go")
	store := globalResponseStore

	mod.Export("op_response_create", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_response_create requires payload")
		}

		payload := responseCreatePayload{}
		if err := args.GetMap(0, &payload); err != nil {
			return ctx.Throw(err.Error())
		}

		if payload.Status == 0 {
			payload.Status = 200
		}

		if payload.Status < 0 || payload.Status > maxResponseStatus {
			return ctx.Throw(fmt.Sprintf("invalid Response status %d", payload.Status))
		}

		if payload.Headers == nil {
			payload.Headers = map[string]string{}
		}

		respType := payload.ResponseType
		if respType == "" {
			respType = responseTypeDefault
		}

		bodyKind := payload.BodyKind
		if bodyKind == "" {
			bodyKind = responseBodyKindNone
		}

		var bodyBytes []byte
		switch bodyKind {
		case responseBodyKindNone:
			// no-op
		case responseBodyKindBytes:
			if args.Len() < 2 {
				return ctx.Throw("body bytes are required for bodyKind 'bytes'")
			}
			raw, err := args.GetTypedArray(1)
			if err != nil {
				return ctx.Throw("body must be Uint8Array")
			}
			bodyBytes = make([]byte, len(raw))
			copy(bodyBytes, raw)
		case responseBodyKindBlob:
			if len(payload.BlobParts) == 0 {
				return ctx.Throw("blob body requires part IDs")
			}
		default:
			return ctx.Throw(fmt.Sprintf("unsupported bodyKind '%s'", bodyKind))
		}

		record := &responseRecord{
			status:      payload.Status,
			statusText:  payload.StatusText,
			headers:     payload.Headers,
			url:         payload.URL,
			respType:    respType,
			bodyKind:    bodyKind,
			body:        bodyBytes,
			blobParts:   payload.BlobParts,
			contentType: payload.ContentType,
			bodyUsed:    false,
		}

		return store.insert(record)
	})

	mod.Export("op_response_snapshot", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_response_snapshot requires response id")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("response id must be a string")
		}

		record, err := store.snapshot(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return map[string]interface{}{
			"id":          record.id,
			"status":      record.status,
			"statusText":  record.statusText,
			"headers":     record.headers,
			"url":         record.url,
			"type":        record.respType,
			"bodyUsed":    record.bodyUsed,
			"hasBody":     record.hasBody(),
			"contentType": record.contentType,
		}
	})

	mod.Export("op_response_clone", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_response_clone requires response id")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("response id must be string")
		}

		cloned, err := store.clone(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return cloned.id
	})

	mod.Export("op_response_consume_body", func(args js.Arguments) interface{} {
		if args.Len() == 0 {
			return ctx.Throw("op_response_consume_body requires response id")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("response id must be string")
		}

		data, err := store.consumeBody(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return data
	})
}
