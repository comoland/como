package js

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	s "strings"
)

type Embedder struct {
	ctx        *Context
	Fs         *embed.FS
	modulesLib string
}

func (ctx *Context) Embedder(f embed.FS) *Embedder {
	em := &Embedder{
		ctx:        ctx,
		Fs:         &f,
		modulesLib: "",
	}

	ctx.FSEmbedder = em
	return em
}

func (em *Embedder) ReadFile(filename string) ([]byte, error) {
	if !em.HasEmbeddings() {
		return nil, fmt.Errorf("embed is not enabled")
	}

	rel, _ := os.Getwd()
	newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
	return em.Fs.ReadFile(newFile)
}

func (em *Embedder) SetModulesLib(path string) {
	if !em.HasEmbeddings() {
		return
	}

	dirFS, err := fs.Sub(em.Fs, path)
	if err == nil {
		f, err := dirFS.Open(".")
		if err == nil {
			em.modulesLib = path
			defer f.Close()
		}
	}
}

func (em *Embedder) HasEmbeddings() bool {
	if em.Fs != nil {
		return true
	}

	return false
}

func (em *Embedder) hasModulesLib() bool {
	if em.modulesLib != "" {
		return true
	}

	return false
}

func (em *Embedder) tryToWriteBundleToModulesLib(filename string, code []byte) {
	if em.hasModulesLib() {
		rel, _ := os.Getwd()
		newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
		dir := filepath.Dir(newFile)
		// 2. Create the directory (and any necessary parent directories)
		moduleBasePath := s.Join([]string{"./", em.modulesLib, "/"}, "")
		err := os.MkdirAll(moduleBasePath+dir, 0755)
		if err != nil {
			fmt.Printf("Error creating directory: %s = %v\n", "./public/"+dir, err)
		}

		err = os.WriteFile(s.Join([]string{moduleBasePath, newFile, ".js"}, ""), code, 0644)
		if err != nil {
			fmt.Printf("Error creating file: %s = %v\n", filename, err)
		}
	}
}

func (em *Embedder) IsEmbedded(filename string) (name string, err error) {
	if !em.HasEmbeddings() {
		return "", fmt.Errorf("embed is not enabled")
	}

	rel, _ := os.Getwd()
	filename = s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
	info, err := fs.Stat(em.Fs, filename)

	if err == nil && !info.IsDir() {
		return filename, nil
	}

	if (err != nil || s.HasSuffix(filename, "mod.ts")) && em.hasModulesLib() {
		filename = em.modulesLib + "/" + filename + ".js"
		info, err = fs.Stat(em.Fs, filename)
		if err == nil && !info.IsDir() {
			return filename, nil
		}
	}

	return "", err
}

func (em *Embedder) ReadJsFile(filename string) ([]byte, error) {
	if !em.HasEmbeddings() {
		return nil, fmt.Errorf("embed is not enabled")
	}

	rel, _ := os.Getwd()
	newFile := s.ReplaceAll(filename, rel+string(os.PathSeparator), "")
	c, err := em.Fs.ReadFile(newFile)

	// try to Read from embedded lib\
	if (err != nil || s.Contains(filename, "mod.ts")) && em.hasModulesLib() {
		c, err = em.Fs.ReadFile(em.modulesLib + "/" + newFile + ".js")
	}

	return c, err
}
