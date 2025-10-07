declare namespace Como {
    export class sys {
        static loadLibrary: (arg: null | string) => number;
    }

    export function embedFs(dir?: string): {
        walkFS: (
            callback: (path: string, info: { isDir: boolean; name: string }) => Promise<boolean | void> | void | boolean
        ) => void | Promise<void>;
        extract: (dest?: string) => void;
        readFile: (file: string) => ArrayBuffer;
    };

    type SqlExecResult = {
        lastInsertId: number;
        rowsAffected: number;
        error: string | null;
    };

    interface SQL {
        register(name: string, extensiosns: Array<string>): void;
        (driver: string, options: string): {
            exec: {
                /**
                 * description: exec sql string
                 *
                 * Example:
                 *
                 * await dd.exec('INSERT INTO place (country, telcode) VALUES ("a", 1)', "Hong Kong", 852);
                 */
                (statement: string, ...bind: any[]): Promise<SqlExecResult>;
                sync(statement: string, ...bind: any[]): SqlExecResult;
            };

            query<E extends any = any>(sql: string, ...bind: (string | number)[]): Promise<E[]>;
            close(): any;

            begin(): {
                exec: {
                    /**
                     * description: exec sql string
                     *
                     * Example:
                     *
                     * await dd.exec('INSERT INTO place (country, telcode) VALUES ("a", 1)', "Hong Kong", 852);
                     */
                    (statement: string, ...bind: any[]): Promise<SqlExecResult>;
                    sync(statement: string, ...bind: any[]): SqlExecResult;
                };
                commit(): void;
                rollBack(): void;
            };
        };
    }

    export const sql: SQL;

    type ICookie = {
        Name: string;
        Value: string;
        Path: string;
        Domain: string;
        Expires: string;
        RawExpires: string;
        MaxAge: number;
        Secure: boolean;
        HttpOnly: boolean;
        SameSite: number;
        Raw: string;
        Unparsed: any;
    };

    export type HTTPRequest = {
        id: number;
        method: string;
        body: () => string;
        buffer: () => ArrayBuffer;
        cookie: (key: string) => string | undefined;
        cookies: () => ICookie[];
        on: <k extends 'disconnect' | 'data'>(event: k) => k extends 'disconnect' ? Promise<true> : Promise<string>;
        query: (key: string) => string;
        header: (key: string) => string;
        headers: () => Record<string, string>;
        form: (maxSize?: number) => Promise<{
            fromValue: (name: string) => Promise<ArrayBuffer>;
            fromFile: (name: string) => Promise<{
                size: number;
                name: string;
                mime: string;
                data: ArrayBuffer;
            }>;
        }>;
        host: string;
        path: string;
        uri: string;
        ipInfo: () => Promise<{
            country: string;
            city: string;
            region: string;
        }>;
        file: (name: string) => Promise<{
            size: number;
            name: string;
            mime: string;
            data: ArrayBuffer;
        }>;
    };

    export type HTTPResponse = {
        status: (status: number) => void;
        header: (key: string, value: string) => void;
        body: (a: string | ArrayBuffer) => void;
        cookie: (key: string, val: string, options?: { maxAge?: number; path?: string; secure?: boolean }) => void;
        write: (a: string | ArrayBuffer) => void;
        stream: (a: string | ArrayBuffer) => void;
        flush: () => void;
        redirect: (utl: string, code?: number) => void;
        end: () => void;
        serve: any;
    };

    export function http(address: string): AsyncIterableIterator<{
        req: HTTPRequest;
        res: HTTPResponse;
    }>;

    export function Reflect(arg: any): any;

    export const path: {
        resolve: (...args: string[]) => string;
        join: (...args: string[]) => string;
        basename: (path: string) => string;
        walk: (
            path: string,
            callback: (path: string, info: { isDir: boolean; name: string }) => Promise<boolean | void> | void | boolean
        ) => void | Promise<void>;
    };

    export const build: {
        plugin(...args: any[]): any;
        bundle2(...args: any[]): string;
        bundle(file: string, options: esbuild.BuildOptions): Promise<Array<{ path: string; content: string }>>;
        loader: {
            js: 'js';
            text: 'text';
            ts: 'ts';
            tsx: 'tsx';
            json: 'json';
            base64: 'base64';
        };
        sourceMap: {
            none: 'none';
            inline: 'inline';
            external: 'external';
            linked: 'linked';
        };
    };

    export function worker(
        worker: string,
        cb: (arg: any) => void
    ): {
        postMessage: (arg: any) => void;
        terminate: () => void;
    };

    export function postMessage(arg: any): void;

    export function onMessage(arg: (arg: any) => void): void;

    export function createWorker<T extends any[], R extends any>(
        cb: (...arg: T) => Promise<R> | R,
        opt?: { pool?: number }
    ): {
        exec: <E extends any = R>(...arg: T) => Promise<E>;
        terminate: () => void;
    };

    export function asyncWorker<T extends any[], R extends any>(cb: (...arg: T) => Promise<R> | R): Promise<R>;

    export const process: {
        suspense(fn: (done: Function) => void): void;
        registerAlias(alias: string, location: string): void;
    };

    type Context = Record<string, any>;

    export type Test<T = Context> = uvu.Test<T>;
    export type Callback<T = Context> = uvu.Callback<T>;

    export const test: uvu.Test<Context>;
    export function suite<T = Context>(title?: string, context?: T): uvu.Test<T>;
    export function exec(bail?: boolean): Promise<void>;

    export namespace assert {
        type Types = 'string' | 'number' | 'boolean' | 'object' | 'undefined' | 'function';

        export type Message = string | Error;
        export function ok(actual: any, msg?: Message): asserts actual;
        export function is(actual: any, expects: any, msg?: Message): void;
        export function equal(actual: any, expects: any, msg?: Message): void;
        export function type(actual: any, expects: Types, msg?: Message): void;
        export function instance(actual: any, expects: any, msg?: Message): void;
        export function snapshot(actual: string, expects: string, msg?: Message): void;
        export function fixture(actual: string, expects: string, msg?: Message): void;
        export function match(actual: string, expects: string | RegExp, msg?: Message): void;
        export function throws(fn: Function, expects?: Message | RegExp | Function, msg?: Message): void;
        export function not(actual: any, msg?: Message): void;
        export function unreachable(msg?: Message): void;

        export namespace is {
            function not(actual: any, expects: any, msg?: Message): void;
        }

        export namespace not {
            function ok(actual: any, msg?: Message): void;
            function equal(actual: any, expects: any, msg?: Message): void;
            function type(actual: any, expects: Types, msg?: Message): void;
            function instance(actual: any, expects: any, msg?: Message): void;
            function snapshot(actual: string, expects: string, msg?: Message): void;
            function fixture(actual: string, expects: string, msg?: Message): void;
            function match(actual: string, expects: string | RegExp, msg?: Message): void;
            function throws(fn: Function, expects?: Message | RegExp | Function, msg?: Message): void;
        }

        export class Assertion extends Error {
            name: 'Assertion';
            code: 'ERR_ASSERTION';
            details: false | string;
            generated: boolean;
            operator: string;
            expects: any;
            actual: any;
            constructor(options?: {
                message: string;
                details?: string;
                generated?: boolean;
                operator: string;
                expects: any;
                actual: any;
            });
        }
    }
}
