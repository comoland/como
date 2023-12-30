package core

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/comoland/como/js"
)

type fetchRequestOpt struct {
	Headers  map[string]string
	Body     interface{}
	Method   string
	Redirect string
}

func fetch(ctx *js.Context, global js.Value) {
	global.Set("formData", func(args js.Arguments) interface{} {
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
						// r := bytes.NewReader(buf)
						// io.Copy(tmp, r)
					} else {
						return nil
					}
				default:
					err = errors.New(fmt.Sprintf("unknown arg type %T", val))
				}

				if err != nil {
					return ctx.Throw(err.Error())
				}

				return nil
			},
			"getHeaders": func(args js.Arguments) interface{} {
				return writer.FormDataContentType()
			},
			"buffer": func(args js.Arguments) interface{} {
				writer.Close()
				return form.Bytes()
			},
			"body": func(args js.Arguments) interface{} {
				writer.Close()
				return form.String()
			},
		}
	})

	global.Set("fetch", func(args js.Arguments) interface{} {
		rawURL, ok := args.Get(0).(string)

		if !ok {
			return ctx.Throw("fetch arg(0) must be a string")
		}

		url, err := url.Parse(rawURL)
		if err != nil {
			return ctx.Throw(fmt.Sprintf("url '%s' is not valid", rawURL))
		}

		fetchOptions := fetchRequestOpt{
			Method: "GET",
			Body:   "",
		}

		err = args.GetMap(1, &fetchOptions)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		var body io.Reader
		switch val := fetchOptions.Body.(type) {
		case string:
			body = strings.NewReader(fetchOptions.Body.(string))
		case []byte:
			body = bytes.NewReader(fetchOptions.Body.([]byte))
		default:
			return ctx.Throw(fmt.Sprintf("unknown body type %T", val))
		}

		req, err := http.NewRequest(fetchOptions.Method, url.String(), body)
		if err != nil {
			return ctx.Throw(err.Error())
		}

		for k, v := range fetchOptions.Headers {
			headerName := http.CanonicalHeaderKey(k)
			req.Header.Set(headerName, v)
		}

		if req.Header.Get("Accept") == "" {
			req.Header.Set("Accept", "*/*")
		}

		if req.Header.Get("Connection") == "" {
			req.Header.Set("Connection", "close")
		}

		req.Header.Set("Redirect", fetchOptions.Redirect)

		return ctx.Async(func(async js.Promise) {
			redirected := false
			client := &http.Client{
				Transport: http.DefaultTransport,
				Timeout:   30 * time.Second,
				CheckRedirect: func(req *http.Request, via []*http.Request) error {
					switch req.Header.Get("Redirect") {
					case "error":
						return errors.New("redirects are not allowed")
					default:
						if len(via) >= 10 {
							return errors.New("stopped after 10 redirects")
						}
					}

					redirected = true
					return nil
				},
			}

			res, err := client.Do(req)
			if err != nil {
				async.Reject(err.Error())
				return
			}

			res.Header.Set("Redirected", fmt.Sprintf("%v", redirected))

			isBodyUsed := false
			getBody := func() ([]byte, error) {
				defer res.Body.Close()
				respBody, err := ioutil.ReadAll(res.Body)

				if isBodyUsed {
					return nil, errors.New("body already used")
				}

				isBodyUsed = true
				return respBody, err
			}

			headers := make(map[string]interface{})
			for k, v := range res.Header {
				headers[strings.ToLower(k)] = strings.Join(v, ",")
			}

			async.Resolve(map[string]interface{}{
				"headers":    headers,
				"ok":         res.StatusCode >= 200 && res.StatusCode < 300,
				"statusText": res.Status,
				"status":     res.StatusCode,
				"bodyUsed":   isBodyUsed,
				"arrayBuffer": func(args js.Arguments) interface{} {
					return ctx.Async(func(async js.Promise) {
						respBody, err := getBody()
						if err != nil {
							async.Reject(err.Error())
							return
						}

						async.Resolve(respBody)
					})
				},
				"text": func(args js.Arguments) interface{} {
					return ctx.Async(func(async js.Promise) {
						respBody, err := getBody()
						if err != nil {
							async.Reject(err.Error())
							return
						}

						if err != nil {
							async.Reject(err.Error())
							return
						}
						async.Resolve(string(respBody))
					})
				},
				"json": func(args js.Arguments) interface{} {
					args.This.Set("BodyUsed", true)
					return ctx.Async(func(async js.Promise) {
						respBody, err := getBody()
						if err != nil {
							async.Reject(err.Error())
							return
						}

						async.Resolve(func() interface{} {
							val := ctx.ParseJSON(string(respBody))
							return val
						})
					})
				},
			})
		})
	})
}
