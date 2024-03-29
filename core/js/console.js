() => {
    var NEWLINE = '\n';
    var isArray = Array.isArray;

    function isBoolean(arg) {
        return typeof arg === 'boolean';
    }

    function isNull(arg) {
        return arg === null;
    }

    function isNullOrUndefined(arg) {
        return arg == null;
    }

    function isNumber(arg) {
        return typeof arg === 'number';
    }

    function isString(arg) {
        return typeof arg === 'string';
    }

    function isSymbol(arg) {
        return typeof arg === 'symbol';
    }

    function isUndefined(arg) {
        return arg === void 0;
    }

    function isRegExp(re) {
        return isObject(re) && objectToString(re) === '[object RegExp]';
    }

    function isObject(arg) {
        return typeof arg === 'object' && arg !== null;
    }

    function isDate(d) {
        return isObject(d) && objectToString(d) === '[object Date]';
    }

    function isError(e) {
        return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
    }

    function isFunction(arg) {
        return typeof arg === 'function';
    }

    function isPrimitive(arg) {
        return (
            arg === null ||
            typeof arg === 'boolean' ||
            typeof arg === 'number' ||
            typeof arg === 'string' ||
            typeof arg === 'symbol' || // ES6 symbol
            typeof arg === 'undefined'
        );
    }

    function isBuffer(b) {
        return b instanceof Buffer;
    }

    /// sssssss

    function objectToString(o) {
        return Object.prototype.toString.call(o);
    }

    function stylizeNoColor(str, styleType) {
        return stylizeWithColor(str, styleType);
    }

    const _extend = function (origin, add) {
        // Don't do anything if add isn't an object
        if (!add || !isObject(add)) return origin;

        var keys = Object.keys(add);
        var i = keys.length;
        while (i--) {
            origin[keys[i]] = add[keys[i]];
        }
        return origin;
    };

    function hasOwnProperty(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    function arrayToHash(array) {
        var hash = {};

        array.forEach(function (val, idx) {
            hash[val] = true;
        });

        return hash;
    }

    function formatPrimitive(ctx, value) {
        if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');
        if (isString(value)) {
            var simple =
                "'" + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
            return ctx.stylize(simple, 'string');
        }
        if (isNumber(value) || typeof value === 'bigint') {
            // Format -0 as '-0'. Strict equality won't distinguish 0 from -0,
            // so instead we use the fact that 1 / -0 < 0 whereas 1 / 0 > 0 .
            if (value === 0 && 1 / value < 0) return ctx.stylize('-0', 'number');
            return ctx.stylize('' + value, 'number');
        }
        if (isBoolean(value)) return ctx.stylize('' + value, 'boolean');
        // For some reason typeof null is "object", so special case here.
        if (isNull(value)) return ctx.stylize('null', 'null');

        if (typeof value !== 'object' && typeof value !== 'function')
            return ctx.stylize('[Pointer: ' + value + ']', 'string');
    }

    function formatPrimitiveNoColor(ctx, value) {
        var stylize = ctx.stylize;
        ctx.stylize = stylizeNoColor;
        var str = formatPrimitive(ctx, value);
        ctx.stylize = stylize;
        return str;
    }

    function formatError(value) {
        return '[' + Error.prototype.toString.call(value) + ']' + '\n' + value.stack;
    }

    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
        var output = [];
        for (var i = 0, l = value.length; i < l; ++i) {
            if (hasOwnProperty(value, String(i))) {
                output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
            } else {
                output.push('');
            }
        }
        keys.forEach(function (key) {
            if (!key.match(/^\d+$/)) {
                output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
            }
        });
        return output;
    }

    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
        var name, str, desc;
        desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
        if (desc.get) {
            if (desc.set) {
                str = ctx.stylize('[Getter/Setter]', 'special');
            } else {
                str = ctx.stylize('[Getter]', 'special');
            }
        } else {
            if (desc.set) {
                str = ctx.stylize('[Setter]', 'special');
            }
        }
        if (!hasOwnProperty(visibleKeys, key)) {
            name = '[' + key + ']';
        }
        if (!str) {
            if (ctx.seen.indexOf(desc.value) < 0) {
                if (isNull(recurseTimes)) {
                    str = formatValue(ctx, desc.value, null);
                } else {
                    str = formatValue(ctx, desc.value, recurseTimes - 1);
                }
                if (str.indexOf('\n') > -1) {
                    if (array) {
                        str = str
                            .split('\n')
                            .map(function (line) {
                                return '  ' + line;
                            })
                            .join('\n')
                            .substr(2);
                    } else {
                        str =
                            '\n' +
                            str
                                .split('\n')
                                .map(function (line) {
                                    return '   ' + line;
                                })
                                .join('\n');
                    }
                }
            } else {
                str = ctx.stylize('[Circular]', 'special');
            }
        }
        if (isUndefined(name)) {
            if (array && key.match(/^\d+$/)) {
                return str;
            }
            name = JSON.stringify('' + key);
            if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                name = name.substr(1, name.length - 2);
                name = ctx.stylize(name, 'name');
            } else {
                name = name
                    .replace(/'/g, "\\'")
                    .replace(/\\"/g, '"')
                    .replace(/(^"|"$)/g, "'")
                    .replace(/\\\\/g, '\\');
                name = ctx.stylize(name, 'string');
            }
        }

        return name + ': ' + str;
    }

    function reduceToSingleString(output, base, braces) {
        var length = output.reduce(function (prev, cur) {
            return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
        }, 0);

        if (length > 60) {
            return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
        }

        return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    function formatValue(ctx, value, recurseTimes) {
        // Provide a hook for user-specified inspect functions.
        // Check that value is an object with an inspect function on it
        if (
            ctx.customInspect &&
            value &&
            isFunction(value.inspect) &&
            // Filter out the util module, it's inspect function is special
            value.inspect !== typeof exports === "object" && exports.inspect &&
            // Also filter out any prototype objects using the circular check.
            !(value.constructor && value.constructor.prototype === value)
        ) {
            var ret = value.inspect(recurseTimes, ctx);
            if (!isString(ret)) {
                ret = formatValue(ctx, ret, recurseTimes);
            }
            return ret;
        }

        // Primitive types cannot have properties
        var primitive = formatPrimitive(ctx, value);
        if (primitive) {
            return primitive;
        }

        // Look up the keys of the object.
        var keys = Object.keys(value);
        var visibleKeys = arrayToHash(keys);

        if (ctx.showHidden) {
            keys = Object.getOwnPropertyNames(value);
        }

        // This could be a boxed primitive (new String(), etc.), check valueOf()
        // NOTE: Avoid calling `valueOf` on `Date` instance because it will return
        // a number which, when object has some additional user-stored `keys`,
        // will be printed out.
        var formatted;
        var raw = value;
        try {
            // the .valueOf() call can fail for a multitude of reasons
            if (!isDate(value)) raw = value.valueOf();
        } catch (e) {
            // ignore...
        }

        if (isString(raw)) {
            // for boxed Strings, we have to remove the 0-n indexed entries,
            // since they just noisey up the output and are redundant
            keys = keys.filter(function (key) {
                return !(key >= 0 && key < raw.length);
            });
        }

        // print(keys.length)
        // Some type of object without properties can be shortcutted.
        if (keys.length === 0 || isError(value)) {
            if (isFunction(value)) {
                var name = value.name ? ': ' + value.name : '';
                return ctx.stylize('[Function' + name + ']', 'special');
            }
            if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
            }
            if (isDate(value)) {
                return ctx.stylize(Date.prototype.toString.call(value), 'date');
            }
            if (isError(value)) {
                return formatError(value);
            }
            // now check the `raw` value to handle boxed primitives
            if (isString(raw)) {
                formatted = formatPrimitiveNoColor(ctx, raw);
                return ctx.stylize('[String: ' + formatted + ']', 'string');
            }
            if (isNumber(raw)) {
                formatted = formatPrimitiveNoColor(ctx, raw);
                return ctx.stylize('[Number: ' + formatted + ']', 'number');
            }
            if (isBoolean(raw)) {
                formatted = formatPrimitiveNoColor(ctx, raw);
                return ctx.stylize('[Boolean: ' + formatted + ']', 'boolean');
            }
        }

        var base = '',
            array = false,
            braces = ['{', '}'];

        // Make Array say that they are Array
        if (isArray(value)) {
            array = true;
            braces = ['[', ']'];
        }

        // Make functions say that they are functions
        if (isFunction(value)) {
            var n = value.name ? ': ' + value.name : '';
            base = ' [Function' + n + ']';
        }

        // Make RegExps say that they are RegExps
        if (isRegExp(value)) {
            base = ' ' + RegExp.prototype.toString.call(value);
        }

        // Make dates with properties first say the date
        if (isDate(value)) {
            base = ' ' + Date.prototype.toUTCString.call(value);
        }

        // Make error with message first say the error
        if (isError(value)) {
            base = ' ' + formatError(value);
        }

        // Make boxed primitive Strings look like such
        if (isString(raw)) {
            formatted = formatPrimitiveNoColor(ctx, raw);
            base = ' ' + '[String: ' + formatted + ']';
        }

        // Make boxed primitive Numbers look like such
        if (isNumber(raw)) {
            formatted = formatPrimitiveNoColor(ctx, raw);
            base = ' ' + '[Number: ' + formatted + ']';
        }

        // Make boxed primitive Booleans look like such
        if (isBoolean(raw)) {
            formatted = formatPrimitiveNoColor(ctx, raw);
            base = ' ' + '[Boolean: ' + formatted + ']';
        }

        if (keys.length === 0 && (!array || value.length === 0)) {
            return braces[0] + base + braces[1];
        }

        if (recurseTimes < 0) {
            if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
            } else {
                return ctx.stylize('[Object]', 'special');
            }
        }

        ctx.seen.push(value);

        var output;
        if (array) {
            output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
        } else {
            output = keys.map(function (key) {
                return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
            });
        }

        ctx.seen.pop();

        return reduceToSingleString(output, base, braces);
    }

    function stylizeWithColor(str, styleType) {
        var style = inspect.styles[styleType];

        if (style) {
            return '\u001b[' + inspect.colors[style][0] + 'm' + str + '\u001b[' + inspect.colors[style][1] + 'm';
        } else {
            return str;
        }
    }

    function inspect(obj, opts) {
        // default options
        var ctx = {
            seen: [],
            stylize: stylizeNoColor
        };
        // legacy...
        if (arguments.length >= 3) ctx.depth = arguments[2];
        if (arguments.length >= 4) ctx.colors = arguments[3];
        if (isBoolean(opts)) {
            // legacy...
            ctx.showHidden = opts;
        } else if (opts) {
            // got an "options" object
            _extend(ctx, opts);
        }
        // set default options
        if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
        if (isUndefined(ctx.depth)) ctx.depth = 2;
        if (isUndefined(ctx.colors)) ctx.colors = false;
        if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
        if (ctx.colors) ctx.stylize = stylizeWithColor;
        return formatValue(ctx, obj, ctx.depth);
    }

    inspect.colors = {
        bold: [1, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        white: [37, 39],
        grey: [90, 39],
        black: [30, 39],
        blue: [34, 39],
        cyan: [36, 39],
        green: [32, 39],
        magenta: [35, 39],
        red: [31, 39],
        yellow: [33, 39]
    };

    // Don't use 'blue' not visible on cmd.exe
    inspect.styles = {
        special: 'cyan',
        number: 'yellow',
        boolean: 'yellow',
        undefined: 'grey',
        null: 'bold',
        string: 'green',
        date: 'magenta',
        // "name": intentionally not styling
        regexp: 'red'
    };

    var formatRegExp = /%[sdj%]/g;
    const format = function (f) {
        if (!isString(f)) {
            var objects = [];
            for (var i = 0; i < arguments.length; i++) {
                objects.push(inspect(arguments[i]));
            }
            return objects.join(' ');
        }

        var i = 1;
        var args = arguments;
        var len = args.length;
        var str = String(f).replace(formatRegExp, function (x) {
            if (x === '%%') return '%';
            if (i >= len) return x;
            switch (x) {
                case '%s':
                    return String(args[i++]);
                case '%d':
                    return Number(args[i++]);
                case '%j':
                    try {
                        return JSON.stringify(args[i++]);
                    } catch (_) {
                        return '[Circular]';
                    }
                default:
                    return x;
            }
        });
        for (var x = args[i]; i < len; x = args[++i]) {
            if (isNull(x) || !isObject(x)) {
                str += ' ' + x;
            } else {
                str += ' ' + inspect(x);
            }
        }
        return str;
    };

    function Console(stdout, stderr) {
        if (!(this instanceof Console)) {
            return new Console(stdout, stderr);
        }
        if (!stdout || !isFunction(stdout.write)) {
            throw new TypeError('Console expects a writable stream instance');
        }
        if (!stderr) {
            stderr = stdout;
        }
        var prop = {
            writable: true,
            enumerable: false,
            configurable: true
        };
        prop.value = stdout;
        Object.defineProperty(this, '_stdout', prop);
        prop.value = stderr;
        Object.defineProperty(this, '_stderr', prop);
        prop.value = {};
        Object.defineProperty(this, '_times', prop);

        // bind the prototype functions to this Console instance
        Object.keys(Console.prototype).forEach(function (k) {
            this[k] = this[k].bind(this);
        }, this);
    }

    Console.prototype.log = function () {
        this._stdout.write(format.apply(this, arguments) + NEWLINE);
    };

    Console.prototype.info = Console.prototype.log;

    Console.prototype.warn = function () {
        this._stderr.write(format.apply(this, arguments) + NEWLINE);
    };

    Console.prototype.error = Console.prototype.warn;

    Console.prototype.dir = function (object, options) {
        this._stdout.write(
            inspect(
                object,
                _extend(
                    {
                        customInspect: false
                    },
                    options
                )
            ) + NEWLINE
        );
    };

    Console.prototype.time = function (label) {
        this._times[label] = Date.now();
    };

    Console.prototype.timeEnd = function (label) {
        var time = this._times[label];
        if (!time) {
            throw new Error('No such label: ' + label);
        }
        var duration = Date.now() - time;
        this.log('%s: %dms', label, duration);
    };

    Console.prototype.trace = function () {
        // TODO probably can to do this better with V8's debug object once that is
        // exposed.
        var err = new Error();
        err.name = 'Trace';
        // err.message = format.apply(this, arguments);
        // Error.captureStackTrace(err, arguments.callee);
        this.log('Trace: ');
        this.log.apply(this, arguments);
        this.warn(err.stack);
    };

    var std = {
        write: v => {
            process.stdout.write(v);
        }
    };

    globalThis.console = new Console(std, std);
};
