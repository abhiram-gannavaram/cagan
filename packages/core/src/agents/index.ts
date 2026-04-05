import type { AgentConfig } from './base.js';
import { BaseAgent } from './base.js';
import { CodeAgent } from './code.js';
import { ArchitectAgent } from './architect.js';
import { DevOpsAgent } from './devops.js';
import { TestAgent } from './test.js';
import { RefactorAgent } from './refactor.js';
import { DocAgent } from './doc.js';
import { OrchestratorAgent } from './orchestrator.js';
import { CustomAgent } from './custom.js';
import { AgentRegistry, getAgentRegistry, type AgentInstance, type AgentMessage } from './registry.js';

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

export function createAgent(config: AgentConfig): BaseAgent {
  switch (config.mode) {
    case 'code':
      return new CodeAgent(config);
    case 'architect':
      return new ArchitectAgent(config);
    case 'devops':
      return new DevOpsAgent(config);
    case 'test':
      return new TestAgent(config);
    case 'refactor':
      return new RefactorAgent(config);
    case 'doc':
      return new DocAgent(config);
    case 'debug':
    case 'review':
    case 'ask':
      return new CodeAgent(config);
    default:
      return new CodeAgent(config);
  }
}

export function createOrchestratorAgent(config: AgentConfig & { maxSubAgents?: number }): OrchestratorAgent {
  return new OrchestratorAgent({
    ...config,
    maxSubAgents: config.maxSubAgents || 5
  } as import('./orchestrator.js').OrchestratorConfig);
}

export function createCustomAgent(config: AgentConfig & { customSystemPrompt: string; allowedTools?: string[] }): CustomAgent {
  return new CustomAgent(config as import('./custom.js').CustomAgentConfig);
}