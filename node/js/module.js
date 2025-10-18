import path from 'path';
import process from 'process';

// import fs from 'fs';
const fs = Como;

class ModuleLoader {
    constructor() {
        this.cache = new Map();
        this.extensions = {
            '.js': this._loadJS.bind(this),
            '.mjs': this._loadMJS.bind(this),
            '.ts': this._loadMJS.bind(this),
            '.es6.js': this._loadMJS.bind(this),
            '.cjs': this._loadCJS.bind(this),
            '.json': this._loadJSON.bind(this)
            // '.node': this._loadNode.bind(this)
        };
        this.globalPaths = this._getGlobalPaths();
        this.conditions = new Set(['node', 'import', 'require']);
    }

    // Main require function
    createRequire(filename, parentModule = null) {
        const self = this;
        const dirname = path.dirname(filename);

        function require(id) {
            return self._load(id, dirname, filename, parentModule);
        }

        require.resolve = function (id, options = {}) {
            return self._resolve(id, dirname, options.paths);
        };

        require.cache = self.cache;
        require.extensions = self.extensions;
        require.main = null; // Set externally if needed

        return require;
    }

    createMoudle(resolvedPath, parentModule = null) {
        // const resolvedPath = this._resolve(id);

        // Check cache first
        if (this.cache.has(resolvedPath)) {
            return this.cache.get(resolvedPath);
        }

        // Create module object
        const module = {
            id: resolvedPath,
            filename: resolvedPath,
            loaded: false,
            parent: parentModule,
            children: [],
            exports: {},
            paths: this._getModulePaths(path.dirname(resolvedPath)),
            require: null // Will be set after module is created
        };

        // Set the require function with the module as parent
        module.require = this.createRequire(resolvedPath, module);
        return module;
    }

    // Core loading logic
    _load(id, parentDir, parentFilename, parentModule = null) {
        const resolvedPath = this._resolve(id, parentDir);

        // Check cache first
        if (this.cache.has(resolvedPath)) {
            return this.cache.get(resolvedPath).exports;
        }

        // Create module object
        const module = {
            id: resolvedPath,
            filename: resolvedPath,
            loaded: false,
            parent: parentModule,
            children: [],
            exports: {},
            paths: this._getModulePaths(path.dirname(resolvedPath)),
            require: null // Will be set after module is created
        };

        // Set the require function with the module as parent
        module.require = this.createRequire(resolvedPath, module);

        // Cache before loading to handle circular dependencies
        this.cache.set(resolvedPath, module);

        try {
            module.loaded = true;
            if (module.parent) {
                module.parent.children.push(module);
            }

            this._loadFile(resolvedPath, module);
            return module.exports;
        } catch (error) {
            // Remove from cache on error
            this.cache.delete(resolvedPath);
            throw error;
        }
    }

    // Module resolution algorithm
    _resolve(id, parentDir, paths = null) {
        // Core modules (would need to be extended for real core modules)
        if (this._isCoreModule(id)) {
            return id;
        }

        // Absolute path
        if (path.isAbsolute(id)) {
            return this._resolveFile(id) || this._resolveDirectory(id);
        }

        // Relative path
        if (id.startsWith('./') || id.startsWith('../')) {
            const resolved = path.resolve(parentDir, id);
            return this._resolveFile(resolved) || this._resolveDirectory(resolved);
        }

        // Module resolution
        return this._resolveModule(id, parentDir, paths);
    }

    // Resolve file with extensions
    _resolveFile(filepath) {
        // Try exact match first
        if (this._fileExists(filepath)) {
            return filepath;
        }

        // Try with extensions
        for (const ext of Object.keys(this.extensions)) {
            const withExt = filepath + ext;
            if (this._fileExists(withExt)) {
                return withExt;
            }
        }

        return null;
    }

