import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { BUILTIN_TOOLS, validateToolInput } from './definitions.js';
import { CodeIndexer } from '../indexer/index.js';
export class ToolExecutor {
    context;
    customTools = new Map();
    ignorePatterns = [];
    indexer = null;
    constructor(context) {
        this.context = context;
    }
    setIgnorePatterns(patterns) {
        this.ignorePatterns = patterns;
        if (this.indexer) {
            this.indexer.setIgnorePatterns(patterns);
        }
    }
    setIndexer(indexer) {
        this.indexer = indexer;
        this.indexer.setIgnorePatterns(this.ignorePatterns);
    }
    async executeToolCall(toolCall) {
        const validation = validateToolInput(toolCall.function.name, JSON.parse(toolCall.function.arguments));
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        const startTime = Date.now();
        let result;
        if (this.customTools.has(toolCall.function.name)) {
            result = await this.customTools.get(toolCall.function.name)(JSON.parse(toolCall.function.arguments));
        }
        else {
            result = await this.executeBuiltin(toolCall.function.name, JSON.parse(toolCall.function.arguments));
        }
        result.executionTime = Date.now() - startTime;
        return result;
    }
    registerCustomTool(name, handler) {
        this.customTools.set(name, handler);
    }
    getAvailableTools() {
        const customToolDefs = Array.from(this.customTools.keys()).map(name => ({
            type: 'function',
            function: {
                name,
                description: 'Custom tool',
                parameters: { type: 'object', properties: {} }
            }
        }));
        return [...BUILTIN_TOOLS, ...customToolDefs];
    }
    shouldIgnore(path) {
        const normalized = path.replace(/\\/g, '/');
        for (const pattern of this.ignorePatterns) {
            if (normalized.includes(pattern))
                return true;
        }
        return false;
    }
    async executeBuiltin(name, input) {
        switch (name) {
            case 'read_file':
                return this.readFile(input);
            case 'write_file':
                return this.writeFile(input);
            case 'edit_file':
                return this.editFile(input);
            case 'glob':
                return this.glob(input);
            case 'grep':
                return this.grep(input);
            case 'terminal':
                return this.terminal(input);
            case 'read_directory':
                return this.readDirectory(input);
            case 'git_status':
                return this.gitStatus(input);
            case 'git_commit':
                return this.gitCommit(input);
            case 'git_log':
                return this.gitLog(input);
            case 'git_diff':
                return this.gitDiff(input);
            case 'repo_map':
                return this.repoMap(input);
            default:
                return { success: false, error: `Unknown tool: ${name}` };
        }
    }
    readFile(input) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Read failed' };
        }
    }
    writeFile(input) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
        }
    }
    editFile(input) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Edit failed' };
        }
    }
    glob(input) {
        try {
            const searchPath = input.cwd || this.context.cwd;
            const escapedPattern = input.pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            const cmd = `find "${searchPath}" -type f -name "*.ts" 2>/dev/null | head -100`;
            const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
            const files = output.split('\n').filter(line => {
                if (!line.trim())
                    return false;
                if (this.shouldIgnore(line))
                    return false;
                const filename = line.split('/').pop() || '';
                return new RegExp(escapedPattern.replace(/\.ts$/, '\\.ts$')).test(filename);
            });
            return { success: true, output: files.join('\n') };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Glob failed' };
        }
    }
    grep(input) {
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
        }
        catch (error) {
            if (error instanceof Error && 'status' in error && error.status === 1) {
                return { success: true, output: '' };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Grep failed' };
        }
    }
    terminal(input) {
        try {
            const cwd = input.cwd || this.context.cwd;
            const output = execSync(input.command, {
                encoding: 'utf-8',
                cwd,
                maxBuffer: 10 * 1024 * 1024,
                timeout: input.timeout
            });
            return { success: true, output };
        }
        catch (error) {
            if (error instanceof Error) {
                return { success: false, error: error.message };
            }
            return { success: false, error: 'Terminal command failed' };
        }
    }
    readDirectory(input) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Read directory failed' };
        }
    }
    gitStatus(input) {
        try {
            const cwd = input.cwd || this.context.cwd;
            const output = execSync('git status --porcelain', { encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024 });
            return { success: true, output: output || 'No changes' };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Git status failed' };
        }
    }
    gitCommit(input) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Git commit failed' };
        }
    }
    gitLog(input) {
        try {
            const cwd = input.cwd || this.context.cwd;
            const count = input.maxCount || 10;
            const output = execSync(`git log --oneline -n ${count}`, { encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024 });
            return { success: true, output: output || 'No commits' };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Git log failed' };
        }
    }
    gitDiff(input) {
        try {
            const cwd = input.cwd || this.context.cwd;
            const fileFlag = input.file ? ` -- ${input.file}` : '';
            const output = execSync(`git diff${fileFlag}`, { encoding: 'utf-8', cwd, maxBuffer: 1024 * 1024 });
            return { success: true, output: output || 'No changes' };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Git diff failed' };
        }
    }
    repoMap(input) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Repo map failed' };
        }
    }
}
//# sourceMappingURL=executor.js.map