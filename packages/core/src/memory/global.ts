import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

export interface GlobalMemoryEntry {
  id: number;
  key: string;
  value: string;
  timestamp: number;
}

interface JsonDatabase {
  entries: GlobalMemoryEntry[];
  nextId: number;
}

export class GlobalMemory {
  private dbPath: string;
  private data: JsonDatabase;

  constructor() {
    const dbDir = join(homedir(), '.cagan');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = join(dbDir, 'global_memory.json');
    this.data = { entries: [], nextId: 1 };
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.dbPath)) {
        const content = readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
      } else {
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

  set(key: string, value: string): number {
    const existing = this.data.entries.find(e => e.key === key);
    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
      this.save();
      return existing.id;
    }

    const entry: GlobalMemoryEntry = {
      id: this.data.nextId++,
      key,
      value,
      timestamp: Date.now()
    };
    this.data.entries.push(entry);
    this.save();
    return entry.id;
  }

  get(key: string): GlobalMemoryEntry | null {
    return this.data.entries.find(e => e.key === key) || null;
  }

  getAll(): GlobalMemoryEntry[] {
    return this.data.entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  search(query: string): GlobalMemoryEntry[] {
    const lower = query.toLowerCase();
    return this.data.entries
      .filter(e => e.key.toLowerCase().includes(lower) || e.value.toLowerCase().includes(lower))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  delete(key: string): void {
    this.data.entries = this.data.entries.filter(e => e.key !== key);
    this.save();
  }

  clear(): void {
    this.data.entries = [];
    this.save();
  }

  close(): void {}
}