import { assert, suite } from './mod'
const Suite = suite('reflects')

const expectedReflect = {
    a: () => {},
    b: 2,
    c: "string",
    e: [
        0,
        "string",
        function(){
            return 'ok'
        },
        {
            arrObject: {
                nested: {
                    nested: () => {
                        return "ok"
                    }
                }
            }
        }
    ],
    one: {
        2: {
            three: {
                nested: () => "ok"
            }
        }
    }
};

Suite('reflect return exact object',  async () => {
    const ret = Como.Reflect(expectedReflect);

    assert.equal(ret, expectedReflect);
    assert.equal(ret.e[2](), 'ok');
    assert.equal(ret.e[3].arrObject.nested.nested(), 'ok');
    assert.equal(ret.one["2"].three.nested(), 'ok');
});

Suite('reflect return same arg',  async () => {
    assert.equal(Como.Reflect(0), 0);

    // todo float
    // assert.equal(Como.Reflect(1.1), 1.1);

    assert.equal(Como.Reflect("ok"), "ok");
    assert.equal(Como.Reflect(null), null);
    assert.equal(Como.Reflect({}), {});
    assert.equal(Como.Reflect({arr: []}), { arr: [] });
    assert.equal(Como.Reflect([]), []);
    assert.equal(Como.Reflect([[]]), [[]]);
    assert.equal(Como.Reflect([[[]]]), [[[]]]);
    assert.equal(Como.Reflect([[[null]]]), [[[null]]]);
});

Suite('reflect some weird cases!!',  async () => {
    class Test {
        id = "ssss"
    }

    assert.equal(Como.Reflect(new Test()).id, "ssss");

    // Fails: detected as objects, should not be intercept by go
    // assert.equal(Como.Reflect(Test), Test);
    // assert.equal(Como.Reflect(Promise), Promise);

    const r = {
        plugins: [
            () => "hello =============="
        ]
    }

    const v = Como.Reflect(r);
    const v2 = Como.Reflect({
        plugins: [
            () => "hello =============="
        ]
    });

    assert.equal(v.plugins[0](), r.plugins[0]())
    assert.equal(v2.plugins[0](), v.plugins[0]())
});

Suite.run();
