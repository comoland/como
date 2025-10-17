# Como Console API Reference

## Standard Methods

### Logging
- `console.log(...args)` - Log messages to stdout
- `console.info(...args)` - Alias for log
- `console.warn(...args)` - Log warnings to stderr
- `console.error(...args)` - Log errors to stderr
- `console.dir(obj, options)` - Display object with custom depth
- `console.trace(label)` - Log stack trace

### Assertions & Testing
- `console.assert(condition, ...message)` - Log error if condition is false

### Timing
- `console.time(label)` - Start a timer
- `console.timeLog(label, ...data)` - Log current timer value
- `console.timeEnd(label)` - Stop timer and log duration

### Counting
- `console.count(label?)` - Increment and log counter
- `console.countReset(label?)` - Reset counter to zero

### Grouping
- `console.group(label?)` - Start a log group
- `console.groupCollapsed(label?)` - Start a collapsed group (same as group in CLI)
- `console.groupEnd()` - End the current group

### Formatting
- `console.table(data, columns?)` - Display tabular data
- `console.clear()` - Clear the console

## Enhanced Formatting

### Class Instances
```javascript
class Person { constructor(name) { this.name = name; } }
console.log(new Person('Alice'));
// Output: Person { name: 'Alice' }
```

### Maps
```javascript
console.log(new Map([['a', 1], ['b', 2]]));
// Output: Map(2) { 'a' => 1, 'b' => 2 }
```

### Sets
```javascript
console.log(new Set([1, 2, 3]));
// Output: Set(3) { 1, 2, 3 }
```

### TypedArrays
```javascript
console.log(new Uint8Array([1, 2, 3, 4]));
// Output: Uint8Array(4) [ 1, 2, 3, 4 ]
```

### Circular References
```javascript
const obj = { name: 'circular' };
obj.self = obj;
console.log(obj);
// Output: { name: 'circular', self: [Circular *1] }
```

## Inspect Options

```javascript
inspect(obj, {
    depth: 2,           // Max recursion depth (default: 2)
    colors: true,       // Enable colors (default: false)
    showHidden: false,  // Show non-enumerable properties (default: false)
    maxArrayLength: 100 // Max array elements to show (default: 100)
})
```

## Examples

### Debugging
```javascript
console.group('User Login');
console.log('Email:', user.email);
console.count('login-attempts');
console.timeEnd('auth-check');
console.groupEnd();
```

### Data Inspection
```javascript
const users = [
    { name: 'Alice', role: 'Admin' },
    { name: 'Bob', role: 'User' }
];
console.table(users);
```

### Performance Profiling
```javascript
console.time('operation');
// work...
console.timeLog('operation', 'checkpoint');
// more work...
console.timeEnd('operation');
```

### Assertions
```javascript
console.assert(users.length > 0, 'Users array is empty!');
console.assert(user.age >= 18, 'User must be an adult');
```

## Color Codes (ANSI)

When colors are enabled:
- **Strings**: Green
- **Numbers**: Yellow
- **Booleans**: Yellow
- **null**: Bold white
- **undefined**: Grey
- **Dates**: Magenta
- **RegExp**: Red
- **Special**: Cyan

Run `examples/console-features.js` to see all features in action!

