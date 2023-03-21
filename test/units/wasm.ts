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

    assert.equal(m.instance.exports.get_age(2000), 23)
    assert.equal(m.instance.exports.get_age(2024), -1)
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

test.run();
