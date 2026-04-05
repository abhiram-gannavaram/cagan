import { type DiffResult } from './compute.js';
export interface ApplyResult {
    success: boolean;
    newContent?: string;
    error?: string;
    backupPath?: string;
}
export declare class DiffApplier {
    private backupDir;
    constructor(backupDir?: string);
    applyFile(filePath: string, newContent: string, createBackup?: boolean): ApplyResult;
    rollbackFile(filePath: string, backupPath: string): ApplyResult;
    previewDiff(filePath: string, newContent: string): string;
    computeFileDiff(oldContent: string, newContent: string): DiffResult;
    private createBackup;
    listBackups(): string[];
    cleanupOldBackups(maxAge?: number): number;
}
//# sourceMappingURL=apply.d.ts.map