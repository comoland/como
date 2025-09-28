import path from './path'
import fs from 'fs';

class ModuleLoader {
  constructor() {
    this.cache = new Map();
    this.extensions = {
      '.js': this._loadJS.bind(this),
      '.json': this._loadJSON.bind(this),
      '.node': this._loadNode.bind(this)
    };
    this.globalPaths = this._getGlobalPaths();
  }

  // Main require function
  createRequire(filename) {
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

  // Resolve directory (look for package.json main or index files)
  _resolveDirectory(dirpath) {
    if (!this._isDirectory(dirpath)) {
      return null;
    }

    // Try package.json main field
    const pkgPath = path.join(dirpath, 'package.json');
    if (this._fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
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

    for (const modulePath of paths) {
      const candidatePath = path.join(modulePath, id);
      const resolved = this._resolveFile(candidatePath) || this._resolveDirectory(candidatePath);
      if (resolved) {
        return resolved;
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

  // Native addon loader (stub)
  _loadNode(filepath, module) {
    throw new Error(`Native addons not supported in this implementation: ${filepath}`);
  }

  // Utility functions
  _fileExists(filepath) {
    try {
      return fs.statSync(filepath).isFile();
    } catch (e) {
      return false;
    }
  }

  _isDirectory(dirpath) {
    try {
      return fs.statSync(dirpath).isDirectory();
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

  // Get cached modules
  getCachedModules() {
    return Array.from(this.cache.keys());
  }
}

// Create global instance
const moduleLoader = new ModuleLoader();

// Export factory function
function createRequire(filename) {
  return moduleLoader.createRequire(filename);
}

// Export the loader class and instance
module.exports = {
  ModuleLoader,
  createRequire,
  moduleLoader
};

// Usage example:
/*
const { createRequire } = require('./module-loader');
const require = createRequire(__filename);

// Now you can use require normally
const myModule = require('./my-module');
const resolved = require.resolve('./my-module');
console.log('Cached modules:', Object.keys(require.cache));
*/