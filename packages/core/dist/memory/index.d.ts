export type MemoryScope = 'session' | 'project' | 'global';
export interface MemoryEntry {
    id: number;
    scope: MemoryScope;
    agentId?: string;
    key?: string;
    value: string;
    timestamp: number;
}
export declare class MemoryManager {
    private session;
    private project;
    private global;
    private projectPath;
    constructor(projectPath?: string);
    add(scope: MemoryScope, agentId: string, content: string): number;
    add(scope: MemoryScope, agentId: string, key: string, value: string): number;
    addMessage(scope: MemoryScope, agentId: string, role: string, content: string): number;
    get(scope: MemoryScope, key: string, agentId?: string): string | null;
    getAll(scope: MemoryScope, agentId?: string): MemoryEntry[];
    search(scope: MemoryScope, query: string, agentId?: string): MemoryEntry[];
    clear(scope: MemoryScope, agentId?: string): void;
    toMessages(scope: MemoryScope, agentId: string): {
        role: string;
        content: string;
    }[];
    close(): void;
}
export declare function getMemoryManager(projectPath?: string): MemoryManager;
//# sourceMappingURL=index.d.ts.map