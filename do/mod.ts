import { test, suite } from 'uvu';
import React, { useCallback, useEffect, useRef } from 'react';
export { test, suite } from 'uvu';
export * as assert from 'uvu/assert';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log(test, React, useCallback, useRef, useEffect);
