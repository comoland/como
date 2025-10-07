// Circular dependency test - B depends on A
let a;
try {
    a = require('./circular_a');
} catch (e) {
    // Handle circular dependency
    a = { name: 'A' };
}

module.exports = {
    name: 'B',
    a: a,
    getAName: () => a.name
};