    // Resolve package.json exports field
    _resolveExports(exports, subpath, packageDir, pkg) {
        // Normalize subpath
        if (!subpath.startsWith('./')) {
            subpath = './' + subpath;
        }

        // Handle different export formats
        if (typeof exports === 'string') {
            // Simple string export
            if (subpath === '.') {
                return this._resolveExportPath(exports, packageDir);
            }
            return null;
        }

        if (Array.isArray(exports)) {
            // Array of exports
            for (const exp of exports) {
                const resolved = this._resolveExports(exp, subpath, packageDir, pkg);
                if (resolved) return resolved;
            }
            return null;
        }

        if (typeof exports === 'object' && exports !== null) {
            // Object exports

            // Direct subpath match
            if (exports[subpath]) {
                return this._resolveExportTarget(exports[subpath], packageDir, pkg);
            }

            // Pattern matching for subpaths like "./lib/*": "./src/*.js"
            for (const [pattern, target] of Object.entries(exports)) {
                if (pattern.includes('*')) {
                    const resolved = this._resolvePatternExport(pattern, target, subpath, packageDir, pkg);
                    if (resolved) return resolved;
                }
            }

            // Conditional exports (require, import, node, default, etc.)
            if (this._isConditionalExports(exports)) {
                return this._resolveConditionalExports(exports, subpath, packageDir, pkg);
            }
        }

        return null;
    }

    // Resolve export target (can be string, array, or object)
    _resolveExportTarget(target, packageDir, pkg) {
        if (typeof target === 'string') {
            return this._resolveExportPath(target, packageDir);
        }

        if (Array.isArray(target)) {
            // Try each target in order
            for (const t of target) {
                const resolved = this._resolveExportTarget(t, packageDir, pkg);
                if (resolved) return resolved;
            }
            return null;
        }

        if (typeof target === 'object' && target !== null) {
            // Conditional exports within target
            return this._resolveConditionalExports(target, '.', packageDir, pkg);
        }

        return null;
    }

    // Resolve pattern exports like "./lib/*": "./src/*.js"
    _resolvePatternExport(pattern, target, subpath, packageDir, pkg) {
        const patternBase = pattern.replace('*', '');

        if (subpath.startsWith(patternBase)) {
            const remainder = subpath.slice(patternBase.length);

            if (typeof target === 'string') {
                const targetPath = target.replace('*', remainder);
                return this._resolveExportPath(targetPath, packageDir);
            }

            if (Array.isArray(target)) {
                for (const t of target) {
                    const resolved = this._resolvePatternExport(pattern, t, subpath, packageDir, pkg);
                    if (resolved) return resolved;
                }
            }

            if (typeof target === 'object') {
                return this._resolveConditionalExports(target, subpath, packageDir, pkg);
            }
        }

        return null;
    }

    // Resolve conditional exports based on conditions
    _resolveConditionalExports(exports, subpath, packageDir, pkg) {
        // Priority order for conditions
        const conditionOrder = ['node', 'require', 'import', 'default'];

        for (const condition of conditionOrder) {
            if (exports[condition] && this.conditions.has(condition)) {
                const resolved = this._resolveExportTarget(exports[condition], packageDir, pkg);
                if (resolved) return resolved;
            }
        }

        // Check for 'default' condition last
        if (exports.default) {
            return this._resolveExportTarget(exports.default, packageDir, pkg);
        }

        return null;
    }

    // Check if exports object contains conditional exports
    _isConditionalExports(exports) {
        const conditions = ['import', 'require', 'node', 'default', 'browser', 'development', 'production'];
        return Object.keys(exports).some(key => conditions.includes(key));
    }

    // Resolve export path relative to package directory
    _resolveExportPath(exportPath, packageDir) {
        if (exportPath.startsWith('./')) {
            const fullPath = path.join(packageDir, exportPath.slice(2));
            return this._resolveFile(fullPath) || this._resolveDirectory(fullPath);
        }
        return null;
    }

    // Resolve directory (look for package.json exports, main or index files)
    _resolveDirectory(dirpath, subpath = '.') {
        if (!this._isDirectory(dirpath)) {
            return null;
        }

        // Try package.json exports field first
        const pkgPath = path.join(dirpath, 'package.json');
        if (this._fileExists(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

                // Handle exports field (modern)
                if (pkg.exports) {
                    const resolved = this._resolveExports(pkg.exports, subpath, dirpath, pkg);
                    if (resolved) return resolved;
                }

                // Handle module field for ESM (when import condition is present)
                if (pkg.module && this.conditions.has('import')) {
                    const modulePath = path.resolve(dirpath, pkg.module);
                    const resolved = this._resolveFile(modulePath);
                    if (resolved) return resolved;
                }

                // Handle main field (legacy)
                if (pkg.main) {
                    const mainPath = path.resolve(dirpath, pkg.main);
                    const resolved = this._resolveFile(mainPath) || this._resolveDirectory(mainPath);
                    if (resolved) return resolved;
                }
            } catch (e) {
                // Invalid package.json, continue
            }
        }

        // Try index files
        const indexPath = path.join(dirpath, 'index');
        return this._resolveFile(indexPath);
    }

