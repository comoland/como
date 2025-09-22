// Simple readline test without imports - direct access to global readline
console.log('Testing readline functionality...');

// Check if readline is available
if (typeof readline === 'undefined') {
    console.error('readline module not available');
    process.exit(1);
}

console.log('readline module found!');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Enter something: '
});

console.log('Interface created successfully');

// Test question functionality
rl.question('What is your name? ', (answer) => {
    console.log(`Hello, ${answer}!`);
    rl.close();
});
