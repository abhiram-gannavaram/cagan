export interface ProjectMemoryEntry {
    id: number;
    agentId: string;
    key: string;
    value: string;
    timestamp: number;
}
export declare class ProjectMemory {
    private dbPath;
    private data;
    private useSqlite;
    private sqliteDb;
    constructor(projectPath: string);
    private load;
    private save;
    set(agentId: string, key: string, value: string): number;
    get(key: string, agentId?: string): string | null;
    getAll(agentId?: string): ProjectMemoryEntry[];
    search(query: string, agentId?: string): ProjectMemoryEntry[];
    clear(agentId?: string): void;
    close(): void;
}
//# sourceMappingURL=project.d.ts.map