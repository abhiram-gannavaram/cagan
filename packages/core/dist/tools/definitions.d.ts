import { z } from 'zod';
import type { ToolDefinition } from '../providers/types.js';
export declare const ReadFileSchema: z.ZodObject<{
    path: z.ZodString;
    offset: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    path: string;
    offset?: number | undefined;
    limit?: number | undefined;
}, {
    path: string;
    offset?: number | undefined;
    limit?: number | undefined;
}>;
export declare const WriteFileSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
    createBackup: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: string;
    path: string;
    createBackup?: boolean | undefined;
}, {
    content: string;
    path: string;
    createBackup?: boolean | undefined;
}>;
export declare const EditFileSchema: z.ZodObject<{
    path: z.ZodString;
    oldString: z.ZodString;
    newString: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    oldString: string;
    newString: string;
}, {
    path: string;
    oldString: string;
    newString: string;
}>;
export declare const GlobSchema: z.ZodObject<{
    pattern: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    cwd?: string | undefined;
}, {
    pattern: string;
    cwd?: string | undefined;
}>;
export declare const GrepSchema: z.ZodObject<{
    pattern: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    include: z.ZodOptional<z.ZodString>;
    caseSensitive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    caseSensitive: boolean;
    path?: string | undefined;
    include?: string | undefined;
}, {
    pattern: string;
    path?: string | undefined;
    include?: string | undefined;
    caseSensitive?: boolean | undefined;
}>;
export declare const TerminalSchema: z.ZodObject<{
    command: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    command: string;
    cwd?: string | undefined;
    timeout?: number | undefined;
}, {
    command: string;
    cwd?: string | undefined;
    timeout?: number | undefined;
}>;
export declare const ReadDirSchema: z.ZodObject<{
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
}, {
    path: string;
}>;
export declare const GitStatusSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cwd?: string | undefined;
}, {
    cwd?: string | undefined;
}>;
export declare const GitCommitSchema: z.ZodObject<{
    message: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    addAll: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    cwd?: string | undefined;
    addAll?: boolean | undefined;
}, {
    message: string;
    cwd?: string | undefined;
    addAll?: boolean | undefined;
}>;
export declare const GitLogSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    maxCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    cwd?: string | undefined;
    maxCount?: number | undefined;
}, {
    cwd?: string | undefined;
    maxCount?: number | undefined;
}>;
export declare const GitDiffSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    file: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cwd?: string | undefined;
    file?: string | undefined;
}, {
    cwd?: string | undefined;
    file?: string | undefined;
}>;
export declare const RepoMapSchema: z.ZodObject<{
    maxFiles: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxFiles?: number | undefined;
}, {
    maxFiles?: number | undefined;
}>;
export type ToolInput = {
    'read_file'?: z.infer<typeof ReadFileSchema>;
    'write_file'?: z.infer<typeof WriteFileSchema>;
    'edit_file'?: z.infer<typeof EditFileSchema>;
    'glob'?: z.infer<typeof GlobSchema>;
    'grep'?: z.infer<typeof GrepSchema>;
    'terminal'?: z.infer<typeof TerminalSchema>;
    'read_directory'?: z.infer<typeof ReadDirSchema>;
    'git_status'?: z.infer<typeof GitStatusSchema>;
    'git_commit'?: z.infer<typeof GitCommitSchema>;
    'git_log'?: z.infer<typeof GitLogSchema>;
    'git_diff'?: z.infer<typeof GitDiffSchema>;
    'repo_map'?: z.infer<typeof RepoMapSchema>;
};
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    executionTime?: number;
}
export type ToolExecutor = (input: ToolInput[keyof ToolInput]) => Promise<ToolResult>;
export interface ToolContext {
    cwd: string;
    workspaceRoot: string;
}
export declare const BUILTIN_TOOLS: ToolDefinition[];
export declare function validateToolInput(toolName: string, input: unknown): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=definitions.d.ts.map