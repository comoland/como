import * as fs from 'fs';
import { FileHandle } from 'fs';
export * from 'fs'

// Export open that returns FileHandle
export const open = async (path, flags, mode) => {
    // Set defaults if not provided
    if (flags === undefined || flags === null) {
        flags = 'r'; // default: read-only
    }
    if (mode === undefined || mode === null) {
        mode = 0o666; // default mode
    }

    // Use fs.open which handles string flags and defaults properly
    const fd = await fs.open(path, flags, mode);
    return new FileHandle(fd);
};

export default { ...fs, open }
