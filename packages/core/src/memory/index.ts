import { SessionMemory, type SessionMemoryEntry } from './session.js';
import { ProjectMemory, type ProjectMemoryEntry } from './project.js';
import { GlobalMemory, type GlobalMemoryEntry } from './global.js';

export type MemoryScope = 'session' | 'project' | 'global';

export interface MemoryEntry {
  id: number;
  scope: MemoryScope;
  agentId?: string;
  key?: string;
  value: string;
  timestamp: number;
}

export class MemoryManager {
  private session: SessionMemory;
  private project: ProjectMemory | null = null;
  private global: GlobalMemory | null = null;
  private projectPath: string | null = null;

  constructor(projectPath?: string) {
    this.session = new SessionMemory();
    if (projectPath) {
      this.projectPath = projectPath;
      this.project = new ProjectMemory(projectPath);
    }
    this.global = new GlobalMemory();
  }

  add(scope: MemoryScope, agentId: string, content: string): number;
  add(scope: MemoryScope, agentId: string, key: string, value: string): number;
  add(scope: MemoryScope, agentIdOrContent: string, contentOrKey: string, value?: string): number {
    if (scope === 'session') {
      return this.session.add(agentIdOrContent, 'user', contentOrKey);
    }
    if (scope === 'project' && this.project) {
      if (value !== undefined) {
        return this.project.set(agentIdOrContent, contentOrKey, value);
      }
      return this.project.set(agentIdOrContent, 'message', contentOrKey);
    }
    if (scope === 'global') {
      return this.global!.set(contentOrKey, value || contentOrKey);
    }
    return -1;
  }

  addMessage(scope: MemoryScope, agentId: string, role: string, content: string): number {
    if (scope === 'session') {
      return this.session.add(agentId, role, content);
    }
    if (scope === 'project' && this.project) {
      return this.project.set(agentId, `${role}:${content.slice(0, 100)}`, content);
    }
    return -1;
  }

  get(scope: MemoryScope, key: string, agentId?: string): string | null {
    if (scope === 'session') {
      const entries = this.session.search(key, agentId);
      return entries[entries.length - 1]?.content || null;
    }
    if (scope === 'project' && this.project) {
      return this.project.get(key, agentId);
    }
    if (scope === 'global') {
      const entry = this.global!.get(key);
      return entry?.value || null;
    }
    return null;
  }

  getAll(scope: MemoryScope, agentId?: string): MemoryEntry[] {
    if (scope === 'session') {
      return this.session.getAll().map(e => ({
        id: e.id,
        scope: 'session' as const,
        agentId: e.agentId,
        value: e.content,
        timestamp: e.timestamp
      }));
    }
    if (scope === 'project' && this.project) {
      return this.project.getAll(agentId).map(e => ({
        id: e.id,
        scope: 'project' as const,
        agentId: e.agentId,
        key: e.key,
        value: e.value,
        timestamp: e.timestamp
      }));
    }
    if (scope === 'global') {
      return this.global!.getAll().map(e => ({
        id: e.id,
        scope: 'global' as const,
        key: e.key,
        value: e.value,
        timestamp: e.timestamp
      }));
    }
    return [];
  }

  search(scope: MemoryScope, query: string, agentId?: string): MemoryEntry[] {
    if (scope === 'session') {
      return this.session.search(query, agentId).map(e => ({
        id: e.id,
        scope: 'session' as const,
        agentId: e.agentId,
        value: e.content,
        timestamp: e.timestamp
      }));
    }
    if (scope === 'project' && this.project) {
      return this.project.search(query, agentId).map(e => ({
        id: e.id,
        scope: 'project' as const,
        agentId: e.agentId,
        key: e.key,
        value: e.value,
        timestamp: e.timestamp
      }));
    }
    if (scope === 'global') {
      return this.global!.search(query).map(e => ({
        id: e.id,
        scope: 'global' as const,
        key: e.key,
        value: e.value,
        timestamp: e.timestamp
      }));
    }
    return [];
  }

  clear(scope: MemoryScope, agentId?: string): void {
    if (scope === 'session') {
      this.session.clear(agentId);
    } else if (scope === 'project' && this.project) {
      this.project.clear(agentId);
    } else if (scope === 'global') {
      this.global!.clear();
    }
  }

  toMessages(scope: MemoryScope, agentId: string): { role: string; content: string }[] {
    if (scope === 'session') {
      return this.session.toMessages(agentId);
    }
    const entries = this.getAll(scope, agentId);
    return entries.map(e => ({ role: 'user', content: e.value }));
  }

  close(): void {
    this.project?.close();
    this.global?.close();
  }
}

let globalMemoryManager: MemoryManager | null = null;

export function getMemoryManager(projectPath?: string): MemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new MemoryManager(projectPath);
  }
  return globalMemoryManager;
}