    // Module resolution in node_modules
    _resolveModule(id, startDir, customPaths = null) {
        const paths = customPaths || this._getModulePaths(startDir);

        // Handle subpath imports (e.g., 'package/subpath')
        const parts = id.split('/');
        let packageName, subpath;

        if (id.startsWith('@')) {
            // Scoped package
            packageName = parts.slice(0, 2).join('/');
            subpath = parts.length > 2 ? parts.slice(2).join('/') : '.';
        } else {
            packageName = parts[0];
            subpath = parts.length > 1 ? parts.slice(1).join('/') : '.';
        }

        for (const modulePath of paths) {
            const packagePath = path.join(modulePath, packageName);
            if (!this._isDirectory(packagePath)) continue;

            // For subpath imports, resolve through package exports
            if (subpath !== '.') {
                const pkgJsonPath = path.join(packagePath, 'package.json');
                if (this._fileExists(pkgJsonPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                        if (pkg.exports) {
                            const resolved = this._resolveExports(pkg.exports, './' + subpath, packagePath, pkg);
                            if (resolved) return resolved;
                        }
                    } catch (e) {
                        // Continue to legacy resolution
                    }
                }

                // Legacy subpath resolution
                const candidatePath = path.join(packagePath, subpath);
                const resolved = this._resolveFile(candidatePath) || this._resolveDirectory(candidatePath);
                if (resolved) return resolved;
            } else {
                // Main package resolution
                const resolved = this._resolveDirectory(packagePath, '.');
                if (resolved) return resolved;
            }
        }

        throw new Error(`Cannot find module '${id}'`);
    }

    // Get module search paths
    _getModulePaths(startDir) {
        const paths = [];
        let currentDir = startDir;

        // Walk up directory tree looking for node_modules
        while (currentDir !== path.dirname(currentDir)) {
            paths.push(path.join(currentDir, 'node_modules'));
            currentDir = path.dirname(currentDir);
        }

        // Add global paths
        paths.push(...this.globalPaths);

        return paths;
    }

    // Get global node_modules paths
    _getGlobalPaths() {
        const paths = [];

        // Add common global paths
        if (process.env.NODE_PATH) {
            paths.push(...process.env.NODE_PATH.split(path.delimiter));
        }

        // Platform-specific global paths
        if (process.platform === 'win32') {
            paths.push(path.join(process.env.APPDATA || '', 'npm', 'node_modules'));
        } else {
            paths.push('/usr/local/lib/node_modules');
            paths.push('/usr/lib/node_modules');
            if (process.env.HOME) {
                paths.push(path.join(process.env.HOME, '.node_modules'));
                paths.push(path.join(process.env.HOME, '.node_libraries'));
            }
        }

        return paths.filter(p => this._isDirectory(p));
    }

    // Load file based on extension
    _loadFile(filepath, module) {
        let ext = path.extname(filepath) || '.js';
        if (filepath && filepath.endsWith('es6.js')) {
            ext = '.es6.js';
        }
        const loader = this.extensions[ext];

        if (!loader) {
            throw new Error(`Unknown file extension: ${ext}`);
        }

        loader(filepath, module);
    }

    // JavaScript file loader
    _loadJS(filepath, module) {
        const content = fs.readFileSync(filepath, 'utf8');
        this._compileJS(content, filepath, module);
    }

