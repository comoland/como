package web

import (
	"crypto/rand"
	"fmt"
	"sync"

	"github.com/comoland/como/js"
)

// BlobPart interface for different types of blob parts
type BlobPart interface {
	Read() ([]byte, error)
	Size() int64
}

// InMemoryBlobPart stores blob data in memory
type InMemoryBlobPart struct {
	data []byte
}

func (p *InMemoryBlobPart) Read() ([]byte, error) {
	return p.data, nil
}

func (p *InMemoryBlobPart) Size() int64 {
	return int64(len(p.data))
}

// SlicedBlobPart is a zero-copy slice reference to another part
type SlicedBlobPart struct {
	parentID string
	start    int64
	length   int64
	store    *BlobStore
}

func (p *SlicedBlobPart) Read() ([]byte, error) {
	// Get parent part
	parentInterface, ok := p.store.parts.Load(p.parentID)
	if !ok {
		return nil, fmt.Errorf("parent blob part not found: %s", p.parentID)
	}

	parent, ok := parentInterface.(BlobPart)
	if !ok {
		return nil, fmt.Errorf("invalid parent blob part type")
	}

	// Read parent data
	parentData, err := parent.Read()
	if err != nil {
		return nil, err
	}

	// Return slice (this creates a new slice header but shares underlying array)
	end := p.start + p.length
	if end > int64(len(parentData)) {
		end = int64(len(parentData))
	}

	return parentData[p.start:end], nil
}

func (p *SlicedBlobPart) Size() int64 {
	return p.length
}

// Blob represents a blob with media type and parts
type Blob struct {
	MediaType string
	Parts     []string // UUID strings
}

func (b *Blob) Size(store *BlobStore) int64 {
	var total int64
	for _, partID := range b.Parts {
		if partInterface, ok := store.parts.Load(partID); ok {
			if part, ok := partInterface.(BlobPart); ok {
				total += part.Size()
			}
		}
	}
	return total
}

func (b *Blob) ReadAll(store *BlobStore) ([]byte, error) {
	size := b.Size(store)
	result := make([]byte, 0, size)

	for _, partID := range b.Parts {
		partInterface, ok := store.parts.Load(partID)
		if !ok {
			return nil, fmt.Errorf("blob part not found: %s", partID)
		}

		part, ok := partInterface.(BlobPart)
		if !ok {
			return nil, fmt.Errorf("invalid blob part type")
		}

		data, err := part.Read()
		if err != nil {
			return nil, err
		}

		result = append(result, data...)
	}

	return result, nil
}

// BlobStore manages blob parts and object URLs
type BlobStore struct {
	parts      sync.Map // map[string]BlobPart
	objectURLs sync.Map // map[string]*Blob
	mu         sync.RWMutex
}

func NewBlobStore() *BlobStore {
	return &BlobStore{}
}

func (s *BlobStore) InsertPart(part BlobPart) string {
	id := generateUUID()
	s.parts.Store(id, part)
	return id
}

func (s *BlobStore) GetPart(id string) (BlobPart, error) {
	partInterface, ok := s.parts.Load(id)
	if !ok {
		return nil, fmt.Errorf("blob part not found: %s", id)
	}

	part, ok := partInterface.(BlobPart)
	if !ok {
		return nil, fmt.Errorf("invalid blob part type")
	}

	return part, nil
}

func (s *BlobStore) RemovePart(id string) {
	s.parts.Delete(id)
}

func (s *BlobStore) InsertObjectURL(blob *Blob) string {
	id := generateUUID()
	url := fmt.Sprintf("blob:null/%s", id)
	s.objectURLs.Store(url, blob)
	return url
}

func (s *BlobStore) GetObjectURL(url string) (*Blob, error) {
	blobInterface, ok := s.objectURLs.Load(url)
	if !ok {
		return nil, fmt.Errorf("object URL not found: %s", url)
	}

	blob, ok := blobInterface.(*Blob)
	if !ok {
		return nil, fmt.Errorf("invalid blob type")
	}

	return blob, nil
}

func (s *BlobStore) RevokeObjectURL(url string) error {
	_, ok := s.objectURLs.Load(url)
	if !ok {
		return fmt.Errorf("object URL not found: %s", url)
	}
	s.objectURLs.Delete(url)
	return nil
}

