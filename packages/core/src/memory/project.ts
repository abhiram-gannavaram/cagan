import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export interface ProjectMemoryEntry {
  id: number;
  agentId: string;
  key: string;
  value: string;
  timestamp: number;
}

interface JsonDatabase {
  entries: ProjectMemoryEntry[];
  nextId: number;
}

export class ProjectMemory {
  private dbPath: string;
  private data: JsonDatabase;
  private useSqlite: boolean = false;
  private sqliteDb: unknown = null;

  constructor(projectPath: string) {
    this.dbPath = join(projectPath, '.byoadev', 'memory.json');
    this.data = { entries: [], nextId: 1 };
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.dbPath)) {
        const content = readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
      } else {
        const dir = join(this.dbPath, '..');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        this.save();
      }
    } catch {
      this.data = { entries: [], nextId: 1 };
    }
  }

  private save(): void {
    try {
      writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch {}
  }

  set(agentId: string, key: string, value: string): number {
    const entry: ProjectMemoryEntry = {
      id: this.data.nextId++,
      agentId,
      key,
      value,
      timestamp: Date.now()
    };
    this.data.entries.push(entry);
    this.save();
    return entry.id;
  }

  get(key: string, agentId?: string): string | null {
    const filtered = this.data.entries.filter(e => {
      if (e.key !== key) return false;
      if (agentId && e.agentId !== agentId) return false;
      return true;
    });
    return filtered.sort((a, b) => b.timestamp - a.timestamp)[0]?.value || null;
  }

  getAll(agentId?: string): ProjectMemoryEntry[] {
    const filtered = agentId
      ? this.data.entries.filter(e => e.agentId === agentId)
      : this.data.entries;
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  search(query: string, agentId?: string): ProjectMemoryEntry[] {
    const lower = query.toLowerCase();
    return this.data.entries.filter(e => {
      if (agentId && e.agentId !== agentId) return false;
      return e.key.toLowerCase().includes(lower) || e.value.toLowerCase().includes(lower);
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  clear(agentId?: string): void {
    if (agentId) {
      this.data.entries = this.data.entries.filter(e => e.agentId !== agentId);
    } else {
      this.data.entries = [];
    }
    this.save();
  }

  close(): void {}
}