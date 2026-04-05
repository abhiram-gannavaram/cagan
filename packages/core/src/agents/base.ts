import type { LLMProvider, Message, ChatOptions, ToolCall } from '../providers/types.js';
import { ToolExecutor, BUILTIN_TOOLS, type ToolContext } from '../tools/index.js';
import { MemoryManager } from '../memory/index.js';
import { CostTracker } from '../cost/index.js';
import { DiffApplier } from '../diff/index.js';

export type AgentMode = 'architect' | 'code' | 'debug' | 'review' | 'ask' |
  'devops' | 'doc' | 'test' | 'refactor' | 'orchestrator' | 'custom';

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

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected state: AgentState;
  protected tools: ToolExecutor;
  protected memory: MemoryManager;
  protected costTracker: CostTracker;
  protected diffApplier: DiffApplier;
  protected messages: Message[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      id: config.id,
      mode: config.mode,
      status: 'idle',
      messages: [],
      cost: 0,
      lastActivity: Date.now()
    };
    this.tools = new ToolExecutor({
      cwd: config.cwd,
      workspaceRoot: config.workspaceRoot
    });
    this.memory = new MemoryManager(config.workspaceRoot);
    this.costTracker = new CostTracker();
    this.diffApplier = new DiffApplier(join(config.workspaceRoot, '.cagan', 'backups'));

    if (config.systemPrompt) {
      this.messages.push({ role: 'system', content: config.systemPrompt });
    }
  }

  getState(): AgentState {
    return { ...this.state, messages: this.messages };
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  addMessage(message: Message): void {
    this.messages.push(message);
    this.state.lastActivity = Date.now();
  }

  setStatus(status: AgentState['status']): void {
    this.state.status = status;
  }

  async *run(task: string): AsyncIterable<{ type: string; data: unknown }> {
    this.state.status = 'running';
    this.state.currentTask = task;
    
    this.messages.push({ role: 'user', content: task });

    const contextMessages = this.buildContext();
    
    try {
      for await (const chunk of this.config.provider.chatStream(contextMessages, {
        model: this.config.model,
        tools: this.tools.getAvailableTools()
      })) {
        yield { type: 'delta', data: chunk };
        
        if (chunk.usage) {
          this.costTracker.recordUsage(chunk.usage, this.config.model, this.config.provider.name);
        }
      }
    } catch (error) {
      this.state.status = 'error';
      yield { type: 'error', data: error instanceof Error ? error.message : 'Unknown error' };
    }

    this.state.status = 'idle';
  }

  protected buildContext(): Message[] {
    const memoryContext = this.memory.toMessages('session', this.config.id);
    const recentMemory = memoryContext.slice(-10);
    
    return [
      ...this.messages.slice(0, 1),
      ...recentMemory.map(m => ({ role: m.role as Message['role'], content: m.content })),
      ...this.messages.slice(1)
    ];
  }

  protected async executeToolCall(toolCall: ToolCall): Promise<string> {
    const result = await this.tools.executeToolCall(toolCall);
    
    this.messages.push({
      role: 'tool',
      content: result.success ? result.output || '' : `Error: ${result.error}`,
      toolCallId: toolCall.id
    });

    return JSON.stringify(result);
  }

  async stop(): Promise<void> {
    this.state.status = 'idle';
  }

  reset(): void {
    this.messages = this.config.systemPrompt 
      ? [{ role: 'system', content: this.config.systemPrompt }]
      : [];
    this.state.cost = 0;
  }
}

function join(...paths: string[]): string {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
}