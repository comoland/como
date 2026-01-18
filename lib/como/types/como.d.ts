
declare namespace Como {
	type ICookie = { Name: string,
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
	}

	export type HTTPRequest = {
		id: number;
		method: string;
		body: () => string;
		buffer: () => ArrayBuffer;
		cookie: (key: string) => string | undefined;
		cookies: () => ICookie[];
		on: <k extends "disconnect" | "data">(event: k) => k extends "disconnect"  ? Promise<true> : Promise<string>;
		query: (key: string) => string;
		header: (key: string) => string;
		headers: () => Record<string, string>;
		form: (maxSize?: number) => Promise<{
			fromValue: (name: string) => Promise<ArrayBuffer>,
			fromFile: (name: string) => Promise<{
				size: number;
				name: string;
				mime: string;
				data: ArrayBuffer;
			}>
		}>
		host: string;
		path: string;
		uri: string;
		ipInfo: () => Promise<{
			country: string,
			city: string,
			region: string
		}>;
		file: (name: string) => Promise<{
			size: number;
			name: string;
			mime: string;
			data: ArrayBuffer;
		}>
	};

	export type HTTPResponse = {
		status: (status: number) => void;
		header: (key: string, value: string) => void;
		body: (a: string | ArrayBuffer) => void;
		cookie: (key: string, val: string, options?: { maxAge?: number, path?: string,secure?: boolean }) => void;
		write: (a: string | ArrayBuffer) => void;
		stream: (a: string | ArrayBuffer) => void;
		flush: () => void;
		redirect: (utl: string, code?: number) => void;
		end: () => void;
		serve: any;
	};

	export function http(
		address: string
	): AsyncIterableIterator<{
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
		walkFS: (
			path: string,
			callback: (path: string, info: { isDir: boolean; name: string }) => Promise<boolean | void> | void | boolean
		) => void | Promise<void>;
	};

	export function worker(
		worker: string,
		cb: (arg: any) => void
	): {
		postMessage: (arg: any) => void;
		terminate: () => void;
	};

	export function postMessage(
		arg: any
	): void;

	export function onMessage(
		arg: (arg: any) => void
	): void;

	export function createWorker<T extends any[], R extends any>(
		cb: (...arg: T) => Promise<R> | R,
		opt?: { pool?: number }
	): {
		exec: <E extends any = R>(...arg: T) => Promise<E>;
		terminate: () => void;
	};

	export function asyncWorker<T extends any[], R extends any>(
		cb: (...arg: T) => Promise<R> | R
	): Promise<R>;

	export const process: {
		suspense(fn: (done: Function) => void) : void
	 	registerAlias(alias: string, location: string) : void
	}
}
