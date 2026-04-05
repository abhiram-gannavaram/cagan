import { EventEmitter } from 'events';
import type { AgentMode } from '../agents/base.js';
import { createAgent, type BaseAgent } from '../agents/index.js';
import type { LLMProvider } from '../providers/types.js';

export interface AgentInstance {
  id: string;
  name: string;
  mode: AgentMode;
  provider: string;
  model: string;
  status: 'idle' | 'running' | 'waiting' | 'completed' | 'failed' | 'stopped';
  cost: number;
  startedAt: number;
  updatedAt: number;
  parentId?: string;
  messages: { role: string; content: string }[];
}

export interface AgentMessage {
  from: string;
  to: string;
  type: 'task' | 'result' | 'error' | 'status' | 'stop';
  payload: unknown;
  timestamp: number;
}

export interface AgentRegistryConfig {
  maxAgents: number;
  defaultProvider: string;
  defaultModel: string;
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentInstance> = new Map();
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private config: AgentRegistryConfig;
  private agentInstances: Map<string, BaseAgent> = new Map();

  constructor(config: Partial<AgentRegistryConfig> = {}) {
    super();
    this.config = {
      maxAgents: config.maxAgents || 10,
      defaultProvider: config.defaultProvider || 'minimax',
      defaultModel: config.defaultModel || 'MiniMax-M2.7'
    };
  }

  createAgent(options: {
    mode: AgentMode;
    provider?: string;
    model?: string;
    cwd: string;
    workspaceRoot: string;
    name?: string;
    parentId?: string;
  }): AgentInstance | null {
    if (this.agents.size >= this.config.maxAgents) {
      this.emit('error', { message: 'Max agents reached', count: this.agents.size });
      return null;
    }

    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name = options.name || `${options.mode}-${id.slice(-6)}`;

    const instance: AgentInstance = {
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

  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  getAgentsByStatus(status: AgentInstance['status']): AgentInstance[] {
    return this.getAllAgents().filter(a => a.status === status);
  }

  getAgentsByParent(parentId: string): AgentInstance[] {
    return this.getAllAgents().filter(a => a.parentId === parentId);
  }

  updateAgent(id: string, updates: Partial<AgentInstance>): void {
    const agent = this.agents.get(id);
    if (agent) {
      Object.assign(agent, updates, { updatedAt: Date.now() });
      this.emit('agent:updated', agent);
    }
  }

  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      this.agents.delete(id);
      this.messageQueue.delete(id);
      this.agentInstances.delete(id);
      this.emit('agent:removed', { id });
    }
  }

  sendMessage(message: AgentMessage): void {
    const queue = this.messageQueue.get(message.to);
    if (queue) {
      queue.push(message);
      this.emit('message:received', message);
    } else {
      this.emit('error', { message: 'Agent not found', agentId: message.to });
    }
  }

  getMessages(agentId: string): AgentMessage[] {
    return this.messageQueue.get(agentId) || [];
  }

  popMessage(agentId: string): AgentMessage | null {
    const queue = this.messageQueue.get(agentId);
    return queue?.shift() || null;
  }

  broadcast(type: AgentMessage['type'], payload: unknown, fromAgentId?: string): void {
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

  async stopAgent(id: string): Promise<void> {
    const agent = this.agentInstances.get(id);
    if (agent) {
      await agent.stop();
      this.updateAgent(id, { status: 'stopped' });
    }
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.agentInstances.values()).map(a => a.stop());
    await Promise.all(stopPromises);
    for (const [agentId] of this.agentInstances) {
      this.updateAgent(agentId, { status: 'stopped' });
    }
  }

  registerAgentInstance(id: string, instance: BaseAgent): void {
    this.agentInstances.set(id, instance);
  }

  getAgentInstance(id: string): BaseAgent | undefined {
    return this.agentInstances.get(id);
  }

  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byMode: Record<string, number>;
    totalCost: number;
  } {
    const stats = {
      total: this.agents.size,
      byStatus: {} as Record<string, number>,
      byMode: {} as Record<string, number>,
      totalCost: 0
    };

    for (const agent of this.agents.values()) {
      stats.byStatus[agent.status] = (stats.byStatus[agent.status] || 0) + 1;
      stats.byMode[agent.mode] = (stats.byMode[agent.mode] || 0) + 1;
      stats.totalCost += agent.cost;
    }

    return stats;
  }

  clear(): void {
    this.agents.clear();
    this.messageQueue.clear();
    this.agentInstances.clear();
  }
}

let globalRegistry: AgentRegistry | null = null;

export function getAgentRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}