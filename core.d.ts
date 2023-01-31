
declare namespace Como {
	export class sys {
		static loadLibrary: (arg: null | string) => number;
	}

	export class sql {
		open: (
			driver: string,
			options: string
		) => {
			exec(): any;
		};
	}

	type SqlExecResult = {
		'lastInsertId': number;
		'rowsAffected': number;
		'error': string | null;
	};

	export function sql(
		driver: string,
		options: string
	): {
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

		query(sql: string, ...bind: (string | number)[]): Promise<any[]>;
		close(): any;

		begin() : {
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
		}
	};

	export type HTTPRequest = {
		body: () => string;
		query: Record<string, string>;
		path: string;
		uri: string;
	};

	export type HTTPResponse = {
		header: (key: string, value: string) => void;
		body: (a: string) => void;
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
	};

	export const build: {
		plugin(...args: any[]): any
		bundle2(...args: any[]) : string
		bundle(file:string, options: esbuild.BuildOptions) : Promise<Array<{ path: string, content: string }>>
	}

	export function worker(
		worker: string,
		cb: (arg: any) => void
	): {
		postMessage: (arg: any) => void;
		terminate: () => void;
	};

	export function createWorker<T extends any, R extends any>(
		cb: (arg: T) => Promise<R> | R,
		opt?: { pool?: number }
	): {
		exec: (arg: T) => Promise<R>;
		terminate: () => void;
	};

	export function asyncWorker<T extends any, R extends any>(
		cb: (arg: T) => Promise<R> | R
	): Promise<R>;

	export function postMessage(
		arg: any
	): void;

	export function onMessage(
		arg: (arg: any) => void
	): void;

	export const process: {
		suspense(fn: (done: Function) => void) : void
	 	registerAlias(alias: string, location: string) : void
	}
}
