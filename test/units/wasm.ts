import { suite, assert } from '../mod';
import fs from 'fs';

const test = suite('wasm');

test('wasm multi return values', async () => {
    const data = fs.readFileSync(Como.path.join(import.meta.dir, '..', 'fixtures', 'wasm', 'multi.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance as any;

    const v = exports.round_trip_many(1, 5, 42);
    assert.ok(Array.isArray(v), 'return value is an array');
    assert.equal(v[0], 1, '1st arg matches');
    assert.equal(v[1], 5, '2nd arg matches');
    assert.equal(v[2], 42, '3rd arg matches');
});

test('wasm i64', async () => {
    const data = fs.readFileSync(Como.path.join(import.meta.dir, '..', 'fixtures', 'wasm', 'i64.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance as any;

    assert.equal(exports.add(1, 2), 3, 'add works');
    assert.equal(exports.add(1, -2), -1, 'add works with negatives');
    assert.equal(exports.add(1n, 2n), 3, 'add works with BigInt');
    assert.equal(exports.sub(1, 2), -1, 'sub works');
    assert.equal(exports.sub(1, -2), 3, 'sub works with negatives');
    assert.equal(exports.mul(2, 2), 4, 'mul works');
    assert.equal(exports.mul(2, -2), -4, 'mul works with negatives');
    assert.equal(String(exports.mul(BigInt(Number.MAX_SAFE_INTEGER), 100n)), '900719925474099100', 'mul works with BigInt');
    // assert.equal(String(exports.mul(0x0123456789abcdefn, 0xfedcba9876543210n)), '2465395958572223728', 'mul works with BigInt 2');
    assert.equal(exports.div_s(4, 2), 2, 'div_s works');
    assert.equal(exports.div_u(-1, -1), 1, 'div_u works');
    assert.equal(exports.rem_s(5, 2), 1, 'rem_s works');

    assert.throws(() => {
        exports.div_s(1, 0);
    }, /wasm error: integer divide by zero/)
});

test('wasm export functions', async () => {
    const data = fs.readFileSync(Como.path.join(import.meta.dir, '..', 'fixtures', 'wasm', 'age_calculator.wasm'));
    const m = await WebAssembly.instantiate(data, {
        "env": {
            "log_i32": (v: number) => {
                console.log('log ==> ', v, typeof v)
            },
            "current_year": () => {
                return 2023
            }
        }
    })

    const { exports } = m.instance as any;

    assert.equal(exports.get_age(2000), 23)
    assert.equal(exports.get_age(2024), -1)
});

test('wasm export functions throws if imported function is not defined', async () => {
    const data = fs.readFileSync(Como.path.join(import.meta.dir, '..', 'fixtures', 'wasm', 'age_calculator.wasm'));
    assert.throws(() => {
        WebAssembly.instantiate(data, {
            "env": {
                "current_year": () => {
                    return 2023
                }
            }
        })
    }, /"log_i32" is not exported in module "env"/)
});

test('wasm memory greet rust', async () => {
    const data = fs.readFileSync(Como.path.join(import.meta.dir, '..', 'fixtures', 'wasm', 'greet.wasm'));
    let res = '';
    const { instance } =  await WebAssembly.instantiate(data, {
        "env": {
            "log": (offset: number, byteCount: number) => {
                const { exports } = instance as any;
                const v = exports.memory.read(offset, byteCount)
                res = Buffer.from(v).toString()
            }
        }
    })

    const { exports } = instance as any;

    const name = Buffer.from('WAZER RUST')
    const p = exports.allocate(name.length)
    exports.memory.write(p, name)
    exports.greet(p, name.length)

    const p2 = exports.greeting(p, name.length)

    const v = exports.memory.read(BigInt.asUintN(64, BigInt(p2)) >> BigInt(32), p2)

    // free rust memory
    exports.deallocate(BigInt.asUintN(64, BigInt(p2)) >> BigInt(32), p2)

    const res2 = Buffer.from(v).toString();


    assert.equal(res, 'wasm >> Hello, WAZER RUST!')
    assert.equal(res2, 'Hello, WAZER RUST!')
});

test.run();
