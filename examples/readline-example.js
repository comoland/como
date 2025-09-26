import readline from 'readline';

// console.log('Testing readline functionality...', readline);
// console.log(readline.createInterface === Como.path.basename)
// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Enter something: '
});

// Event listeners
rl.on('line', (input) => {
    console.log(`You entered: ${input}`);

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        rl.close();
    } else {
        rl.prompt();
    }
});

rl.on('close', () => {
    console.log('Goodbye!');
    // process.exit(0);
});

rl.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Type "exit" or "quit" to exit gracefully.');
    rl.prompt();
});

// Show initial prompt
console.log('Type something and press Enter. Type "exit" or "quit" to exit.');
rl.prompt();
