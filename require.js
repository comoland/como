// Node.js require() implementation using Como.resolve() and path module
// Assumes Como.resolve() returns: { path, moduleType, isFile, isBuiltin, package }
// Assumes access to: path (native module), readFileSync, writeFileSync functions
import path from './path'
import { readFileSync } from 'fs';

// Module cache to prevent circular dependencies and improve performance
const moduleCache = Object.create(null);

// Stack to detect circular dependencies
const loadingModules = new Set();

// Built-in modules cache
const builtinModules = Object.create(null);

// Module types enum (should match Go implementation)
const ModuleType = {
  COMMONJS: 0,
  ESMODULE: 1,
  JSON: 2,
  NATIVE: 3
};

/**
 * Main require function implementation
 * @param {string} request - The module to require
 * @param {string} fromPath - The path of the file making the request
 * @returns {any} The required module's exports
 */
function createRequire(fromPath) {
  // Normalize the fromPath
  fromPath = path.resolve(fromPath);

  function require(request) {
    // Resolve the module using the Go resolver
    console.log({ request, fromPath })
    const resolveResult = Como.resolve(request, fromPath);
    console.log({ resolveResult })

    if (!resolveResult) {
      throw new Error(`Cannot find module '${request}' from '${fromPath}'`);
    }

    const { Path: resolvedPath, ModuleType: moduleType, IsFile: isFile, IsBuiltin: isBuiltin } = resolveResult;

    // Handle builtin modules
    if (isBuiltin) {
      return requireBuiltin(resolvedPath);
    }

    // Check cache first
    if (moduleCache[resolvedPath]) {
      return moduleCache[resolvedPath].exports;
    }

    // Detect circular dependencies
    if (loadingModules.has(resolvedPath)) {
      // Return partial exports for circular dependencies
      const module = moduleCache[resolvedPath];
      return module ? module.exports : {};
    }

    // Load the module based on its type
    return loadModule(resolvedPath, moduleType, request, fromPath);
  }

  // Add require extensions and cache properties
  require.cache = moduleCache;
  require.extensions = extensions;
  require.resolve = function(request, options = {}) {
    const basePath = options.paths ? options.paths[0] : fromPath;
    const result = Como.resolve(request, basePath);
    if (!result) {
      throw new Error(`Cannot resolve module '${request}'`);
    }
    return result.path;
  };
  require.main = null; // Will be set by the main module

  return require;
}

/**
 * Load a module based on its resolved path and type
 * @param {string} resolvedPath - The resolved file path
 * @param {number} moduleType - The module type
 * @param {string} originalRequest - The original request string
 * @param {string} fromPath - The requesting file path
 * @returns {any} The module's exports
 */
function loadModule(resolvedPath, moduleType, originalRequest, fromPath) {
  // Mark as loading to detect circular dependencies
  loadingModules.add(resolvedPath);

  try {
    // Create module object
    const module = createModuleObject(resolvedPath, originalRequest, fromPath);

    // Add to cache before loading (for circular dependencies)
    moduleCache[resolvedPath] = module;

    // Load based on module type
    switch (moduleType) {
      case ModuleType.COMMONJS:
        loadCommonJSModule(module);
        break;
      case ModuleType.ESMODULE:
        loadESModule(module);
        break;
      case ModuleType.JSON:
        loadJSONModule(module);
        break;
      case ModuleType.NATIVE:
        loadNativeModule(module);
        break;
      default:
        throw new Error(`Unknown module type: ${moduleType} for ${resolvedPath}`);
    }

    return module.exports;
  } finally {
    loadingModules.delete(resolvedPath);
  }
}

/**
 * Create a module object with all necessary properties
 * @param {string} filename - The module filename
 * @param {string} id - The module id (original request)
 * @param {string} parent - The parent module filename
 * @returns {object} Module object
 */
function createModuleObject(filename, id, parent) {
  const module = {
    id: filename,
    filename: filename,
    loaded: false,
    parent: parent,
    children: [],
    exports: {},
    paths: getModulePaths(path.dirname(filename)),
    require: createRequire(filename)
  };

  // Set up parent-child relationship
  if (parent && moduleCache[parent]) {
    const parentModule = moduleCache[parent];
    if (!parentModule.children.includes(filename)) {
      parentModule.children.push(filename);
    }
  }

  return module;
}

