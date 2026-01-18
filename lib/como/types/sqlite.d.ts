/**
 * SQLite database module types
 *
 * Module: como:sqlite
 * Usage: import * as sqlite from 'como:sqlite'
 *
 * This module provides a native SQLite database interface built on top of
 * sqlx and go-sqlite3. It supports async operations using goroutines and
 * provides both promise-based and synchronous APIs.
 */

// Module declaration for TypeScript to recognize 'como:sqlite' imports
declare module 'como:sqlite' {
    /**
     * Result object returned from exec operations
     */
    export interface ExecResult {
        /** The last inserted row ID (0 if not applicable) */
        lastInsertId: number
        /** Number of rows affected by the operation */
        rowsAffected: number
        /** Error message if operation failed, null on success */
        error: string | null
    }

    /**
     * Record type representing a database row
     * Keys are column names, values are the column data
     */
    export type TRecord = Record<string, any>

    /**
     * Result object from query2 that provides streaming capabilities
     */
    export interface QueryStreamResult {
        /**
         * Streams query results to a writer callback
         * @param writer - Callback function that receives each record as it's fetched
         * @returns Promise that resolves when streaming is complete
         */
        stream(writer: (record: TRecord) => void): Promise<void>
    }

    /**
     * Exec function type with sync property
     * Represents a function that can be called directly (async) or via .sync (synchronous)
     */
    export interface ExecFunction {
        /**
         * Executes a SQL statement asynchronously
         * @param sql - SQL statement string
         * @param bindArgs - Optional bind parameters for the statement
         * @returns Promise resolving to execution result
         */
        (sql: string, ...bindArgs: any[]): Promise<ExecResult>

        /**
         * Synchronous version of exec
         * Executes immediately without returning a promise
         * @param sql - SQL statement string
         * @param bindArgs - Optional bind parameters for the statement
         * @returns Execution result (synchronous)
         */
        sync(sql: string, ...bindArgs: any[]): ExecResult
    }

    /**
     * Database transaction interface
     * Provides methods for executing queries and statements within a transaction
     */
    export interface Transaction {
        /**
         * Commits the transaction
         * @throws Error if commit fails
         */
        commit(): void

        /**
         * Rolls back the transaction
         */
        rollBack(): void

        /**
         * Executes a SELECT query and returns all matching rows
         * @param sql - SQL query string
         * @param bindArgs - Optional bind parameters for the query
         * @returns Promise resolving to an array of record objects
         */
        query(sql: string, ...bindArgs: any[]): Promise<TRecord[]>

        /**
         * Executes a SQL statement (INSERT, UPDATE, DELETE, etc.)
         * Can be called directly (returns Promise) or via .sync (returns synchronously)
         */
        exec: ExecFunction
    }

    /**
     * Database connection interface
     * Provides methods for querying and executing SQL statements
     */
    export interface Database {
        /**
         * Closes the database connection
         */
        close(): void

        /**
         * Begins a new transaction
         * @returns Transaction object for executing statements within the transaction
         */
        begin(): Transaction

        /**
         * Executes a SQL statement (INSERT, UPDATE, DELETE, etc.)
         * Can be called directly (returns Promise) or via .sync (returns synchronously)
         */
        exec: ExecFunction

        /**
         * Executes a SELECT query and returns all matching rows
         * @param sql - SQL query string
         * @param bindArgs - Optional bind parameters for the query
         * @returns Promise resolving to an array of record objects
         */
        query(sql: string, ...bindArgs: any[]): Promise<TRecord[]>

        /**
         * Executes a SELECT query with streaming support
         * Returns an object with a stream method for processing results incrementally
         * @param sql - SQL query string
         * @param bindArgs - Optional bind parameters for the query
         * @returns QueryStreamResult object with stream method
         */
        query2(sql: string, ...bindArgs: any[]): QueryStreamResult
    }

    /**
     * SQLite module interface
     * Main entry point for the como:sqlite module
     */
    export interface SQLiteModule {
        /**
         * Opens a database connection
         *
         * @param driver - Database driver name (typically "sqlite3")
         * @param options - Connection string (e.g., "file:database.db?cache=shared&mode=rwc")
         * @returns Database instance
         * @throws Error if connection fails or ping fails
         *
         * @example
         * ```typescript
         * const db = sqlite.database("sqlite3", "file:test.db?cache=shared&mode=rwc")
         * ```
         */
        database(driver: string, options: string): Database

        /**
         * Registers a custom SQLite driver with extensions
         *
         * @param name - Driver name to register
         * @param extensions - Array of SQLite extension names to load
         *
         * @example
         * ```typescript
         * sqlite.register("sqlite3_ext", ["json1", "fts5"])
         * ```
         */
        register(name: string, extensions: string[]): void
    }

    /**
     * Default export for the SQLite module
     *
     * @example
     * ```typescript
     * import sqlite from 'como:sqlite'
     * const db = sqlite.database("sqlite3", "file:app.db")
     * ```
     */
    const sqlite: SQLiteModule
    export default sqlite
}

