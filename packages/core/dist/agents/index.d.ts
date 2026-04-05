import type { AgentConfig } from './base.js';
import { BaseAgent } from './base.js';
import { OrchestratorAgent } from './orchestrator.js';
import { CustomAgent } from './custom.js';
export type { AgentConfig, AgentMode, AgentState } from './base.js';
export { BaseAgent } from './base.js';
export { CodeAgent } from './code.js';
export { ArchitectAgent } from './architect.js';
export { DevOpsAgent } from './devops.js';
export { TestAgent } from './test.js';
export { RefactorAgent } from './refactor.js';
export { DocAgent } from './doc.js';
export { OrchestratorAgent } from './orchestrator.js';
export { CustomAgent } from './custom.js';
export { AgentRegistry, getAgentRegistry } from './registry.js';
export type { AgentInstance, AgentMessage } from './registry.js';
export declare function createAgent(config: AgentConfig): BaseAgent;
export declare function createOrchestratorAgent(config: AgentConfig & {
    maxSubAgents?: number;
}): OrchestratorAgent;
export declare function createCustomAgent(config: AgentConfig & {
    customSystemPrompt: string;
    allowedTools?: string[];
}): CustomAgent;
//# sourceMappingURL=index.d.ts.map