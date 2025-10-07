// Simple counter module for testing caching
let count = 0;

module.exports = {
    increment: () => ++count,
    getCount: () => count,
    reset: () => {
        count = 0;
    }
};
