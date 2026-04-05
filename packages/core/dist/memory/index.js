import { SessionMemory } from './session.js';
import { ProjectMemory } from './project.js';
import { GlobalMemory } from './global.js';
export class MemoryManager {
    session;
    project = null;
    global = null;
    projectPath = null;
    constructor(projectPath) {
        this.session = new SessionMemory();
        if (projectPath) {
            this.projectPath = projectPath;
            this.project = new ProjectMemory(projectPath);
        }
        this.global = new GlobalMemory();
    }
    add(scope, agentIdOrContent, contentOrKey, value) {
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
            return this.global.set(contentOrKey, value || contentOrKey);
        }
        return -1;
    }
    addMessage(scope, agentId, role, content) {
        if (scope === 'session') {
            return this.session.add(agentId, role, content);
        }
        if (scope === 'project' && this.project) {
            return this.project.set(agentId, `${role}:${content.slice(0, 100)}`, content);
        }
        return -1;
    }
    get(scope, key, agentId) {
        if (scope === 'session') {
            const entries = this.session.search(key, agentId);
            return entries[entries.length - 1]?.content || null;
        }
        if (scope === 'project' && this.project) {
            return this.project.get(key, agentId);
        }
        if (scope === 'global') {
            const entry = this.global.get(key);
            return entry?.value || null;
        }
        return null;
    }
    getAll(scope, agentId) {
        if (scope === 'session') {
            return this.session.getAll().map(e => ({
                id: e.id,
                scope: 'session',
                agentId: e.agentId,
                value: e.content,
                timestamp: e.timestamp
            }));
        }
        if (scope === 'project' && this.project) {
            return this.project.getAll(agentId).map(e => ({
                id: e.id,
                scope: 'project',
                agentId: e.agentId,
                key: e.key,
                value: e.value,
                timestamp: e.timestamp
            }));
        }
        if (scope === 'global') {
            return this.global.getAll().map(e => ({
                id: e.id,
                scope: 'global',
                key: e.key,
                value: e.value,
                timestamp: e.timestamp
            }));
        }
        return [];
    }
    search(scope, query, agentId) {
        if (scope === 'session') {
            return this.session.search(query, agentId).map(e => ({
                id: e.id,
                scope: 'session',
                agentId: e.agentId,
                value: e.content,
                timestamp: e.timestamp
            }));
        }
        if (scope === 'project' && this.project) {
            return this.project.search(query, agentId).map(e => ({
                id: e.id,
                scope: 'project',
                agentId: e.agentId,
                key: e.key,
                value: e.value,
                timestamp: e.timestamp
            }));
        }
        if (scope === 'global') {
            return this.global.search(query).map(e => ({
                id: e.id,
                scope: 'global',
                key: e.key,
                value: e.value,
                timestamp: e.timestamp
            }));
        }
        return [];
    }
    clear(scope, agentId) {
        if (scope === 'session') {
            this.session.clear(agentId);
        }
        else if (scope === 'project' && this.project) {
            this.project.clear(agentId);
        }
        else if (scope === 'global') {
            this.global.clear();
        }
    }
    toMessages(scope, agentId) {
        if (scope === 'session') {
            return this.session.toMessages(agentId);
        }
        const entries = this.getAll(scope, agentId);
        return entries.map(e => ({ role: 'user', content: e.value }));
    }
    close() {
        this.project?.close();
        this.global?.close();
    }
}
let globalMemoryManager = null;
export function getMemoryManager(projectPath) {
    if (!globalMemoryManager) {
        globalMemoryManager = new MemoryManager(projectPath);
    }
    return globalMemoryManager;
}
//# sourceMappingURL=index.js.map