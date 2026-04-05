import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { execSync } from 'child_process';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'type' | 'method';
  filePath: string;
  line: number;
  dependencies: string[];
  signature?: string;
}

export interface IndexedFile {
  path: string;
  hash: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'extends' | 'implements' | 'calls';
}

export class CodeIndexer {
  private index: Map<string, IndexedFile> = new Map();
  private symbols: Map<string, CodeSymbol[]> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private ignorePatterns: string[] = [];
  private extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];

  constructor(ignorePatterns?: string[]) {
    if (ignorePatterns) {
      this.ignorePatterns = ignorePatterns;
    }
  }

  setIgnorePatterns(patterns: string[]): void {
    this.ignorePatterns = patterns;
  }

  async indexDirectory(rootPath: string): Promise<void> {
    this.index.clear();
    this.symbols.clear();
    this.dependencyGraph.clear();

    const files = this.getFiles(rootPath);

    for (const file of files) {
      await this.indexFile(file);
    }
  }

  private getFiles(dir: string, collected: string[] = []): string[] {
    if (!existsSync(dir)) return collected;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = fullPath;

      if (this.shouldIgnore(relativePath)) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        this.getFiles(fullPath, collected);
      } else if (this.isCodeFile(fullPath)) {
        collected.push(fullPath);
      }
    }
    return collected;
  }

  private shouldIgnore(path: string): boolean {
    const normalized = path.replace(/\\/g, '/');

    for (const pattern of this.ignorePatterns) {
      if (normalized.includes(pattern)) return true;
    }

    const parts = normalized.split('/');
    for (const part of parts) {
      if (part === 'node_modules' || part === '.git' || part.startsWith('.')) {
        return true;
      }
    }
    return false;
  }

  private isCodeFile(path: string): boolean {
    return this.extensions.includes(extname(path));
  }

  private async indexFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const hash = this.simpleHash(content);

      const symbols = this.extractSymbols(filePath, content);
      const { imports, exports } = this.extractImportsExports(content);

      const indexed: IndexedFile = {
        path: filePath,
        hash,
        symbols,
        imports,
        exports
      };

      this.index.set(filePath, indexed);

      for (const symbol of symbols) {
        if (!this.symbols.has(symbol.name)) {
          this.symbols.set(symbol.name, []);
        }
        this.symbols.get(symbol.name)!.push(symbol);
      }

      for (const imp of imports) {
        if (!this.dependencyGraph.has(filePath)) {
          this.dependencyGraph.set(filePath, new Set());
        }
        this.dependencyGraph.get(filePath)!.add(imp);
      }
    } catch {}
  }

  private extractSymbols(filePath: string, content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');
    const ext = extname(filePath);

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      this.extractJSSymbols(content, filePath, symbols);
    } else if (ext === '.py') {
      this.extractPySymbols(content, filePath, symbols);
    } else if (ext === '.go') {
      this.extractGoSymbols(content, filePath, symbols);
    }

    return symbols;
  }

  private extractJSSymbols(content: string, filePath: string, symbols: CodeSymbol[]): void {
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)|(\w+)\s*:\s*(?:string|number|boolean|object|array|any)/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      let type: CodeSymbol['type'] = 'function';
      if (match[3]) type = 'class';
      else if (match[4]) type = 'interface';
      else if (match[5]) type = 'type';
      else if (match[2]) type = 'variable';

      symbols.push({
        name,
        type,
        filePath,
        line: lineNumber,
        dependencies: []
      });
    }
  }

  private extractPySymbols(content: string, filePath: string, symbols: CodeSymbol[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const defMatch = line.match(/^(?:def|class)\s+(\w+)/);
      if (defMatch) {
        symbols.push({
          name: defMatch[1],
          type: line.startsWith('class') ? 'class' : 'function',
          filePath,
          line: i + 1,
          dependencies: []
        });
      }
    }
  }

  private extractGoSymbols(content: string, filePath: string, symbols: CodeSymbol[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const funcMatch = line.match(/func\s+(?:\([^)]+\)\s+)?(\w+)/);
      const typeMatch = line.match(/type\s+(\w+)/);
      const constMatch = line.match(/const\s+(\w+)/);

      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          filePath,
          line: i + 1,
          dependencies: []
        });
      } else if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          type: 'type',
          filePath,
          line: i + 1,
          dependencies: []
        });
      }
    }
  }

  private extractImportsExports(content: string): { imports: string[]; exports: string[] } {
    const imports: string[] = [];
    const exports: string[] = [];

    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    const exportRegex = /export\s+(?:default\s+)?(?:const|function|class|interface|type)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push('anonymous');
    }

    return { imports, exports };
  }

  private simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getFile(path: string): IndexedFile | undefined {
    return this.index.get(path);
  }

  getSymbol(name: string): CodeSymbol[] {
    return this.symbols.get(name) || [];
  }

  getDependencies(filePath: string): string[] {
    return Array.from(this.dependencyGraph.get(filePath) || []);
  }

  searchFiles(pattern: string): string[] {
    const results: string[] = [];
    const lowerPattern = pattern.toLowerCase();

    for (const [path] of this.index) {
      if (basename(path).toLowerCase().includes(lowerPattern)) {
        results.push(path);
      }
    }
    return results;
  }

  searchSymbols(pattern: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];
    const lowerPattern = pattern.toLowerCase();

    for (const [, symbols] of this.symbols) {
      for (const symbol of symbols) {
        if (symbol.name.toLowerCase().includes(lowerPattern)) {
          results.push(symbol);
        }
      }
    }
    return results;
  }

  getRepoMap(maxFiles: number = 100): string {
    const files = Array.from(this.index.entries())
      .slice(0, maxFiles);

    let map = '# Repository Structure\n\n';

    for (const [path, indexed] of files) {
      map += `## ${path}\n`;
      map += `Symbols: ${indexed.symbols.map(s => s.name).join(', ') || 'none'}\n`;
      map += `Imports: ${indexed.imports.join(', ') || 'none'}\n\n`;
    }

    return map;
  }

  async searchBySemantic(query: string, topK: number = 5): Promise<CodeSymbol[]> {
    const queryLower = query.toLowerCase();
    const allSymbols: CodeSymbol[] = [];

    for (const [, symbols] of this.symbols) {
      allSymbols.push(...symbols);
    }

    const scored = allSymbols.map(symbol => {
      let score = 0;
      const nameLower = symbol.name.toLowerCase();
      const queryWords = queryLower.split(/\s+/);

      for (const word of queryWords) {
        if (nameLower === word) score += 10;
        else if (nameLower.startsWith(word)) score += 5;
        else if (nameLower.includes(word)) score += 2;
      }

      if (symbol.type === 'function') score *= 1.2;
      if (symbol.type === 'class') score *= 1.1;

      return { symbol, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.symbol);
  }
}