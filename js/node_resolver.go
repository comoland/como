package js

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ModuleType represents the type of module resolution
type ModuleType int

const (
	ModuleTypeCommonJS ModuleType = iota
	ModuleTypeESModule
	ModuleTypeJSON
	ModuleTypeNative
)

// ResolveResult contains information about the resolved module
type ResolveResult struct {
	Path       string
	ModuleType ModuleType
	IsFile     bool
	IsBuiltin  bool
	Package    *PackageJSON
}

// PackageJSON represents a package.json file structure
type PackageJSON struct {
	Name            string                 `json:"name"`
	Version         string                 `json:"version"`
	Main            string                 `json:"main"`
	Module          string                 `json:"module"`
	Exports         interface{}            `json:"exports"`
	Type            string                 `json:"type"`
	Dependencies    map[string]string      `json:"dependencies"`
	DevDependencies map[string]string      `json:"devDependencies"`
	Fields          map[string]interface{} `json:"-"`
}

// Resolver handles Node.js module resolution
type Resolver struct {
	basePath     string
	nodeModules  []string
	extensions   []string
	builtinMods  map[string]bool
	packageCache map[string]*PackageJSON
}

// NewResolver creates a new module resolver
func NewResolver(basePath string) *Resolver {
	builtins := map[string]bool{
		"assert": true, "buffer": true, "child_process": true, "cluster": true,
		"crypto": true, "dgram": true, "dns": true, "domain": true, "events": true,
		"fs": true, "http": true, "https": true, "net": true, "os": true, "path": true,
		"querystring": true, "readline": true, "repl": true, "stream": true,
		"string_decoder": true, "timers": true, "tls": true, "tty": true, "url": true,
		"util": true, "v8": true, "vm": true, "zlib": true, "console": true,
		"process": true, "global": true, "module": true,
	}

	return &Resolver{
		basePath:     basePath,
		nodeModules:  []string{},
		extensions:   []string{".js", ".json", ".node", ".mjs", ".cjs"},
		builtinMods:  builtins,
		packageCache: make(map[string]*PackageJSON),
	}
}

// Resolve resolves a module path according to Node.js resolution algorithm
func (r *Resolver) Resolve(request string, fromPath string) (*ResolveResult, error) {
	// Handle builtin modules
	if r.isBuiltinModule(request) {
		return &ResolveResult{
			Path:      request,
			IsBuiltin: true,
		}, nil
	}

	// Handle relative and absolute paths
	if r.isRelativeOrAbsolute(request) {
		return r.resolveAsFile(request, fromPath)
	}

	// Handle node_modules resolution
	return r.resolveNodeModules(request, fromPath)
}

// isBuiltinModule checks if a module is a Node.js builtin
func (r *Resolver) isBuiltinModule(request string) bool {
	// Remove node: prefix if present
	if strings.HasPrefix(request, "node:") {
		request = request[5:]
	}
	return r.builtinMods[request]
}

// isRelativeOrAbsolute checks if a path is relative or absolute
func (r *Resolver) isRelativeOrAbsolute(request string) bool {
	return strings.HasPrefix(request, "./") ||
		strings.HasPrefix(request, "../") ||
		strings.HasPrefix(request, "/") ||
		(len(request) > 1 && request[1] == ':') // Windows absolute path
}

// resolveAsFile attempts to resolve a request as a file
func (r *Resolver) resolveAsFile(request string, fromPath string) (*ResolveResult, error) {
	var targetPath string

	if filepath.IsAbs(request) {
		targetPath = request
	} else {
		dir := filepath.Dir(fromPath)
		targetPath = filepath.Join(dir, request)
	}

	// Clean the path
	targetPath = filepath.Clean(targetPath)

	// Try exact match first
	if info, err := os.Stat(targetPath); err == nil && !info.IsDir() {
		return &ResolveResult{
			Path:       targetPath,
			IsFile:     true,
			ModuleType: r.getModuleType(targetPath),
		}, nil
	}

	// Try with extensions
	for _, ext := range r.extensions {
		testPath := targetPath + ext
		if info, err := os.Stat(testPath); err == nil && !info.IsDir() {
			return &ResolveResult{
				Path:       testPath,
				IsFile:     true,
				ModuleType: r.getModuleType(testPath),
			}, nil
		}
	}

	// Try as directory
	return r.resolveAsDirectory(targetPath)
}

