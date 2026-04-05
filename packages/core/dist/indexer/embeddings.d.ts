export interface SemanticSearchResult {
    filePath: string;
    symbolName: string;
    symbolType: string;
    line: number;
    score: number;
    context: string;
}
export interface EmbeddingResult {
    vector: number[];
    dimensions: number;
}
export declare class LocalEmbeddings {
    initialize(): Promise<void>;
    embed(text: string): Promise<EmbeddingResult>;
    private simpleEmbedding;
    cosineSimilarity(a: number[], b: number[]): number;
}
export declare class SemanticCodeSearch {
    private embeddings;
    private codeIndex;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    indexFile(path: string, content: string, symbols: string[]): Promise<void>;
    search(query: string, topK?: number): Promise<SemanticSearchResult[]>;
    getIndexedFiles(): string[];
    clear(): void;
}
export declare function getSemanticSearch(): SemanticCodeSearch;
export declare function initializeSemanticSearch(): Promise<void>;
//# sourceMappingURL=embeddings.d.ts.map