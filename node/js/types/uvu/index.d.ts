declare namespace uvu {
    type Crumbs = { __suite__: string; __test__: string };
    type Callback<T> = (context: T & Crumbs) => Promise<void> | void;

    interface Hook<T> {
        (hook: Callback<T>): void;
        each(hook: Callback<T>): void;
    }

    interface Test<T> {
        (name: string, test: Callback<T>): void;
        only(name: string, test: Callback<T>): void;
        skip(name?: string, test?: Callback<T>): void;
        before: Hook<T>;
        after: Hook<T>;
        run(): void;
    }
}
