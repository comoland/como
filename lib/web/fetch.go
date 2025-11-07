package web

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"time"

	"github.com/comoland/como/js"
)

// FetchRequestOptions represents the options for a fetch request
type FetchRequestOptions struct {
	Method         string            `json:"method"`
	Headers        map[string]string `json:"headers"`
	Body           interface{}       `json:"body"`
	Mode           string            `json:"mode"`
	Credentials    string            `json:"credentials"`
	Cache          string            `json:"cache"`
	Redirect       string            `json:"redirect"`
	Referrer       string            `json:"referrer"`
	ReferrerPolicy string            `json:"referrerPolicy"`
	Integrity      string            `json:"integrity"`
	Keepalive      bool              `json:"keepalive"`
	Signal         interface{}       `json:"signal"`
}

// Headers represents the Headers interface
type Headers struct {
	headers map[string]string
}

// NewHeaders creates a new Headers instance
func NewHeaders() *Headers {
	return &Headers{
		headers: make(map[string]string),
	}
}

// Append adds a new value to a header
func (h *Headers) Append(name, value string) {
	if existing, ok := h.headers[name]; ok {
		h.headers[name] = existing + ", " + value
	} else {
		h.headers[name] = value
	}
}

// Delete removes a header
func (h *Headers) Delete(name string) {
	delete(h.headers, name)
}

// Get returns a header value
func (h *Headers) Get(name string) string {
	return h.headers[name]
}

// Has checks if a header exists
func (h *Headers) Has(name string) bool {
	_, ok := h.headers[name]
	return ok
}

// Set sets a header value
func (h *Headers) Set(name, value string) {
	h.headers[name] = value
}

// FetchError represents a fetch error
type FetchError struct {
	Type    string
	Message string
}

