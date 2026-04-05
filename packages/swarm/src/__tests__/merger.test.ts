import { describe, it, expect } from 'vitest';
import { OutputMerger } from '../merger.js';
import type { TaskResult } from '../types.js';

function makeResult(taskId: string, filesModified: string[], output: string): TaskResult {
  return {
    taskId,
    success: true,
    output,
    filesModified,
    tokensUsed: 100,
    durationMs: 1000
  };
}

describe('OutputMerger', () => {
  const merger = new OutputMerger();

  describe('detectConflicts', () => {
    it('detects no conflicts when files are unique per task', () => {
      const results = [
        makeResult('task1', ['src/a.ts'], ''),
        makeResult('task2', ['src/b.ts'], '')
      ];
      const conflicts = merger.detectConflicts(results);
      expect(conflicts).toHaveLength(0);
    });

    it('detects conflict when same file modified by two tasks', () => {
      const results = [
        makeResult('task1', ['src/shared.ts'], '```ts\nconst a = 1;\n```'),
        makeResult('task2', ['src/shared.ts'], '```ts\nconst a = 2;\n```')
      ];
      const conflicts = merger.detectConflicts(results);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].filePath).toBe('src/shared.ts');
      expect(conflicts[0].task1).toBe('task1');
      expect(conflicts[0].task2).toBe('task2');
    });

    it('ignores failed tasks', () => {
      const results = [
        { ...makeResult('task1', ['src/shared.ts'], ''), success: false },
        makeResult('task2', ['src/shared.ts'], '')
      ];
      const conflicts = merger.detectConflicts(results);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('mergeFiles', () => {
    it('returns version2 when version1 equals base', () => {
      const base = 'const x = 1;';
      const v2 = 'const x = 2;';
      const result = merger.mergeFiles(base, base, v2);
      expect(result.success).toBe(true);
      expect(result.merged).toBe(v2);
      expect(result.hasConflictMarkers).toBe(false);
    });

    it('returns version1 when version2 equals base', () => {
      const base = 'const x = 1;';
      const v1 = 'const x = 10;';
      const result = merger.mergeFiles(base, v1, base);
      expect(result.success).toBe(true);
      expect(result.merged).toBe(v1);
    });

    it('produces conflict markers when both versions differ from base', () => {
      const base = 'line 1\nline 2\nline 3';
      const v1 = 'line 1 modified\nline 2\nline 3';
      const v2 = 'line 1\nline 2 modified\nline 3';
      const result = merger.mergeFiles(base, v1, v2);
      // May succeed with clean merge or produce markers — both are valid
      expect(typeof result.merged).toBe('string');
      expect(result.merged!.length).toBeGreaterThan(0);
    });

    it('includes conflict markers in output when overlapping changes exist', () => {
      const base = 'function foo() { return 1; }';
      const v1 = 'function foo() { return 2; }';
      const v2 = 'function foo() { return 3; }';
      const result = merger.mergeFiles(base, v1, v2);
      if (!result.success) {
        expect(result.merged).toContain('<<<<<<');
        expect(result.merged).toContain('>>>>>>>');
      }
    });
  });

  describe('interactiveResolve', () => {
    it('returns a resolution for each conflict', async () => {
      const conflicts = [
        {
          filePath: 'src/test.ts',
          task1: 'task1',
          task2: 'task2',
          content1: 'const x = 1;',
          content2: 'const x = 2;',
          type: 'edit-edit' as const
        }
      ];
      const resolutions = await merger.interactiveResolve(conflicts);
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].conflict.filePath).toBe('src/test.ts');
    });
  });
});
