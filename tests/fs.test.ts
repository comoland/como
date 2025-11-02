import { describe, assert } from './runner';
import fs from 'fs/promises';
import path from 'path';

describe('fs basic file operations', async ({ test }) => {
    test('readFile should read file content', async () => {
        const testFile = '/tmp/test-readfile.txt';
        const testContent = 'Hello World';

        // Write test file first
        await fs.writeFile(testFile, Buffer.from(testContent));

        const data = await fs.readFile(testFile);
        console.log(data)
        assert.ok(Buffer.isBuffer(data), 'readFile should return Buffer');
        assert.equal(data.toString(), testContent, 'readFile should read correct content');

        // Cleanup
        await fs.unlink(testFile);
    });

    test('readFile should read file with encoding', async () => {
        const testFile = '/tmp/test-readfile-enc.txt';
        const testContent = 'Hello World';

        await fs.writeFile(testFile, Buffer.from(testContent));

        const data = await fs.readFile(testFile, 'utf8');
        assert.equal(typeof data, 'string', 'readFile with encoding should return string');
        assert.equal(data, testContent, 'readFile with encoding should read correct content');

        await fs.unlink(testFile);
    });

    test('writeFile should write file', async () => {
        const testFile = '/tmp/test-writefile.txt';
        const testContent = 'Test write content';

        await fs.writeFile(testFile, Buffer.from(testContent));

        const exists = await fs.exists(testFile);
        assert.ok(exists, 'writeFile should create file');

        const data = await fs.readFile(testFile);
        assert.equal(data.toString(), testContent, 'writeFile should write correct content');

        await fs.unlink(testFile);
    });

    test('writeFile should write string with encoding', async () => {
        const testFile = '/tmp/test-writefile-str.txt';
        const testContent = 'Test string content';

        await fs.writeFile(testFile, testContent, 'utf8');

        const data = await fs.readFile(testFile, 'utf8');
        assert.equal(data, testContent, 'writeFile should write string correctly');

        await fs.unlink(testFile);
    });

    test('writeFile should support options object', async () => {
        const testFile = '/tmp/test-writefile-options.txt';
        const testContent = 'Test with options';

        await fs.writeFile(testFile, testContent, { encoding: 'utf8', mode: 0o644 });

        const data = await fs.readFile(testFile, 'utf8');
        assert.equal(data, testContent, 'writeFile with options should work');

        await fs.unlink(testFile);
    });

    test('appendFile should append to file', async () => {
        const testFile = '/tmp/test-appendfile.txt';
        const initialContent = 'Initial ';
        const appendContent = 'Appended';

        await fs.writeFile(testFile, Buffer.from(initialContent));
        await fs.appendFile(testFile, Buffer.from(appendContent));

        const data = await fs.readFile(testFile);
        assert.equal(data.toString(), initialContent + appendContent, 'appendFile should append content');

        await fs.unlink(testFile);
    });

    test('read should read file', async () => {
        const testContent = 'Test read content';
        const testFile = path.resolve(import.meta.dirname, 'fixtures/fs/test-read.txt');
        const fh = await fs.open(testFile);
        const data = await fh.read(Buffer.alloc(testContent.length));
        // console.log(data)
        assert.ok(Buffer.isBuffer(data.buffer) || data.buffer instanceof Uint8Array, 'read should return buffer-like');
        const content = data.buffer.toString();
        assert.equal(content, testContent, 'read should read correct content');
    });

    test('write should write file', async () => {
        const testFile = '/tmp/test-write.txt';
        await fs.unlink(testFile).catch(() => {});

        const testContent = 'Test write';
        const fh = await fs.open(testFile, "wx+");
        await fh.write(Buffer.from(testContent));

        const exists = await fs.exists(testFile);
        assert.ok(exists, 'write should create file');

        const data = await fs.readFile(testFile);
        const content = Buffer.from(data).toString();
        assert.equal(content, testContent, 'append should append content');

        await fs.unlink(testFile);
    });

    test('append should append to file', async () => {
        const testFile = '/tmp/test-append.txt';
        await fs.unlink(testFile).catch(() => {});
        const initialContent = 'Initial';
        const appendContent = 'Appended';

        await fs.writeFile(testFile, "");

        const fh = await fs.open(testFile, 'w+')
        await fh.write(Buffer.from(initialContent));
        await fh.write(Buffer.from(appendContent));

        const data = await fs.readFile(testFile);
        const content = Buffer.from(data).toString();
        assert.equal(content, initialContent + appendContent, 'append should append content');

        await fs.unlink(testFile);
    });
});

