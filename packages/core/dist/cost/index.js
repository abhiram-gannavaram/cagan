export class CostTracker {
    entries = [];
    pricing = {
        'default': { input: 0.001, output: 0.003 }
    };
    sessionStart;
    budgetAlertThreshold = null;
    onBudgetAlert;
    constructor(budgetAlertThreshold) {
        this.sessionStart = Date.now();
        if (budgetAlertThreshold) {
            this.budgetAlertThreshold = budgetAlertThreshold;
        }
    }
    setPricing(model, pricing) {
        this.pricing[model] = pricing;
    }
    setBudgetAlert(threshold, callback) {
        this.budgetAlertThreshold = threshold;
        this.onBudgetAlert = callback;
    }
    recordUsage(usage, model, provider) {
        const modelPricing = this.pricing[model] || this.pricing['default'];
        const costUsd = (usage.promptTokens * modelPricing.input + usage.completionTokens * modelPricing.output) / 1000;
        const entry = {
            timestamp: Date.now(),
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            model,
            provider,
            costUsd
        };
        this.entries.push(entry);
        if (this.budgetAlertThreshold && this.onBudgetAlert) {
            const total = this.getSummary().totalCostUsd;
            if (total >= this.budgetAlertThreshold) {
                this.onBudgetAlert(total, this.budgetAlertThreshold);
            }
        }
    }
    getSummary() {
        let totalPrompt = 0;
        let totalCompletion = 0;
        const byModel = {};
        const byProvider = {};
        for (const entry of this.entries) {
            totalPrompt += entry.promptTokens;
            totalCompletion += entry.completionTokens;
            if (!byModel[entry.model]) {
                byModel[entry.model] = { tokens: 0, costUsd: 0 };
            }
            byModel[entry.model].tokens += entry.promptTokens + entry.completionTokens;
            byModel[entry.model].costUsd += entry.costUsd;
            if (!byProvider[entry.provider]) {
                byProvider[entry.provider] = { tokens: 0, costUsd: 0 };
            }
            byProvider[entry.provider].tokens += entry.promptTokens + entry.completionTokens;
            byProvider[entry.provider].costUsd += entry.costUsd;
        }
        return {
            totalPromptTokens: totalPrompt,
            totalCompletionTokens: totalCompletion,
            totalTokens: totalPrompt + totalCompletion,
            totalCostUsd: this.entries.reduce((sum, e) => sum + e.costUsd, 0),
            byModel,
            byProvider
        };
    }
    getEntries() {
        return [...this.entries];
    }
    getSessionDuration() {
        return Date.now() - this.sessionStart;
    }
    reset() {
        this.entries = [];
        this.sessionStart = Date.now();
    }
    exportToCsv() {
        const headers = 'Timestamp,Provider,Model,PromptTokens,CompletionTokens,TotalTokens,CostUSD\n';
        const rows = this.entries.map(e => `${new Date(e.timestamp).toISOString()},${e.provider},${e.model},${e.promptTokens},${e.completionTokens},${e.promptTokens + e.completionTokens},${e.costUsd.toFixed(6)}`).join('\n');
        return headers + rows;
    }
}
let globalCostTracker = null;
export function getCostTracker(budgetAlertThreshold) {
    if (!globalCostTracker) {
        globalCostTracker = new CostTracker(budgetAlertThreshold);
    }
    return globalCostTracker;
}
//# sourceMappingURL=index.js.map