    // Compile and execute JavaScript
    _compileJS(content, filepath, module) {
        // Remove shebang if present
        content = content.replace(/^#!.*\n/, '');

        // Wrap in function
        const wrapper = `(function(exports, require, module, __filename, __dirname) {\n${content}\n});`;

        try {
            const compiledWrapper = eval(wrapper);
            const dirname = path.dirname(filepath);

            // Add this module to parent's children if parent exists
            // if (module.parent) {
            //     module.parent.children.push(module);
            // }

            compiledWrapper.call(module.exports, module.exports, module.require, module, filepath, dirname);
        } catch (error) {
            error.message = `${filepath}: ${error.message}`;
            throw error;
        }
    }

    // JSON file loader
    _loadJSON(filepath, module) {
        const content = fs.readFileSync(filepath, 'utf8');
        try {
            // Add this module to parent's children if parent exists
            // if (module.parent) {
            //     module.parent.children.push(module);
            // }

            module.exports = JSON.parse(content);
        } catch (error) {
            error.message = `${filepath}: ${error.message}`;
            throw error;
        }
    }

    // ESM module loader
    _loadMJS(filepath, module) {
        // In a full implementation, this would use dynamic import()
        // For now, we'll read and parse as CommonJS with ESM syntax detection
        const content = fs.readFileSync(filepath, 'utf8');

        let ret = null;
        let error = null;
        process.suspense(unsuspense => {
            import(filepath)
                .then(ret => {
                    module.exports = ret;
                })
                .catch(e => {
                    error = e;
                })
                .finally(() => {
                    unsuspense();
                });
        });

        if (error) {
            throw new Error(error);
        }

        // Add this module to parent's children if parent exists
        // if (module.parent) {
        //     module.parent.children.push(module);
        // }

        // Basic ESM to CJS transformation (simplified)
        //  const transformedContent = this._transformESMtoCJS(content);
        //   this._compileJS(ret, filepath, module);
    }

    // CommonJS module loader (explicit)
    _loadCJS(filepath, module) {
        this._loadJS(filepath, module);
    }

    // Transform ESM to CJS (simplified)
    _transformESMtoCJS(content) {
        // This is a very basic transformation - a real implementation would need a proper parser
        return content
            .replace(/import\s+(.+?)\s+from\s+['"`](.+?)['"`]/g, (match, imports, source) => {
                if (imports.includes('{')) {
                    // Named imports
                    const named = imports.replace(/[{}]/g, '').trim();
                    return `const { ${named} } = require('${source}');`;
                } else if (imports.includes('*')) {
                    // Namespace import
                    const namespace = imports.replace(/\*\s+as\s+/, '').trim();
                    return `const ${namespace} = require('${source}');`;
                } else {
                    // Default import
                    return `const ${imports.trim()} = require('${source}');`;
                }
            })
            .replace(/export\s+default\s+/g, 'module.exports = ')
            .replace(/export\s+\{(.+?)\}/g, (match, exports) => {
                const namedExports = exports.split(',').map(e => e.trim());
                return namedExports.map(exp => `module.exports.${exp} = ${exp};`).join('\n');
            })
            .replace(/export\s+(const|let|var|function|class)\s+(\w+)/g, (match, type, name) => {
                return `${type} ${name}`; // Keep declaration, add export later
            });
    }

    // Utility functions
    _fileExists(filepath) {
        try {
            return Como.statSync(filepath).isDir === false;
        } catch (e) {
            return false;
        }
    }

    _isDirectory(dirpath) {
        try {
            return Como.statSync(dirpath).isDir === true;
        } catch (e) {
            return false;
        }
    }

    _isCoreModule(id) {
        // Simplified core module detection
        // In a real implementation, this would check against Node's actual core modules
        const coreModules = [
            'assert',
            'buffer',
            'child_process',
            'cluster',
            'crypto',
            'dgram',
            'dns',
            'domain',
            'events',
            'fs',
            'http',
            'https',
            'net',
            'os',
            'path',
            'punycode',
            'querystring',
            'readline',
            'stream',
            'string_decoder',
            'tls',
            'tty',
            'url',
            'util',
            'v8',
            'vm',
            'zlib'
        ];
        return coreModules.includes(id);
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Set import/require conditions
    setConditions(conditions) {
        this.conditions = new Set(conditions);
    }

    // Add condition
    addCondition(condition) {
        this.conditions.add(condition);
    }

    // Remove condition
    removeCondition(condition) {
        this.conditions.delete(condition);
    }

    // Get current conditions
    getConditions() {
        return Array.from(this.conditions);
    }
}

// Create global instance
const moduleLoader = new ModuleLoader();

// Export factory function
function createRequire(filename) {
    return moduleLoader.createRequire(filename);
}

function createModule(filename, parentModel = null) {
    return moduleLoader.createMoudle(filename, parentModel);
}

// Export the loader class and instance
export { ModuleLoader, createRequire, moduleLoader, createModule };
