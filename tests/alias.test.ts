import path from 'node:path';
import { describe, assert } from './runner';
process.registerAlias("@alias", path.resolve(import.meta.dirname,'fixtures', 'alias'));

describe("alias import", async ({ test }) => {
    test("alias import", async () => {
        // @ts-expect-error
        const im = await import("@alias/m")
        assert.equal(im.default, 9);
        assert.equal(im.VAR, 8)
    })
});
