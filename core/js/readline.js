({ createInterface, cursorTo, moveCursor, clearLine, clearScreenDown }) => {
    // Import EventEmitter-like functionality from existing polyfills or create simple version
    class EventEmitter {
        constructor() {
            this._events = {};
        }

        on(event, listener) {
            if (!this._events[event]) {
                this._events[event] = [];
            }
            this._events[event].push(listener);
            return this;
        }

        emit(event, ...args) {
            if (this._events[event]) {
                this._events[event].forEach(listener => {
                    try {
                        listener.apply(this, args);
                    } catch (err) {
                        console.error('Error in event listener:', err);
                    }
                });
            }
            return this;
        }

        removeListener(event, listener) {
            if (this._events[event]) {
                const index = this._events[event].indexOf(listener);
                if (index > -1) {
                    this._events[event].splice(index, 1);
                }
            }
            return this;
        }

        removeAllListeners(event) {
            if (event) {
                delete this._events[event];
            } else {
                this._events = {};
            }
            return this;
        }
    }

    // Interface class that extends EventEmitter
    class Interface extends EventEmitter {
        constructor(options) {
            super();
            
            // Validate required options
            if (!options || !options.input) {
                throw new TypeError("Missing required option 'input'");
            }

            this.input = options.input;
            this.output = options.output || process.stdout;
            this.terminal = options.terminal !== undefined ? options.terminal : 
                           (this.output && this.output.isTTY);
            this.prompt = options.prompt || '> ';
            this.historySize = options.historySize !== undefined ? options.historySize : 30;
            this.removeHistoryDuplicates = options.removeHistoryDuplicates || false;
            this.completer = options.completer || null;
            this.escapeCodeTimeout = options.escapeCodeTimeout || 500;
            this.tabSize = options.tabSize || 8;
            this.crlfDelay = options.crlfDelay || 100;

            // Internal state
            this.history = options.history || [];
            this.line = '';
            this.cursor = 0;
            this._closed = false;
            this._paused = false;

            // Create the native interface
            this._interface = createInterface(options);
            
            // Proxy native interface events to this instance
            this._setupEventForwarding();
        }

        _setupEventForwarding() {
            // Forward events from native interface to this EventEmitter
            const events = ['line', 'close', 'pause', 'resume', 'SIGINT', 'SIGTSTP', 'SIGCONT', 'history'];
            
            events.forEach(eventName => {
                this._interface.on(eventName, (...args) => {
                    this.emit(eventName, ...args);
                });
            });
        }

        setPrompt(prompt) {
            this.prompt = prompt;
            if (this._interface && this._interface.setPrompt) {
                this._interface.setPrompt(prompt);
            }
        }

        getPrompt() {
            return this.prompt;
        }

        prompt(preserveCursor) {
            if (this._interface && this._interface.prompt) {
                this._interface.prompt(preserveCursor);
            }
        }

        question(query, options, callback) {
            // Handle overloaded arguments
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }

            if (!callback || typeof callback !== 'function') {
                throw new TypeError('Callback must be a function');
            }

            if (this._interface && this._interface.question) {
                return this._interface.question(query, callback);
            }

            // Fallback implementation
            if (this.output) {
                this.output.write(query);
            }
            
            // Simple fallback - just call callback with empty string
            process.nextTick(() => callback(''));
        }

        write(data, key) {
            if (this._interface && this._interface.write) {
                this._interface.write(data, key);
            } else if (this.output) {
                this.output.write(data);
            }
        }

        pause() {
            if (!this._paused) {
                this._paused = true;
                if (this._interface && this._interface.pause) {
                    this._interface.pause();
                }
                this.emit('pause');
            }
        }

        resume() {
            if (this._paused) {
                this._paused = false;
                if (this._interface && this._interface.resume) {
                    this._interface.resume();
                }
                this.emit('resume');
            }
        }

        close() {
            if (!this._closed) {
                this._closed = true;
                if (this._interface && this._interface.close) {
                    this._interface.close();
                }
                this.emit('close');
            }
        }

        // Symbol.dispose for resource cleanup
        [Symbol.dispose]() {
            this.close();
        }

        // Async iterator support
        async* [Symbol.asyncIterator]() {
            const lines = [];
            let resolve, reject;
            let promise = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });

            const onLine = (line) => {
                lines.push(line);
                resolve();
                promise = new Promise((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
            };

            const onClose = () => {
                resolve();
            };

            const onError = (err) => {
                reject(err);
            };

            this.on('line', onLine);
            this.on('close', onClose);
            this.on('error', onError);

            try {
                while (!this._closed) {
                    await promise;
                    while (lines.length > 0) {
                        yield lines.shift();
                    }
                }
            } finally {
                this.removeListener('line', onLine);
                this.removeListener('close', onClose);
                this.removeListener('error', onError);
            }
        }

        getCursorPos() {
            return {
                rows: 0, // Would need TTY integration for accurate values
                cols: this.cursor
            };
        }
    }

    // Create a createInterface function that returns our Interface class
    const createInterfaceWrapper = (options) => {
        return new Interface(options);
    };

    // Export the readline module API
    const readline = {
        createInterface: createInterfaceWrapper,
        Interface: Interface,
        cursorTo: (stream, x, y, callback) => {
            const result = cursorTo(stream, x, y);
            if (callback) {
                process.nextTick(callback);
            }
            return result;
        },
        moveCursor: (stream, dx, dy, callback) => {
            const result = moveCursor(stream, dx, dy);
            if (callback) {
                process.nextTick(callback);
            }
            return result;
        },
        clearLine: (stream, dir, callback) => {
            const result = clearLine(stream, dir);
            if (callback) {
                process.nextTick(callback);
            }
            return result;
        },
        clearScreenDown: (stream, callback) => {
            const result = clearScreenDown(stream);
            if (callback) {
                process.nextTick(callback);
            }
            return result;
        },
        emitKeypressEvents: (stream, intf) => {
            // Placeholder for keypress event emission
            // Would need platform-specific implementation
            console.warn('emitKeypressEvents not fully implemented');
        }
    };

    // Set up the global readline object
    globalThis.readline = readline;

    return readline;
};
