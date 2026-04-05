export class SessionMemory {
    entries = [];
    nextId = 1;
    add(agentId, role, content) {
        const entry = {
            id: this.nextId++,
            agentId,
            role,
            content,
            timestamp: Date.now()
        };
        this.entries.push(entry);
        return entry.id;
    }
    getByAgent(agentId) {
        return this.entries.filter(e => e.agentId === agentId);
    }
    getAll() {
        return [...this.entries];
    }
    clear(agentId) {
        if (agentId) {
            this.entries = this.entries.filter(e => e.agentId !== agentId);
        }
        else {
            this.entries = [];
        }
    }
    search(query, agentId) {
        const lower = query.toLowerCase();
        return this.entries.filter(e => {
            if (agentId && e.agentId !== agentId)
                return false;
            return e.content.toLowerCase().includes(lower);
        });
    }
    toMessages(agentId) {
        return this.getByAgent(agentId).map(e => ({
            role: e.role,
            content: e.content
        }));
    }
}
//# sourceMappingURL=session.js.map