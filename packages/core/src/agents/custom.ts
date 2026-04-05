import { BaseAgent, type AgentConfig } from './base.js';

export interface CustomAgentConfig extends AgentConfig {
  customSystemPrompt: string;
  allowedTools?: string[];
}

export class CustomAgent extends BaseAgent {
  private allowedTools: Set<string> | null = null;

  constructor(config: CustomAgentConfig) {
    const systemPrompt = config.customSystemPrompt || config.systemPrompt || `You are a custom agent configured by the user.`;

    super({ ...config, systemPrompt });

    if (config.allowedTools) {
      this.allowedTools = new Set(config.allowedTools);
    }
  }

  protected override buildContext(): import('../providers/types.js').Message[] {
    return [...this.messages];
  }
}