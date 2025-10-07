import { describe, assert } from '../runner';
import path from 'path';

describe('path module', async ({ test }) => {
    test('path.join should join path segments', () => {
        assert.equal(path.join('a', 'b', 'c'), 'a/b/c', 'should join multiple segments');
        assert.equal(path.join('/a', 'b', 'c'), '/a/b/c', 'should handle absolute paths');
        assert.equal(path.join('a', '..', 'b'), 'b', 'should resolve ..');
        assert.equal(path.join('a', '.', 'b'), 'a/b', 'should resolve .');
        assert.equal(path.join('a', '', 'b'), 'a/b', 'should handle empty segments');
    });

    test('path.resolve should resolve absolute paths', () => {
        const result = path.resolve('a', 'b', 'c');
        assert.ok(result.endsWith('a/b/c'), 'should resolve relative paths');
        assert.ok(result.startsWith('/'), 'should return absolute path');
    });

    test('path.basename should extract filename', () => {
        assert.equal(path.basename('/a/b/c.txt'), 'c.txt', 'should extract filename with extension');
        assert.equal(path.basename('/a/b/c.txt', '.txt'), 'c', 'should remove extension when specified');
        assert.equal(path.basename('/a/b/'), 'b', 'should handle trailing slash');
        assert.equal(path.basename('c.txt'), 'c.txt', 'should handle simple filename');
    });

    test('path.dirname should extract directory', () => {
        assert.equal(path.dirname('/a/b/c.txt'), '/a/b', 'should extract directory path');
        assert.equal(path.dirname('/a/b/'), '/a', 'should handle trailing slash');
        assert.equal(path.dirname('c.txt'), '.', 'should return . for simple filename');
        assert.equal(path.dirname('/'), '/', 'should handle root path');
    });

    test('path.extname should extract extension', () => {
        assert.equal(path.extname('file.txt'), '.txt', 'should extract extension');
        assert.equal(path.extname('file.tar.gz'), '.gz', 'should extract last extension');
        assert.equal(path.extname('file'), '', 'should return empty for no extension');
        assert.equal(path.extname('.hidden'), '', 'should return empty for hidden files');
        assert.equal(path.extname('file.'), '.', 'should handle trailing dot');
    });

    test('path.normalize should normalize paths', () => {
        assert.equal(path.normalize('/a/b/../c'), '/a/c', 'should resolve ..');
        assert.equal(path.normalize('/a/b/./c'), '/a/b/c', 'should resolve .');
        assert.equal(path.normalize('/a//b//c'), '/a/b/c', 'should remove duplicate slashes');
        assert.equal(path.normalize('a/../b'), 'b', 'should normalize relative paths');
    });

    test('path.isAbsolute should detect absolute paths', () => {
        assert.ok(path.isAbsolute('/a/b/c'), 'should detect absolute Unix path');
        assert.ok(!path.isAbsolute('a/b/c'), 'should detect relative path');
        assert.ok(!path.isAbsolute('./a/b'), 'should detect relative path with .');
        assert.ok(!path.isAbsolute('../a/b'), 'should detect relative path with ..');
    });

    test('path.relative should compute relative paths', () => {
        const result = path.relative('/a/b', '/a/c');
        assert.equal(result, '../c', 'should compute relative path');

        const result2 = path.relative('/a/b/c', '/a/b/d');
        assert.equal(result2, '../d', 'should compute relative path to sibling');

        const result3 = path.relative('/a/b', '/a/b/c');
        assert.equal(result3, 'c', 'should compute relative path to child');
    });

    test('path.sep should provide path separator', () => {
        assert.equal(path.sep, '/', 'should provide Unix path separator');
    });

    test('path.delimiter should provide path delimiter', () => {
        assert.equal(path.delimiter, ':', 'should provide Unix path delimiter');
    });

    test('path.join should handle edge cases', () => {
        assert.equal(path.join(), '.', 'should handle no arguments');
        assert.equal(path.join(''), '.', 'should handle empty string');
        assert.equal(path.join('a', '..', '..', 'b'), '../b', 'should handle multiple ..');
        assert.equal(path.join('a', 'b', '..', '..', 'c'), 'c', 'should handle multiple .. going up');
    });

    test('path.resolve should handle edge cases', () => {
        const result1 = path.resolve();
        assert.ok(result1.startsWith('/'), 'should resolve to current directory when no args');

        const result2 = path.resolve('a', '..', 'b');
        assert.ok(result2.endsWith('b'), 'should resolve relative paths');

        const result3 = path.resolve('/a', 'b', '..', 'c');
        assert.equal(result3, '/a/c', 'should resolve absolute with relative components');
    });

    test('path.basename should handle edge cases', () => {
        assert.equal(path.basename(''), '', 'should handle empty string');
        assert.equal(path.basename('/'), '', 'should handle root path');
        assert.equal(path.basename('a/b/c.txt', 'txt'), 'c.', 'should handle extension without dot');
        assert.equal(path.basename('a/b/c.txt', '.txt'), 'c', 'should handle extension with dot');
    });

    test('path.dirname should handle edge cases', () => {
        assert.equal(path.dirname(''), '.', 'should handle empty string');
        assert.equal(path.dirname('a'), '.', 'should handle single segment');
        assert.equal(path.dirname('a/'), '.', 'should handle single segment with slash');
    });

    test('path.extname should handle edge cases', () => {
        assert.equal(path.extname(''), '', 'should handle empty string');
        assert.equal(path.extname('.'), '', 'should handle single dot');
        assert.equal(path.extname('..'), '', 'should handle double dot');
        assert.equal(path.extname('file.'), '.', 'should handle trailing dot');
    });

    test('path.normalize should handle edge cases', () => {
        assert.equal(path.normalize(''), '.', 'should handle empty string');
        assert.equal(path.normalize('.'), '.', 'should handle single dot');
        assert.equal(path.normalize('..'), '..', 'should handle double dot');
        assert.equal(path.normalize('/'), '/', 'should handle root');
    });

    test('path.relative should handle edge cases', () => {
        assert.equal(path.relative('a', 'a'), '', 'should return empty for same paths');
        assert.equal(path.relative('a', 'b'), '../b', 'should handle sibling paths');
        assert.equal(path.relative('a/b', 'a'), '..', 'should handle parent path');
    });

    test('path functions should handle special characters', () => {
        assert.equal(path.join('a b', 'c d'), 'a b/c d', 'should handle spaces');
        assert.equal(path.basename('file with spaces.txt'), 'file with spaces.txt', 'should handle spaces in basename');
        assert.equal(path.extname('file-with-dashes.txt'), '.txt', 'should handle dashes');
        assert.equal(path.extname('file_with_underscores.txt'), '.txt', 'should handle underscores');
    });

    test('path functions should handle unicode', () => {
        assert.equal(path.join('测试', '路径'), '测试/路径', 'should handle unicode characters');
        assert.equal(path.basename('测试文件.txt'), '测试文件.txt', 'should handle unicode in basename');
        assert.equal(path.extname('测试文件.txt'), '.txt', 'should handle unicode with extension');
    });

    test('path.join should handle mixed separators', () => {
        assert.equal(path.join('a\\b', 'c/d'), 'a\\b/c/d', 'should handle mixed separators');
        assert.equal(path.join('a/b', 'c\\d'), 'a/b/c\\d', 'should handle mixed separators');
    });

    test('path.resolve should handle multiple absolute paths', () => {
        const result = path.resolve('/a/b', '/c/d');
        assert.equal(result, '/c/d', 'should use last absolute path');

        const result2 = path.resolve('/a/b', 'c/d', '/e/f');
        assert.equal(result2, '/e/f', 'should use last absolute path');
    });

    test('path functions should be consistent', () => {
        const testPath = '/a/b/c.txt';
        const joined = path.join(path.dirname(testPath), path.basename(testPath));
        assert.equal(joined, '/a/b/c.txt', 'join(dirname, basename) should reconstruct path');

        const resolved = path.resolve('a', 'b', 'c.txt');
        const normalized = path.normalize(resolved);
        assert.equal(resolved, normalized, 'resolved path should be normalized');
    });
});
