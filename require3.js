import path from './path'
import fs from 'fs';

class ModuleLoader {
  constructor() {
    this.cache = new Map();
    this.extensions = {
      '.js': this._loadJS.bind(this),
      '.mjs': this._loadMJS.bind(this),
      '.cjs': this._loadCJS.bind(this),
      '.json': this._loadJSON.bind(this),
    //   '.node': this._loadNode.bind(this)
    };
    this.globalPaths = this._getGlobalPaths();
    this.conditions = new Set(['node', 'import', 'require']);
  }

  // Main require function
  createRequire(filename) {
    console.log(filename)
    const self = this;
    const dirname = path.dirname(filename);

    function require(id) {
      return self._load(id, dirname, filename);
    }

    require.resolve = function(id, options = {}) {
      return self._resolve(id, dirname, options.paths);
    };

    require.cache = self.cache;
    require.extensions = self.extensions;
    require.main = null; // Set externally if needed

    return require;
  }

  // Core loading logic
  _load(id, parentDir, parentFilename) {
    const resolvedPath = this._resolve(id, parentDir);

    console.log({ parentDir, parentFilename, resolvedPath })

    // Check cache first
    if (this.cache.has(resolvedPath)) {
      return this.cache.get(resolvedPath).exports;
    }

    // Create module object
    const module = {
      id: resolvedPath,
      filename: resolvedPath,
      loaded: false,
      parent: null,
      children: [],
      exports: {},
      paths: this._getModulePaths(path.dirname(resolvedPath)),
      require: this.createRequire(resolvedPath)
    };

    // Cache before loading to handle circular dependencies
    this.cache.set(resolvedPath, module);

    try {
      this._loadFile(resolvedPath, module);
      module.loaded = true;
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
    console.log({ filepath }, this._fileExists(filepath))
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

      console.log({  packagePath, subpath })

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
            console.log({ e })
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
    const ext = path.extname(filepath) || '.js';
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

      compiledWrapper.call(
        module.exports,
        module.exports,
        module.require,
        module,
        filepath,
        dirname
      );
    } catch (error) {
      error.message = `${filepath}: ${error.message}`;
      throw error;
    }
  }

  // JSON file loader
  _loadJSON(filepath, module) {
    const content = fs.readFileSync(filepath, 'utf8');
    try {
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

    // Basic ESM to CJS transformation (simplified)
    const transformedContent = this._transformESMtoCJS(content);
    this._compileJS(transformedContent, filepath, module);
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
        return `${type} ${name}`;  // Keep declaration, add export later
      });
  }

  // Utility functions
  _fileExists(filepath) {
    try {
      return fs.statSync(filepath).isDir === false;
    } catch (e) {
      return false;
    }
  }

  _isDirectory(dirpath) {
    try {
      return fs.statSync(dirpath).isDir;
    } catch (e) {
      return false;
    }
  }

  _isCoreModule(id) {
    // Simplified core module detection
    // In a real implementation, this would check against Node's actual core modules
    const coreModules = [
      'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
      'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
      'querystring', 'readline', 'stream', 'string_decoder', 'tls', 'tty',
      'url', 'util', 'v8', 'vm', 'zlib'
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

// Export the loader class and instance
export {
  ModuleLoader,
  createRequire,
  moduleLoader
};


// Usage examples:
/*
const { createRequire, moduleLoader } = require('./module-loader');

// Basic usage
const require = createRequire(__filename);
const myModule = require('./my-module');
const esmModule = require('./my-module.mjs'); // ESM support

// Modern package.json exports
const lodash = require('lodash'); // Uses main field
const lodashGet = require('lodash/get'); // Subpath exports
const reactDom = require('react-dom/server'); // Conditional exports

// Configure conditions for different environments
moduleLoader.setConditions(['node', 'require', 'development']);
moduleLoader.addCondition('custom-condition');

// Package.json examples this supports:

// 1. Simple exports
{
  "exports": "./dist/index.js"
}

// 2. Conditional exports
{
  "exports": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs",
    "node": "./dist/node.js",
    "default": "./dist/index.js"
  }
}

// 3. Subpath exports
{
  "exports": {
    ".": "./dist/index.js",
    "./utils": "./dist/utils.js",
    "./package.json": "./package.json"
  }
}

// 4. Pattern exports
{
  "exports": {
    ".": "./dist/index.js",
    "./lib/*": "./dist/lib/*.js",
    "./features/*": {
      "import": "./dist/features/*.mjs",
      "require": "./dist/features/*.cjs"
    }
  }
}

// 5. Complex conditional with fallbacks
{
  "exports": {
    ".": {
      "node": {
        "import": "./dist/node.mjs",
        "require": "./dist/node.cjs"
      },
      "browser": {
        "import": "./dist/browser.mjs",
        "require": "./dist/browser.cjs"
      },
      "default": "./dist/index.js"
    },
    "./utils": {
      "import": "./dist/utils.mjs",
      "require": "./dist/utils.cjs"
    }
  }
}
*/