// resolveAsDirectory attempts to resolve a request as a directory
func (r *Resolver) resolveAsDirectory(dirPath string) (*ResolveResult, error) {
	// Check if directory exists
	if info, err := os.Stat(dirPath); err != nil || !info.IsDir() {
		return nil, fmt.Errorf("directory not found: %s", dirPath)
	}

	// Try package.json
	packagePath := filepath.Join(dirPath, "package.json")
	if pkg, err := r.loadPackageJSON(packagePath); err == nil {
		// Handle exports field (modern Node.js)
		if pkg.Exports != nil {
			if resolved := r.resolvePackageExports(pkg.Exports, ".", dirPath); resolved != "" {
				return &ResolveResult{
					Path:       resolved,
					IsFile:     true,
					ModuleType: r.getModuleType(resolved),
					Package:    pkg,
				}, nil
			}
		}

		// Handle module field (ES modules)
		if pkg.Module != "" {
			modulePath := filepath.Join(dirPath, pkg.Module)
			if r.fileExists(modulePath) {
				return &ResolveResult{
					Path:       modulePath,
					IsFile:     true,
					ModuleType: ModuleTypeESModule,
					Package:    pkg,
				}, nil
			}
		}

		// Handle main field
		mainFile := "index.js"
		if pkg.Main != "" {
			mainFile = pkg.Main
		}

		mainPath := filepath.Join(dirPath, mainFile)
		if result, err := r.resolveAsFile(mainPath, dirPath); err == nil {
			result.Package = pkg
			return result, nil
		}
	}

	// Fallback to index files
	indexFiles := []string{"index.js", "index.json", "index.node", "index.mjs", "index.cjs"}
	for _, indexFile := range indexFiles {
		indexPath := filepath.Join(dirPath, indexFile)
		if r.fileExists(indexPath) {
			return &ResolveResult{
				Path:       indexPath,
				IsFile:     true,
				ModuleType: r.getModuleType(indexPath),
			}, nil
		}
	}

	return nil, fmt.Errorf("cannot resolve directory: %s", dirPath)
}

// resolveNodeModules resolves modules from node_modules directories
func (r *Resolver) resolveNodeModules(request string, fromPath string) (*ResolveResult, error) {
	nodeModuleDirs := r.getNodeModulesPaths(fromPath)
	pkgName, subpath := splitPackageSpecifier(request)
	normalizedExportSubpath := normalizeExportsSubpath(subpath)

	for _, nodeModuleDir := range nodeModuleDirs {
		modulePath := filepath.Join(nodeModuleDir, request)

		// Try as file first
		if result, err := r.resolveAsFile(modulePath, fromPath); err == nil {
			return result, nil
		}

		// Try as directory
		if result, err := r.resolveAsDirectory(modulePath); err == nil {
			return result, nil
		}

		if pkgName == "" {
			continue
		}

		packageDir := filepath.Join(nodeModuleDir, pkgName)
		if info, err := os.Stat(packageDir); err != nil || !info.IsDir() {
			continue
		}

		var pkg *PackageJSON
		if pkgJSON, err := r.loadPackageJSON(filepath.Join(packageDir, "package.json")); err == nil {
			pkg = pkgJSON
			if pkg.Exports != nil && normalizedExportSubpath != "" {
				if resolved := r.resolvePackageExports(pkg.Exports, normalizedExportSubpath, packageDir); resolved != "" {
					return &ResolveResult{
						Path:       resolved,
						IsFile:     true,
						ModuleType: r.getModuleType(resolved),
						Package:    pkg,
					}, nil
				}
			}
		}

		if subpath == "" {
			if result, err := r.resolveAsDirectory(packageDir); err == nil {
				result.Package = pkg
				return result, nil
			}
			continue
		}

		fullSubpath := filepath.Join(packageDir, subpath)
		if result, err := r.resolveAsFile(fullSubpath, fullSubpath); err == nil {
			result.Package = pkg
			return result, nil
		}

		if result, err := r.resolveAsDirectory(fullSubpath); err == nil {
			result.Package = pkg
			return result, nil
		}
	}

	return nil, fmt.Errorf("module not found: %s", request)
}

// getNodeModulesPaths returns all possible node_modules paths for a given file
func (r *Resolver) getNodeModulesPaths(fromPath string) []string {
	var paths []string
	dir := filepath.Dir(fromPath)

	// Walk up the directory tree
	for {
		nodeModulesPath := filepath.Join(dir, "node_modules")
		paths = append(paths, nodeModulesPath)

		parentDir := filepath.Dir(dir)
		if parentDir == dir {
			break // reached root
		}
		dir = parentDir
	}

	return paths
}

func splitPackageSpecifier(request string) (string, string) {
	if request == "" {
		return "", ""
	}

	if strings.HasPrefix(request, "@") {
		parts := strings.SplitN(request, "/", 3)
		if len(parts) < 2 {
			return request, ""
		}

		packageName := fmt.Sprintf("%s/%s", parts[0], parts[1])
		if len(parts) == 2 {
			return packageName, ""
		}
		return packageName, parts[2]
	}

	parts := strings.SplitN(request, "/", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}

	return request, ""
}

