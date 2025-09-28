
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
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
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    var dist_exports = {};
    __export(dist_exports, {
      exec: () => exec,
      suite: () => suite,
      test: () => test
    });
    module.exports = __toCommonJS(dist_exports);
    var import_kleur = {
        default: {}
    };
    // var import_diff = require("uvu/diff");

    const into = (ctx, key) => (name, handler) => ctx[key].push({ name, handler });
    const context = (state) => ({ tests: [], before: [], after: [], bEach: [], aEach: [], only: [], skips: 0, state });
    const milli = (arr) => (arr[0] * 1e3 + arr[1] / 1e6).toFixed(2) + "ms";
    const hook = (ctx, key) => (handler) => ctx[key].push(handler);
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
    const QUOTE = import_kleur.default.dim('"'), GUTTER = "\n        ";
    const FAIL = import_kleur.default.red("\u2718 "), PASS = import_kleur.default.gray("\u2022 ");
    const IGNORE = /^\s*at.*(?:\(|\s)(?:node|(internal\/[\w/]*))/;
    const FAILURE = import_kleur.default.bold().bgRed(" FAIL ");
    const FILE = import_kleur.default.bold().underline().white;
    const SUITE = import_kleur.default.bgWhite().bold;
    function stack(stack2, idx) {
      let i = 0, line, out = "";
      let arr = stack2.substring(idx).replace(/\\/g, "/").split("\n");
      for (; i < arr.length; i++) {
        line = arr[i].trim();
        if (line.length && !IGNORE.test(line)) {
          out += "\n    " + line;
        }
      }
      return import_kleur.default.grey(out) + "\n";
    }
    function format(name, err, suite2 = "") {
      let { details, operator = "" } = err;
      let idx = err.stack && err.stack.indexOf("\n");
      if (err.name.startsWith("AssertionError") && !operator.includes("not"))
        details = (0, import_diff.compare)(err.actual, err.expected);
      let str = "  " + FAILURE + (suite2 ? import_kleur.default.red(SUITE(` ${suite2} `)) : "") + " " + QUOTE + import_kleur.default.red().bold(name) + QUOTE;
      str += "\n    " + err.message + (operator ? import_kleur.default.italic().dim(`  (${operator})`) : "") + "\n";
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
          write(SUITE(import_kleur.default.black(` ${name} `)) + " ");
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
        write(errors.length ? import_kleur.default.red(msg) : import_kleur.default.green(msg));
        return [errors || true, num, skipped, total];
      }
    }
    let timer;
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
        let run = runner.bind(0, copy, name);
        Object.assign(ctx, context(copy.state));
        UVU_QUEUE[globalThis.UVU_INDEX || 0].push(run);
        isCLI || defer();
      };
      return test2;
    }
    const suite = (name = "", state = {}) => setup(context(state), name);
    const test = suite();
    let isRunning = false;
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
      write((code ? import_kleur.default.red : import_kleur.default.green)("\n  Passed:    " + done));
      write("\n  Skipped:   " + (skips ? import_kleur.default.yellow(skips) : skips));
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
    // Annotate the CommonJS export names for ESM import in node:
    0 && (module.exports = {
      exec,
      suite,
      test
    });


