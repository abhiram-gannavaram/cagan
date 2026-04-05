import type { TokenUsage } from '../providers/types.js';
export interface CostEntry {
    timestamp: number;
    promptTokens: number;
    completionTokens: number;
    model: string;
    provider: string;
    costUsd: number;
}
export interface CostSummary {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    byModel: Record<string, {
        tokens: number;
        costUsd: number;
    }>;
    byProvider: Record<string, {
        tokens: number;
        costUsd: number;
    }>;
}
export interface ModelPricing {
    input: number;
    output: number;
}
export declare class CostTracker {
    private entries;
    private pricing;
    private sessionStart;
    private budgetAlertThreshold;
    private onBudgetAlert?;
    constructor(budgetAlertThreshold?: number);
    setPricing(model: string, pricing: ModelPricing): void;
    setBudgetAlert(threshold: number, callback: (spent: number, threshold: number) => void): void;
    recordUsage(usage: TokenUsage, model: string, provider: string): void;
    getSummary(): CostSummary;
    getEntries(): CostEntry[];
    getSessionDuration(): number;
    reset(): void;
    exportToCsv(): string;
}
export declare function getCostTracker(budgetAlertThreshold?: number): CostTracker;
//# sourceMappingURL=index.d.ts.map