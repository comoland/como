
/**
 * HTTP server module types
 *
 * Module: std::server2
 * Usage: import * as server2 from 'std::server2'
 *
 * This module provides a native HTTP server built on top of Go's net/http.
 * It supports request/response handling with streaming capabilities.
 */

declare module 'std:server2' {
    /**
     * File data returned from file upload operations
     */
    export interface FileData {
        /** File size in bytes */
        size: number
        /** MIME type of the file */
        mime: string
        /** Original filename */
        name: string
        /** File contents as Uint8Array */
        data: Uint8Array
    }

    /**
     * Cookie options for setting cookies
     */
    export interface CookieOptions {
        /** Cookie path (default: "/") */
        Path?: string
        /** Cookie domain */
        Domain?: string
        /** Cookie expiration time */
        Expires?: Date
        /** Max age in seconds */
        MaxAge?: number
        /** Whether cookie is secure (HTTPS only) */
        Secure?: boolean
        /** Whether cookie is HTTP-only */
        HttpOnly?: boolean
        /** SameSite policy */
        SameSite?: 'Strict' | 'Lax' | 'None'
    }

    /**
     * Form data interface for multipart form handling
     */
    export interface FormData {
        /**
         * Get headers (currently a no-op)
         * @returns null
         */
        headers(): null

        /**
         * Get a file from the form by field name
         * @param file - Form field name containing the file
         * @returns Promise resolving to file data
         */
        fromFile(file: string): Promise<FileData>

        /**
         * Get a form value by field name
         * @param name - Form field name
         * @returns Promise resolving to form value as Uint8Array
         */
        fromValue(name: string): Promise<Uint8Array>
    }

    /**
     * HTTP request object
     * Provides access to request data and methods
     */
    export interface Request {
        /** Client IP address */
        ip: string
        /** HTTP method (GET, POST, etc.) */
        method: string
        /** Full request URI */
        uri: string
        /** Request path */
        path: string
        /** Request host */
        host: string

        /**
         * Get query parameter(s)
         * @param key - Optional query parameter key
         * @returns If key provided: string | string[] | null. If no key: object with all query params
         */
        query<T extends string>(key: T): string | null
        query(): Record<string, string>
        /**
         * Get a single header value
         * @param key - Header name
         * @returns Header value or empty string
         */
        header(key: string): string

        /**
         * Get all headers as an object
         * @returns Object with header names as keys and values as strings
         */
        headers(): Record<string, string>

        /**
         * Get a cookie value by name
         * @param key - Cookie name
         * @returns Cookie value or null if not found
         */
        cookie(key: string): string | null

        /**
         * Get all cookies
         * @returns Array of cookie objects
         */
        cookies(): Array<{
            Name: string
            Value: string
            Path?: string
            Domain?: string
            Expires?: Date
            RawExpires?: string
            MaxAge?: number
            Secure?: boolean
            HttpOnly?: boolean
            SameSite?: number
            Raw?: string
            Unparsed?: string[]
        }>

        /**
         * Read request body as string
         * @returns Request body as string
         * @throws Error if body already consumed
         */
        body(): string

        /**
         * Read request body as buffer
         * @returns Request body as Uint8Array
         * @throws Error if body already consumed
         */
        buffer(): Uint8Array

        /**
         * Parse multipart form data
         * @param maxMemory - Maximum memory in bytes for form parsing (default: 10MB)
         * @returns Promise resolving to FormData object
         */
        form(maxMemory?: number): Promise<FormData>

        /**
         * Get a file from multipart form
         * @param file - Form field name containing the file
         * @returns Promise resolving to file data
         */
        file(file: string): Promise<FileData>

        /**
         * Listen for request events
         * @param event - Event name ("data" or "disconnect")
         * @returns Promise that resolves when event occurs
         */
        on(event: 'data' | 'disconnect'): Promise<boolean>
    }

    /**
     * HTTP response object
     * Provides methods for sending responses
     */
    export interface Response {
        /**
         * Redirect to a URL
         * @param url - URL to redirect to
         * @param code - HTTP status code (default: 303)
         */
        redirect(url: string, code?: number): void

        /**
         * Set HTTP status code
         * @param code - HTTP status code
         */
        status(code: number): void

        /**
         * Set a response header
         * @param key - Header name
         * @param value - Header value
         */
        header(key: string, value: string): void

        /**
         * Set a cookie
         * @param key - Cookie name
         * @param value - Cookie value
         * @param options - Optional cookie configuration
         */
        cookie(key: string, value: string, options?: CookieOptions): void

        /**
         * Flush response buffer
         */
        flush(): void

        /**
         * Write data to response (streaming)
         * @param data - Data to write (string or Uint8Array)
         */
        write(data: string | Uint8Array): void

        /**
         * Set response body (ends response)
         * @param data - Response body (string or Uint8Array)
         */
        body(data: string | Uint8Array | ArrayBuffer): void

        /**
         * Set response body asynchronously
         * @param data - Response body (string or Uint8Array)
         * @returns Promise that resolves when body is written
         */
        body2(data: string | Uint8Array | ArrayBuffer): Promise<void>

        /**
         * End the response
         */
        end(): void
    }

    /**
     * Request handler callback function
     * Receives request and response objects
     */
    export type RequestHandler = (context: {
        req: Request
        res: Response
    }) => void

    /**
     * HTTP server instance
     * Returned from http() function
     */
    export interface Server {
        /**
         * Close the server
         */
        close(): void
    }

    /**
     * Server2 module interface
     * Main entry point for the std::server2 module
     */
    export interface Server2Module {
        /**
         * Create and start an HTTP server
         *
         * @param port - Port to listen on (e.g., ":8080" or "localhost:3000")
         * @param handler - Request handler function that receives req and res objects
         * @returns Server instance with close method
         *
         * @example
         * ```typescript
         * const server = server2.http(":8080", ({ req, res }) => {
         *   res.status(200)
         *   res.body("Hello, World!")
         * })
         * ```
         */
        http(port: string, handler: RequestHandler): Server
    }

    /**
     * Default export for the Server2 module
     *
     * @example
     * ```typescript
     * import server2 from 'std::server2'
     * const server = server2.http(":8080", ({ req, res }) => {
     *   res.body("Hello!")
     * })
     * ```
     */
    const server2: Server2Module
    export default server2
}

