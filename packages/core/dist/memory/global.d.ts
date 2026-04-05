export interface GlobalMemoryEntry {
    id: number;
    key: string;
    value: string;
    timestamp: number;
}
export declare class GlobalMemory {
    private dbPath;
    private data;
    constructor();
    private load;
    private save;
    set(key: string, value: string): number;
    get(key: string): GlobalMemoryEntry | null;
    getAll(): GlobalMemoryEntry[];
    search(query: string): GlobalMemoryEntry[];
    delete(key: string): void;
    clear(): void;
    close(): void;
}
//# sourceMappingURL=global.d.ts.map