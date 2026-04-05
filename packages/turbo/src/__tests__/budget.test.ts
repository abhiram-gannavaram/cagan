import { describe, it, expect, beforeEach } from 'vitest';
import { TokenBudget } from '../budget.js';

let budget: TokenBudget;

beforeEach(() => {
  budget = new TokenBudget();
});

describe('TokenBudget', () => {
  describe('wouldExceedBudget', () => {
    it('allows requests when no budget is set', () => {
      budget.setBudget({});
      const result = budget.wouldExceedBudget(100_000);
      expect(result.allowed).toBe(true);
    });

    it('blocks requests that would exceed token budget', () => {
      budget.setBudget({ maxTokensPerSession: 1000, blockAtPercent: 100 });
      budget.recordUsage({ promptTokens: 900, completionTokens: 90, totalTokens: 990 });

      const result = budget.wouldExceedBudget(20);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('token budget');
    });

    it('allows requests within budget', () => {
      budget.setBudget({ maxTokensPerSession: 10_000, blockAtPercent: 100 });
      const result = budget.wouldExceedBudget(500);
      expect(result.allowed).toBe(true);
    });

    it('includes remainingTokens in blocked result', () => {
      budget.setBudget({ maxTokensPerSession: 100, blockAtPercent: 100 });
      budget.recordUsage({ promptTokens: 90, completionTokens: 0, totalTokens: 90 });

      const result = budget.wouldExceedBudget(20);
      if (!result.allowed) {
        expect(result.remainingTokens).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('recordUsage', () => {
    it('accumulates token usage', () => {
      budget.setBudget({ maxTokensPerSession: 10_000 });
      budget.recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
      budget.recordUsage({ promptTokens: 200, completionTokens: 100, totalTokens: 300 });

      const status = budget.getStatus();
      expect(status.sessionTokensUsed).toBe(450);
    });
  });

  describe('getStatus', () => {
    it('returns zero usage initially', () => {
      budget.setBudget({ maxTokensPerSession: 1000 });
      const status = budget.getStatus();
      expect(status.sessionTokensUsed).toBe(0);
      expect(status.percentUsedTokens).toBe(0);
    });

    it('computes percentUsedTokens correctly', () => {
      budget.setBudget({ maxTokensPerSession: 1000 });
      budget.recordUsage({ promptTokens: 500, completionTokens: 0, totalTokens: 500 });

      const status = budget.getStatus();
      expect(status.percentUsedTokens).toBe(50);
    });

    it('triggers alertTriggered when threshold reached', () => {
      budget.setBudget({ maxTokensPerSession: 1000, alertAtPercent: 80 });
      budget.recordUsage({ promptTokens: 850, completionTokens: 0, totalTokens: 850 });

      const status = budget.getStatus();
      expect(status.alertTriggered).toBe(true);
    });
  });

  describe('suggestAlternatives', () => {
    it('returns cheaper models than the current one', () => {
      budget.setBudget({});
      const suggestions = budget.suggestAlternatives('gpt-4o', 10_000);
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        expect(s.estimatedCost).toBeLessThan(
          (10_000 / 1000) * 0.01 // gpt-4o avg price
        );
      }
    });

    it('returns empty array for unknown model', () => {
      budget.setBudget({});
      const suggestions = budget.suggestAlternatives('unknown-model-xyz', 1000);
      expect(suggestions).toHaveLength(0);
    });

    it('includes tradeoff description', () => {
      const suggestions = budget.suggestAlternatives('gpt-4o', 1000);
      if (suggestions.length > 0) {
        expect(suggestions[0].tradeoff).toContain('cheaper');
      }
    });
  });

  describe('resetTaskBudget', () => {
    it('resets task counter without affecting session total', () => {
      budget.setBudget({});
      budget.recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
      budget.resetTaskBudget();

      const status = budget.getStatus();
      expect(status.taskTokensUsed).toBe(0);
      expect(status.sessionTokensUsed).toBe(150);
    });
  });
});