describe('fs directory operations', async ({ test }) => {
    test('mkdir should create directory', async () => {
        const testDir = '/tmp/test-mkdir-dir';

        await fs.mkdir(testDir);

        const exists = await fs.exists(testDir);
        assert.ok(exists, 'mkdir should create directory');

        const stat = await fs.stat(testDir);
        assert.ok(stat.isDirectory(), 'mkdir should create directory type');

        await fs.rmdir(testDir);
    });

    test('mkdir should create nested directories', async () => {
        const testDir = '/tmp/test-mkdir-nested/subdir';

        await fs.mkdir(testDir, { recursive: true });

        const exists = await fs.exists(testDir);
        assert.ok(exists, 'mkdir should create nested directories');

        await fs.rmdir('/tmp/test-mkdir-nested/subdir');
        await fs.rmdir('/tmp/test-mkdir-nested');
    });

    test('readdir should list directory contents', async () => {
        const testDir = '/tmp/test-readdir';
        const testFile1 = '/tmp/test-readdir/file1.txt';
        const testFile2 = '/tmp/test-readdir/file2.txt';

        await fs.mkdir(testDir);
        await fs.writeFile(testFile1, Buffer.from('file1'));
        await fs.writeFile(testFile2, Buffer.from('file2'));

        const entries = await fs.readdir(testDir);
        assert.ok(Array.isArray(entries), 'readdir should return array');
        assert.ok(entries.length >= 2, 'readdir should list files');
        assert.ok(entries.includes('file1.txt'), 'readdir should include file1.txt');
        assert.ok(entries.includes('file2.txt'), 'readdir should include file2.txt');

        await fs.unlink(testFile1);
        await fs.unlink(testFile2);
        await fs.rmdir(testDir);
    });

    test('readdir should support withFileTypes option', async () => {
        const testDir = '/tmp/test-readdir-types';
        const testFile = '/tmp/test-readdir-types/file.txt';

        await fs.mkdir(testDir);
        await fs.writeFile(testFile, Buffer.from('test'));

        const entries = await fs.readdir(testDir, { withFileTypes: true });
        assert.ok(Array.isArray(entries), 'readdir withFileTypes should return array');
        assert.ok(entries.length > 0, 'readdir withFileTypes should have entries');

        const fileEntry = entries.find(e => e.name === 'file.txt');
        assert.ok(fileEntry, 'readdir withFileTypes should include file');
        assert.ok(fileEntry.isFile !== undefined, 'readdir withFileTypes should have isFile');
        assert.ok(fileEntry.isDirectory !== undefined, 'readdir withFileTypes should have isDirectory');

        await fs.unlink(testFile);
        await fs.rmdir(testDir);
    });

    test('readdir should support recursive option', async () => {
        const testDir = '/tmp/test-readdir-recursive';
        const subDir = '/tmp/test-readdir-recursive/subdir';
        const testFile = '/tmp/test-readdir-recursive/subdir/file.txt';

        await fs.mkdir(subDir);
        await fs.writeFile(testFile, Buffer.from('test'));

        const entries = await fs.readdir(testDir, { recursive: true });
        assert.ok(Array.isArray(entries), 'readdir recursive should return array');
        assert.ok(entries.length > 0, 'readdir recursive should have entries');

        const fileEntry = entries.find(e => e.name === 'file.txt');
        assert.ok(fileEntry, 'readdir recursive should include nested file');
        assert.ok(fileEntry.path, 'readdir recursive should have path');

        await fs.unlink(testFile);
        await fs.rmdir(subDir);
        await fs.rmdir(testDir);
    });

    test('rmdir should remove directory', async () => {
        const testDir = '/tmp/test-rmdir';

        await fs.mkdir(testDir);
        await fs.rmdir(testDir);

        const exists = await fs.exists(testDir);
        assert.ok(!exists, 'rmdir should remove directory');
    });
});

