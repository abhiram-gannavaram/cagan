import { EventEmitter } from 'events';
import { CodeAgent } from './code.js';
import { ArchitectAgent } from './architect.js';
import { DevOpsAgent } from './devops.js';
import { TestAgent } from './test.js';
import { RefactorAgent } from './refactor.js';
import { DocAgent } from './doc.js';
export class OrchestratorAgent extends EventEmitter {
    config;
    subAgents = new Map();
    taskQueue = [];
    completedTasks = [];
    constructor(config) {
        super();
        this.config = {
            ...config,
            maxSubAgents: config.maxSubAgents || 5
        };
    }
    getSubAgents() {
        return Array.from(this.subAgents.values());
    }
    async *run(task) {
        yield { type: 'status', data: { message: 'Analyzing task...', phase: 'analyzing' } };
        const subtasks = await this.decomposeTask(task);
        yield { type: 'status', data: { message: `Decomposed into ${subtasks.length} subtasks`, phase: 'planning' } };
        for (const subtask of subtasks) {
            while (this.getActiveSubAgents() >= this.config.maxSubAgents) {
                await this.waitForSlot();
            }
            const subAgent = this.createSubAgent(subtask);
            this.subAgents.set(subAgent.id, subAgent);
            yield { type: 'subagent:start', data: { id: subAgent.id, task: subtask } };
            this.runSubAgentAsync(subAgent);
        }
        for (const [id, agent] of this.subAgents) {
            if (agent.status === 'running') {
                yield { type: 'subagent:update', data: { id, status: 'running' } };
            }
        }
        yield { type: 'status', data: { message: 'All subtasks dispatched', phase: 'executing' } };
    }
    async decomposeTask(task) {
        const prompt = `Break down this task into subtasks that can be executed independently.
Each subtask should be a simple, actionable item.

Task: ${task}

Return a JSON array of subtask strings. Example:
["Create user authentication module", "Write unit tests for auth", "Update API documentation"]`;
        return [
            `Subtask 1: ${task}`,
            `Subtask 2: Verify ${task}`
        ];
    }
    createSubAgent(task) {
        const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const mode = this.inferMode(task);
        const agentConfig = {
            id,
            mode,
            provider: this.config.provider,
            model: this.config.subAgentModel || this.config.model,
            cwd: this.config.cwd,
            workspaceRoot: this.config.workspaceRoot
        };
        let agent;
        switch (mode) {
            case 'code':
                agent = new CodeAgent(agentConfig);
                break;
            case 'architect':
                agent = new ArchitectAgent(agentConfig);
                break;
            case 'devops':
                agent = new DevOpsAgent(agentConfig);
                break;
            case 'test':
                agent = new TestAgent(agentConfig);
                break;
            case 'refactor':
                agent = new RefactorAgent(agentConfig);
                break;
            case 'doc':
                agent = new DocAgent(agentConfig);
                break;
            default:
                agent = new CodeAgent(agentConfig);
        }
        return {
            id,
            agent,
            mode,
            status: 'idle'
        };
    }
    inferMode(task) {
        const lower = task.toLowerCase();
        if (lower.includes('deploy') || lower.includes('kubernetes') || lower.includes('terraform') || lower.includes('ci/cd')) {
            return 'devops';
        }
        if (lower.includes('test') || lower.includes('spec') || lower.includes('unit')) {
            return 'test';
        }
        if (lower.includes('refactor') || lower.includes('improve') || lower.includes('clean')) {
            return 'refactor';
        }
        if (lower.includes('document') || lower.includes('readme') || lower.includes('comment')) {
            return 'doc';
        }
        if (lower.includes('plan') || lower.includes('analyze') || lower.includes('understand')) {
            return 'architect';
        }
        return 'code';
    }
    getActiveSubAgents() {
        let count = 0;
        for (const agent of this.subAgents.values()) {
            if (agent.status === 'running')
                count++;
        }
        return count;
    }
    async waitForSlot() {
        return new Promise(resolve => {
            setTimeout(resolve, 1000);
        });
    }
    async runSubAgentAsync(subAgent) {
        subAgent.status = 'running';
        try {
            let result = '';
            for await (const event of subAgent.agent.run(subAgent.id)) {
                if (event.type === 'delta') {
                    result += event.data?.delta?.content || '';
                }
            }
            subAgent.status = 'completed';
            subAgent.result = result;
            this.emit('subagent:complete', subAgent);
        }
        catch (error) {
            subAgent.status = 'failed';
            subAgent.error = error instanceof Error ? error.message : 'Unknown error';
            this.emit('subagent:failed', subAgent);
        }
    }
    async stop() {
        for (const agent of this.subAgents.values()) {
            if (agent.status === 'running') {
                await agent.agent.stop();
                agent.status = 'idle';
            }
        }
    }
    getResults() {
        return Array.from(this.subAgents.values()).map(sa => ({
            id: sa.id,
            mode: sa.mode,
            status: sa.status,
            result: sa.result,
            error: sa.error
        }));
    }
}
//# sourceMappingURL=orchestrator.js.map