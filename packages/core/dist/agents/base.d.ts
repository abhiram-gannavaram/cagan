import type { LLMProvider, Message, ToolCall } from '../providers/types.js';
import { ToolExecutor } from '../tools/index.js';
import { MemoryManager } from '../memory/index.js';
import { CostTracker } from '../cost/index.js';
import { DiffApplier } from '../diff/index.js';
export type AgentMode = 'architect' | 'code' | 'debug' | 'review' | 'ask' | 'devops' | 'doc' | 'test' | 'refactor' | 'orchestrator' | 'custom';
export interface AgentConfig {
    id: string;
    mode: AgentMode;
    provider: LLMProvider;
    model: string;
    systemPrompt?: string;
    cwd: string;
    workspaceRoot: string;
}
export interface AgentState {
    id: string;
    mode: AgentMode;
    status: 'idle' | 'running' | 'waiting' | 'error';
    currentTask?: string;
    messages: Message[];
    cost: number;
    lastActivity: number;
}
export declare abstract class BaseAgent {
    protected config: AgentConfig;
    protected state: AgentState;
    protected tools: ToolExecutor;
    protected memory: MemoryManager;
    protected costTracker: CostTracker;
    protected diffApplier: DiffApplier;
    protected messages: Message[];
    constructor(config: AgentConfig);
    getState(): AgentState;
    getMessages(): Message[];
    addMessage(message: Message): void;
    setStatus(status: AgentState['status']): void;
    run(task: string): AsyncIterable<{
        type: string;
        data: unknown;
    }>;
    protected buildContext(): Message[];
    protected executeToolCall(toolCall: ToolCall): Promise<string>;
    stop(): Promise<void>;
    reset(): void;
}
//# sourceMappingURL=base.d.ts.map