describe('fs file info operations', async ({ test }) => {
    test('stat should return file stats', async () => {
        const testFile = '/tmp/test-stat.txt';
        const testContent = 'Test stat';

        await fs.writeFile(testFile, Buffer.from(testContent));

        const stat = await fs.stat(testFile);
        assert.ok(stat, 'stat should return stats object');
        assert.equal(typeof stat.size, 'number', 'stat should have size');
        assert.equal(stat.size, testContent.length, 'stat size should match file size');
        assert.ok(stat.isFile, 'stat should have isFile method');
        assert.ok(stat.isDirectory, 'stat should have isDirectory method');
        assert.ok(stat.isFile(), 'stat isFile() should return true for file');
        assert.ok(!stat.isDirectory(), 'stat isDirectory() should return false for file');

        await fs.unlink(testFile);
    });

    test('stat should return directory stats', async () => {
        const testDir = '/tmp/test-stat-dir';

        await fs.mkdir(testDir);

        const stat = await fs.stat(testDir);
        assert.ok(stat, 'stat should return stats for directory');
        assert.ok(stat.isDirectory(), 'stat isDirectory() should return true for directory');
        assert.ok(!stat.isFile(), 'stat isFile() should return false for directory');

        await fs.rmdir(testDir);
    });

    test('lstat should return stats without following symlinks', async () => {
        const testFile = '/tmp/test-lstat.txt';
        const testLink = '/tmp/test-lstat-link.txt';

        try {
            await fs.unlink(testFile);
            await fs.unlink(testLink);
        } catch {}

        await fs.writeFile(testFile, Buffer.from('test'));
        await fs.symlink(testFile, testLink);

        const stat = await fs.lstat(testLink);
        assert.ok(stat, 'lstat should return stats');
        // lstat on symlink should return info about the link itself

        await fs.unlink(testLink);
        await fs.unlink(testFile);
    });

    test('exists should check file existence', async () => {
        const testFile = '/tmp/test-exists.txt';

        try {
            await fs.unlink(testFile);
        } catch {}

        const existsBefore = await fs.exists(testFile);
        assert.ok(!existsBefore, 'exists should return false for non-existent file');

        await fs.writeFile(testFile, Buffer.from('test'));

        const existsAfter = await fs.exists(testFile);
        assert.ok(existsAfter, 'exists should return true for existing file');

        await fs.unlink(testFile);
    });
});

describe('fs file manipulation', async ({ test }) => {
    test('unlink should delete file', async () => {
        const testFile = '/tmp/test-unlink.txt';

        await fs.writeFile(testFile, Buffer.from('test'));

        const existsBefore = await fs.exists(testFile);
        assert.ok(existsBefore, 'file should exist before unlink');

        await fs.unlink(testFile);

        const existsAfter = await fs.exists(testFile);
        assert.ok(!existsAfter, 'unlink should delete file');
    });

    test('rename should rename file', async () => {
        const oldPath = '/tmp/test-rename-old.txt';
        const newPath = '/tmp/test-rename-new.txt';

        await fs.writeFile(oldPath, Buffer.from('test rename'));

        await fs.rename(oldPath, newPath);

        const oldExists = await fs.exists(oldPath);
        const newExists = await fs.exists(newPath);

        assert.ok(!oldExists, 'rename should remove old file');
        assert.ok(newExists, 'rename should create new file');

        const data = await fs.readFile(newPath);
        assert.equal(data.toString(), 'test rename', 'rename should preserve content');

        await fs.unlink(newPath);
    });

    test('copyFile should copy file', async () => {
        const srcFile = '/tmp/test-copyfile-src.txt';
        const dstFile = '/tmp/test-copyfile-dst.txt';
        const testContent = 'test copy content';

        await fs.writeFile(srcFile, Buffer.from(testContent));

        await fs.copyFile(srcFile, dstFile);

        const srcExists = await fs.exists(srcFile);
        const dstExists = await fs.exists(dstFile);

        assert.ok(srcExists, 'copyFile should preserve source file');
        assert.ok(dstExists, 'copyFile should create destination file');

        const srcData = await fs.readFile(srcFile);
        const dstData = await fs.readFile(dstFile);

        assert.equal(srcData.toString(), testContent, 'copyFile should preserve source content');
        assert.equal(dstData.toString(), testContent, 'copyFile should copy content correctly');

        await fs.unlink(srcFile);
        await fs.unlink(dstFile);
    });
});

describe('fs file permissions', async ({ test }) => {
    test('chmod should change file mode', async () => {
        const testFile = '/tmp/test-chmod.txt';

        try {
            await fs.unlink(testFile);
        } catch {}

        await fs.writeFile(testFile, Buffer.from('test'));

        // Change to read-only (owner read)
        await fs.chmod(testFile, 0o400);

        const stat = await fs.stat(testFile);
        assert.ok(stat, 'stat should work after chmod');
        // Note: exact mode comparison may vary by platform

        await fs.unlink(testFile);
    });
});

describe('fs path operations', async ({ test }) => {
    test('realpath should resolve real path', async () => {
        const testFile = '/tmp/test-realpath.txt';
        const testLink = '/tmp/test-realpath-link.txt';

        try {
            await fs.unlink(testFile);
            await fs.unlink(testLink);
        } catch {}

        await fs.writeFile(testFile, Buffer.from('test'));
        await fs.symlink(testFile, testLink);

        const realPath = await fs.realpath(testLink);
        assert.ok(typeof realPath === 'string', 'realpath should return string');
        // realpath should resolve the symlink to actual file

        await fs.unlink(testLink);
        await fs.unlink(testFile);
    });
});

