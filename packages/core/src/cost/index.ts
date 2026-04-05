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
  byModel: Record<string, { tokens: number; costUsd: number }>;
  byProvider: Record<string, { tokens: number; costUsd: number }>;
}

export interface ModelPricing {
  input: number;
  output: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private pricing: Record<string, ModelPricing> = {
    'default': { input: 0.001, output: 0.003 }
  };
  private sessionStart: number;
  private budgetAlertThreshold: number | null = null;
  private onBudgetAlert?: (spent: number, threshold: number) => void;

  constructor(budgetAlertThreshold?: number) {
    this.sessionStart = Date.now();
    if (budgetAlertThreshold) {
      this.budgetAlertThreshold = budgetAlertThreshold;
    }
  }

  setPricing(model: string, pricing: ModelPricing): void {
    this.pricing[model] = pricing;
  }

  setBudgetAlert(threshold: number, callback: (spent: number, threshold: number) => void): void {
    this.budgetAlertThreshold = threshold;
    this.onBudgetAlert = callback;
  }

  recordUsage(usage: TokenUsage, model: string, provider: string): void {
    const modelPricing = this.pricing[model] || this.pricing['default'];
    const costUsd = (usage.promptTokens * modelPricing.input + usage.completionTokens * modelPricing.output) / 1000;

    const entry: CostEntry = {
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

  getSummary(): CostSummary {
    let totalPrompt = 0;
    let totalCompletion = 0;
    const byModel: CostSummary['byModel'] = {};
    const byProvider: CostSummary['byProvider'] = {};

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

  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  getSessionDuration(): number {
    return Date.now() - this.sessionStart;
  }

  reset(): void {
    this.entries = [];
    this.sessionStart = Date.now();
  }

  exportToCsv(): string {
    const headers = 'Timestamp,Provider,Model,PromptTokens,CompletionTokens,TotalTokens,CostUSD\n';
    const rows = this.entries.map(e => 
      `${new Date(e.timestamp).toISOString()},${e.provider},${e.model},${e.promptTokens},${e.completionTokens},${e.promptTokens + e.completionTokens},${e.costUsd.toFixed(6)}`
    ).join('\n');
    return headers + rows;
  }
}

let globalCostTracker: CostTracker | null = null;

export function getCostTracker(budgetAlertThreshold?: number): CostTracker {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker(budgetAlertThreshold);
  }
  return globalCostTracker;
}