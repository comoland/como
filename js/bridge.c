#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "cutils.h"
#include "quickjs.h"
#include "quickjs-libc.h"

const uint32_t qjsc_ts_size;
const uint8_t qjsc_ts[2141516];

const uint32_t qjsc_babel_size;
const uint8_t qjsc_babel[1083920];

JSModuleDef *moduleLoader();
char *moduleNormalizeName();
void promiseRejectionTracker();

struct _promise
{
    JSContext *ctx;
    JSValue promise;
    JSValue resolve;
} _promise;

static JSValue JS_NewNull() { return JS_NULL; }
static JSValue JS_NewUndefined() { return JS_UNDEFINED; }
static JSValue JS_NewUninitialized() { return JS_UNINITIALIZED; }
static JSValue ThrowSyntaxError(JSContext *ctx, const char *fmt) { return JS_ThrowSyntaxError(ctx, "%s", fmt); }
static JSValue ThrowTypeError(JSContext *ctx, const char *fmt) { return JS_ThrowTypeError(ctx, "%s", fmt); }
static JSValue ThrowReferenceError(JSContext *ctx, const char *fmt) { return JS_ThrowReferenceError(ctx, "%s", fmt); }
static JSValue ThrowRangeError(JSContext *ctx, const char *fmt) { return JS_ThrowRangeError(ctx, "%s", fmt); }
static JSValue ThrowInternalError(JSContext *ctx, const char *fmt) { return JS_ThrowInternalError(ctx, "%s", fmt); }
static JSValue JS_True() {  return JS_TRUE; }
static JSValue JS_False() {  return JS_FALSE; }

static inline JS_BOOL JS_IsFloat(JSValueConst v) {
    int tag = JS_VALUE_GET_TAG(v);
    return tag == JS_TAG_IS_FLOAT64(tag);
}

static void *como_value_ptr(JSValue val) {
    return JS_VALUE_GET_PTR(val);
}

static int como_get_val_int(JSValue val) {
    return JS_VALUE_GET_INT(val);
}

static int como_js_type(JSValue val) {
    int type = JS_VALUE_GET_NORM_TAG(val);
    return type;
}

static int como_eval_buf(JSContext *ctx, const char *buf, const char *filename, int eval_flags) {
    JSValue val;
    int ret;
    int buf_len = strlen(buf);

    if ((eval_flags & JS_EVAL_TYPE_MASK) == JS_EVAL_TYPE_MODULE)
    {
        val = JS_Eval(ctx, buf, buf_len, filename, eval_flags | JS_EVAL_FLAG_COMPILE_ONLY);
        if (!JS_IsException(val))
        {
            js_module_set_import_meta(ctx, val, TRUE, TRUE);
            val = JS_EvalFunction(ctx, val);
        }
    }
    else
    {
        val = JS_Eval(ctx, buf, buf_len, filename, eval_flags);
    }

    if (JS_IsException(val))
    {
        js_std_dump_error(ctx);
        ret = -1;
    }
    else
    {
        ret = 0;
    }

    JS_FreeValue(ctx, val);
    return ret;
}

static inline int como_eval_file(JSContext *ctx, const char *filename, int module)
{
    uint8_t *buf;
    int ret, eval_flags;
    size_t buf_len;

    buf = js_load_file(ctx, &buf_len, filename);

    if (!buf)
    {
        perror(filename);
        exit(1);
    }

    if (module < 0)
    {
        module = (has_suffix(filename, ".mjs") || JS_DetectModule((const char *)buf, buf_len));
    }

    if (module)
    {
        eval_flags = JS_EVAL_TYPE_MODULE;
    }
    else
    {
        eval_flags = JS_EVAL_TYPE_GLOBAL;
    }

    ret = como_eval_buf(ctx, buf, filename, eval_flags);
    js_free(ctx, buf);
    return ret;
}

static JSContext *como_js_context(JSRuntime *rt)
{
    JSContext *ctx;
    ctx = JS_NewContext(rt);
    // JS_AddIntrinsicBaseObjects(ctx);
    // js_std_init_handlers(rt);
    JS_SetModuleLoaderFunc(rt, moduleNormalizeName, moduleLoader, NULL);
    JS_SetHostPromiseRejectionTracker(rt, promiseRejectionTracker, NULL);

    // js_std_add_helpers(ctx, 0, NULL);
    // js_init_module_std(ctx, "std");
    // js_init_module_os(ctx, "os");

    // const char *str = "import * as std from 'std';\n"
    //                   "import * as os from 'os';\n"
    //                   "globalThis.std = std;\n"
    //                   "globalThis.os = os;\n"
    //                   "globalThis.setTimeout = os.setTimeout;\n"
    //                   "globalThis.clearTimeout = os.clearTimeout;\n";
    // como_eval_buf(ctx, str, "<global>", JS_EVAL_TYPE_MODULE);
    // como_eval_file(ctx, "./js/bundles/babel.js", 0);
    return ctx;
}

static void como_js_loop(JSContext *ctx)
{
    JSContext *ctx1;
    int err;
    for (;;)
    {
        err = JS_ExecutePendingJob(JS_GetRuntime(ctx), &ctx1);
        if (err <= 0)
        {
            if (err < 0)
            {
                printf("got an error report from c");
                js_std_dump_error(ctx1);
            }
            break;
        }
    }
}

static int como_js_loop_once(JSContext *ctx)
{
    JSContext *ctx1;
    int err;
    err = JS_ExecutePendingJob(JS_GetRuntime(ctx), &ctx1);
    if (err < 0) {
        js_std_dump_error(ctx1);
    }

    return err;
}
