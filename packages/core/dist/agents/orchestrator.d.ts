import { EventEmitter } from 'events';
import { BaseAgent, type AgentConfig } from './base.js';
export interface SubAgent {
    id: string;
    agent: BaseAgent;
    mode: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    result?: string;
    error?: string;
}
export interface OrchestratorConfig extends AgentConfig {
    maxSubAgents: number;
    subAgentProviderName?: string;
    subAgentModel?: string;
}
export declare class OrchestratorAgent extends EventEmitter {
    private config;
    private subAgents;
    private taskQueue;
    private completedTasks;
    constructor(config: OrchestratorConfig);
    getSubAgents(): SubAgent[];
    run(task: string): AsyncIterable<{
        type: string;
        data: unknown;
    }>;
    private decomposeTask;
    private createSubAgent;
    private inferMode;
    private getActiveSubAgents;
    private waitForSlot;
    private runSubAgentAsync;
    stop(): Promise<void>;
    getResults(): {
        id: string;
        mode: string;
        status: string;
        result?: string;
        error?: string;
    }[];
}
//# sourceMappingURL=orchestrator.d.ts.map