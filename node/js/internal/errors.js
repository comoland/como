
import primordials from 'primordials';

const { ReflectApply } = primordials;

const targetObject = {};

const handler = {
    get(target, prop, receiver) {
        return class Err extends Error {};
    },
    set(target, prop, value, receiver) {
        console.log(`Setting property: ${prop} to ${value}`);
        if (prop === 'count' && typeof value !== 'number') {
            throw new TypeError('Count must be a number.');
        }
        return Reflect.set(target, prop, value, receiver);
    }
};

const codes = new Proxy(targetObject, handler);
export { codes };

export function hideStackFrames(fn) {
    function wrappedFn(...args) {
        try {
            return ReflectApply(fn, this, args);
        } catch (error) {
            Error.stackTraceLimit && ErrorCaptureStackTrace(error, wrappedFn);
            throw error;
        }
    }
    wrappedFn.withoutStackTrace = fn;
    return wrappedFn;
}
