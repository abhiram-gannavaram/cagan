export interface CodeSymbol {
    name: string;
    type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'type' | 'method';
    filePath: string;
    line: number;
    dependencies: string[];
    signature?: string;
}
export interface IndexedFile {
    path: string;
    hash: string;
    symbols: CodeSymbol[];
    imports: string[];
    exports: string[];
}
export interface DependencyEdge {
    from: string;
    to: string;
    type: 'import' | 'extends' | 'implements' | 'calls';
}
export declare class CodeIndexer {
    private index;
    private symbols;
    private dependencyGraph;
    private ignorePatterns;
    private extensions;
    constructor(ignorePatterns?: string[]);
    setIgnorePatterns(patterns: string[]): void;
    indexDirectory(rootPath: string): Promise<void>;
    private getFiles;
    private shouldIgnore;
    private isCodeFile;
    private indexFile;
    private extractSymbols;
    private extractJSSymbols;
    private extractPySymbols;
    private extractGoSymbols;
    private extractImportsExports;
    private simpleHash;
    getFile(path: string): IndexedFile | undefined;
    getSymbol(name: string): CodeSymbol[];
    getDependencies(filePath: string): string[];
    searchFiles(pattern: string): string[];
    searchSymbols(pattern: string): CodeSymbol[];
    getRepoMap(maxFiles?: number): string;
    searchBySemantic(query: string, topK?: number): Promise<CodeSymbol[]>;
}
//# sourceMappingURL=index.d.ts.map