func normalizeExportsSubpath(subpath string) string {
	if subpath == "" || subpath == "." {
		return "."
	}

	if strings.HasPrefix(subpath, "./") {
		return subpath
	}

	return "./" + strings.TrimPrefix(subpath, "/")
}

// loadPackageJSON loads and parses a package.json file
func (r *Resolver) loadPackageJSON(path string) (*PackageJSON, error) {
	// Check cache first
	if pkg, exists := r.packageCache[path]; exists {
		return pkg, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var pkg PackageJSON
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("invalid package.json at %s: %v", path, err)
	}

	// Cache the result
	r.packageCache[path] = &pkg
	return &pkg, nil
}

// resolvePackageExports handles the modern "exports" field in package.json
func (r *Resolver) resolvePackageExports(exports interface{}, subpath string, packagePath string) string {
	switch exp := exports.(type) {
	case string:
		// Simple string export
		return r.normalizeAndValidateExportPath(packagePath, exp)
	case map[string]interface{}:
		if hasSubpathKeys(exp) {
			if subpath == "." {
				if rootExp, exists := exp["."]; exists {
					if resolved := r.resolvePackageExports(rootExp, subpath, packagePath); resolved != "" {
						return resolved
					}
				}
			}

			if target, exists := exp[subpath]; exists {
				return r.resolvePackageExports(target, subpath, packagePath)
			}
			return ""
		}

		preferredConditions := []string{"default", "import", "require", "module", "node"}
		for _, condition := range preferredConditions {
			if target, exists := exp[condition]; exists {
				if resolved := r.resolvePackageExports(target, subpath, packagePath); resolved != "" {
					return resolved
				}
			}
		}

		for _, target := range exp {
			if resolved := r.resolvePackageExports(target, subpath, packagePath); resolved != "" {
				return resolved
			}
		}
	case []interface{}:
		for _, item := range exp {
			if resolved := r.resolvePackageExports(item, subpath, packagePath); resolved != "" {
				return resolved
			}
		}
	}
	return ""
}

func (r *Resolver) normalizeAndValidateExportPath(packagePath, target string) string {
	if target == "" {
		return ""
	}

	cleanTarget := filepath.Clean(target)
	resolved := filepath.Join(packagePath, cleanTarget)
	if info, err := os.Stat(resolved); err == nil && !info.IsDir() {
		return resolved
	}

	return ""
}

func hasSubpathKeys(obj map[string]interface{}) bool {
	for key := range obj {
		if key == "." || strings.HasPrefix(key, "./") {
			return true
		}
	}
	return false
}

// getModuleType determines the module type based on file extension and context
func (r *Resolver) getModuleType(filePath string) ModuleType {
	ext := filepath.Ext(filePath)
	switch ext {
	case ".mjs":
		return ModuleTypeESModule
	case ".cjs":
		return ModuleTypeCommonJS
	case ".json":
		return ModuleTypeJSON
	case ".node":
		return ModuleTypeNative
	case ".js":
		// For .js files, we'd need to check the package.json type field
		// This is a simplified version
		return ModuleTypeCommonJS
	default:
		return ModuleTypeCommonJS
	}
}

// fileExists checks if a file exists and is not a directory
func (r *Resolver) fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// Additional utility methods

// SetExtensions allows customizing the file extensions to try
func (r *Resolver) SetExtensions(extensions []string) {
	r.extensions = extensions
}

// AddBuiltinModule adds a custom builtin module
func (r *Resolver) AddBuiltinModule(name string) {
	r.builtinMods[name] = true
}

// ClearCache clears the package.json cache
func (r *Resolver) ClearCache() {
	r.packageCache = make(map[string]*PackageJSON)
}

// ResolveAll resolves multiple modules at once
func (r *Resolver) ResolveAll(requests []string, fromPath string) (map[string]*ResolveResult, map[string]error) {
	results := make(map[string]*ResolveResult)
	errors := make(map[string]error)

	for _, request := range requests {
		if result, err := r.Resolve(request, fromPath); err != nil {
			errors[request] = err
		} else {
			results[request] = result
		}
	}

	return results, errors
}

// Example usage and testing functions

// PrintResolveResult prints a formatted resolve result
func PrintResolveResult(result *ResolveResult) {
	fmt.Printf("Path: %s\n", result.Path)
	fmt.Printf("Module Type: %v\n", result.ModuleType)
	fmt.Printf("Is File: %t\n", result.IsFile)
	fmt.Printf("Is Builtin: %t\n", result.IsBuiltin)
	if result.Package != nil {
		fmt.Printf("Package: %s@%s\n", result.Package.Name, result.Package.Version)
	}
	fmt.Println("---")
}
