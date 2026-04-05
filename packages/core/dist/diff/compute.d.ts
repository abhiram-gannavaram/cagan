export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
}
export interface DiffResult {
    hunks: DiffHunk[];
    hasChanges: boolean;
}
export declare function computeDiff(oldContent: string, newContent: string): DiffResult;
export declare function formatDiff(oldContent: string, newContent: string): string;
export declare function applyDiff(content: string, diff: DiffResult): string;
export declare function applyPatch(original: string, patch: string): string;
export declare function rollbackPatch(original: string, patch: string): string;
//# sourceMappingURL=compute.d.ts.map