interface AgentOptions {
    mode: string;
    provider?: string;
    model?: string;
}
export declare function agentCommand(task: string, options: AgentOptions): Promise<void>;
export {};
