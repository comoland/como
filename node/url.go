package node

import (
	"encoding/binary"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/comoland/como/js"
)

// ParseStatus represents the result of URL parsing
const (
	ParseStatusOk              = 0 // Success, href unchanged
	ParseStatusOkSerialization = 1 // Success, needs serialization
	ParseStatusErr             = 2 // Error
)

// UrlSetter constants - must match JavaScript layer
const (
	SetHash     = 0
	SetHost     = 1
	SetHostname = 2
	SetPassword = 3
	SetPathname = 4
	SetPort     = 5
	SetProtocol = 6
	SetSearch   = 7
	SetUsername = 8
)

const NoPort = 65536 // Represents "no port"

// parseURL is the core parsing function used by both op_url_parse and op_url_parse_with_base
func parseURL(ctx *js.Context, href string, baseURL *url.URL, buf []interface{}) (int, string) {
	var parsedURL *url.URL
	var err error

	if baseURL != nil {
		// Parse relative to base
		parsedURL, err = baseURL.Parse(href)
	} else {
		// Parse absolute URL
		parsedURL, err = url.Parse(href)
	}

	if err != nil {
		return ParseStatusErr, ""
	}

	// Validate that we have a scheme for absolute URLs
	if baseURL == nil && parsedURL.Scheme == "" {
		return ParseStatusErr, ""
	}

	// Serialize the URL
	serialized := parsedURL.String()

	// Calculate offsets by parsing the serialized string
	// This ensures accuracy since we're working with the actual output

	// Scheme
	schemeEnd := strings.Index(serialized, ":")
	if schemeEnd == -1 {
		schemeEnd = 0
	} else {
		schemeEnd += 1 // Include ':'
	}

	// Authority section
	usernameEnd := schemeEnd
	hostStart := schemeEnd
	hostEnd := schemeEnd

	if strings.HasPrefix(serialized[schemeEnd:], "//") {
		hostStart = schemeEnd + 2
		usernameEnd = hostStart

		// Find where authority ends (at '/', '?', '#', or end of string)
		authEnd := len(serialized)
		for _, ch := range []string{"/", "?", "#"} {
			if idx := strings.Index(serialized[hostStart:], ch); idx != -1 {
				if hostStart+idx < authEnd {
					authEnd = hostStart + idx
				}
			}
		}

		authority := serialized[hostStart:authEnd]

		// Check for userinfo (username:password@)
		if atIdx := strings.Index(authority, "@"); atIdx != -1 {
			usernameEnd = hostStart + atIdx + 1 // Include '@'
			hostStart = usernameEnd
			authority = authority[atIdx+1:] // Remove userinfo from authority
		}

		// Now authority contains just host:port
		// hostEnd should be at end of hostname (before ':port' if any)
		if colonIdx := strings.LastIndex(authority, ":"); colonIdx != -1 {
			// Check if this is really a port (not IPv6)
			if !strings.Contains(authority, "]") || strings.Index(authority, "]") < colonIdx {
				hostEnd = hostStart + colonIdx
			} else {
				hostEnd = hostStart + len(authority)
			}
		} else {
			hostEnd = hostStart + len(authority)
		}
	}

	// Port handling
	portNum := NoPort
	if parsedURL.Port() != "" {
		if p, err := strconv.Atoi(parsedURL.Port()); err == nil {
			portNum = p
		}
	}

	// Path starts after authority
	pathStart := hostEnd
	if portNum != NoPort {
		pathStart += 1 + len(strconv.Itoa(portNum)) // Include ':port'
	}

	// Query and fragment
	queryStart := 0
	fragmentStart := 0

	if parsedURL.RawQuery != "" {
		queryStart = strings.Index(serialized, "?")
		if queryStart == -1 {
			queryStart = 0
		}
	}

	if parsedURL.Fragment != "" {
		fragmentStart = strings.Index(serialized, "#")
		if fragmentStart == -1 {
			fragmentStart = 0
		}
	}

	// Fill buffer
	if len(buf) >= 8 {
		buf[0] = schemeEnd
		buf[1] = usernameEnd
		buf[2] = hostStart
		buf[3] = hostEnd
		buf[4] = portNum
		buf[5] = pathStart
		buf[6] = queryStart
		buf[7] = fragmentStart
	}

	// Check if serialization differs from input
	if serialized != href {
		return ParseStatusOkSerialization, serialized
	}

	return ParseStatusOk, serialized
}

