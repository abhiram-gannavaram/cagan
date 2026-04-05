import { BaseAgent, type AgentConfig } from './base.js';
export declare class CodeAgent extends BaseAgent {
    constructor(config: AgentConfig);
    run(task: string): AsyncGenerator<{
        type: string;
        data: unknown;
    }, void, any>;
}
//# sourceMappingURL=code.d.ts.map