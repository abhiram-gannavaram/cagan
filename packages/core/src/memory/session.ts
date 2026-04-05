import type { Message } from '../providers/types.js';

export interface SessionMemoryEntry {
  id: number;
  agentId: string;
  role: string;
  content: string;
  timestamp: number;
}

export class SessionMemory {
  private entries: SessionMemoryEntry[] = [];
  private nextId = 1;

  add(agentId: string, role: string, content: string): number {
    const entry: SessionMemoryEntry = {
      id: this.nextId++,
      agentId,
      role,
      content,
      timestamp: Date.now()
    };
    this.entries.push(entry);
    return entry.id;
  }

  getByAgent(agentId: string): SessionMemoryEntry[] {
    return this.entries.filter(e => e.agentId === agentId);
  }

  getAll(): SessionMemoryEntry[] {
    return [...this.entries];
  }

  clear(agentId?: string): void {
    if (agentId) {
      this.entries = this.entries.filter(e => e.agentId !== agentId);
    } else {
      this.entries = [];
    }
  }

  search(query: string, agentId?: string): SessionMemoryEntry[] {
    const lower = query.toLowerCase();
    return this.entries.filter(e => {
      if (agentId && e.agentId !== agentId) return false;
      return e.content.toLowerCase().includes(lower);
    });
  }

  toMessages(agentId: string): Message[] {
    return this.getByAgent(agentId).map(e => ({
      role: e.role as Message['role'],
      content: e.content
    }));
  }
}