// generateUUID creates a simple UUID v4 without external dependencies
func generateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		// Fallback to less secure method if crypto/rand fails
		for i := range b {
			b[i] = byte(i)
		}
	}

	// Set version (4) and variant bits
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant RFC4122

	return fmt.Sprintf("%x-%x-%x-%x-%x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// Global blob store instance
var globalBlobStore = NewBlobStore()

func registerBlob(ctx *js.Context) {
	mod := ctx.NewModule("blob.go")
	store := globalBlobStore

	// op_blob_create_part: Create an in-memory blob part
	mod.Export("op_blob_create_part", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("op_blob_create_part requires 1 argument")
		}

		// Use GetTypedArray to properly handle Uint8Array views
		// This respects the view's length and byteOffset, not just the underlying buffer
		data, err := args.GetTypedArray(0)
		if err != nil {
			return ctx.Throw("First argument must be Uint8Array")
		}

		// Create a copy of the data to avoid issues with JS memory
		dataCopy := make([]byte, len(data))
		copy(dataCopy, data)

		part := &InMemoryBlobPart{data: dataCopy}
		id := store.InsertPart(part)

		return id
	})

	// op_blob_slice_part: Create a zero-copy slice of a blob part
	mod.Export("op_blob_slice_part", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("op_blob_slice_part requires 3 arguments")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (UUID)")
		}

		start, ok := args.Get(1).(int64)
		if !ok {
			// Try float64 conversion
			if startFloat, ok := args.Get(1).(float64); ok {
				start = int64(startFloat)
			} else {
				return ctx.Throw("Second argument must be number (start)")
			}
		}

		length, ok := args.Get(2).(int64)
		if !ok {
			// Try float64 conversion
			if lengthFloat, ok := args.Get(2).(float64); ok {
				length = int64(lengthFloat)
			} else {
				return ctx.Throw("Third argument must be number (length)")
			}
		}

		// Verify parent exists
		_, err := store.GetPart(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		// Create sliced part
		slicedPart := &SlicedBlobPart{
			parentID: id,
			start:    start,
			length:   length,
			store:    store,
		}

		newID := store.InsertPart(slicedPart)
		return newID
	})

	// op_blob_read_part: Read blob part data
	mod.Export("op_blob_read_part", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("op_blob_read_part requires 1 argument")
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (UUID)")
		}

		part, err := store.GetPart(id)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return ctx.Async(func(async js.Promise) {
			data, err := part.Read()
			if err != nil {
				async.Reject(err.Error())
				return
			}

			async.Resolve(data)
		})

	})

	// op_blob_remove_part: Remove a blob part (GC cleanup)
	mod.Export("op_blob_remove_part", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return nil
		}

		id, ok := args.Get(0).(string)
		if !ok {
			return nil
		}

		store.RemovePart(id)
		return nil
	})

	// op_blob_create_object_url: Create a blob:// URL
	mod.Export("op_blob_create_object_url", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("op_blob_create_object_url requires 2 arguments")
		}

		mediaType, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (mediaType)")
		}

		partIDs, ok := args.Get(1).([]interface{})
		if !ok {
			return ctx.Throw("Second argument must be array (partIDs)")
		}

		// Convert interface{} array to string array
		parts := make([]string, len(partIDs))
		for i, partID := range partIDs {
			if str, ok := partID.(string); ok {
				parts[i] = str
			} else {
				return ctx.Throw(fmt.Sprintf("Part ID at index %d must be string", i))
			}
		}

		blob := &Blob{
			MediaType: mediaType,
			Parts:     parts,
		}

		url := store.InsertObjectURL(blob)
		return url
	})

	// op_blob_revoke_object_url: Revoke a blob:// URL
	mod.Export("op_blob_revoke_object_url", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("op_blob_revoke_object_url requires 1 argument")
		}

		url, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (URL)")
		}

		err := store.RevokeObjectURL(url)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		return nil
	})

	// op_blob_from_object_url: Get blob data from object URL
	mod.Export("op_blob_from_object_url", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("op_blob_from_object_url requires 1 argument")
		}

		url, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (URL)")
		}

		blob, err := store.GetObjectURL(url)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		// Build parts info
		parts := make([]map[string]interface{}, len(blob.Parts))
		for i, partID := range blob.Parts {
			part, err := store.GetPart(partID)
			if err != nil {
				return ctx.Throw(err.Error())
			}

			parts[i] = map[string]interface{}{
				"uuid": partID,
				"size": part.Size(),
			}
		}

		return map[string]interface{}{
			"media_type": blob.MediaType,
			"parts":      parts,
		}
	})
}
