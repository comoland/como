// Comprehensive Console Features Test

console.log('\n=== CONSOLE FEATURES TEST ===\n');

// 1. Class Formatting
console.log('1. CLASS FORMATTING');
console.log('-------------------');
class Person {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }
}

class Employee extends Person {
    constructor(name, age, role) {
        super(name, age);
        this.role = role;
    }
}

const person = new Person('Alice', 30);
const employee = new Employee('Bob', 25, 'Developer');
console.log('Person instance:', person);
console.log('Employee instance:', employee);
console.log();

// 2. Map Formatting
console.log('2. MAP FORMATTING');
console.log('-----------------');
const map = new Map();
map.set('name', 'John');
map.set('age', 30);
map.set('city', 'NYC');
console.log('Map:', map);

const emptyMap = new Map();
console.log('Empty Map:', emptyMap);
console.log();

// 3. Set Formatting
console.log('3. SET FORMATTING');
console.log('-----------------');
const set = new Set([1, 2, 3, 4, 5]);
console.log('Set:', set);

const emptySet = new Set();
console.log('Empty Set:', emptySet);

const complexSet = new Set(['a', 'b', 'c', { x: 1 }, { y: 2 }]);
console.log('Complex Set:', complexSet);
console.log();

// 4. TypedArray Formatting
console.log('4. TYPEDARRAY FORMATTING');
console.log('------------------------');
const uint8 = new Uint8Array([1, 2, 3, 4, 5]);
console.log('Uint8Array:', uint8);

const float32 = new Float32Array([1.1, 2.2, 3.3]);
console.log('Float32Array:', float32);

const int16 = new Int16Array([10, 20, 30, 40]);
console.log('Int16Array:', int16);
console.log();

// 5. Circular References
console.log('5. CIRCULAR REFERENCES');
console.log('----------------------');
const circular = { name: 'circular' };
circular.self = circular;
circular.nested = { parent: circular };
console.log('Circular object:', circular);
console.log();

// 6. console.assert()
console.log('6. CONSOLE.ASSERT()');
console.log('-------------------');
console.assert(true, 'This should not print');
console.assert(1 === 1, 'This should not print either');
console.assert(false, 'This assertion failed!');
console.assert(1 === 2, 'Expected 1 to equal 2');
console.log();

// 7. console.count() and countReset()
console.log('7. CONSOLE.COUNT()');
console.log('------------------');
console.count('clicks');
console.count('clicks');
console.count('clicks');
console.count('downloads');
console.count('downloads');
console.countReset('clicks');
console.count('clicks');
console.log();

// 8. console.group()
console.log('8. CONSOLE.GROUP()');
console.log('------------------');
console.group('User Details');
console.log('Name: Alice');
console.log('Age: 30');
console.group('Address');
console.log('City: NYC');
console.log('Country: USA');
console.groupEnd();
console.log('Email: alice@example.com');
console.groupEnd();
console.log('Done with groups');
console.log();

// 9. console.groupCollapsed()
console.log('9. CONSOLE.GROUPCOLLAPSED()');
console.log('---------------------------');
console.groupCollapsed('Collapsed Group');
console.log('This is inside collapsed group');
console.log('Another line');
console.groupEnd();
console.log();

// 10. console.time() and timeLog()
console.log('10. CONSOLE.TIME() and TIMELOG()');
console.log('--------------------------------');
console.time('operation');
// Simulate some work
let sum = 0;
for (let i = 0; i < 1000000; i++) {
    sum += i;
}
console.timeLog('operation', 'Checkpoint 1');
for (let i = 0; i < 1000000; i++) {
    sum += i;
}
console.timeLog('operation', 'Checkpoint 2');
console.timeEnd('operation');
console.log();

// 11. console.table()
console.log('11. CONSOLE.TABLE()');
console.log('-------------------');
console.log('Array of objects:');
const users = [
    { name: 'Alice', age: 30, role: 'Developer' },
    { name: 'Bob', age: 25, role: 'Designer' },
    { name: 'Charlie', age: 35, role: 'Manager' }
];
console.table(users);

console.log('\nTable with specific columns:');
console.table(users, ['name', 'role']);

console.log('\nObject data:');
const data = {
    john: { age: 30, city: 'NYC' },
    jane: { age: 25, city: 'LA' },
    joe: { age: 35, city: 'Chicago' }
};
console.table(data);
console.log();

// 12. Nested structures
console.log('12. NESTED STRUCTURES');
console.log('---------------------');
const company = new Person('Alice', 30);
company.employees = [
    new Employee('Bob', 25, 'Developer'),
    new Employee('Charlie', 28, 'Designer')
];
company.metadata = new Map();
company.metadata.set('founded', 2020);
company.metadata.set('location', 'NYC');
company.tags = new Set(['tech', 'startup', 'remote']);
console.log('Complex nested structure:', company);
console.log();

// 13. Mixed collections
console.log('13. MIXED COLLECTIONS');
console.log('---------------------');
const mixed = [
    'string',
    123,
    true,
    null,
    undefined,
    { obj: true },
    [1, 2, 3],
    new Map([['key', 'value']]),
    new Set([1, 2, 3]),
    new Uint8Array([1, 2, 3]),
    new Person('Dave', 40)
];
console.log('Mixed array:', mixed);
console.log();

// 14. console.dir()
console.log('14. CONSOLE.DIR()');
console.log('-----------------');
const obj = { a: 1, b: { c: 2, d: { e: 3 } } };
console.dir(obj, { depth: 0 });
console.dir(obj, { depth: 1 });
console.dir(obj, { depth: 2 });
console.log();

// 15. console.trace()
console.log('15. CONSOLE.TRACE()');
console.log('-------------------');
function outer() {
    function inner() {
        console.trace('Trace from inner function');
    }
    inner();
}
outer();
console.log();

console.log('\n=== ALL TESTS COMPLETE ===\n');