func (e *FetchError) Error() string {
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

func registerFetch(ctx *js.Context) {
	global := ctx.GlobalObject()
	defer global.Free()
	// FormData implementation
	global.Set("FormData", func(args js.Arguments) interface{} {
		form := new(bytes.Buffer)
		writer := multipart.NewWriter(form)

		return map[string]interface{}{
			"append": func(args js.Arguments) interface{} {
				key := args.GetString(0)
				formField, err := writer.CreateFormField(key)

				if err != nil {
					return ctx.Throw(err.Error())
				}

				switch val := args.Get(1).(type) {
				case string:
					formField.Write([]byte(val))
				case []byte:
					formField.Write(val)
				case map[string]interface{}:
					name := val["name"].(string)
					buf := val["value"].([]uint8)

					if tmp, err := writer.CreateFormFile(key, name); err == nil {
						tmp.Write(buf)
					} else {
						return nil
					}
				default:
					err = fmt.Errorf("unknown arg type %T", val)
				}

				if err != nil {
					return ctx.Throw(err.Error())
				}

				return nil
			},
			"delete": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"get": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"getAll": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"has": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return false
			},
			"set": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"entries": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"keys": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"values": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
			"forEach": func(args js.Arguments) interface{} {
				// Not implemented in standard FormData
				return nil
			},
		}
	})

	// Headers implementation
	global.SetConstructor("Headers", func(args js.Arguments) interface{} {
		headers := NewHeaders()

		if args.Len() > 0 {
			switch val := args.Get(0).(type) {
			case map[string]interface{}:
				for k, v := range val {
					headers.Set(k, v.(string))
				}
			case []interface{}:
				for _, pair := range val {
					if arr, ok := pair.([]interface{}); ok && len(arr) == 2 {
						headers.Set(arr[0].(string), arr[1].(string))
					}
				}
			}
		}

		return map[string]interface{}{
			"append": func(args js.Arguments) interface{} {
				headers.Append(args.GetString(0), args.GetString(1))
				return nil
			},
			"delete": func(args js.Arguments) interface{} {
				headers.Delete(args.GetString(0))
				return nil
			},
			"get": func(args js.Arguments) interface{} {
				return headers.Get(args.GetString(0))
			},
			"has": func(args js.Arguments) interface{} {
				return headers.Has(args.GetString(0))
			},
			"set": func(args js.Arguments) interface{} {
				headers.Set(args.GetString(0), args.GetString(1))
				return nil
			},
			"entries": func(args js.Arguments) interface{} {
				entries := make([][]string, 0)
				for k, v := range headers.headers {
					entries = append(entries, []string{k, v})
				}
				return entries
			},
			"keys": func(args js.Arguments) interface{} {
				keys := make([]string, 0)
				for k := range headers.headers {
					keys = append(keys, k)
				}
				return keys
			},
			"values": func(args js.Arguments) interface{} {
				values := make([]string, 0)
				for _, v := range headers.headers {
					values = append(values, v)
				}

				return values
			},
		}
	})

	// Fetch implementation
	global.Set("fetch", func(args js.Arguments) interface{} {
		rawURL, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("fetch arg(0) must be a string")
		}

		url, err := url.Parse(rawURL)
		if err != nil {
			return ctx.Throw(fmt.Sprintf("url '%s' is not valid", rawURL))
		}

		options := FetchRequestOptions{
			Method:         "GET",
			Mode:           "cors",
			Credentials:    "same-origin",
			Cache:          "default",
			Redirect:       "follow",
			Referrer:       "about:client",
			ReferrerPolicy: "no-referrer-when-downgrade",
			Keepalive:      false,
		}

		if args.Len() > 1 {
			err = args.GetMap(1, &options)
			if err != nil {
				return ctx.Throw(err.Error())
			}
		}

		var body io.Reader
		switch b := options.Body.(type) {
		case string:
			body = strings.NewReader(b)
		case []byte:
			body = bytes.NewReader(b)
		case map[string]interface{}:
			if form, ok := b["buffer"]; ok {
				if buf, ok := form.([]byte); ok {
					body = bytes.NewReader(buf)
				}
			}
		}

		if body == nil {
			body = strings.NewReader("")
		}

		req, err := http.NewRequest(options.Method, url.String(), body)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		// Set headers
		for k, v := range options.Headers {
			headerName := http.CanonicalHeaderKey(k)
			req.Header.Set(headerName, v)
		}

		// Set default headers if not present
		if req.Header.Get("Accept") == "" {
			req.Header.Set("Accept", "*/*")
		}

		if req.Header.Get("Connection") == "" {
			req.Header.Set("Connection", "close")
		}

		// Set referrer
		if options.Referrer != "" {
			req.Header.Set("Referer", options.Referrer)
		}

		// Create cookie jar if needed
		var jar *cookiejar.Jar
		if options.Credentials == "include" {
			var err error
			jar, err = cookiejar.New(nil)
			if err != nil {
				return ctx.Throw(fmt.Sprintf("failed to create cookie jar: %v", err))
			}
		} else {
			// Create an empty jar for other cases to avoid nil pointer dereference
			jar, _ = cookiejar.New(nil)
		}

		return ctx.Async(func(async js.Promise) {
			redirected := false
			client := &http.Client{
				Transport: http.DefaultTransport,
				Timeout:   30 * time.Second,
				Jar:       jar,
				CheckRedirect: func(req *http.Request, via []*http.Request) error {
					switch options.Redirect {
					case "error":
						return http.ErrUseLastResponse
					case "manual":
						return http.ErrUseLastResponse
					case "follow":
						if len(via) >= 10 {
							return errors.New("stopped after 10 redirects")
						}
						redirected = true
						return nil
					default:
						return errors.New("invalid redirect option")
					}
				},
			}

			res, err := client.Do(req)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			defer res.Body.Close()
			respBody, bodyReadError := ioutil.ReadAll(res.Body)

			headers := make(map[string]interface{})
			for k, v := range res.Header {
				headers[strings.ToLower(k)] = strings.Join(v, ",")
			}

			response := map[string]interface{}{
				"headers":    headers,
				"ok":         res.StatusCode >= 200 && res.StatusCode < 300,
				"statusText": res.Status,
				"status":     res.StatusCode,
				"type":       "basic", // or "cors", "opaque", "opaqueredirect"
				"url":        res.Request.URL.String(),
				"redirected": redirected,
				"bodyUsed":   false,
			}

			// Add body methods
			response["arrayBuffer"] = func(args js.Arguments) interface{} {
				return ctx.Async(func(async js.Promise) {
					if bodyReadError != nil {
						async.Reject(bodyReadError.Error())
						return
					}
					response["bodyUsed"] = true
					async.Resolve(respBody)
				})
			}

			response["blob"] = func(args js.Arguments) interface{} {
				return ctx.Async(func(async js.Promise) {
					if bodyReadError != nil {
						async.Reject(bodyReadError.Error())
						return
					}
					response["bodyUsed"] = true
					async.Resolve(map[string]interface{}{
						"type": res.Header.Get("Content-Type"),
						"size": len(respBody),
						"arrayBuffer": func(args js.Arguments) interface{} {
							return respBody
						},
					})
				})
			}

			response["formData"] = func(args js.Arguments) interface{} {
				return ctx.Async(func(async js.Promise) {
					if bodyReadError != nil {
						async.Reject(bodyReadError.Error())
						return
					}
					response["bodyUsed"] = true
					// Not implemented
					async.Reject("FormData parsing not implemented")
				})
			}

			response["json"] = func(args js.Arguments) interface{} {
				return ctx.Async(func(async js.Promise) {
					if bodyReadError != nil {
						async.Reject(bodyReadError.Error())
						return
					}
					response["bodyUsed"] = true

					var result map[string]interface{}

					err := json.Unmarshal(respBody, &result)
					if err != nil {
						async.Reject(err.Error())
						return
					}

					async.Resolve(result)

					// async.Resolve(func() interface{} {
					// 	val := ctx.ParseJSON(string(respBody))
					// 	return val
					// })
				})
			}

			response["text"] = func(args js.Arguments) interface{} {
				return ctx.Async(func(async js.Promise) {
					if bodyReadError != nil {
						async.Reject(bodyReadError.Error())
						return
					}
					response["bodyUsed"] = true
					async.Resolve(string(respBody))
				})
			}

			response["clone"] = func(args js.Arguments) interface{} {
				// Not implemented
				return ctx.Throw("Response.clone() not implemented")
			}

			async.Resolve(response)
		})
	})
}
