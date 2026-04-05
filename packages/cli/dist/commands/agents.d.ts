export declare function agentsCommand(): Promise<void>;
export declare function registerAgent(agent: {
    id: string;
    mode: string;
    provider: string;
    model: string;
}): void;
export declare function unregisterAgent(id: string): void;
export declare function updateAgentCost(id: string, cost: number): void;
