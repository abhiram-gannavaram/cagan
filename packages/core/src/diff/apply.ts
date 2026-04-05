import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { formatDiff, applyPatch, rollbackPatch, type DiffResult } from './compute.js';

export interface ApplyResult {
  success: boolean;
  newContent?: string;
  error?: string;
  backupPath?: string;
}

export class DiffApplier {
  private backupDir: string;

  constructor(backupDir: string = '.cagan/backups') {
    this.backupDir = backupDir;
  }

  applyFile(filePath: string, newContent: string, createBackup: boolean = true): ApplyResult {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      const originalContent = readFileSync(filePath, 'utf-8');
      
      if (originalContent === newContent) {
        return { success: true, newContent };
      }

      let backupPath: string | undefined;
      if (createBackup) {
        backupPath = this.createBackup(filePath, originalContent);
      }

      const diff = this.computeFileDiff(originalContent, newContent);
      const patchedContent = applyPatch(originalContent, newContent);
      
      writeFileSync(filePath, patchedContent, 'utf-8');

      return {
        success: true,
        newContent: patchedContent,
        backupPath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  rollbackFile(filePath: string, backupPath: string): ApplyResult {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: `Backup not found: ${backupPath}` };
      }

      const backupContent = readFileSync(backupPath, 'utf-8');
      writeFileSync(filePath, backupContent, 'utf-8');

      return {
        success: true,
        newContent: backupContent
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  previewDiff(filePath: string, newContent: string): string {
    if (!existsSync(filePath)) {
      return `File not found: ${filePath}`;
    }

    const originalContent = readFileSync(filePath, 'utf-8');
    return formatDiff(originalContent, newContent);
  }

  computeFileDiff(oldContent: string, newContent: string): DiffResult {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const hunks: import('./compute.js').DiffHunk[] = [];
    let oldStart = 1;
    let newStart = 1;
    let hasChanges = false;

    const maxContext = 3;
    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
      const oldLine = oldLines[i];
      const newLine = newLines[j];

      if (oldLine === newLine) {
        i++;
        j++;
        continue;
      }

      hasChanges = true;
      const hunkLines: string[] = [];
      const hunkOldStart = i + 1;
      const hunkNewStart = j + 1;
      let hunkOldCount = 0;
      let hunkNewCount = 0;

      while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
        hunkLines.push(`- ${oldLines[i]}`);
        hunkOldCount++;
        i++;
      }

      while (j < newLines.length && (i >= oldLines.length || newLines[j] !== oldLines[i])) {
        hunkLines.push(`+ ${newLines[j]}`);
        hunkNewCount++;
        j++;
      }

      hunks.push({
        oldStart: hunkOldStart,
        oldLines: hunkOldCount,
        newStart: hunkNewStart,
        newLines: hunkNewCount,
        lines: hunkLines
      });
    }

    return { hunks, hasChanges };
  }

  private createBackup(filePath: string, content: string): string {
    const timestamp = Date.now();
    const filename = join(this.backupDir, `${timestamp}-${filePath.replace(/[/\\]/g, '_')}`);
    
    const dirExists = existsSync(this.backupDir);
    if (!dirExists) {
      const { mkdirSync } = require('fs');
      mkdirSync(this.backupDir, { recursive: true });
    }
    
    writeFileSync(filename, content, 'utf-8');
    return filename;
  }

  listBackups(): string[] {
    if (!existsSync(this.backupDir)) {
      return [];
    }
    const { readdirSync } = require('fs');
    return readdirSync(this.backupDir).filter((f: string) => f.endsWith('.ts') || f.endsWith('.js') || f.includes('-'));
  }

  cleanupOldBackups(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    if (!existsSync(this.backupDir)) {
      return 0;
    }

    const { readdirSync, unlinkSync, statSync } = require('fs');
    const files = readdirSync(this.backupDir);
    let deleted = 0;
    const now = Date.now();

    for (const file of files) {
      const filePath = join(this.backupDir, file);
      try {
        const stat = statSync(filePath);
        if (now - stat.mtimeMs > maxAge) {
          unlinkSync(filePath);
          deleted++;
        }
      } catch {}
    }

    return deleted;
  }
}