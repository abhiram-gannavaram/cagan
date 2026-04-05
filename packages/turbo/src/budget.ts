/**
 * budget.ts — Token budget enforcer for TurboQuant.
 *
 * Tracks token consumption against user-configured limits.
 * Blocks requests that would exceed the budget and suggests cheaper alternatives.
 * All tracking is in-memory — nothing is sent to any server.
 */

import type { TokenUsage } from '@cagan/core';

export interface BudgetOptions {
  maxTokensPerSession?: number;
  maxUsdPerSession?: number;
  maxTokensPerTask?: number;
  /** Alert (warn) when this percentage of budget is consumed */
  alertAtPercent?: number;
  /** Hard block requests when this percentage is consumed */
  blockAtPercent?: number;
  /** Switch to this model when budget is running low */
  fallbackModel?: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  suggestion?: string;
  remainingTokens?: number;
  remainingUsd?: number;
}

export interface BudgetStatus {
  sessionTokensUsed: number;
  sessionUsdUsed: number;
  taskTokensUsed: number;
  budgetOptions: BudgetOptions;
  alertTriggered: boolean;
  blockTriggered: boolean;
  percentUsedTokens: number;
  percentUsedUsd: number;
}

export interface ModelSuggestion {
  model: string;
  provider: string;
  estimatedCost: number;
  tradeoff: string;
}

/** Well-known model pricing (USD per 1K tokens, input/output average). Kept local. */
const MODEL_PRICING: Record<string, { input: number; output: number; provider: string }> = {
  'gpt-4o':            { input: 0.005, output: 0.015, provider: 'openai' },
  'gpt-4o-mini':       { input: 0.00015, output: 0.0006, provider: 'openai' },
  'gpt-3.5-turbo':     { input: 0.0005, output: 0.0015, provider: 'openai' },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015, provider: 'anthropic' },
  'claude-3-haiku':    { input: 0.00025, output: 0.00125, provider: 'anthropic' },
  'deepseek-chat':     { input: 0.00014, output: 0.00028, provider: 'deepseek' },
  'deepseek-coder':    { input: 0.00014, output: 0.00028, provider: 'deepseek' },
  'llama3-70b-8192':   { input: 0.00059, output: 0.00079, provider: 'groq' },
  'llama3-8b-8192':    { input: 0.00005, output: 0.00008, provider: 'groq' },
  'MiniMax-Text-01':   { input: 0.0002, output: 0.0006, provider: 'minimax' },
  'gemini-1.5-flash':  { input: 0.000075, output: 0.0003, provider: 'gemini' },
  'gemini-1.5-pro':    { input: 0.00125, output: 0.005, provider: 'gemini' },
};

/**
 * TokenBudget — enforces per-session and per-task token/cost limits.
 * Tracks usage in-memory. Resets on construction.
 */
export class TokenBudget {
  private options: BudgetOptions = {};
  private sessionTokensUsed = 0;
  private sessionUsdUsed = 0;
  private taskTokensUsed = 0;
  private alertTriggered = false;
  private blockTriggered = false;

  setBudget(options: BudgetOptions): void {
    this.options = { alertAtPercent: 80, blockAtPercent: 100, ...options };
  }

