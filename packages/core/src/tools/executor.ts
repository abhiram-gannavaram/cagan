import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { BUILTIN_TOOLS, validateToolInput, type ToolResult, type ToolContext } from './definitions.js';
import type { ToolCall } from '../providers/types.js';
import { CodeIndexer } from '../indexer/index.js';

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

  private shouldIgnore(path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
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
      if (this.shouldIgnore(absolutePath)) {
        return { success: false, error: `File ignored by .caganignore: ${absolutePath}` };
      }
      if (!existsSync(absolutePath)) {
        return { success: false, error: `File not found: ${absolutePath}` };
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
      if (this.shouldIgnore(absolutePath)) {
        return { success: false, error: `File ignored by .caganignore: ${absolutePath}` };
      }
      
      if (input.createBackup && existsSync(absolutePath)) {
        const backupPath = `${absolutePath}.backup`;
        writeFileSync(backupPath, readFileSync(absolutePath), 'utf-8');
      }

      const dir = join(absolutePath, '..');
      if (!existsSync(dir)) {
        const { mkdirSync } = require('fs');
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
      const searchPath = input.cwd || this.context.cwd;
      const escapedPattern = input.pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      const cmd = `find "${searchPath}" -type f -name "*.ts" 2>/dev/null | head -100`;
      const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
      const files = output.split('\n').filter(line => {
        if (!line.trim()) return false;
        if (this.shouldIgnore(line)) return false;
        const filename = line.split('/').pop() || '';
        return new RegExp(escapedPattern.replace(/\.ts$/, '\\.ts$')).test(filename);
      });
      return { success: true, output: files.join('\n') };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Glob failed' };
    }
  }

  private grep(input: { pattern: string; path?: string; include?: string; caseSensitive?: boolean }): ToolResult {
    try {
      const searchPath = input.path || this.context.cwd;
      if (this.shouldIgnore(searchPath)) {
        return { success: false, error: `Path ignored by .caganignore: ${searchPath}` };
      }
      const flags = input.caseSensitive ? '' : 'i';
      const includeFlag = input.include ? `--include=${input.include}` : '';
      
      const cmd = `grep -rn${flags} "${input.pattern.replace(/"/g, '\\"')}" ${searchPath} ${includeFlag}`.trim();
      const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      
      const lines = output.split('\n').filter(line => !this.shouldIgnore(line.split(':')[0] || ''));
      return { success: true, output: lines.join('\n') };
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 1) {
        return { success: true, output: '' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Grep failed' };
    }
  }

  private terminal(input: { command: string; cwd?: string; timeout?: number }): ToolResult {
    try {
      const cwd = input.cwd || this.context.cwd;
      const output = execSync(input.command, { 
        encoding: 'utf-8', 
        cwd, 
        maxBuffer: 10 * 1024 * 1024,
        timeout: input.timeout
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
      const cwd = input.cwd || this.context.cwd;
      const output = execSync('git status --porcelain', { encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024 });
      return { success: true, output: output || 'No changes' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git status failed' };
    }
  }

  private gitCommit(input: { message: string; cwd?: string; addAll?: boolean }): ToolResult {
    try {
      const cwd = input.cwd || this.context.cwd;
      if (input.addAll) {
        execSync('git add -A', { encoding: 'utf-8', cwd });
      }
      const output = execSync(`git commit -m "${input.message.replace(/"/g, '\\"')}"`, { 
        encoding: 'utf-8', 
        cwd,
        maxBuffer: 1024 * 1024
      });
      return { success: true, output: output || 'Committed successfully' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git commit failed' };
    }
  }

  private gitLog(input: { cwd?: string; maxCount?: number }): ToolResult {
    try {
      const cwd = input.cwd || this.context.cwd;
      const count = input.maxCount || 10;
      const output = execSync(`git log --oneline -n ${count}`, { encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024 });
      return { success: true, output: output || 'No commits' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Git log failed' };
    }
  }

  private gitDiff(input: { cwd?: string; file?: string }): ToolResult {
    try {
      const cwd = input.cwd || this.context.cwd;
      const fileFlag = input.file ? ` -- ${input.file}` : '';
      const output = execSync(`git diff${fileFlag}`, { encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024 });
      return { success: true, output: output || 'No changes' };
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
        const { execSync: syncExec } = require('child_process');
        syncExec(`find "${cwd}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) 2>/dev/null | head -1000`, { encoding: 'utf-8' });
        this.indexer.indexDirectory(cwd);
      }

      const map = this.indexer.getRepoMap(input.maxFiles || 100);
      return { success: true, output: map };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Repo map failed' };
    }
  }
}