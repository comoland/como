
globalThis.global = globalThis;
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/fastestsmallesttextencoderdecoder-encodeinto/EncoderDecoderTogether.min.js
  var require_EncoderDecoderTogether_min = __commonJS({
    "node_modules/fastestsmallesttextencoderdecoder-encodeinto/EncoderDecoderTogether.min.js"(exports) {
      "use strict";
      (function(q) {
        function y() {
        }
        function C(b) {
          var c = b.charCodeAt(0) | 0;
          if (55296 <= c)
            if (56319 >= c)
              if (b = b.charCodeAt(1) | 0, 56320 <= b && 57343 >= b) {
                if (c = (c << 10) + b - 56613888 | 0, 65535 < c)
                  return v(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
              } else
                c = 65533;
            else
              57343 >= c && (c = 65533);
          return 2047 >= c ? v(192 | c >> 6, 128 | c & 63) : v(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
        }
        function z() {
        }
        function A(b, c) {
          var g = void 0 === b ? "" : ("" + b).replace(D, C), d = g.length | 0, a = 0, k = 0, f = c.length | 0, h = b.length | 0;
          f < d && (d = f);
          a:
            for (; a < d; a = a + 1 | 0) {
              b = g.charCodeAt(a) | 0;
              switch (b >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                  k = k + 1 | 0;
                case 8:
                case 9:
                case 10:
                case 11:
                  break;
                case 12:
                case 13:
                  if ((a + 1 | 0) < f) {
                    k = k + 1 | 0;
                    break;
                  }
                case 14:
                  if ((a + 2 | 0) < f) {
                    k = k + 1 | 0;
                    break;
                  }
                case 15:
                  if ((a + 3 | 0) < f) {
                    k = k + 1 | 0;
                    break;
                  }
                default:
                  break a;
              }
              c[a] = b;
            }
          return { written: a, read: h < k ? h : k };
        }
        var v = String.fromCharCode, x = {}.toString, E = x.call(q.SharedArrayBuffer), F = x(), t = q.Uint8Array, w = t || Array, u = t ? ArrayBuffer : w, G = u.isView || function(b) {
          return b && "length" in b;
        }, H = x.call(u.prototype), B = z.prototype;
        u = q.TextEncoder;
        var D = /[\x80-\uD7ff\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]?/g, e = new (t ? Uint16Array : w)(32);
        y.prototype.decode = function(b) {
          if (!G(b)) {
            var c = x.call(b);
            if (c !== H && c !== E && c !== F)
              throw TypeError("Failed to execute 'decode' on 'TextDecoder': The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
            b = t ? new w(b) : b || [];
          }
          for (var g = c = "", d = 0, a = b.length | 0, k = a - 32 | 0, f, h, l = 0, r = 0, n, m = 0, p = -1; d < a; ) {
            for (f = d <= k ? 32 : a - d | 0; m < f; d = d + 1 | 0, m = m + 1 | 0) {
              h = b[d] & 255;
              switch (h >> 4) {
                case 15:
                  n = b[d = d + 1 | 0] & 255;
                  if (2 !== n >> 6 || 247 < h) {
                    d = d - 1 | 0;
                    break;
                  }
                  l = (h & 7) << 6 | n & 63;
                  r = 5;
                  h = 256;
                case 14:
                  n = b[d = d + 1 | 0] & 255, l <<= 6, l |= (h & 15) << 6 | n & 63, r = 2 === n >> 6 ? r + 4 | 0 : 24, h = h + 256 & 768;
                case 13:
                case 12:
                  n = b[d = d + 1 | 0] & 255, l <<= 6, l |= (h & 31) << 6 | n & 63, r = r + 7 | 0, d < a && 2 === n >> 6 && l >> r && 1114112 > l ? (h = l, l = l - 65536 | 0, 0 <= l && (p = (l >> 10) + 55296 | 0, h = (l & 1023) + 56320 | 0, 31 > m ? (e[m] = p, m = m + 1 | 0, p = -1) : (n = p, p = h, h = n))) : (h >>= 8, d = d - h - 1 | 0, h = 65533), l = r = 0, f = d <= k ? 32 : a - d | 0;
                default:
                  e[m] = h;
                  continue;
                case 11:
                case 10:
                case 9:
                case 8:
              }
              e[m] = 65533;
            }
            g += v(
              e[0],
              e[1],
              e[2],
              e[3],
              e[4],
              e[5],
              e[6],
              e[7],
              e[8],
              e[9],
              e[10],
              e[11],
              e[12],
              e[13],
              e[14],
              e[15],
              e[16],
              e[17],
              e[18],
              e[19],
              e[20],
              e[21],
              e[22],
              e[23],
              e[24],
              e[25],
              e[26],
              e[27],
              e[28],
              e[29],
              e[30],
              e[31]
            );
            32 > m && (g = g.slice(0, m - 32 | 0));
            if (d < a) {
              if (e[0] = p, m = ~p >>> 31, p = -1, g.length < c.length)
                continue;
            } else
              -1 !== p && (g += v(p));
            c += g;
            g = "";
          }
          return c;
        };
        B.encode = function(b) {
          b = void 0 === b ? "" : "" + b;
          var c = b.length | 0, g = new w((c << 1) + 8 | 0), d, a = 0, k = !t;
          for (d = 0; d < c; d = d + 1 | 0, a = a + 1 | 0) {
            var f = b.charCodeAt(d) | 0;
            if (127 >= f)
              g[a] = f;
            else {
              if (2047 >= f)
                g[a] = 192 | f >> 6;
              else {
                a: {
                  if (55296 <= f)
                    if (56319 >= f) {
                      var h = b.charCodeAt(d = d + 1 | 0) | 0;
                      if (56320 <= h && 57343 >= h) {
                        f = (f << 10) + h - 56613888 | 0;
                        if (65535 < f) {
                          g[a] = 240 | f >> 18;
                          g[a = a + 1 | 0] = 128 | f >> 12 & 63;
                          g[a = a + 1 | 0] = 128 | f >> 6 & 63;
                          g[a = a + 1 | 0] = 128 | f & 63;
                          continue;
                        }
                        break a;
                      }
                      f = 65533;
                    } else
                      57343 >= f && (f = 65533);
                  !k && d << 1 < a && d << 1 < (a - 7 | 0) && (k = true, h = new w(3 * c), h.set(g), g = h);
                }
                g[a] = 224 | f >> 12;
                g[a = a + 1 | 0] = 128 | f >> 6 & 63;
              }
              g[a = a + 1 | 0] = 128 | f & 63;
            }
          }
          return t ? g.subarray(0, a) : g.slice(0, a);
        };
        B.encodeInto = A;
        if (!u)
          q.TextDecoder = y, q.TextEncoder = z;
        else if (!(q = u.prototype).encodeInto) {
          var I = new u();
          q.encodeInto = function(b, c) {
            var g = b.length | 0, d = c.length | 0;
            if (g < d >> 1) {
              var a = I.encode(b);
              if ((a.length | 0) < d)
                return c.set(a), { read: g, written: a.length | 0 };
            }
            return A(b, c);
          };
        }
      })("undefined" == typeof global ? "undefined" == typeof self ? exports : self : global);
    }
  });

  // <stdin>
  var import_fastestsmallesttextencoderdecoder_encodeinto = __toESM(require_EncoderDecoderTogether_min());

  // node_modules/kleur/index.mjs
  var FORCE_COLOR;
  var NODE_DISABLE_COLORS;
  var NO_COLOR;
  var TERM;
  var isTTY = true;
  if (typeof process !== "undefined") {
    ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {});
    isTTY = process.stdout && process.stdout.isTTY;
  }
  var $ = {
    enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== "dumb" && (FORCE_COLOR != null && FORCE_COLOR !== "0" || isTTY),
    // modifiers
    reset: init(0, 0),
    bold: init(1, 22),
    dim: init(2, 22),
    italic: init(3, 23),
    underline: init(4, 24),
    inverse: init(7, 27),
    hidden: init(8, 28),
    strikethrough: init(9, 29),
    // colors
    black: init(30, 39),
    red: init(31, 39),
    green: init(32, 39),
    yellow: init(33, 39),
    blue: init(34, 39),
    magenta: init(35, 39),
    cyan: init(36, 39),
    white: init(37, 39),
    gray: init(90, 39),
    grey: init(90, 39),
    // background colors
    bgBlack: init(40, 49),
    bgRed: init(41, 49),
    bgGreen: init(42, 49),
    bgYellow: init(43, 49),
    bgBlue: init(44, 49),
    bgMagenta: init(45, 49),
    bgCyan: init(46, 49),
    bgWhite: init(47, 49)
  };
  function run(arr, str) {
    let i = 0, tmp, beg = "", end = "";
    for (; i < arr.length; i++) {
      tmp = arr[i];
      beg += tmp.open;
      end += tmp.close;
      if (!!~str.indexOf(tmp.close)) {
        str = str.replace(tmp.rgx, tmp.close + tmp.open);
      }
    }
    return beg + str + end;
  }
  function chain(has2, keys) {
    let ctx = { has: has2, keys };
    ctx.reset = $.reset.bind(ctx);
    ctx.bold = $.bold.bind(ctx);
    ctx.dim = $.dim.bind(ctx);
    ctx.italic = $.italic.bind(ctx);
    ctx.underline = $.underline.bind(ctx);
    ctx.inverse = $.inverse.bind(ctx);
    ctx.hidden = $.hidden.bind(ctx);
    ctx.strikethrough = $.strikethrough.bind(ctx);
    ctx.black = $.black.bind(ctx);
    ctx.red = $.red.bind(ctx);
    ctx.green = $.green.bind(ctx);
    ctx.yellow = $.yellow.bind(ctx);
    ctx.blue = $.blue.bind(ctx);
    ctx.magenta = $.magenta.bind(ctx);
    ctx.cyan = $.cyan.bind(ctx);
    ctx.white = $.white.bind(ctx);
    ctx.gray = $.gray.bind(ctx);
    ctx.grey = $.grey.bind(ctx);
    ctx.bgBlack = $.bgBlack.bind(ctx);
    ctx.bgRed = $.bgRed.bind(ctx);
    ctx.bgGreen = $.bgGreen.bind(ctx);
    ctx.bgYellow = $.bgYellow.bind(ctx);
    ctx.bgBlue = $.bgBlue.bind(ctx);
    ctx.bgMagenta = $.bgMagenta.bind(ctx);
    ctx.bgCyan = $.bgCyan.bind(ctx);
    ctx.bgWhite = $.bgWhite.bind(ctx);
    return ctx;
  }
  function init(open, close) {
    let blk = {
      open: `\x1B[${open}m`,
      close: `\x1B[${close}m`,
      rgx: new RegExp(`\\x1b\\[${close}m`, "g")
    };
    return function(txt) {
      if (this !== void 0 && this.has !== void 0) {
        !!~this.has.indexOf(open) || (this.has.push(open), this.keys.push(blk));
        return txt === void 0 ? this : $.enabled ? run(this.keys, txt + "") : txt + "";
      }
      return txt === void 0 ? chain([open], [blk]) : $.enabled ? run([blk], txt + "") : txt + "";
    };
  }
  var kleur_default = $;

  // node_modules/diff/lib/index.mjs
  function Diff() {
  }
  Diff.prototype = {
    diff: function diff(oldString, newString) {
      var _options$timeout;
      var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      var callback = options.callback;
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      this.options = options;
      var self2 = this;
      function done(value) {
        if (callback) {
          setTimeout(function() {
            callback(void 0, value);
          }, 0);
          return true;
        } else {
          return value;
        }
      }
      oldString = this.castInput(oldString);
      newString = this.castInput(newString);
      oldString = this.removeEmpty(this.tokenize(oldString));
      newString = this.removeEmpty(this.tokenize(newString));
      var newLen = newString.length, oldLen = oldString.length;
      var editLength = 1;
      var maxEditLength = newLen + oldLen;
      if (options.maxEditLength) {
        maxEditLength = Math.min(maxEditLength, options.maxEditLength);
      }
      var maxExecutionTime = (_options$timeout = options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : Infinity;
      var abortAfterTimestamp = Date.now() + maxExecutionTime;
      var bestPath = [{
        oldPos: -1,
        lastComponent: void 0
      }];
      var newPos = this.extractCommon(bestPath[0], newString, oldString, 0);
      if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
        return done([{
          value: this.join(newString),
          count: newString.length
        }]);
      }
      var minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
      function execEditLength() {
        for (var diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
          var basePath = void 0;
          var removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
          if (removePath) {
            bestPath[diagonalPath - 1] = void 0;
          }
          var canAdd = false;
          if (addPath) {
            var addPathNewPos = addPath.oldPos - diagonalPath;
            canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
          }
          var canRemove = removePath && removePath.oldPos + 1 < oldLen;
          if (!canAdd && !canRemove) {
            bestPath[diagonalPath] = void 0;
            continue;
          }
          if (!canRemove || canAdd && removePath.oldPos + 1 < addPath.oldPos) {
            basePath = self2.addToPath(addPath, true, void 0, 0);
          } else {
            basePath = self2.addToPath(removePath, void 0, true, 1);
          }
          newPos = self2.extractCommon(basePath, newString, oldString, diagonalPath);
          if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
            return done(buildValues(self2, basePath.lastComponent, newString, oldString, self2.useLongestToken));
          } else {
            bestPath[diagonalPath] = basePath;
            if (basePath.oldPos + 1 >= oldLen) {
              maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
            }
            if (newPos + 1 >= newLen) {
              minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
            }
          }
        }
        editLength++;
      }
      if (callback) {
        (function exec2() {
          setTimeout(function() {
            if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
              return callback();
            }
            if (!execEditLength()) {
              exec2();
            }
          }, 0);
        })();
      } else {
        while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
          var ret = execEditLength();
          if (ret) {
            return ret;
          }
        }
      }
    },
    addToPath: function addToPath(path, added, removed, oldPosInc) {
      var last = path.lastComponent;
      if (last && last.added === added && last.removed === removed) {
        return {
          oldPos: path.oldPos + oldPosInc,
          lastComponent: {
            count: last.count + 1,
            added,
            removed,
            previousComponent: last.previousComponent
          }
        };
      } else {
        return {
          oldPos: path.oldPos + oldPosInc,
          lastComponent: {
            count: 1,
            added,
            removed,
            previousComponent: last
          }
        };
      }
    },
    extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
      var newLen = newString.length, oldLen = oldString.length, oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
      while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
        newPos++;
        oldPos++;
        commonCount++;
      }
      if (commonCount) {
        basePath.lastComponent = {
          count: commonCount,
          previousComponent: basePath.lastComponent
        };
      }
      basePath.oldPos = oldPos;
      return newPos;
    },
    equals: function equals(left, right) {
      if (this.options.comparator) {
        return this.options.comparator(left, right);
      } else {
        return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
      }
    },
    removeEmpty: function removeEmpty(array) {
      var ret = [];
      for (var i = 0; i < array.length; i++) {
        if (array[i]) {
          ret.push(array[i]);
        }
      }
      return ret;
    },
    castInput: function castInput(value) {
      return value;
    },
    tokenize: function tokenize(value) {
      return value.split("");
    },
    join: function join(chars2) {
      return chars2.join("");
    }
  };
  function buildValues(diff2, lastComponent, newString, oldString, useLongestToken) {
    var components = [];
    var nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    var componentPos = 0, componentLen = components.length, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      var component = components[componentPos];
      if (!component.removed) {
        if (!component.added && useLongestToken) {
          var value = newString.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i) {
            var oldValue = oldString[oldPos + i];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = diff2.join(value);
        } else {
          component.value = diff2.join(newString.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = diff2.join(oldString.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
        if (componentPos && components[componentPos - 1].added) {
          var tmp = components[componentPos - 1];
          components[componentPos - 1] = components[componentPos];
          components[componentPos] = tmp;
        }
      }
    }
    var finalComponent = components[componentLen - 1];
    if (componentLen > 1 && typeof finalComponent.value === "string" && (finalComponent.added || finalComponent.removed) && diff2.equals("", finalComponent.value)) {
      components[componentLen - 2].value += finalComponent.value;
      components.pop();
    }
    return components;
  }
  var characterDiff = new Diff();
  function diffChars(oldStr, newStr, options) {
    return characterDiff.diff(oldStr, newStr, options);
  }
  var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;
  var reWhitespace = /\S/;
  var wordDiff = new Diff();
  wordDiff.equals = function(left, right) {
    if (this.options.ignoreCase) {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }
    return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
  };
  wordDiff.tokenize = function(value) {
    var tokens = value.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/);
    for (var i = 0; i < tokens.length - 1; i++) {
      if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
        tokens[i] += tokens[i + 2];
        tokens.splice(i + 1, 2);
        i--;
      }
    }
    return tokens;
  };
  var lineDiff = new Diff();
  lineDiff.tokenize = function(value) {
    if (this.options.stripTrailingCr) {
      value = value.replace(/\r\n/g, "\n");
    }
    var retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
    if (!linesAndNewlines[linesAndNewlines.length - 1]) {
      linesAndNewlines.pop();
    }
    for (var i = 0; i < linesAndNewlines.length; i++) {
      var line2 = linesAndNewlines[i];
      if (i % 2 && !this.options.newlineIsToken) {
        retLines[retLines.length - 1] += line2;
      } else {
        if (this.options.ignoreWhitespace) {
          line2 = line2.trim();
        }
        retLines.push(line2);
      }
    }
    return retLines;
  };
  function diffLines(oldStr, newStr, callback) {
    return lineDiff.diff(oldStr, newStr, callback);
  }
  var sentenceDiff = new Diff();
  sentenceDiff.tokenize = function(value) {
    return value.split(/(\S.+?[.!?])(?=\s+|$)/);
  };
  var cssDiff = new Diff();
  cssDiff.tokenize = function(value) {
    return value.split(/([{}:;,]|\s+)/);
  };
  function _typeof(obj) {
    "@babel/helpers - typeof";
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function(obj2) {
        return typeof obj2;
      };
    } else {
      _typeof = function(obj2) {
        return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
      };
    }
    return _typeof(obj);
  }
  var objectPrototypeToString = Object.prototype.toString;
  var jsonDiff = new Diff();
  jsonDiff.useLongestToken = true;
  jsonDiff.tokenize = lineDiff.tokenize;
  jsonDiff.castInput = function(value) {
    var _this$options = this.options, undefinedReplacement = _this$options.undefinedReplacement, _this$options$stringi = _this$options.stringifyReplacer, stringifyReplacer = _this$options$stringi === void 0 ? function(k, v) {
      return typeof v === "undefined" ? undefinedReplacement : v;
    } : _this$options$stringi;
    return typeof value === "string" ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, "  ");
  };
  jsonDiff.equals = function(left, right) {
    return Diff.prototype.equals.call(jsonDiff, left.replace(/,([\r\n])/g, "$1"), right.replace(/,([\r\n])/g, "$1"));
  };
  function canonicalize(obj, stack2, replacementStack, replacer, key) {
    stack2 = stack2 || [];
    replacementStack = replacementStack || [];
    if (replacer) {
      obj = replacer(key, obj);
    }
    var i;
    for (i = 0; i < stack2.length; i += 1) {
      if (stack2[i] === obj) {
        return replacementStack[i];
      }
    }
    var canonicalizedObj;
    if ("[object Array]" === objectPrototypeToString.call(obj)) {
      stack2.push(obj);
      canonicalizedObj = new Array(obj.length);
      replacementStack.push(canonicalizedObj);
      for (i = 0; i < obj.length; i += 1) {
        canonicalizedObj[i] = canonicalize(obj[i], stack2, replacementStack, replacer, key);
      }
      stack2.pop();
      replacementStack.pop();
      return canonicalizedObj;
    }
    if (obj && obj.toJSON) {
      obj = obj.toJSON();
    }
    if (_typeof(obj) === "object" && obj !== null) {
      stack2.push(obj);
      canonicalizedObj = {};
      replacementStack.push(canonicalizedObj);
      var sortedKeys = [], _key;
      for (_key in obj) {
        if (obj.hasOwnProperty(_key)) {
          sortedKeys.push(_key);
        }
      }
      sortedKeys.sort();
      for (i = 0; i < sortedKeys.length; i += 1) {
        _key = sortedKeys[i];
        canonicalizedObj[_key] = canonicalize(obj[_key], stack2, replacementStack, replacer, _key);
      }
      stack2.pop();
      replacementStack.pop();
    } else {
      canonicalizedObj = obj;
    }
    return canonicalizedObj;
  }
  var arrayDiff = new Diff();
  arrayDiff.tokenize = function(value) {
    return value.slice();
  };
  arrayDiff.join = arrayDiff.removeEmpty = function(value) {
    return value;
  };
  function diffArrays(oldArr, newArr, callback) {
    return arrayDiff.diff(oldArr, newArr, callback);
  }

  // node_modules/uvu/diff/index.mjs
  var colors = {
    "--": kleur_default.red,
    "\xB7\xB7": kleur_default.grey,
    "++": kleur_default.green
  };
  var TITLE = kleur_default.dim().italic;
  var TAB = kleur_default.dim("\u2192");
  var SPACE = kleur_default.dim("\xB7");
  var NL = kleur_default.dim("\u21B5");
  var LOG = (sym, str) => colors[sym](sym + PRETTY(str)) + "\n";
  var LINE = (num, x) => kleur_default.dim("L" + String(num).padStart(x, "0") + " ");
  var PRETTY = (str) => str.replace(/[ ]/g, SPACE).replace(/\t/g, TAB).replace(/(\r?\n)/g, NL);
  function line(obj, prev, pad) {
    let char = obj.removed ? "--" : obj.added ? "++" : "\xB7\xB7";
    let arr = obj.value.replace(/\r?\n$/, "").split("\n");
    let i = 0, tmp, out = "";
    if (obj.added)
      out += colors[char]().underline(TITLE("Expected:")) + "\n";
    else if (obj.removed)
      out += colors[char]().underline(TITLE("Actual:")) + "\n";
    for (; i < arr.length; i++) {
      tmp = arr[i];
      if (tmp != null) {
        if (prev)
          out += LINE(prev + i, pad);
        out += LOG(char, tmp || "\n");
      }
    }
    return out;
  }
  function arrays(input, expect) {
    let arr = diffArrays(input, expect);
    let i = 0, j = 0, k = 0, tmp, val, char, isObj, str;
    let out = LOG("\xB7\xB7", "[");
    for (; i < arr.length; i++) {
      char = (tmp = arr[i]).removed ? "--" : tmp.added ? "++" : "\xB7\xB7";
      if (tmp.added) {
        out += colors[char]().underline(TITLE("Expected:")) + "\n";
      } else if (tmp.removed) {
        out += colors[char]().underline(TITLE("Actual:")) + "\n";
      }
      for (j = 0; j < tmp.value.length; j++) {
        isObj = tmp.value[j] && typeof tmp.value[j] === "object";
        val = stringify(tmp.value[j]).split(/\r?\n/g);
        for (k = 0; k < val.length; ) {
          str = "  " + val[k++] + (isObj ? "" : ",");
          if (isObj && k === val.length && j + 1 < tmp.value.length)
            str += ",";
          out += LOG(char, str);
        }
      }
    }
    return out + LOG("\xB7\xB7", "]");
  }
  function lines(input, expect, linenum = 0) {
    let i = 0, tmp, output = "";
    let arr = diffLines(input, expect);
    let pad = String(expect.split(/\r?\n/g).length - linenum).length;
    for (; i < arr.length; i++) {
      output += line(tmp = arr[i], linenum, pad);
      if (linenum && !tmp.removed)
        linenum += tmp.count;
    }
    return output;
  }
  function chars(input, expect) {
    let arr = diffChars(input, expect);
    let i = 0, output = "", tmp;
    let l1 = input.length;
    let l2 = expect.length;
    let p1 = PRETTY(input);
    let p2 = PRETTY(expect);
    tmp = arr[i];
    if (l1 === l2) {
    } else if (tmp.removed && arr[i + 1]) {
      let del = tmp.count - arr[i + 1].count;
      if (del == 0) {
      } else if (del > 0) {
        expect = " ".repeat(del) + expect;
        p2 = " ".repeat(del) + p2;
        l2 += del;
      } else if (del < 0) {
        input = " ".repeat(-del) + input;
        p1 = " ".repeat(-del) + p1;
        l1 += -del;
      }
    }
    output += direct(p1, p2, l1, l2);
    if (l1 === l2) {
      for (tmp = "  "; i < l1; i++) {
        tmp += input[i] === expect[i] ? " " : "^";
      }
    } else {
      for (tmp = "  "; i < arr.length; i++) {
        tmp += (arr[i].added || arr[i].removed ? "^" : " ").repeat(Math.max(arr[i].count, 0));
        if (i + 1 < arr.length && (arr[i].added && arr[i + 1].removed || arr[i].removed && arr[i + 1].added)) {
          arr[i + 1].count -= arr[i].count;
        }
      }
    }
    return output + kleur_default.red(tmp);
  }
  function direct(input, expect, lenA = String(input).length, lenB = String(expect).length) {
    let gutter = 4;
    let lenC = Math.max(lenA, lenB);
    let typeA = typeof input, typeB = typeof expect;
    if (typeA !== typeB) {
      gutter = 2;
      let delA = gutter + lenC - lenA;
      let delB = gutter + lenC - lenB;
      input += " ".repeat(delA) + kleur_default.dim(`[${typeA}]`);
      expect += " ".repeat(delB) + kleur_default.dim(`[${typeB}]`);
      lenA += delA + typeA.length + 2;
      lenB += delB + typeB.length + 2;
      lenC = Math.max(lenA, lenB);
    }
    let output = colors["++"]("++" + expect + " ".repeat(gutter + lenC - lenB) + TITLE("(Expected)")) + "\n";
    return output + colors["--"]("--" + input + " ".repeat(gutter + lenC - lenA) + TITLE("(Actual)")) + "\n";
  }
  function sort(input, expect) {
    var k, i = 0, tmp, isArr = Array.isArray(input);
    var keys = [], out = isArr ? Array(input.length) : {};
    if (isArr) {
      for (i = 0; i < out.length; i++) {
        tmp = input[i];
        if (!tmp || typeof tmp !== "object")
          out[i] = tmp;
        else
          out[i] = sort(tmp, expect[i]);
      }
    } else {
      for (k in expect)
        keys.push(k);
      for (; i < keys.length; i++) {
        if (Object.prototype.hasOwnProperty.call(input, k = keys[i])) {
          if (!(tmp = input[k]) || typeof tmp !== "object")
            out[k] = tmp;
          else
            out[k] = sort(tmp, expect[k]);
        }
      }
      for (k in input) {
        if (!out.hasOwnProperty(k)) {
          out[k] = input[k];
        }
      }
    }
    return out;
  }
  function circular() {
    var cache = /* @__PURE__ */ new Set();
    return function print(key, val) {
      if (val === void 0)
        return "[__VOID__]";
      if (typeof val === "number" && val !== val)
        return "[__NAN__]";
      if (typeof val === "bigint")
        return val.toString();
      if (!val || typeof val !== "object")
        return val;
      if (cache.has(val))
        return "[Circular]";
      cache.add(val);
      return val;
    };
  }
  function stringify(input) {
    return JSON.stringify(input, circular(), 2).replace(/"\[__NAN__\]"/g, "NaN").replace(/"\[__VOID__\]"/g, "undefined");
  }
  function compare(input, expect) {
    if (Array.isArray(expect) && Array.isArray(input))
      return arrays(input, expect);
    if (expect instanceof RegExp)
      return chars("" + input, "" + expect);
    let isA = input && typeof input == "object";
    let isB = expect && typeof expect == "object";
    if (isA && isB)
      input = sort(input, expect);
    if (isB)
      expect = stringify(expect);
    if (isA)
      input = stringify(input);
    if (expect && typeof expect == "object") {
      input = stringify(sort(input, expect));
      expect = stringify(expect);
    }
    isA = typeof input == "string";
    isB = typeof expect == "string";
    if (isA && /\r?\n/.test(input))
      return lines(input, "" + expect);
    if (isB && /\r?\n/.test(expect))
      return lines("" + input, expect);
    if (isA && isB)
      return chars(input, expect);
    return direct(input, expect);
  }

  // node_modules/uvu/dist/index.mjs
  var isCLI = false;
  var isNode = false;
  var hrtime = (now = Date.now()) => () => (Date.now() - now).toFixed(2) + "ms";
  var write = console.log;
  var into = (ctx, key) => (name, handler) => ctx[key].push({ name, handler });
  var context = (state) => ({ tests: [], before: [], after: [], bEach: [], aEach: [], only: [], skips: 0, state });
  var milli = (arr) => (arr[0] * 1e3 + arr[1] / 1e6).toFixed(2) + "ms";
  var hook = (ctx, key) => (handler) => ctx[key].push(handler);
  if (isNode = typeof process < "u" && typeof process.stdout < "u") {
    if (typeof globalThis !== "object") {
      Object.defineProperty(global, "globalThis", {
        get: function() {
          return this;
        }
      });
    }
    let rgx = /(\.bin[\\+\/]uvu$|uvu[\\+\/]bin\.js)/i;
    isCLI = process.argv.some((x) => rgx.test(x));
    write = (x) => process.stdout.write(x);
    hrtime = (now = process.hrtime()) => () => milli(process.hrtime(now));
  } else if (typeof performance < "u") {
    hrtime = (now = performance.now()) => () => (performance.now() - now).toFixed(2) + "ms";
  }
  globalThis.UVU_QUEUE = globalThis.UVU_QUEUE || [];
  isCLI = isCLI || !!globalThis.UVU_DEFER;
  isCLI || UVU_QUEUE.push([null]);
  var QUOTE = kleur_default.dim('"');
  var GUTTER = "\n        ";
  var FAIL = kleur_default.red("\u2718 ");
  var PASS = kleur_default.gray("\u2022 ");
  var IGNORE = /^\s*at.*(?:\(|\s)(?:node|(internal\/[\w/]*))/;
  var FAILURE = kleur_default.bold().bgRed(" FAIL ");
  var FILE = kleur_default.bold().underline().white;
  var SUITE = kleur_default.bgWhite().bold;
  function stack(stack2, idx) {
    let i = 0, line2, out = "";
    let arr = stack2.substring(idx).replace(/\\/g, "/").split("\n");
    for (; i < arr.length; i++) {
      line2 = arr[i].trim();
      if (line2.length && !IGNORE.test(line2)) {
        out += "\n    " + line2;
      }
    }
    return kleur_default.grey(out) + "\n";
  }
  function format(name, err, suite2 = "") {
    let { details, operator = "" } = err;
    let idx = err.stack && err.stack.indexOf("\n");
    if (err.name.startsWith("AssertionError") && !operator.includes("not"))
      details = compare(err.actual, err.expected);
    let str = "  " + FAILURE + (suite2 ? kleur_default.red(SUITE(` ${suite2} `)) : "") + " " + QUOTE + kleur_default.red().bold(name) + QUOTE;
    str += "\n    " + err.message + (operator ? kleur_default.italic().dim(`  (${operator})`) : "") + "\n";
    if (details)
      str += GUTTER + details.split("\n").join(GUTTER);
    if (!!~idx)
      str += stack(err.stack, idx);
    return str + "\n";
  }
  async function runner(ctx, name) {
    let { only, tests, before, after, bEach, aEach, state } = ctx;
    let hook2, test2, arr = only.length ? only : tests;
    let num = 0, errors = "", total = arr.length;
    try {
      if (name)
        write(SUITE(kleur_default.black(` ${name} `)) + " ");
      for (hook2 of before)
        await hook2(state);
      for (test2 of arr) {
        state.__test__ = test2.name;
        try {
          for (hook2 of bEach)
            await hook2(state);
          await test2.handler(state);
          for (hook2 of aEach)
            await hook2(state);
          write(PASS);
          num++;
        } catch (err) {
          for (hook2 of aEach)
            await hook2(state);
          if (errors.length)
            errors += "\n";
          errors += format(test2.name, err, name);
          write(FAIL);
        }
      }
    } finally {
      state.__test__ = "";
      for (hook2 of after)
        await hook2(state);
      let msg = `  (${num} / ${total})
`;
      let skipped = (only.length ? tests.length : 0) + ctx.skips;
      write(errors.length ? kleur_default.red(msg) : kleur_default.green(msg));
      return [errors || true, num, skipped, total];
    }
  }
  var timer;
  function defer() {
    clearTimeout(timer);
    timer = setTimeout(exec);
  }
  function setup(ctx, name = "") {
    ctx.state.__test__ = "";
    ctx.state.__suite__ = name;
    const test2 = into(ctx, "tests");
    test2.before = hook(ctx, "before");
    test2.before.each = hook(ctx, "bEach");
    test2.after = hook(ctx, "after");
    test2.after.each = hook(ctx, "aEach");
    test2.only = into(ctx, "only");
    test2.skip = () => {
      ctx.skips++;
    };
    test2.run = () => {
      let copy = { ...ctx };
      let run2 = runner.bind(0, copy, name);
      Object.assign(ctx, context(copy.state));
      UVU_QUEUE[globalThis.UVU_INDEX || 0].push(run2);
      isCLI || defer();
    };
    return test2;
  }
  var suite = (name = "", state = {}) => setup(context(state), name);
  var test = suite();
  var isRunning = false;
  async function exec(bail) {
    let timer2 = hrtime();
    let done = 0, total = 0, skips = 0, code = 0;
    isRunning = true;
    for (let group of UVU_QUEUE) {
      if (total)
        write("\n");
      let name = group.shift();
      if (name != null)
        write(FILE(name) + "\n");
      for (let test2 of group) {
        let [errs, ran, skip, max] = await test2();
        total += max;
        done += ran;
        skips += skip;
        if (errs.length) {
          write("\n" + errs + "\n");
          code = 1;
          if (bail)
            return isNode && process.exit(1);
        }
      }
    }
    isRunning = false;
    write("\n  Total:     " + total);
    write((code ? kleur_default.red : kleur_default.green)("\n  Passed:    " + done));
    write("\n  Skipped:   " + (skips ? kleur_default.yellow(skips) : skips));
    write("\n  Duration:  " + timer2() + "\n\n");
    if (isNode)
      process.exitCode = code;
  }
  if (isNode)
    process.on("exit", () => {
      if (!isRunning)
        return;
      process.exitCode = process.exitCode || 1;
      console.error("Exiting early before testing is finished.");
    });

  // node_modules/uvu/assert/index.mjs
  var assert_exports = {};
  __export(assert_exports, {
    Assertion: () => Assertion,
    equal: () => equal,
    fixture: () => fixture,
    instance: () => instance,
    is: () => is,
    match: () => match,
    not: () => not,
    ok: () => ok,
    snapshot: () => snapshot,
    throws: () => throws,
    type: () => type,
    unreachable: () => unreachable
  });

  // node_modules/dequal/dist/index.mjs
  var has = Object.prototype.hasOwnProperty;
  function find(iter, tar, key) {
    for (key of iter.keys()) {
      if (dequal(key, tar))
        return key;
    }
  }
  function dequal(foo, bar) {
    var ctor, len, tmp;
    if (foo === bar)
      return true;
    if (foo && bar && (ctor = foo.constructor) === bar.constructor) {
      if (ctor === Date)
        return foo.getTime() === bar.getTime();
      if (ctor === RegExp)
        return foo.toString() === bar.toString();
      if (ctor === Array) {
        if ((len = foo.length) === bar.length) {
          while (len-- && dequal(foo[len], bar[len]))
            ;
        }
        return len === -1;
      }
      if (ctor === Set) {
        if (foo.size !== bar.size) {
          return false;
        }
        for (len of foo) {
          tmp = len;
          if (tmp && typeof tmp === "object") {
            tmp = find(bar, tmp);
            if (!tmp)
              return false;
          }
          if (!bar.has(tmp))
            return false;
        }
        return true;
      }
      if (ctor === Map) {
        if (foo.size !== bar.size) {
          return false;
        }
        for (len of foo) {
          tmp = len[0];
          if (tmp && typeof tmp === "object") {
            tmp = find(bar, tmp);
            if (!tmp)
              return false;
          }
          if (!dequal(len[1], bar.get(tmp))) {
            return false;
          }
        }
        return true;
      }
      if (ctor === ArrayBuffer) {
        foo = new Uint8Array(foo);
        bar = new Uint8Array(bar);
      } else if (ctor === DataView) {
        if ((len = foo.byteLength) === bar.byteLength) {
          while (len-- && foo.getInt8(len) === bar.getInt8(len))
            ;
        }
        return len === -1;
      }
      if (ArrayBuffer.isView(foo)) {
        if ((len = foo.byteLength) === bar.byteLength) {
          while (len-- && foo[len] === bar[len])
            ;
        }
        return len === -1;
      }
      if (!ctor || typeof foo === "object") {
        len = 0;
        for (ctor in foo) {
          if (has.call(foo, ctor) && ++len && !has.call(bar, ctor))
            return false;
          if (!(ctor in bar) || !dequal(foo[ctor], bar[ctor]))
            return false;
        }
        return Object.keys(bar).length === len;
      }
    }
    return foo !== foo && bar !== bar;
  }

  // node_modules/uvu/assert/index.mjs
  function dedent(str) {
    str = str.replace(/\r?\n/g, "\n");
    let arr = str.match(/^[ \t]*(?=\S)/gm);
    let i = 0, min = 1 / 0, len = (arr || []).length;
    for (; i < len; i++)
      min = Math.min(min, arr[i].length);
    return len && min ? str.replace(new RegExp(`^[ \\t]{${min}}`, "gm"), "") : str;
  }
  var Assertion = class extends Error {
    constructor(opts = {}) {
      super(opts.message);
      this.name = "Assertion";
      this.code = "ERR_ASSERTION";
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
      this.details = opts.details || false;
      this.generated = !!opts.generated;
      this.operator = opts.operator;
      this.expects = opts.expects;
      this.actual = opts.actual;
    }
  };
  function assert(bool, actual, expects, operator, detailer, backup, msg) {
    if (bool)
      return;
    let message = msg || backup;
    if (msg instanceof Error)
      throw msg;
    let details = detailer && detailer(actual, expects);
    throw new Assertion({ actual, expects, operator, message, details, generated: !msg });
  }
  function ok(val, msg) {
    assert(!!val, false, true, "ok", false, "Expected value to be truthy", msg);
  }
  function is(val, exp, msg) {
    assert(val === exp, val, exp, "is", compare, "Expected values to be strictly equal:", msg);
  }
  function equal(val, exp, msg) {
    assert(dequal(val, exp), val, exp, "equal", compare, "Expected values to be deeply equal:", msg);
  }
  function unreachable(msg) {
    assert(false, true, false, "unreachable", false, "Expected not to be reached!", msg);
  }
  function type(val, exp, msg) {
    let tmp = typeof val;
    assert(tmp === exp, tmp, exp, "type", false, `Expected "${tmp}" to be "${exp}"`, msg);
  }
  function instance(val, exp, msg) {
    let name = "`" + (exp.name || exp.constructor.name) + "`";
    assert(val instanceof exp, val, exp, "instance", false, `Expected value to be an instance of ${name}`, msg);
  }
  function match(val, exp, msg) {
    if (typeof exp === "string") {
      assert(val.includes(exp), val, exp, "match", false, `Expected value to include "${exp}" substring`, msg);
    } else {
      assert(exp.test(val), val, exp, "match", false, `Expected value to match \`${String(exp)}\` pattern`, msg);
    }
  }
  function snapshot(val, exp, msg) {
    val = dedent(val);
    exp = dedent(exp);
    assert(val === exp, val, exp, "snapshot", lines, "Expected value to match snapshot:", msg);
  }
  var lineNums = (x, y) => lines(x, y, 1);
  function fixture(val, exp, msg) {
    val = dedent(val);
    exp = dedent(exp);
    assert(val === exp, val, exp, "fixture", lineNums, "Expected value to match fixture:", msg);
  }
  function throws(blk, exp, msg) {
    if (!msg && typeof exp === "string") {
      msg = exp;
      exp = null;
    }
    try {
      blk();
      assert(false, false, true, "throws", false, "Expected function to throw", msg);
    } catch (err) {
      if (err instanceof Assertion)
        throw err;
      if (typeof exp === "function") {
        assert(exp(err), false, true, "throws", false, "Expected function to throw matching exception", msg);
      } else if (exp instanceof RegExp) {
        assert(exp.test(err.message), false, true, "throws", false, `Expected function to throw exception matching \`${String(exp)}\` pattern`, msg);
      }
    }
  }
  function not(val, msg) {
    assert(!val, true, false, "not", false, "Expected value to be falsey", msg);
  }
  not.ok = not;
  is.not = function(val, exp, msg) {
    assert(val !== exp, val, exp, "is.not", false, "Expected values not to be strictly equal", msg);
  };
  not.equal = function(val, exp, msg) {
    assert(!dequal(val, exp), val, exp, "not.equal", false, "Expected values not to be deeply equal", msg);
  };
  not.type = function(val, exp, msg) {
    let tmp = typeof val;
    assert(tmp !== exp, tmp, exp, "not.type", false, `Expected "${tmp}" not to be "${exp}"`, msg);
  };
  not.instance = function(val, exp, msg) {
    let name = "`" + (exp.name || exp.constructor.name) + "`";
    assert(!(val instanceof exp), val, exp, "not.instance", false, `Expected value not to be an instance of ${name}`, msg);
  };
  not.snapshot = function(val, exp, msg) {
    val = dedent(val);
    exp = dedent(exp);
    assert(val !== exp, val, exp, "not.snapshot", false, "Expected value not to match snapshot", msg);
  };
  not.fixture = function(val, exp, msg) {
    val = dedent(val);
    exp = dedent(exp);
    assert(val !== exp, val, exp, "not.fixture", false, "Expected value not to match fixture", msg);
  };
  not.match = function(val, exp, msg) {
    if (typeof exp === "string") {
      assert(!val.includes(exp), val, exp, "not.match", false, `Expected value not to include "${exp}" substring`, msg);
    } else {
      assert(!exp.test(val), val, exp, "not.match", false, `Expected value not to match \`${String(exp)}\` pattern`, msg);
    }
  };
  not.throws = function(blk, exp, msg) {
    if (!msg && typeof exp === "string") {
      msg = exp;
      exp = null;
    }
    try {
      blk();
    } catch (err) {
      if (typeof exp === "function") {
        assert(!exp(err), true, false, "not.throws", false, "Expected function not to throw matching exception", msg);
      } else if (exp instanceof RegExp) {
        assert(!exp.test(err.message), true, false, "not.throws", false, `Expected function not to throw exception matching \`${String(exp)}\` pattern`, msg);
      } else if (!exp) {
        assert(false, true, false, "not.throws", false, "Expected function not to throw", msg);
      }
    }
  };

  // <stdin>
  globalThis.Como.suite = suite;
  globalThis.Como.test = test;
  globalThis.Como.assert = assert_exports;
})();

