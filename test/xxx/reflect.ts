import { suite, assert } from '../mod';

const test = suite("reflect")

test("reflect", () => {
    assert.ok(1)
})

test.run()