/**
 * Get module search paths for a directory
 * @param {string} from - Starting directory
 * @returns {string[]} Array of node_modules paths
 */
function getModulePaths(from) {
  const paths = [];
  let currentDir = path.resolve(from);

  while (true) {
    if (path.basename(currentDir) !== 'node_modules') {
      paths.push(path.join(currentDir, 'node_modules'));
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return paths;
}

/**
 * Load a CommonJS module
 * @param {object} module - The module object
 */
function loadCommonJSModule(module) {
  const content = readFileSync(module.filename, 'utf8');
  const dirname = path.dirname(module.filename);

  // Create the wrapper function
  const wrapper = `(function(exports, require, module, __filename, __dirname) {\n${content}\n});`;

  try {
    // Evaluate the wrapper function
    const compiledWrapper = eval(wrapper);

    // Execute with proper context
    compiledWrapper.call(
      module.exports,
      module.exports,
      module.require,
      module,
      module.filename,
      dirname
    );

    module.loaded = true;
  } catch (error) {
    // Remove from cache on error
    delete moduleCache[module.filename];
    throw new Error(`Error loading module ${module.filename}: ${error.message}`);
  }
}

/**
 * Load an ES Module (simplified - converts to CommonJS-like)
 * @param {object} module - The module object
 */
function loadESModule(module) {

    let ret = null;
      let error = null;



      process.suspense(async unsuspense => {
          try {
            //   ret = await import(module.filename);
            await Como.build.bundle('', {
                bundle: false,
                entryPoints: [module.filename],
                format: 2
              }).then((re) => {
                // console.log(re[0].content)
                ret = re[0].content
              })
          } catch (e) {
              error = e;
          } finally {
              unsuspense();
          }
      });

      if (error) {
          throw error;
      }

    //   return ret;
let content = ret;
//   content = readFileSync('./compiled.js', 'utf8');
  const dirname = path.dirname(module.filename);

//   Como.build.bundle('', {
//     bundle: false,
//     entryPoints: [module.filename],
//     format: 2
//   }).then((re) => {
//     console.log(re[0].content)
//   })

  // Simple ES module to CommonJS conversion
  // This is a basic implementation - real ES modules need more sophisticated handling
// content = content.replace(/export default/g, 'module.exports = ')
//   let convertedContent = content
//     // Convert export default
//     .replace(/export\s+default/g, 'module.exports = ')
//     // Convert named exports (basic)
//     .replace(/export\s+\{([^}]+)\}/g, (match, exports) => {
//       const exportList = exports.split(',').map(e => e.trim());
//       return exportList.map(exp => `module.exports.${exp} = ${exp};`).join('\n');
//     })
//     // Convert export const/let/var
//     .replace(/export\s+(const|let|var)\s+(\w+)/g, '$1 $2')
//     // Convert import statements (basic)
//     .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")')
//     .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, 'const {$1} = require("$2")');

  const wrapper = `(function(exports, require, module, __filename, __dirname) {\n${content}\n});`;

//   console.log(content)

  try {
    const compiledWrapper = eval(wrapper);
    compiledWrapper.call(
      module.exports,
      module.exports,
      module.require,
      module,
      module.filename,
      dirname
    );

    module.loaded = true;
  } catch (error) {
    console.log(wrapper)
    delete moduleCache[module.filename];
    throw new Error(`Error loading ES module ${module.filename}: ${error.message}`);
  }
}

/**
 * Load a JSON module
 * @param {object} module - The module object
 */
function loadJSONModule(module) {
  try {
    const content = readFileSync(module.filename, 'utf8');
    module.exports = JSON.parse(content);
    module.loaded = true;
  } catch (error) {
    delete moduleCache[module.filename];
    throw new Error(`Error parsing JSON module ${module.filename}: ${error.message}`);
  }
}

/**
 * Load a native (.node) module
 * @param {object} module - The module object
 */
function loadNativeModule(module) {
  // Native modules would need special handling in the actual environment
  // This is a placeholder implementation
  throw new Error(`Native modules (.node) are not supported in this environment: ${module.filename}`);
}

/**
 * Handle builtin modules
 * @param {string} moduleName - The builtin module name
 * @returns {any} The builtin module
 */
function requireBuiltin(moduleName) {
  // Remove 'node:' prefix if present
  if (moduleName.startsWith('node:')) {
    moduleName = moduleName.slice(5);
  }

  // Check cache first
  if (builtinModules[moduleName]) {
    return builtinModules[moduleName];
  }

  // For this implementation, we only have 'path' available
  if (moduleName === 'path') {
    builtinModules[moduleName] = path;
    return path;
  }

  // Mock other builtin modules or throw error
  throw new Error(`Builtin module '${moduleName}' is not available in this environment`);
}

/**
 * Extension handlers for different file types
 */
const extensions = {
  '.js': loadCommonJSModule,
  '.json': loadJSONModule,
  '.node': loadNativeModule,
  '.mjs': loadESModule,
  '.cjs': loadCommonJSModule
};

/**
 * Utility function to clear the require cache
 * @param {string} [moduleId] - Specific module to clear, or clear all if not provided
 */
function clearCache(moduleId) {
  if (moduleId) {
    delete moduleCache[moduleId];
    // Also clear from children arrays
    Object.values(moduleCache).forEach(mod => {
      const index = mod.children.indexOf(moduleId);
      if (index !== -1) {
        mod.children.splice(index, 1);
      }
    });
  } else {
    // Clear all cache
    Object.keys(moduleCache).forEach(key => {
      delete moduleCache[key];
    });
    Object.keys(builtinModules).forEach(key => {
      delete builtinModules[key];
    });
  }
}

/**
 * Get module loading statistics
 * @returns {object} Statistics about loaded modules
 */
function getStats() {
  const stats = {
    totalModules: Object.keys(moduleCache).length,
    loadedModules: 0,
    cachedBuiltins: Object.keys(builtinModules).length,
    modulesByType: {
      commonjs: 0,
      esmodule: 0,
      json: 0,
      native: 0
    }
  };

  Object.values(moduleCache).forEach(mod => {
    if (mod.loaded) stats.loadedModules++;

    const ext = path.extname(mod.filename);
    switch (ext) {
      case '.mjs':
        stats.modulesByType.esmodule++;
        break;
      case '.json':
        stats.modulesByType.json++;
        break;
      case '.node':
        stats.modulesByType.native++;
        break;
      default:
        stats.modulesByType.commonjs++;
    }
  });

  return stats;
}

/**
 * Debug function to inspect module cache
 * @param {string} [moduleId] - Specific module to inspect
 * @returns {object} Module information
 */
function inspectModule(moduleId) {
  if (moduleId) {
    const module = moduleCache[moduleId];
    if (!module) return null;

    return {
      id: module.id,
      filename: module.filename,
      loaded: module.loaded,
      parent: module.parent,
      children: module.children.slice(),
      hasExports: Object.keys(module.exports).length > 0
    };
  }

  return Object.keys(moduleCache).map(id => inspectModule(id));
}

/**
 * Mock writeFileSync function
 */
function writeFileSync(filename, data, encoding = 'utf8') {
  // This would use whatever file writing API is available in your environment
  // For example, if you have a global writeFile function:
  // return writeFile(filename, data, encoding);

  throw new Error('writeFileSync not implemented - please provide file writing capability');
}

// Main entry point - create the global require function
function initializeRequire(mainModulePath = process.cwd ? process.cwd() : '/') {
  const mainRequire = createRequire(mainModulePath);

  // Set up main module
  if (typeof global !== 'undefined') {
    global.require = mainRequire;
    global.require.main = {
      filename: mainModulePath,
      children: []
    };
  }

  // Export utilities
  return {
    require: mainRequire,
    createRequire,
    clearCache,
    getStats,
    inspectModule,
    moduleCache,
    ModuleType
  };
}

// Export the implementation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeRequire,
    createRequire,
    clearCache,
    getStats,
    inspectModule,
    ModuleType
  };
} else if (typeof globalThis !== 'undefined') {
  globalThis.NodeRequire = {
    initializeRequire,
    createRequire,
    clearCache,
    getStats,
    inspectModule,
    ModuleType
  };
}

// Example usage:
/*
// Initialize the require system
const { require, clearCache, getStats } = initializeRequire('/path/to/main/file.js');

// Use require like normal Node.js
const myModule = require('./my-module');
const lodash = require('lodash');
const config = require('./config.json');

// Utility functions
console.log(getStats()); // Get loading statistics
clearCache('./my-module'); // Clear specific module from cache
*/

globalThis.require = initializeRequire('/home/mamod/Desktop/projects/ai/como').require