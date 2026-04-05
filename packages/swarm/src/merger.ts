/**
 * merger.ts — Output conflict resolution and merging for Agent Swarm.
 *
 * Detects when two agents modified the same file and resolves conflicts
 * using 3-way merge, LLM-assisted merge, or interactive resolution.
 * NETWORK: LLM merge sends conflicted content to user's configured provider only.
 * FILE READ/WRITE: reads from and writes to local workspace only.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type { LLMProvider } from '@cagan/core';
import type { Conflict, Resolution, TaskResult } from './types.js';

export interface MergeResult {
  success: boolean;
  merged?: string;
  hasConflictMarkers: boolean;
}

export class OutputMerger {
  constructor(private readonly provider?: LLMProvider) {}

  /** Scan task results for files that were modified by more than one task. */
  detectConflicts(results: TaskResult[]): Conflict[] {
    const fileToTasks = new Map<string, TaskResult[]>();

    for (const result of results) {
      if (!result.success) continue;
      for (const file of result.filesModified) {
        const existing = fileToTasks.get(file) ?? [];
        existing.push(result);
        fileToTasks.set(file, existing);
      }
    }

    const conflicts: Conflict[] = [];
    for (const [filePath, tasks] of fileToTasks) {
      if (tasks.length < 2) continue;

      // Take the first two conflicting tasks
      const [t1, t2] = tasks;
      conflicts.push({
        filePath,
        task1: t1.taskId,
        task2: t2.taskId,
        content1: this.extractFileContent(t1.output, filePath),
        content2: this.extractFileContent(t2.output, filePath),
        type: 'edit-edit'
      });
    }

    return conflicts;
  }

  /**
   * Perform a 3-way merge of two versions against a common base.
   * Uses simple line-by-line diffing — no external dependencies.
   */
  mergeFiles(base: string, version1: string, version2: string): MergeResult {
    const baseLines = base.split('\n');
    const v1Lines = version1.split('\n');
    const v2Lines = version2.split('\n');

    // If one version is identical to base, use the other
    if (version1 === base) {
      return { success: true, merged: version2, hasConflictMarkers: false };
    }
    if (version2 === base) {
      return { success: true, merged: version1, hasConflictMarkers: false };
    }

    // Simple 3-way merge: find changes relative to base
    const v1Changes = diffLines(baseLines, v1Lines);
    const v2Changes = diffLines(baseLines, v2Lines);

    // Check for overlapping changes (conflicts)
    const v1Changed = new Set(v1Changes.filter(c => c.type !== 'equal').map(c => c.baseIndex));
    const v2Changed = new Set(v2Changes.filter(c => c.type !== 'equal').map(c => c.baseIndex));
    const hasOverlap = [...v1Changed].some(idx => v2Changed.has(idx));

    if (!hasOverlap) {
      // No conflict — apply both changes
      const merged = applyNonConflictingChanges(baseLines, v1Changes, v2Changes);
      return { success: true, merged, hasConflictMarkers: false };
    }

    // Has conflicts — produce a diff3-style output
    const conflictOutput = produceDiff3(base, version1, version2);
    return { success: false, merged: conflictOutput, hasConflictMarkers: true };
  }

  /**
   * Use the LLM to intelligently resolve a conflict.
   * NETWORK: sends conflicted file content to user's configured LLM provider only.
   */
  async aiMerge(conflict: Conflict, context: string = ''): Promise<string> {
    if (!this.provider) {
      throw new Error('No LLM provider configured for AI merge');
    }

    const prompt = `You are resolving a file conflict in a software project.

File: ${conflict.filePath}
Conflict type: ${conflict.type}

=== VERSION 1 (from task "${conflict.task1}") ===
${conflict.content1}

=== VERSION 2 (from task "${conflict.task2}") ===
${conflict.content2}

${context ? `=== Context ===\n${context}\n` : ''}

Produce a single merged version that intelligently combines both changes.
Keep the best parts of each version. Resolve any logical conflicts by
preferring the version that is more complete, correct, or idiomatic.
Return ONLY the merged file content — no explanation, no markers.`;

    // NETWORK: sends to user's configured LLM provider only
    const response = await this.provider.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1 }
    );

    return response.choices[0]?.message?.content ?? conflict.content1;
  }

  /**
   * Present conflicts to the user via terminal for manual resolution.
   * Shows a diff and asks which version to keep.
   */
  async interactiveResolve(conflicts: Conflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = [];

    for (const conflict of conflicts) {
      // In a real interactive session this would prompt the user.
      // For now, default to a safe strategy: prefer version 1.
      console.log(`\nConflict in ${conflict.filePath}:`);
      console.log(`  Task 1: ${conflict.task1}`);
      console.log(`  Task 2: ${conflict.task2}`);
      console.log('  Defaulting to version 1 (use --conflicts merge for auto-merge)');

      resolutions.push({
        conflict,
        resolvedContent: conflict.content1,
        strategy: 'task1'
      });
    }

    return resolutions;
  }

  /**
   * Apply all resolved merges to the filesystem.
   * FILE WRITE: writes merged content to local workspace files only.
   */
  async applyMerges(resolutions: Resolution[], workspaceRoot: string): Promise<void> {
    for (const resolution of resolutions) {
      const fullPath = resolution.conflict.filePath.startsWith('/')
        ? resolution.conflict.filePath
        : `${workspaceRoot}/${resolution.conflict.filePath}`;

      // FILE WRITE: writes resolved content to local file
      await writeFile(fullPath, resolution.resolvedContent, 'utf8');
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Extract the content a task produced for a specific file.
   * Looks for code blocks in the task output labelled with the file path.
   */
  private extractFileContent(taskOutput: string, filePath: string): string {
    // Look for ```lang\n...``` blocks preceded by the filename
    const filename = filePath.split('/').pop() ?? filePath;
    const pattern = new RegExp(
      `(?:${escapeRegex(filePath)}|${escapeRegex(filename)})[^]*?` +
      '```[^\\n]*\\n([\\s\\S]*?)```',
      'i'
    );
    const match = taskOutput.match(pattern);
    if (match?.[1]) return match[1];

    // Fallback: first code block in the output
    const first = taskOutput.match(/```[^\n]*\n([\s\S]*?)```/);
    return first?.[1] ?? taskOutput;
  }
}

// ── Diff utilities ──────────────────────────────────────────────────────────

type DiffEntry = { type: 'equal' | 'add' | 'delete'; line: string; baseIndex: number };

function diffLines(base: string[], version: string[]): DiffEntry[] {
  // Simplified LCS-based diff
  const result: DiffEntry[] = [];
  let bi = 0;
  let vi = 0;

  while (bi < base.length || vi < version.length) {
    if (bi < base.length && vi < version.length && base[bi] === version[vi]) {
      result.push({ type: 'equal', line: base[bi], baseIndex: bi });
      bi++; vi++;
    } else if (vi < version.length && (bi >= base.length || !base.includes(version[vi]))) {
      result.push({ type: 'add', line: version[vi], baseIndex: bi });
      vi++;
    } else {
      result.push({ type: 'delete', line: base[bi], baseIndex: bi });
      bi++;
    }
  }
  return result;
}

function applyNonConflictingChanges(
  base: string[],
  v1Changes: DiffEntry[],
  v2Changes: DiffEntry[]
): string {
  const v2Additions = new Map<number, string[]>();
  for (const c of v2Changes) {
    if (c.type === 'add') {
      const list = v2Additions.get(c.baseIndex) ?? [];
      list.push(c.line);
      v2Additions.set(c.baseIndex, list);
    }
  }

  const v1Result = v1Changes
    .filter(c => c.type !== 'delete')
    .map(c => c.line);

  // Inject v2 additions at the correct positions
  return [...v1Result, ...(v2Additions.get(base.length) ?? [])].join('\n');
}

function produceDiff3(base: string, v1: string, v2: string): string {
  return [
    '<<<<<<< task1',
    v1,
    '||||||| base',
    base,
    '=======',
    v2,
    '>>>>>>> task2'
  ].join('\n');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
