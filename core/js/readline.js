_exports => {
    /**
     * Modern Node.js compatible readline implementation for QuickJS
     * Supports promises, async iterators, and modern readline features
     */

    // ANSI escape codes for terminal control
    const ANSI = {
        CLEAR_LINE: '\x1b[2K',
        CURSOR_LEFT: '\x1b[1000D',
        CURSOR_UP: '\x1b[1A',
        CURSOR_DOWN: '\x1b[1B',
        CURSOR_FORWARD: '\x1b[1C',
        CURSOR_BACK: '\x1b[1D',
        SAVE_CURSOR: '\x1b[s',
        RESTORE_CURSOR: '\x1b[u',
        HIDE_CURSOR: '\x1b[?25l',
        SHOW_CURSOR: '\x1b[?25h'
    };

    // Key codes
    const KEYS = {
        CTRL_C: 3,
        CTRL_D: 4,
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        ESC: 27,
        DELETE: 127
    };

    // mini-readline.js
    // Minimal, pure-JS readline compatible implementation for Node.js
    // Uses only core modules (events) and process.stdin/stdout.
    // Exports: createInterface(options)

    class Readline extends EventEmitter {
        #input;
        #output;
        #buffer;
        #prompt;
        #isPaused;
        #lineHandler;

        constructor({ input = process.stdin, output = process.stdout, prompt } = {}) {
            super();
            this.#input = input;
            this.#output = output;
            this.#buffer = '';
            this.#prompt = prompt;
            this.#isPaused = false;
            this.#lineHandler = null;

            // Set encoding to handle text input
            if (this.#input.setEncoding) {
                this.#input.setEncoding('utf8');
            }

            // Listen for data events on input
            this.#input.on('data', data => {
                if (this.#isPaused) return;
                this.#buffer += data;
                this.#processBuffer();
            });

            // Handle input close
            this.#input.on('end', () => {
                this.emit('close');
            });
        }

        #processBuffer() {
            let newlineIndex;
            while ((newlineIndex = this.#buffer.indexOf('\n')) !== -1) {
                let line = this.#buffer.slice(0, newlineIndex);
                // Remove \r if present (for Windows compatibility)
                if (line.endsWith('\r')) {
                    line = line.slice(0, -1);
                }
                this.#buffer = this.#buffer.slice(newlineIndex + 1);
                this.emit('line', line);
                if (this.#lineHandler) {
                    this.#lineHandler(line);
                }
            }
        }

        setPrompt(prompt) {
            this.#prompt = prompt;
        }

        prompt() {
            if (this.#output && this.#prompt) {
                this.#output.write(this.#prompt);
            }
            this.resume();
        }

        question(query, callback) {
            this.setPrompt(query);
            this.prompt();
            this.#lineHandler = line => {
                this.#lineHandler = null;
                this.pause();
                callback(line);
            };
        }

        pause() {
            this.#isPaused = true;
            if (this.#input.pause) {
                this.#input.pause();
            }
            return this;
        }

        resume() {
            this.#isPaused = false;
            if (this.#input.resume) {
                this.#input.resume();
            }
            return this;
        }

        close() {
            this.#input.removeAllListeners();
            this.emit('close');
            this.removeAllListeners();
            if (this.#input.destroy) {
                this.#input.destroy();
            }
        }

        write(data) {
            if (this.#output) {
                this.#output.write(data);
            }
        }
    }

    function createInterface(options) {
        return new Readline(options);
    }

    // Export the readline module
    _exports.readline = {
        createInterface
        // question,
        // Constants
        // KEYS,
        // ANSI
    };

    return _exports.readline;
};