// setURLComponent modifies a URL component and returns the new URL
func setURLComponent(href string, setter int, value string) (*url.URL, error) {
	parsedURL, err := url.Parse(href)
	if err != nil {
		return nil, err
	}

	switch setter {
	case SetHash:
		parsedURL.Fragment = strings.TrimPrefix(value, "#")

	case SetHost:
		parsedURL.Host = value

	case SetHostname:
		// Preserve port if present
		port := parsedURL.Port()
		parsedURL.Host = value
		if port != "" {
			parsedURL.Host = value + ":" + port
		}

	case SetPassword:
		username := ""
		if parsedURL.User != nil {
			username = parsedURL.User.Username()
		}
		if value != "" {
			parsedURL.User = url.UserPassword(username, value)
		} else {
			parsedURL.User = url.User(username)
		}

	case SetPathname:
		parsedURL.Path = value

	case SetPort:
		hostname := parsedURL.Hostname()
		if value == "" {
			parsedURL.Host = hostname
		} else {
			parsedURL.Host = hostname + ":" + value
		}

	case SetProtocol:
		// Remove trailing ':' if present
		scheme := strings.TrimSuffix(value, ":")
		parsedURL.Scheme = scheme

	case SetSearch:
		// Remove leading '?' if present
		query := strings.TrimPrefix(value, "?")
		parsedURL.RawQuery = query

	case SetUsername:
		password := ""
		if parsedURL.User != nil {
			password, _ = parsedURL.User.Password()
		}
		if password != "" {
			parsedURL.User = url.UserPassword(value, password)
		} else {
			parsedURL.User = url.User(value)
		}

	default:
		return nil, fmt.Errorf("invalid setter: %d", setter)
	}

	return parsedURL, nil
}

