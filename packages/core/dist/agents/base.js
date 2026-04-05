import { ToolExecutor } from '../tools/index.js';
import { MemoryManager } from '../memory/index.js';
import { CostTracker } from '../cost/index.js';
import { DiffApplier } from '../diff/index.js';
export class BaseAgent {
    config;
    state;
    tools;
    memory;
    costTracker;
    diffApplier;
    messages = [];
    constructor(config) {
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
        this.diffApplier = new DiffApplier(join(config.workspaceRoot, '.byoadev', 'backups'));
        if (config.systemPrompt) {
            this.messages.push({ role: 'system', content: config.systemPrompt });
        }
    }
    getState() {
        return { ...this.state, messages: this.messages };
    }
    getMessages() {
        return [...this.messages];
    }
    addMessage(message) {
        this.messages.push(message);
        this.state.lastActivity = Date.now();
    }
    setStatus(status) {
        this.state.status = status;
    }
    async *run(task) {
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
        }
        catch (error) {
            this.state.status = 'error';
            yield { type: 'error', data: error instanceof Error ? error.message : 'Unknown error' };
        }
        this.state.status = 'idle';
    }
    buildContext() {
        const memoryContext = this.memory.toMessages('session', this.config.id);
        const recentMemory = memoryContext.slice(-10);
        return [
            ...this.messages.slice(0, 1),
            ...recentMemory.map(m => ({ role: m.role, content: m.content })),
            ...this.messages.slice(1)
        ];
    }
    async executeToolCall(toolCall) {
        const result = await this.tools.executeToolCall(toolCall);
        this.messages.push({
            role: 'tool',
            content: result.success ? result.output || '' : `Error: ${result.error}`,
            toolCallId: toolCall.id
        });
        return JSON.stringify(result);
    }
    async stop() {
        this.state.status = 'idle';
    }
    reset() {
        this.messages = this.config.systemPrompt
            ? [{ role: 'system', content: this.config.systemPrompt }]
            : [];
        this.state.cost = 0;
    }
}
function join(...paths) {
    return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
}
//# sourceMappingURL=base.js.map