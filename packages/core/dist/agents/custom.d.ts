import { BaseAgent, type AgentConfig } from './base.js';
export interface CustomAgentConfig extends AgentConfig {
    customSystemPrompt: string;
    allowedTools?: string[];
}
export declare class CustomAgent extends BaseAgent {
    private allowedTools;
    constructor(config: CustomAgentConfig);
    protected buildContext(): import('../providers/types.js').Message[];
}
//# sourceMappingURL=custom.d.ts.map