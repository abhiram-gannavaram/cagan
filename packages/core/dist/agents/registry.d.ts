import { EventEmitter } from 'events';
import type { AgentMode } from '../agents/base.js';
import { type BaseAgent } from '../agents/index.js';
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
    messages: {
        role: string;
        content: string;
    }[];
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
export declare class AgentRegistry extends EventEmitter {
    private agents;
    private messageQueue;
    private config;
    private agentInstances;
    constructor(config?: Partial<AgentRegistryConfig>);
    createAgent(options: {
        mode: AgentMode;
        provider?: string;
        model?: string;
        cwd: string;
        workspaceRoot: string;
        name?: string;
        parentId?: string;
    }): AgentInstance | null;
    getAgent(id: string): AgentInstance | undefined;
    getAllAgents(): AgentInstance[];
    getAgentsByStatus(status: AgentInstance['status']): AgentInstance[];
    getAgentsByParent(parentId: string): AgentInstance[];
    updateAgent(id: string, updates: Partial<AgentInstance>): void;
    removeAgent(id: string): void;
    sendMessage(message: AgentMessage): void;
    getMessages(agentId: string): AgentMessage[];
    popMessage(agentId: string): AgentMessage | null;
    broadcast(type: AgentMessage['type'], payload: unknown, fromAgentId?: string): void;
    stopAgent(id: string): Promise<void>;
    stopAll(): Promise<void>;
    registerAgentInstance(id: string, instance: BaseAgent): void;
    getAgentInstance(id: string): BaseAgent | undefined;
    getStats(): {
        total: number;
        byStatus: Record<string, number>;
        byMode: Record<string, number>;
        totalCost: number;
    };
    clear(): void;
}
export declare function getAgentRegistry(): AgentRegistry;
//# sourceMappingURL=registry.d.ts.map