# Console Improvements - Class Formatting

## Overview
This document describes the improvements made to Como's console implementation to properly format class instances, and suggests additional enhancements for future implementation.

## Implemented Changes

### 1. Class Instance Formatting

**Problem**: Previously, class instances were displayed as plain objects without showing their constructor names.

```javascript
// Before
class Person { constructor(name) { this.name = name; } }
console.log(new Person('Alice'));
// Output: { name: 'Alice' }

// After
console.log(new Person('Alice'));
// Output: Person { name: 'Alice' }
```

### 2. Implementation Details

#### Go Layer (`core/console.go`)
- Added `op_get_constructor_name` native operation
- Uses JavaScript evaluation to safely get constructor names
- Handles edge cases and errors gracefully

#### JavaScript Layer (`core/js/console.js`)
- Added `getConstructorName()` function that walks the prototype chain
- Added `getPrefix()` helper for formatting constructor names with tags
- Modified `formatValue()` to detect and display constructor names
- Imports native operations from `console.go` module

### 3. Features
- ✅ Displays constructor names for custom classes
- ✅ Handles inheritance correctly (shows immediate class, not parent)
- ✅ Works with nested class instances
- ✅ Distinguishes between plain objects and class instances
- ✅ Handles built-in types (Date, Error, RegExp, Map, Set)
- ✅ Supports Symbol.toStringTag when available
- ✅ Graceful fallback if native operations fail

## Test Results

All tests pass successfully:

```javascript
class Person { constructor(name, age) { this.name = name; this.age = age; } }
console.log(new Person('Alice', 30));
// Output: Person { name: 'Alice', age: 30 }

class Employee extends Person {
    constructor(name, age, role) {
        super(name, age);
        this.role = role;
    }
}
console.log(new Employee('Bob', 25, 'Developer'));
// Output: Employee { name: 'Bob', age: 25, role: 'Developer' }

// Plain objects remain unchanged
console.log({ name: 'John', age: 40 });
// Output: { name: 'John', age: 40 }
```

## Suggested Future Enhancements

Based on Deno's console implementation, the following enhancements could be added:

### High Priority

#### 1. `console.table(data, columns?)`
Display tabular data as a table (extremely useful for debugging arrays of objects)

```javascript
console.table([
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 }
]);
// Output:
// ┌─────────┬─────────┬─────┐
// │ (index) │  name   │ age │
// ├─────────┼─────────┼─────┤
// │    0    │ 'Alice' │ 30  │
// │    1    │  'Bob'  │ 25  │
// └─────────┴─────────┴─────┘
```

**Implementation effort**: Medium
**Files to modify**: `core/js/console.js`

#### 2. `console.group()` / `console.groupEnd()` / `console.groupCollapsed()`
Group related log messages with indentation

```javascript
console.group('User Details');
console.log('Name: Alice');
console.log('Age: 30');
console.groupEnd();
```

**Implementation effort**: Low
**Files to modify**: `core/js/console.js`

#### 3. `console.count(label?)` / `console.countReset(label?)`
Count how many times a label has been logged

```javascript
console.count('clicks'); // clicks: 1
console.count('clicks'); // clicks: 2
console.countReset('clicks');
console.count('clicks'); // clicks: 1
```

**Implementation effort**: Low
**Files to modify**: `core/js/console.js`

#### 4. `console.assert(condition, ...args)`
Log an error message if condition is false

```javascript
console.assert(value > 0, 'Value must be positive');
// If value <= 0: Assertion failed: Value must be positive
```

**Implementation effort**: Low
**Files to modify**: `core/js/console.js`

### Medium Priority

#### 5. `console.clear()`
Clear the console (send ANSI clear screen codes)

**Implementation effort**: Low
**Files to modify**: `core/js/console.js`

#### 6. `console.timeLog(label)`
Log the current time for a timer without stopping it

```javascript
console.time('fetch');
// ... some work ...
console.timeLog('fetch'); // fetch: 150ms
// ... more work ...
console.timeEnd('fetch'); // fetch: 300ms
```

**Implementation effort**: Low
**Files to modify**: `core/js/console.js`

#### 7. Better TypedArray and ArrayBuffer formatting
Display typed arrays in a more readable format with byte information

```javascript
console.log(new Uint8Array([1, 2, 3, 4]));
// Output: Uint8Array(4) [ 1, 2, 3, 4 ]
```

**Implementation effort**: Medium
**Files to modify**: `core/js/console.js`

#### 8. Map and Set preview
Show a preview of Map/Set contents inline

```javascript
console.log(new Map([['a', 1], ['b', 2]]));
// Output: Map(2) { 'a' => 1, 'b' => 2 }

console.log(new Set([1, 2, 3]));
// Output: Set(3) { 1, 2, 3 }
```

**Implementation effort**: Medium
**Files to modify**: `core/js/console.js`
**Note**: Would need native operation `op_preview_entries` in Go

### Low Priority

#### 9. `console.profile()` / `console.profileEnd()`
CPU profiling (if supported by runtime)

**Implementation effort**: High
**Files to modify**: `core/console.go`, `core/js/console.js`

#### 10. Custom inspect colors configuration
Allow customization of color schemes

**Implementation effort**: Low
**Files to modify**: `core/js/console.js`

#### 11. Circular reference handling improvements
Better visualization of circular references with numbered markers

```javascript
const obj = {};
obj.self = obj;
console.log(obj);
// Output: { self: [Circular *1] }
```

**Implementation effort**: Medium
**Files to modify**: `core/js/console.js`
**Note**: Partially implemented in Deno with circular map

## Implementation Priority

### Phase 1 (Quick Wins)
1. ✅ Class formatting (DONE)
2. console.assert()
3. console.count() / countReset()
4. console.group() / groupEnd()
5. console.clear()
6. console.timeLog()

### Phase 2 (Medium Effort)
1. console.table()
2. Better Map/Set formatting
3. Better TypedArray formatting
4. Circular reference improvements

### Phase 3 (Future)
1. console.profile()
2. Color customization
3. Performance optimization

## Code Examples from Deno

For reference, Deno's console implementation can be found at:
- `.references/deno/ext/console/01_console.js`

Key functions to study:
- `getConstructorName()` - lines 1119-1185
- `formatValue()` - lines 439-546
- `formatRaw()` - lines 624-900
- `getPrefix()` - lines 1229-1241

## Compatibility Notes

The current implementation is inspired by Deno's console but simplified for Como's needs:
- Uses simpler prototype chain walking
- Native operation via JavaScript eval (simpler than C bindings)
- Compatible with existing Como color system
- No dependency on V8-specific features

## Performance Considerations

- Constructor name lookup is cached in the prototype chain walk
- Native operation only called as fallback
- No significant performance impact on regular object logging
- Class instances may be slightly slower to format (acceptable tradeoff)

## Breaking Changes

None. This is a pure enhancement that improves output quality without changing the API.

---

**Author**: AI Assistant
**Date**: October 11, 2025
**Status**: Implemented and Tested

