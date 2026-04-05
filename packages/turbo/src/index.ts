/**
 * index.ts — TurboQuant public API.
 *
 * TurboQuant is cagan's token efficiency engine.
 * It reduces API costs by 40–60% through:
 *   1. Prompt compression (removes redundant content before sending)
 *   2. Semantic response caching (avoids duplicate LLM calls)
 *   3. Token budget enforcement (blocks requests that exceed budget)
 *   4. Context window optimisation (sends only relevant file sections)
 *   5. Usage analytics (shows where tokens are being wasted)
 *
 * SECURITY: All processing is local. No data leaves the machine.
 * Cache is stored at ~/.cagan/cache/. Delete it anytime.
 */

export { PromptCompressor } from './compressor.js';
export type {
  CompressionLevel,
  CompressionOptions,
  CompressedResult,
  CompressedMessages
} from './compressor.js';

export { ResponseCache } from './cache.js';
export type { CacheMetadata, CachedResponse, CacheStats } from './cache.js';

export { TokenBudget } from './budget.js';
export type {
  BudgetOptions,
  BudgetCheckResult,
  BudgetStatus,
  ModelSuggestion
} from './budget.js';

export { ContextOptimiser } from './optimizer.js';
export type {
  IndexedFile,
  RelevantFile,
  RankedFile,
  OptimalContext,
  ContextUsageReport
} from './optimizer.js';

export { TokenAnalytics } from './analytics.js';
export type {
  SessionData,
  WasteReport,
  TokenBreakdown,
  ModeCostBreakdown,
  WastePattern,
  CostProjection
} from './analytics.js';

import type { Message } from '@cagan/core';
import { PromptCompressor } from './compressor.js';
import { ResponseCache } from './cache.js';
import { TokenBudget } from './budget.js';
import { ContextOptimiser } from './optimizer.js';
import { TokenAnalytics } from './analytics.js';
import type { BudgetOptions, CompressionLevel } from './index.js';

export interface TurboConfig {
  enabled: boolean;
  compressionLevel: CompressionLevel;
  cacheEnabled: boolean;
  cacheTtlDays: number;
  budget: BudgetOptions;
  contextOptimizer: boolean;
  maxContextFiles: number;
}

export const DEFAULT_TURBO_CONFIG: TurboConfig = {
  enabled: true,
  compressionLevel: 'medium',
  cacheEnabled: true,
  cacheTtlDays: 7,
  budget: {
    alertAtPercent: 80,
    blockAtPercent: 100
  },
  contextOptimizer: true,
  maxContextFiles: 20
};

/**
 * TurboQuant — unified entry point for all token efficiency features.
 * Instantiate once per session and pass to provider wrappers.
 */
export class TurboQuant {
  readonly compressor: PromptCompressor;
  readonly cache: ResponseCache;
  readonly budget: TokenBudget;
  readonly optimizer: ContextOptimiser;
  readonly analytics: TokenAnalytics;
  readonly config: TurboConfig;

  constructor(config: Partial<TurboConfig> = {}) {
    this.config = { ...DEFAULT_TURBO_CONFIG, ...config };
    this.compressor = new PromptCompressor();
    this.cache = new ResponseCache();
    this.budget = new TokenBudget();
    this.optimizer = new ContextOptimiser();
    this.analytics = new TokenAnalytics();

    if (this.config.budget) {
      this.budget.setBudget(this.config.budget);
    }
  }

  /**
   * Process messages before sending to the LLM provider.
   * Checks cache first, then compresses if cache miss.
   * NETWORK: if cache misses, the compressed messages are sent to the
   * user's configured LLM provider only — nowhere else.
   */
  async processMessages(messages: Message[], model?: string): Promise<{
    messages: Message[];
    cacheHit: boolean;
    cachedResponse?: string;
    originalTokens: number;
    compressedTokens: number;
  }> {
    if (!this.config.enabled) {
      return {
        messages,
        cacheHit: false,
        originalTokens: messages.reduce((s, m) => s + this.compressor.estimateTokens(m.content), 0),
        compressedTokens: messages.reduce((s, m) => s + this.compressor.estimateTokens(m.content), 0)
      };
    }

    // Check budget before proceeding
    const estimatedTokens = messages.reduce((s, m) => s + this.compressor.estimateTokens(m.content), 0);
    const budgetCheck = this.budget.wouldExceedBudget(estimatedTokens, model);
    if (!budgetCheck.allowed) {
      throw new Error(`Budget exceeded: ${budgetCheck.reason}. ${budgetCheck.suggestion ?? ''}`);
    }

    // Check cache
    if (this.config.cacheEnabled) {
      const hash = this.cache.hashPrompt(messages);
      const cached = await this.cache.get(hash);
      if (cached) {
        return {
          messages,
          cacheHit: true,
          cachedResponse: cached.response,
          originalTokens: estimatedTokens,
          compressedTokens: 0
        };
      }
    }

    // Compress
    const compressed = this.compressor.compress(messages, {
      maxTokens: 100_000,
      compressionLevel: this.config.compressionLevel,
      preserveLastN: 3
    });

    return {
      messages: compressed.messages,
      cacheHit: false,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens
    };
  }

  /**
   * Store a response in the local cache after a successful LLM call.
   * FILE WRITE: writes to ~/.cagan/cache/ on local disk only.
   */
  async cacheResponse(messages: Message[], response: string, metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
  }): Promise<void> {
    if (!this.config.cacheEnabled) return;
    const hash = this.cache.hashPrompt(messages);
    await this.cache.set(hash, response, {
      ...metadata,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.cacheTtlDays * 24 * 60 * 60 * 1000
    });
  }
}
