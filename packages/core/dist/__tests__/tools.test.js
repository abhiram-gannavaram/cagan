import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutor } from '../tools/executor.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
describe('ToolExecutor', () => {
    let executor;
    let testDir;
    beforeEach(() => {
        testDir = join(tmpdir(), `cagan-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        executor = new ToolExecutor({ cwd: testDir, workspaceRoot: testDir });
    });
    describe('read_file', () => {
        it('should read a file successfully', async () => {
            const testFile = join(testDir, 'test.txt');
            writeFileSync(testFile, 'Hello World', 'utf-8');
            const result = await executor.executeToolCall({
                id: '1',
                type: 'function',
                function: { name: 'read_file', arguments: JSON.stringify({ path: testFile }) }
            });
            expect(result.success).toBe(true);
            expect(result.output).toBe('Hello World');
        });
        it('should fail for non-existent file', async () => {
            const result = await executor.executeToolCall({
                id: '2',
                type: 'function',
                function: { name: 'read_file', arguments: JSON.stringify({ path: join(testDir, 'nonexistent.txt') }) }
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
        it('should respect .byoaignore patterns', async () => {
            const ignoredFile = join(testDir, 'secrets.json');
            writeFileSync(ignoredFile, '{"key": "secret"}', 'utf-8');
            executor.setIgnorePatterns(['secrets.json']);
            const result = await executor.executeToolCall({
                id: '3',
                type: 'function',
                function: { name: 'read_file', arguments: JSON.stringify({ path: ignoredFile }) }
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('ignored');
        });
    });
    describe('write_file', () => {
        it('should write a file successfully', async () => {
            const testFile = join(testDir, 'output.txt');
            const result = await executor.executeToolCall({
                id: '4',
                type: 'function',
                function: { name: 'write_file', arguments: JSON.stringify({ path: testFile, content: 'Test content' }) }
            });
            expect(result.success).toBe(true);
            expect(existsSync(testFile)).toBe(true);
            expect(readFileSync(testFile, 'utf-8')).toBe('Test content');
        });
    });
    describe('edit_file', () => {
        it('should edit file content', async () => {
            const testFile = join(testDir, 'edit-test.txt');
            writeFileSync(testFile, 'Hello World', 'utf-8');
            const result = await executor.executeToolCall({
                id: '5',
                type: 'function',
                function: { name: 'edit_file', arguments: JSON.stringify({
                        path: testFile,
                        oldString: 'World',
                        newString: 'cagan'
                    }) }
            });
            expect(result.success).toBe(true);
            expect(readFileSync(testFile, 'utf-8')).toBe('Hello cagan');
        });
        it('should fail if oldString not found', async () => {
            const testFile = join(testDir, 'edit-test2.txt');
            writeFileSync(testFile, 'Hello World', 'utf-8');
            const result = await executor.executeToolCall({
                id: '6',
                type: 'function',
                function: { name: 'edit_file', arguments: JSON.stringify({
                        path: testFile,
                        oldString: 'NonExistent',
                        newString: 'Test'
                    }) }
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
    describe('git_status', () => {
        it('should return error when not a git repo', async () => {
            const result = await executor.executeToolCall({
                id: '7',
                type: 'function',
                function: { name: 'git_status', arguments: JSON.stringify({ cwd: testDir }) }
            });
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
        });
    });
    describe('terminal', () => {
        it('should execute terminal commands', async () => {
            const result = await executor.executeToolCall({
                id: '8',
                type: 'function',
                function: { name: 'terminal', arguments: JSON.stringify({
                        command: 'echo "Hello from terminal"',
                        cwd: testDir
                    }) }
            });
            expect(result.success).toBe(true);
            expect(result.output).toContain('Hello from terminal');
        });
        it('should handle non-zero exit codes', async () => {
            const result = await executor.executeToolCall({
                id: '9',
                type: 'function',
                function: { name: 'terminal', arguments: JSON.stringify({
                        command: 'exit 1',
                        cwd: testDir
                    }) }
            });
            expect(result.success).toBe(false);
        });
    });
    describe('validation', () => {
        it('should reject invalid tool input', async () => {
            const result = await executor.executeToolCall({
                id: '10',
                type: 'function',
                function: { name: 'read_file', arguments: JSON.stringify({}) }
            });
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
//# sourceMappingURL=tools.test.js.map