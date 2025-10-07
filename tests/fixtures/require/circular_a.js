// Circular dependency test - A depends on B
let b;
try {
    b = require('./circular_b');
} catch (e) {
    // Handle circular dependency
    b = { name: 'B' };
}

module.exports = {
    name: 'A',
    b: b,
    getBName: () => b.name
};
