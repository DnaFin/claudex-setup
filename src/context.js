/**
 * Project context scanner - reads project files to evaluate against techniques.
 */

const fs = require('fs');
const path = require('path');

class ProjectContext {
  constructor(dir) {
    this.dir = dir;
    this.files = [];
    this._cache = {};
    this._scan();
  }

  _scan() {
    try {
      const entries = fs.readdirSync(this.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          if (entry.name === '.DS_Store') continue;
          this.files.push(entry.name);
        } else if (entry.isDirectory()) {
          if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
          if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
          this.files.push(entry.name + '/');
          // Scan .claude/ subdirectories
          if (entry.name === '.claude') {
            this._scanSubdir('.claude');
          }
        }
      }
    } catch (err) {
      // Directory might not be readable
    }
  }

  _scanSubdir(subdir) {
    try {
      const fullPath = path.join(this.dir, subdir);
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          this._scanSubdir(path.join(subdir, entry.name));
        }
      }
    } catch (err) {
      // Subdirectory might not exist
    }
  }

  hasDir(dirPath) {
    const fullPath = path.join(this.dir, dirPath);
    try {
      return fs.statSync(fullPath).isDirectory();
    } catch {
      return false;
    }
  }

  dirFiles(dirPath) {
    const fullPath = path.join(this.dir, dirPath);
    try {
      return fs.readdirSync(fullPath).filter(f => !f.startsWith('.'));
    } catch {
      return [];
    }
  }

  claudeMdContent() {
    return this.fileContent('CLAUDE.md') || this.fileContent('.claude/CLAUDE.md');
  }

  fileContent(filePath) {
    if (this._cache[filePath] !== undefined) return this._cache[filePath];
    const fullPath = path.join(this.dir, filePath);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      this._cache[filePath] = content;
      return content;
    } catch {
      this._cache[filePath] = null;
      return null;
    }
  }

  jsonFile(filePath) {
    const content = this.fileContent(filePath);
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  detectStacks(STACKS) {
    const detected = [];
    for (const [key, stack] of Object.entries(STACKS)) {
      const hasFile = stack.files.some(f => {
        return this.files.some(pf => pf.startsWith(f));
      });
      if (!hasFile) continue;

      let contentMatch = true;
      for (const [file, needle] of Object.entries(stack.content)) {
        const content = this.fileContent(file);
        if (!content || !content.includes(needle)) {
          contentMatch = false;
          break;
        }
      }

      if (hasFile && contentMatch) {
        detected.push({ key, label: stack.label });
      }
    }
    return detected;
  }
}

module.exports = { ProjectContext };
