// Test different export patterns
module.exports = {
    named: 'exported value',
    number: 42,
    object: { nested: 'value' },
    array: [1, 2, 3],
    function: function () {
        return 'function export';
    },
    boolean: true
};