  /**
   * Check whether a proposed request would exceed the budget.
   * Returns { allowed: false } with a human-readable reason if blocked.
   */
  wouldExceedBudget(estimatedTokens: number, currentModel?: string): BudgetCheckResult {
    const priceInfo = currentModel ? MODEL_PRICING[currentModel] : undefined;
    const estimatedUsd = priceInfo
      ? (estimatedTokens / 1000) * ((priceInfo.input + priceInfo.output) / 2)
      : 0;

    // Check token-based limit
    if (this.options.maxTokensPerSession) {
      const newTotal = this.sessionTokensUsed + estimatedTokens;
      const pct = (newTotal / this.options.maxTokensPerSession) * 100;
      const blockAt = this.options.blockAtPercent ?? 100;

      if (pct >= blockAt) {
        return {
          allowed: false,
          reason: `Session token budget exhausted (${newTotal.toLocaleString()} / ${this.options.maxTokensPerSession.toLocaleString()} tokens)`,
          suggestion: this.options.fallbackModel
            ? `Switch to ${this.options.fallbackModel} which uses fewer tokens per request`
            : 'Consider reducing context size or starting a new session',
          remainingTokens: Math.max(0, this.options.maxTokensPerSession - this.sessionTokensUsed)
        };
      }
    }

    // Check USD-based limit
    if (this.options.maxUsdPerSession) {
      const newTotal = this.sessionUsdUsed + estimatedUsd;
      const pct = (newTotal / this.options.maxUsdPerSession) * 100;
      const blockAt = this.options.blockAtPercent ?? 100;

      if (pct >= blockAt) {
        return {
          allowed: false,
          reason: `Session cost budget exhausted ($${newTotal.toFixed(4)} / $${this.options.maxUsdPerSession.toFixed(2)})`,
          suggestion: this.options.fallbackModel
            ? `Switch to ${this.options.fallbackModel} to reduce costs`
            : 'Increase budget or start a new session',
          remainingUsd: Math.max(0, this.options.maxUsdPerSession - this.sessionUsdUsed)
        };
      }
    }

    return { allowed: true };
  }

  /** Record actual token usage after a request completes. */
  recordUsage(usage: TokenUsage, model?: string): void {
    this.sessionTokensUsed += usage.totalTokens;
    this.taskTokensUsed += usage.totalTokens;

    const priceInfo = model ? MODEL_PRICING[model] : undefined;
    if (priceInfo) {
      this.sessionUsdUsed +=
        (usage.promptTokens / 1000) * priceInfo.input +
        (usage.completionTokens / 1000) * priceInfo.output;
    }

    // Check alert threshold
    if (!this.alertTriggered && this.options.maxTokensPerSession && this.options.alertAtPercent) {
      const pct = (this.sessionTokensUsed / this.options.maxTokensPerSession) * 100;
      if (pct >= this.options.alertAtPercent) {
        this.alertTriggered = true;
      }
    }
  }

  /** Reset the per-task counter (call at the start of each new task). */
  resetTaskBudget(): void {
    this.taskTokensUsed = 0;
  }

  getStatus(): BudgetStatus {
    const percentUsedTokens = this.options.maxTokensPerSession
      ? Math.round((this.sessionTokensUsed / this.options.maxTokensPerSession) * 100)
      : 0;
    const percentUsedUsd = this.options.maxUsdPerSession
      ? Math.round((this.sessionUsdUsed / this.options.maxUsdPerSession) * 100)
      : 0;

    return {
      sessionTokensUsed: this.sessionTokensUsed,
      sessionUsdUsed: this.sessionUsdUsed,
      taskTokensUsed: this.taskTokensUsed,
      budgetOptions: this.options,
      alertTriggered: this.alertTriggered,
      blockTriggered: this.blockTriggered,
      percentUsedTokens,
      percentUsedUsd
    };
  }

  /**
   * Suggest cheaper model alternatives when budget is running low.
   * Only returns models cheaper than `currentModel`.
   */
  suggestAlternatives(currentModel: string, tokensNeeded: number): ModelSuggestion[] {
    const current = MODEL_PRICING[currentModel];
    if (!current) return [];

    const currentAvgPrice = (current.input + current.output) / 2;
    const currentCost = (tokensNeeded / 1000) * currentAvgPrice;

    return Object.entries(MODEL_PRICING)
      .filter(([name, info]) => {
        const avgPrice = (info.input + info.output) / 2;
        return name !== currentModel && avgPrice < currentAvgPrice;
      })
      .map(([name, info]) => {
        const avgPrice = (info.input + info.output) / 2;
        const estimatedCost = (tokensNeeded / 1000) * avgPrice;
        const savingsPct = Math.round((1 - estimatedCost / currentCost) * 100);
        return {
          model: name,
          provider: info.provider,
          estimatedCost,
          tradeoff: `~${savingsPct}% cheaper than ${currentModel}; quality may vary for complex tasks`
        };
      })
      .sort((a, b) => a.estimatedCost - b.estimatedCost)
      .slice(0, 3);
  }
}
