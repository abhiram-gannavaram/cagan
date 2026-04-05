import { BaseAgent } from './base.js';
export class CustomAgent extends BaseAgent {
    allowedTools = null;
    constructor(config) {
        const systemPrompt = config.customSystemPrompt || config.systemPrompt || `You are a custom agent configured by the user.`;
        super({ ...config, systemPrompt });
        if (config.allowedTools) {
            this.allowedTools = new Set(config.allowedTools);
        }
    }
    buildContext() {
        return [...this.messages];
    }
}
//# sourceMappingURL=custom.js.map