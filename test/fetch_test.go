package test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/comoland/como/core"
	"github.com/comoland/como/js"
)

func TestFetch(t *testing.T) {
	// Create a test server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/test":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"message": "test response"})
		case "/redirect":
			http.Redirect(w, r, "/test", http.StatusFound)
		case "/error":
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("error response"))
		case "/timeout":
			time.Sleep(2 * time.Second)
			w.Write([]byte("timeout response"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer ts.Close()

	// Create a new context
	Loop, ctx := core.Como("")
	defer ctx.Free()

	// Test cases
	tests := []struct {
		name     string
		url      string
		options  map[string]interface{}
		expected interface{}
	}{
		{
			name: "GET request",
			url:  ts.URL + "/test",
			options: map[string]interface{}{
				"method": "GET",
			},
			expected: map[string]string{"message": "test response"},
		},
		{
			name: "POST request",
			url:  ts.URL + "/test",
			options: map[string]interface{}{
				"method": "POST",
				"body":   "test body",
			},
			expected: map[string]string{"message": "test response"},
		},
		{
			name: "Redirect",
			url:  ts.URL + "/redirect",
			options: map[string]interface{}{
				"redirect": "follow",
			},
			expected: map[string]string{"message": "test response"},
		},
		{
			name: "Error response",
			url:  ts.URL + "/error",
			options: map[string]interface{}{
				"method": "GET",
			},
			expected: "error response",
		},
		{
			name: "Timeout",
			url:  ts.URL + "/timeout",
			options: map[string]interface{}{
				"method": "GET",
			},
			expected: "timeout response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Execute the fetch request
			ctx.Eval(fmt.Sprintf(`
				fetch("%s", %s)
					.then(res => res.text())
					.then(text => {
						try {
							const json = JSON.parse(text);
							globalThis.result = json;
						} catch {
							globalThis.result = text;
						}
					})
					.catch(err => {
						globalThis.result = err;
					});
			`, tt.url, toJSON(tt.options)))

			// Wait for the response
			Loop(func() {
				result := ctx.GlobalObject().Get("result")
				if result != tt.expected {
					t.Errorf("expected %v, got %v", tt.expected, result)
				}
			})
		})
	}
}

func TestHeaders(t *testing.T) {
	Loop, ctx := core.Como("")
	defer ctx.Free()

	// Test Headers constructor
	code := `
		const headers = new Headers({
			'Content-Type': 'application/json',
			'X-Custom': 'value'
		});

		headers.append('X-Custom', 'value2');
		headers.set('X-New', 'new-value');

		const result = {
			hasContentType: headers.has('Content-Type'),
			getContentType: headers.get('Content-Type'),
			getCustom: headers.get('X-Custom'),
			getNew: headers.get('X-New'),
			entries: Array.from(headers.entries()),
			keys: Array.from(headers.keys()),
			values: Array.from(headers.values())
		};

		globalThis.result = result;
	`

	ctx.Eval(code)

	// Wait for the response and verify headers
	Loop(func() {
		result := ctx.GlobalObject().Get("result").(js.Value)
		hasContentType := result.Get("hasContentType").(js.Value)
		if !hasContentType.IsBool() || hasContentType.String() != "true" {
			t.Error("Expected Content-Type header to exist")
		}
		if result.Get("getContentType").(js.Value).String() != "application/json" {
			t.Error("Expected Content-Type to be application/json")
		}
		if result.Get("getCustom").(js.Value).String() != "value, value2" {
			t.Error("Expected X-Custom to be value, value2")
		}
		if result.Get("getNew").(js.Value).String() != "new-value" {
			t.Error("Expected X-New to be new-value")
		}
	})
}

func TestFormData(t *testing.T) {
	Loop, ctx := core.Como("")
	defer ctx.Free()

	// Test FormData
	code := `
		const formData = new FormData();
		formData.append('text', 'value');
		formData.append('file', {
			name: 'test.txt',
			value: new Uint8Array([1, 2, 3])
		});

		const result = {
			contentType: formData.getHeaders()
		};

		globalThis.result = result;
	`

	ctx.Eval(code)

	// Wait for the response and verify FormData
	Loop(func() {
		result := ctx.GlobalObject().Get("result").(js.Value)
		if result.Get("contentType").(js.Value).String() == "" {
			t.Error("Expected FormData to have content type")
		}
	})
}

// Helper function to convert Go map to JSON string
func toJSON(v interface{}) string {
	if v == nil {
		return "undefined"
	}
	b, _ := json.Marshal(v)
	return string(b)
}
