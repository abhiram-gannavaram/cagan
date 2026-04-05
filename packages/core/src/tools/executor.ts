import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, chmodSync } from 'fs';
import { join, resolve, relative } from 'path';
import { execSync, spawnSync } from 'child_process';
import { BUILTIN_TOOLS, validateToolInput, type ToolResult, type ToolContext } from './definitions.js';
import type { ToolCall } from '../providers/types.js';
import { CodeIndexer } from '../indexer/index.js';

/** Maximum file size we will read into memory (10 MiB). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Hard timeout (ms) for every terminal command. */
const TERMINAL_TIMEOUT_MS = 60_000;

/**
 * Assert that `filePath` is inside `root`, throwing if it is not.
 * Prevents path-traversal attacks (../../etc/passwd etc.).
 */
function assertWithinRoot(filePath: string, root: string): void {
  const rel = relative(root, filePath);
  if (rel.startsWith('..') || require('path').isAbsolute(rel)) {
    throw new Error(`Access denied: path "${filePath}" is outside workspace root`);
  }
}

/**
 * Validate and resolve an env-var name for API key lookups.
 * Only allows uppercase letters, digits, and underscores — no shell-injection risk.
 */
function safeEnvVarName(name: string): string {
  if (!/^[A-Z_][A-Z0-9_]{0,99}$/.test(name)) {
    throw new Error(`Invalid environment variable name: "${name}"`);
  }
  return name;
}

export class ToolExecutor {
  private context: ToolContext;
  private customTools: Map<string, (input: unknown) => Promise<ToolResult>> = new Map();
  private ignorePatterns: string[] = [];
  private indexer: CodeIndexer | null = null;

  constructor(context: ToolContext) {
    this.context = context;
  }

  setIgnorePatterns(patterns: string[]): void {
    this.ignorePatterns = patterns;
    if (this.indexer) {
      this.indexer.setIgnorePatterns(patterns);
    }
  }

  setIndexer(indexer: CodeIndexer): void {
    this.indexer = indexer;
    this.indexer.setIgnorePatterns(this.ignorePatterns);
  }

  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const validation = validateToolInput(toolCall.function.name, JSON.parse(toolCall.function.arguments));
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const startTime = Date.now();
    let result: ToolResult;

    if (this.customTools.has(toolCall.function.name)) {
      result = await this.customTools.get(toolCall.function.name)!(JSON.parse(toolCall.function.arguments));
    } else {
      result = await this.executeBuiltin(toolCall.function.name, JSON.parse(toolCall.function.arguments));
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  registerCustomTool(name: string, handler: (input: unknown) => Promise<ToolResult>): void {
    this.customTools.set(name, handler);
  }

  getAvailableTools() {
    const customToolDefs = Array.from(this.customTools.keys()).map(name => ({
      type: 'function' as const,
      function: {
        name,
        description: 'Custom tool',
        parameters: { type: 'object', properties: {} }
      }
    }));
    return [...BUILTIN_TOOLS, ...customToolDefs];
  }

  private shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    for (const pattern of this.ignorePatterns) {
      if (normalized.includes(pattern)) return true;
    }
    return false;
  }

