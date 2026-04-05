import type { Message } from '../providers/types.js';
export interface SessionMemoryEntry {
    id: number;
    agentId: string;
    role: string;
    content: string;
    timestamp: number;
}
export declare class SessionMemory {
    private entries;
    private nextId;
    add(agentId: string, role: string, content: string): number;
    getByAgent(agentId: string): SessionMemoryEntry[];
    getAll(): SessionMemoryEntry[];
    clear(agentId?: string): void;
    search(query: string, agentId?: string): SessionMemoryEntry[];
    toMessages(agentId: string): Message[];
}
//# sourceMappingURL=session.d.ts.map