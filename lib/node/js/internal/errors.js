import primordials from 'primordials';
const { ReflectApply, Symbol, ObjectDefineProperty } = primordials;

const kIsNodeError = Symbol.for('kIsNodeError');

const targetObject = {};

const safeInspect = (value) => {
    if (typeof globalThis?.inspect === 'function') {
        return globalThis.inspect(value);
    }
    // Fallback for when inspect is not available
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '[Object]';
        }
    }
    return String(value);
};

const createErrorHelper = (err, code, args) => {
    err.code = code;

    // Add kIsNodeError property to identify Node.js errors
    ObjectDefineProperty(err, kIsNodeError, { value: true });

    // Build message from args
    if (args.length > 0) {
        const filteredArgs = args.filter((a) => a !== undefined && a !== null);

        if (filteredArgs.length > 0) {
            err.message = filteredArgs.map((a) => safeInspect(a)).join(' ');
        } else {
            err.message = code;
        }
    } else {
        err.message = code;
    }
};

const handler = {
    get(target, prop, receiver) {
        // Validate that it's an error code
        if (typeof prop !== 'string' || !prop.startsWith('ERR_')) {
            // Return undefined for non-ERR_ properties (like Symbol properties)
            return undefined;
        }

        if (prop.includes('TYPE')) {
            return class extends TypeError {
                constructor(...args) {
                    // Don't pass prop to super - just use the message from helper
                    super();
                    createErrorHelper(this, prop, args);
                }
            };
        }

        if (prop.includes('OUT_OF_RANGE')) {
            return class extends RangeError {
                constructor(...args) {
                    super();
                    createErrorHelper(this, prop, args);
                }
            };
        }

        return class extends Error {
            constructor(...args) {
                super();
                createErrorHelper(this, prop, args);
            }
        };
    }
};

const codes = new Proxy(targetObject, handler);

export { codes, kIsNodeError };

export function hideStackFrames(fn) {
    function wrappedFn(...args) {
        try {
            return ReflectApply(fn, this, args);
        } catch (error) {
            if (Error.stackTraceLimit && typeof ErrorCaptureStackTrace === 'function') {
                ErrorCaptureStackTrace(error, wrappedFn);
            }
            throw error;
        }
    }
    wrappedFn.withoutStackTrace = fn;
    return wrappedFn;
}