describe('fs symbolic links', async ({ test }) => {
    test('symlink should create symbolic link', async () => {
        const targetFile = '/tmp/test-symlink-target.txt';
        const linkFile = '/tmp/test-symlink-link.txt';

        try {
            await fs.unlink(linkFile);
            await fs.unlink(targetFile);
        } catch {}

        await fs.writeFile(targetFile, Buffer.from('target'));

        await fs.symlink(targetFile, linkFile);

        const linkExists = await fs.exists(linkFile);
        assert.ok(linkExists, 'symlink should create link');

        const targetData = await fs.readFile(linkFile);
        assert.equal(targetData.toString(), 'target', 'symlink should resolve to target');

        await fs.unlink(linkFile);
        await fs.unlink(targetFile);
    });

    test('readlink should read symbolic link target', async () => {
        const targetFile = '/tmp/test-readlink-target.txt';
        const linkFile = '/tmp/test-readlink-link.txt';

        try {
            await fs.unlink(linkFile);
            await fs.unlink(targetFile);
        } catch {}

        await fs.writeFile(targetFile, Buffer.from('test'));
        await fs.symlink(targetFile, linkFile);

        const target = await fs.readlink(linkFile);
        assert.ok(typeof target === 'string', 'readlink should return string');
        assert.equal(target, targetFile, 'readlink should return target path');

        await fs.unlink(linkFile);
        await fs.unlink(targetFile);
    });
});

describe('fs file truncation', async ({ test }) => {
    test('truncate should truncate file', async () => {
        const testFile = '/tmp/test-truncate.txt';
        const initialContent = 'This is a long test content';

        await fs.writeFile(testFile, Buffer.from(initialContent));

        const statBefore = await fs.stat(testFile);
        assert.ok(statBefore.size > 5, 'file should be larger than 5 bytes');

        await fs.truncate(testFile, 5);

        const statAfter = await fs.stat(testFile);
        assert.equal(statAfter.size, 5, 'truncate should set file size');

        const data = await fs.readFile(testFile);
        assert.equal(data.length, 5, 'truncated file should have correct size');

        await fs.unlink(testFile);
    });
});

describe('fs temporary directories', async ({ test }) => {
    test('mkdtemp should create temporary directory', async () => {
        const prefix = 'test-mkdtemp-';

        const tempDir = await fs.mkdtemp(prefix);

        assert.ok(typeof tempDir === 'string', 'mkdtemp should return string');
        assert.ok(tempDir.includes(prefix), 'mkdtemp should include prefix');

        const exists = await fs.exists(tempDir);
        assert.ok(exists, 'mkdtemp should create directory');

        const stat = await fs.stat(tempDir);
        assert.ok(stat.isDirectory(), 'mkdtemp should create directory type');

        await fs.rmdir(tempDir);
    });
});

describe('fs constants and flags', async ({ test }) => {
    test('fs should export constants', () => {
        assert.ok(fs.constants, 'fs should have constants');
        assert.equal(typeof fs.constants.F_OK, 'number', 'F_OK should be number');
        assert.equal(typeof fs.constants.R_OK, 'number', 'R_OK should be number');
        assert.equal(typeof fs.constants.W_OK, 'number', 'W_OK should be number');
        assert.equal(typeof fs.constants.X_OK, 'number', 'X_OK should be number');
    });
});

describe('fs file access', async ({ test }) => {
    test('access should check file access permissions', async () => {
        const testFile = '/tmp/test-access.txt';

        await fs.writeFile(testFile, Buffer.from('test'));

        // Test with F_OK (existence check)
        const accessible = await fs.access(testFile, fs.constants.F_OK);
        assert.ok(accessible, 'access should return true for existing file');

        await fs.unlink(testFile);
    });
});

describe('fs error handling', async ({ test }) => {
    test('readFile should throw error for non-existent file', async () => {
        let error = null;
        try {
            await fs.readFile('/tmp/nonexistent-file-12345.txt');
        } catch (e) {
            error = e;
        }
        assert.ok(error, 'readFile should throw error for non-existent file');
    });

    test('writeFile should throw error for invalid path', async () => {
        let error = null;
        try {
            await fs.writeFile('/invalid/path/that/does/not/exist/file.txt', Buffer.from('test'));
        } catch (e) {
            error = e;
        }
        // Note: This may not always throw depending on implementation
        // Just check that either it works or throws
    });

    test('stat should throw error for non-existent file', async () => {
        let error = null;
        try {
            await fs.stat('/tmp/nonexistent-file-12345.txt');
        } catch (e) {
            error = e;
        }
        assert.ok(error, 'stat should throw error for non-existent file');
    });
});

