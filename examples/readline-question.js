import readline from 'readline';

console.log('Testing readline question functionality...');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Ask a series of questions
async function askQuestions() {
    try {
        // Using callback style
        rl.question('What is your name? ', (name) => {
            console.log(`Hello, ${name}!`);
            
            rl.question('What is your favorite color? ', (color) => {
                console.log(`${color} is a nice color!`);
                
                rl.question('How old are you? ', (age) => {
                    console.log(`${age} years old, great!`);
                    
                    console.log('\nSummary:');
                    console.log(`Name: ${name}`);
                    console.log(`Favorite Color: ${color}`);
                    console.log(`Age: ${age}`);
                    
                    rl.close();
                });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        rl.close();
    }
}

rl.on('close', () => {
    console.log('Interview complete. Goodbye!');
    process.exit(0);
});

// Start the questions
askQuestions();