func goURL(ctx *js.Context, _ js.Value) {
	mod := ctx.NewModule("url.go")

	// op_url_parse: Parse URL without base
	mod.Export("op_url_parse", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("op_url_parse requires 2 arguments")
		}

		href, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (href)")
		}

		// Get the Uint32Array buffer
		buf, err := args.GetBuffer(1)
		if err != nil {
			return ctx.Throw("Second argument must be Uint32Array")
		}
		if len(buf) < 32 { // 8 * 4 bytes
			return ctx.Throw("Buffer must be at least 32 bytes (Uint32Array with 8 elements)")
		}

		// Create interface slice for results
		results := make([]interface{}, 8)
		status, serialized := parseURL(ctx, href, nil, results)

		// Write results to buffer (as little-endian uint32)
		for i := 0; i < 8 && i < len(results); i++ {
			val := uint32(0)
			switch v := results[i].(type) {
			case int:
				val = uint32(v)
			case uint32:
				val = v
			}
			offset := i * 4
			binary.LittleEndian.PutUint32(buf[offset:offset+4], val)
		}

		// Return an object with status and serialization
		return map[string]interface{}{
			"status":        status,
			"serialization": serialized,
		}
	})

	// op_url_parse_with_base: Parse URL with base
	mod.Export("op_url_parse_with_base", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("op_url_parse_with_base requires 3 arguments")
		}

		href, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (href)")
		}

		baseHref, ok := args.Get(1).(string)
		if !ok {
			return ctx.Throw("Second argument must be string (base)")
		}

		// Parse base URL
		baseURL, err := url.Parse(baseHref)
		if err != nil {
			return ParseStatusErr
		}

		// Get the Uint32Array buffer
		buf, err := args.GetBuffer(2)
		if err != nil {
			return ctx.Throw("Third argument must be Uint32Array")
		}
		if len(buf) < 32 {
			return ctx.Throw("Buffer must be at least 32 bytes")
		}

		results := make([]interface{}, 8)
		status, serialized := parseURL(ctx, href, baseURL, results)

		// Write results to buffer
		for i := 0; i < 8 && i < len(results); i++ {
			val := uint32(0)
			switch v := results[i].(type) {
			case int:
				val = uint32(v)
			case uint32:
				val = v
			}
			offset := i * 4
			binary.LittleEndian.PutUint32(buf[offset:offset+4], val)
		}

		// Return an object with status and serialization
		return map[string]interface{}{
			"status":        status,
			"serialization": serialized,
		}
	})

	// op_url_get_serialization is no longer needed - serialization is returned directly

	// op_url_reparse: Reparse URL after setting a component
	mod.Export("op_url_reparse", func(args js.Arguments) interface{} {
		if args.Len() < 4 {
			return ctx.Throw("op_url_reparse requires 4 arguments")
		}

		href, ok := args.Get(0).(string)
		if !ok {
			return ctx.Throw("First argument must be string (href)")
		}

		var setter int
		switch v := args.Get(1).(type) {
		case int:
			setter = v
		case int64:
			setter = int(v)
		case float64:
			setter = int(v)
		default:
			return ctx.Throw("Second argument must be number (setter)")
		}

		value, ok := args.Get(2).(string)
		if !ok {
			return ctx.Throw("Third argument must be string (value)")
		}

		// Get the Uint32Array buffer
		buf, err := args.GetBuffer(3)
		if err != nil {
			return ctx.Throw("Fourth argument must be Uint32Array")
		}
		if len(buf) < 32 {
			return ctx.Throw("Buffer must be at least 32 bytes")
		}

		// Set component
		modifiedURL, err := setURLComponent(href, setter, value)
		if err != nil {
			return ParseStatusErr
		}

		newHref := modifiedURL.String()
		results := make([]interface{}, 8)
		_, serialized := parseURL(ctx, newHref, nil, results)

		// Write results to buffer
		for i := 0; i < 8 && i < len(results); i++ {
			val := uint32(0)
			switch v := results[i].(type) {
			case int:
				val = uint32(v)
			case uint32:
				val = v
			}
			offset := i * 4
			binary.LittleEndian.PutUint32(buf[offset:offset+4], val)
		}

		// Always return serialization when we've modified the URL
		// Even if status is Ok, we modified it so return OkSerialization
		return map[string]interface{}{
			"status":        ParseStatusOkSerialization,
			"serialization": serialized,
		}
	})

	// op_url_parse_search_params: Parse query string
	mod.Export("op_url_parse_search_params", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return []interface{}{}
		}

		query, ok := args.Get(0).(string)
		if !ok {
			return []interface{}{}
		}

		// Remove leading '?' if present
		query = strings.TrimPrefix(query, "?")

		if query == "" {
			return []interface{}{}
		}

		// Parse query string manually to preserve order
		// url.ParseQuery uses a map which has random iteration order
		var pairs []interface{}
		for _, part := range strings.Split(query, "&") {
			if part == "" {
				continue
			}

			var key, value string
			if idx := strings.Index(part, "="); idx != -1 {
				key = part[:idx]
				value = part[idx+1:]
			} else {
				key = part
				value = ""
			}

			// URL decode key and value
			decodedKey, err := url.QueryUnescape(key)
			if err != nil {
				decodedKey = key
			}
			decodedValue, err := url.QueryUnescape(value)
			if err != nil {
				decodedValue = value
			}

			pairs = append(pairs, []interface{}{decodedKey, decodedValue})
		}

		return pairs
	})

	// op_url_stringify_search_params: Stringify search params
	mod.Export("op_url_stringify_search_params", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ""
		}

		pairsInterface, ok := args.Get(0).([]interface{})
		if !ok {
			return ""
		}

		// Build url.Values from pairs
		values := url.Values{}
		for _, pairInterface := range pairsInterface {
			pair, ok := pairInterface.([]interface{})
			if !ok || len(pair) != 2 {
				continue
			}

			key, ok1 := pair[0].(string)
			val, ok2 := pair[1].(string)
			if !ok1 || !ok2 {
				continue
			}

			values.Add(key, val)
		}

		return values.Encode()
	})
}
