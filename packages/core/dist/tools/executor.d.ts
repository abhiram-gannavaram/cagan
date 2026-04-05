import { type ToolResult, type ToolContext } from './definitions.js';
import type { ToolCall } from '../providers/types.js';
import { CodeIndexer } from '../indexer/index.js';
export declare class ToolExecutor {
    private context;
    private customTools;
    private ignorePatterns;
    private indexer;
    constructor(context: ToolContext);
    setIgnorePatterns(patterns: string[]): void;
    setIndexer(indexer: CodeIndexer): void;
    executeToolCall(toolCall: ToolCall): Promise<ToolResult>;
    registerCustomTool(name: string, handler: (input: unknown) => Promise<ToolResult>): void;
    getAvailableTools(): (import("../providers/types.js").ToolDefinition | {
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {};
            };
        };
    })[];
    private shouldIgnore;
    private executeBuiltin;
    private readFile;
    private writeFile;
    private editFile;
    private glob;
    private grep;
    private terminal;
    private readDirectory;
    private gitStatus;
    private gitCommit;
    private gitLog;
    private gitDiff;
    private repoMap;
}
//# sourceMappingURL=executor.d.ts.map