  private async executeBuiltin(name: string, input: unknown): Promise<ToolResult> {
    switch (name) {
      case 'read_file':
        return this.readFile(input as { path: string; offset?: number; limit?: number });
      case 'write_file':
        return this.writeFile(input as { path: string; content: string; createBackup?: boolean });
      case 'edit_file':
        return this.editFile(input as { path: string; oldString: string; newString: string });
      case 'glob':
        return this.glob(input as { pattern: string; cwd?: string });
      case 'grep':
        return this.grep(input as { pattern: string; path?: string; include?: string; caseSensitive?: boolean });
      case 'terminal':
        return this.terminal(input as { command: string; cwd?: string; timeout?: number });
      case 'read_directory':
        return this.readDirectory(input as { path: string });
      case 'git_status':
        return this.gitStatus(input as { cwd?: string });
      case 'git_commit':
        return this.gitCommit(input as { message: string; cwd?: string; addAll?: boolean });
      case 'git_log':
        return this.gitLog(input as { cwd?: string; maxCount?: number });
      case 'git_diff':
        return this.gitDiff(input as { cwd?: string; file?: string });
      case 'repo_map':
        return this.repoMap(input as { maxFiles?: number });
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  private readFile(input: { path: string; offset?: number; limit?: number }): ToolResult {
    try {
      const absolutePath = resolve(this.context.cwd, input.path);
      assertWithinRoot(absolutePath, this.context.workspaceRoot || this.context.cwd);
      if (this.shouldIgnore(absolutePath)) {
        return { success: false, error: `File ignored by .caganignore: ${absolutePath}` };
      }
      if (!existsSync(absolutePath)) {
        return { success: false, error: `File not found: ${absolutePath}` };
      }

      // Enforce size limit before reading into memory
      const size = statSync(absolutePath).size;
      if (size > MAX_FILE_BYTES) {
        return { success: false, error: `File too large (${(size / 1024 / 1024).toFixed(1)} MiB). Use offset/limit to read in chunks.` };
      }

      let content = readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');

      if (input.offset !== undefined || input.limit !== undefined) {
        const start = (input.offset || 1) - 1;
        const end = input.limit ? start + input.limit : lines.length;
        content = lines.slice(start, end).join('\n');
      }

      return { success: true, output: content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Read failed' };
    }
  }

  private writeFile(input: { path: string; content: string; createBackup?: boolean }): ToolResult {
    try {
      const absolutePath = resolve(this.context.cwd, input.path);
      assertWithinRoot(absolutePath, this.context.workspaceRoot || this.context.cwd);
      if (this.shouldIgnore(absolutePath)) {
        return { success: false, error: `File ignored by .caganignore: ${absolutePath}` };
      }

      if (input.createBackup && existsSync(absolutePath)) {
        const backupPath = `${absolutePath}.backup`;
        writeFileSync(backupPath, readFileSync(absolutePath), 'utf-8');
      }

      const dir = join(absolutePath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(absolutePath, input.content, 'utf-8');
      return { success: true, output: `Written to ${absolutePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
    }
  }

  private editFile(input: { path: string; oldString: string; newString: string }): ToolResult {
    try {
      const absolutePath = resolve(this.context.cwd, input.path);
      assertWithinRoot(absolutePath, this.context.workspaceRoot || this.context.cwd);
      if (this.shouldIgnore(absolutePath)) {
        return { success: false, error: `File ignored by .caganignore: ${absolutePath}` };
      }
      if (!existsSync(absolutePath)) {
        return { success: false, error: `File not found: ${absolutePath}` };
      }

      const content = readFileSync(absolutePath, 'utf-8');
      if (!content.includes(input.oldString)) {
        return { success: false, error: 'String to replace not found in file' };
      }

      const newContent = content.replace(input.oldString, input.newString);
      writeFileSync(absolutePath, newContent, 'utf-8');
      return { success: true, output: `Edited ${absolutePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Edit failed' };
    }
  }

  private glob(input: { pattern: string; cwd?: string }): ToolResult {
    try {
      const searchPath = resolve(this.context.cwd, input.cwd || '.');
      assertWithinRoot(searchPath, this.context.workspaceRoot || this.context.cwd);

      // Pure Node.js recursive file walk — no shell involvement
      const results: string[] = [];
      const patternRegex = new RegExp(
        '^' + input.pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );

      const walk = (dir: string, depth: number): void => {
        if (depth > 20) return; // guard against deep symlink cycles
        let entries: string[];
        try { entries = readdirSync(dir); } catch { return; }
        for (const entry of entries) {
          const full = join(dir, entry);
          if (this.shouldIgnore(full)) continue;
          try {
            const st = statSync(full);
            if (st.isDirectory()) {
              walk(full, depth + 1);
            } else if (patternRegex.test(entry) || patternRegex.test(full)) {
              if (results.length < 500) results.push(full);
            }
          } catch { /* skip unreadable */ }
        }
      };

      walk(searchPath, 0);
      return { success: true, output: results.join('\n') };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Glob failed' };
    }
  }

  private grep(input: { pattern: string; path?: string; include?: string; caseSensitive?: boolean }): ToolResult {
    try {
      const searchPath = resolve(this.context.cwd, input.path || '.');
      assertWithinRoot(searchPath, this.context.workspaceRoot || this.context.cwd);
      if (this.shouldIgnore(searchPath)) {
        return { success: false, error: `Path ignored by .caganignore: ${searchPath}` };
      }

      // Use spawnSync with array argv — no shell expansion, safe against injection
      const args: string[] = ['-rn'];
      if (!input.caseSensitive) args.push('-i');
      if (input.include) args.push(`--include=${input.include}`);
      args.push('--', input.pattern, searchPath);

      const result = spawnSync('grep', args, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10_000,
        shell: false
      });

      if (result.error) throw result.error;
      if (result.status === 1) return { success: true, output: '' }; // no matches
      if (result.status !== 0) {
        return { success: false, error: result.stderr || 'grep failed' };
      }

      const lines = (result.stdout || '').split('\n')
        .filter(line => !this.shouldIgnore(line.split(':')[0] || ''));
      return { success: true, output: lines.join('\n') };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Grep failed' };
    }
  }

  private terminal(input: { command: string; cwd?: string; timeout?: number }): ToolResult {
    try {
      // Validate and bound the working directory
      const cwd = input.cwd
        ? resolve(this.context.cwd, input.cwd)
        : this.context.cwd;
      assertWithinRoot(cwd, this.context.workspaceRoot || this.context.cwd);

      // Cap timeout at 60 seconds; always enforce a hard ceiling
      const timeout = Math.min(input.timeout ?? TERMINAL_TIMEOUT_MS, TERMINAL_TIMEOUT_MS);

      const output = execSync(input.command, {
        encoding: 'utf-8',
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        timeout
      });
      return { success: true, output };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Terminal command failed' };
    }
  }

  private readDirectory(input: { path: string }): ToolResult {
    try {
      const absolutePath = resolve(this.context.cwd, input.path);
      assertWithinRoot(absolutePath, this.context.workspaceRoot || this.context.cwd);
      if (this.shouldIgnore(absolutePath)) {
        return { success: false, error: `Directory ignored by .caganignore: ${absolutePath}` };
      }
      if (!existsSync(absolutePath)) {
        return { success: false, error: `Directory not found: ${absolutePath}` };
      }

      const entries = readdirSync(absolutePath);
      const result = entries.map(name => {
        const fullPath = join(absolutePath, name);
        const stat = statSync(fullPath);
        return `${stat.isDirectory() ? 'd' : 'f'} ${name}`;
      }).join('\n');

      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Read directory failed' };
    }
  }

  private gitStatus(input: { cwd?: string }): ToolResult {
    try {
      const cwd = input.cwd ? resolve(this.context.cwd, input.cwd) : this.context.cwd;
      assertWithinRoot(cwd, this.context.workspaceRoot || this.context.cwd);
      const result = spawnSync('git', ['status', '--porcelain'], {
        encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024, timeout: 10_000, shell: false
      });
      if (result.error) throw result.error;
      return { success: true, output: result.stdout || 'No changes' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git status failed' };
    }
  }

  private gitCommit(input: { message: string; cwd?: string; addAll?: boolean }): ToolResult {
    try {
      const cwd = input.cwd ? resolve(this.context.cwd, input.cwd) : this.context.cwd;
      assertWithinRoot(cwd, this.context.workspaceRoot || this.context.cwd);

      if (input.addAll) {
        const addResult = spawnSync('git', ['add', '-A'], {
          encoding: 'utf-8', cwd, timeout: 10_000, shell: false
        });
        if (addResult.error) throw addResult.error;
      }

      // Pass message as a separate argv element — no shell escaping needed
      const result = spawnSync('git', ['commit', '-m', input.message], {
        encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024, timeout: 30_000, shell: false
      });
      if (result.error) throw result.error;
      if (result.status !== 0) return { success: false, error: result.stderr || 'Commit failed' };
      return { success: true, output: result.stdout || 'Committed successfully' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git commit failed' };
    }
  }

  private gitLog(input: { cwd?: string; maxCount?: number }): ToolResult {
    try {
      const cwd = input.cwd ? resolve(this.context.cwd, input.cwd) : this.context.cwd;
      assertWithinRoot(cwd, this.context.workspaceRoot || this.context.cwd);
      const count = String(Math.min(input.maxCount ?? 10, 100)); // cap at 100
      const result = spawnSync('git', ['log', '--oneline', `-n`, count], {
        encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024, timeout: 10_000, shell: false
      });
      if (result.error) throw result.error;
      return { success: true, output: result.stdout || 'No commits' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git log failed' };
    }
  }

  private gitDiff(input: { cwd?: string; file?: string }): ToolResult {
    try {
      const cwd = input.cwd ? resolve(this.context.cwd, input.cwd) : this.context.cwd;
      assertWithinRoot(cwd, this.context.workspaceRoot || this.context.cwd);

      const args = ['diff'];
      if (input.file) {
        const filePath = resolve(cwd, input.file);
        assertWithinRoot(filePath, this.context.workspaceRoot || this.context.cwd);
        args.push('--', filePath);
      }

      const result = spawnSync('git', args, {
        encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024, timeout: 10_000, shell: false
      });
      if (result.error) throw result.error;
      return { success: true, output: result.stdout || 'No changes' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git diff failed' };
    }
  }

  private repoMap(input: { maxFiles?: number }): ToolResult {
    try {
      if (!this.indexer) {
        this.indexer = new CodeIndexer(this.ignorePatterns);
        const cwd = this.context.workspaceRoot || this.context.cwd;
        const ignorePath = join(cwd, '.caganignore');
        if (existsSync(ignorePath)) {
          const ignoreContent = readFileSync(ignorePath, 'utf-8');
          const patterns = ignoreContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
          this.indexer.setIgnorePatterns(patterns);
        }
        this.indexer.indexDirectory(cwd);
      }

      const map = this.indexer.getRepoMap(input.maxFiles || 100);
      return { success: true, output: map };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Repo map failed' };
    }
  }
}

export { safeEnvVarName };
