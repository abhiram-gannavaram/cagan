import { EventEmitter } from 'events';
export class AgentRegistry extends EventEmitter {
    agents = new Map();
    messageQueue = new Map();
    config;
    agentInstances = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            maxAgents: config.maxAgents || 10,
            defaultProvider: config.defaultProvider || 'minimax',
            defaultModel: config.defaultModel || 'MiniMax-M2.7'
        };
    }
    createAgent(options) {
        if (this.agents.size >= this.config.maxAgents) {
            this.emit('error', { message: 'Max agents reached', count: this.agents.size });
            return null;
        }
        const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const name = options.name || `${options.mode}-${id.slice(-6)}`;
        const instance = {
            id,
            name,
            mode: options.mode,
            provider: options.provider || this.config.defaultProvider,
            model: options.model || this.config.defaultModel,
            status: 'idle',
            cost: 0,
            startedAt: Date.now(),
            updatedAt: Date.now(),
            parentId: options.parentId,
            messages: []
        };
        this.agents.set(id, instance);
        this.messageQueue.set(id, []);
        this.emit('agent:created', instance);
        return instance;
    }
    getAgent(id) {
        return this.agents.get(id);
    }
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    getAgentsByStatus(status) {
        return this.getAllAgents().filter(a => a.status === status);
    }
    getAgentsByParent(parentId) {
        return this.getAllAgents().filter(a => a.parentId === parentId);
    }
    updateAgent(id, updates) {
        const agent = this.agents.get(id);
        if (agent) {
            Object.assign(agent, updates, { updatedAt: Date.now() });
            this.emit('agent:updated', agent);
        }
    }
    removeAgent(id) {
        const agent = this.agents.get(id);
        if (agent) {
            this.agents.delete(id);
            this.messageQueue.delete(id);
            this.agentInstances.delete(id);
            this.emit('agent:removed', { id });
        }
    }
    sendMessage(message) {
        const queue = this.messageQueue.get(message.to);
        if (queue) {
            queue.push(message);
            this.emit('message:received', message);
        }
        else {
            this.emit('error', { message: 'Agent not found', agentId: message.to });
        }
    }
    getMessages(agentId) {
        return this.messageQueue.get(agentId) || [];
    }
    popMessage(agentId) {
        const queue = this.messageQueue.get(agentId);
        return queue?.shift() || null;
    }
    broadcast(type, payload, fromAgentId) {
        for (const [id] of this.agents) {
            if (id !== fromAgentId) {
                this.sendMessage({
                    from: fromAgentId || 'system',
                    to: id,
                    type,
                    payload,
                    timestamp: Date.now()
                });
            }
        }
    }
    async stopAgent(id) {
        const agent = this.agentInstances.get(id);
        if (agent) {
            await agent.stop();
            this.updateAgent(id, { status: 'stopped' });
        }
    }
    async stopAll() {
        const stopPromises = Array.from(this.agentInstances.values()).map(a => a.stop());
        await Promise.all(stopPromises);
        for (const [agentId] of this.agentInstances) {
            this.updateAgent(agentId, { status: 'stopped' });
        }
    }
    registerAgentInstance(id, instance) {
        this.agentInstances.set(id, instance);
    }
    getAgentInstance(id) {
        return this.agentInstances.get(id);
    }
    getStats() {
        const stats = {
            total: this.agents.size,
            byStatus: {},
            byMode: {},
            totalCost: 0
        };
        for (const agent of this.agents.values()) {
            stats.byStatus[agent.status] = (stats.byStatus[agent.status] || 0) + 1;
            stats.byMode[agent.mode] = (stats.byMode[agent.mode] || 0) + 1;
            stats.totalCost += agent.cost;
        }
        return stats;
    }
    clear() {
        this.agents.clear();
        this.messageQueue.clear();
        this.agentInstances.clear();
    }
}
let globalRegistry = null;
export function getAgentRegistry() {
    if (!globalRegistry) {
        globalRegistry = new AgentRegistry();
    }
    return globalRegistry;
}
//# sourceMappingURL=registry.js.map