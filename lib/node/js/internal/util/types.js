import primordials from 'primordials';

const { ArrayBufferIsView, ArrayBuffer, DataView, ObjectDefineProperties, TypedArrayPrototypeGetSymbolToStringTag } =
    primordials;

function isArrayBuffer(value) {
    return value instanceof ArrayBuffer;
}

function isDataView(value) {
    return value instanceof DataView;
}

function isSharedArrayBuffer(value) {
    return typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer;
}

function isTypedArray(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) !== undefined;
}

function isUint8Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Uint8Array';
}

function isUint8ClampedArray(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Uint8ClampedArray';
}

function isUint16Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Uint16Array';
}

function isUint32Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Uint32Array';
}

function isInt8Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Int8Array';
}

function isInt16Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Int16Array';
}

function isInt32Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Int32Array';
}

function isFloat16Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Float16Array';
}

function isFloat32Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Float32Array';
}

function isFloat64Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Float64Array';
}

function isBigInt64Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'BigInt64Array';
}

function isBigUint64Array(value) {
    return TypedArrayPrototypeGetSymbolToStringTag(value) === 'BigUint64Array';
}

export function isAsyncFunction(fn) {
    return fn instanceof async function () {}.constructor;
}

export {
    ArrayBufferIsView as isArrayBufferView,
    isArrayBuffer,
    isDataView,
    isSharedArrayBuffer,
    isTypedArray,
    isUint8Array,
    isUint8ClampedArray,
    isUint16Array,
    isUint32Array,
    isInt8Array,
    isInt16Array,
    isInt32Array,
    isFloat16Array,
    isFloat32Array,
    isFloat64Array,
    isBigInt64Array,
    isBigUint64Array
};
