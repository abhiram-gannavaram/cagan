/**
 * analytics.ts — Token usage visualiser for TurboQuant.
 *
 * Generates waste reports and cost projections from local session data.
 * All analytics are computed locally — no data is sent anywhere.
 */

export interface SessionData {
  id: string;
  mode: string;
  startedAt: number;
  endedAt?: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  model: string;
  provider: string;
  compressionSavings: number; // tokens saved by TurboQuant compression
}

export interface WasteReport {
  totalSessions: number;
  totalTokensSpent: number;
  totalTokensWasted: number;
  wastePercent: number;
  patterns: WastePattern[];
  topWastefulSessions: SessionData[];
  estimatedSavingsWithTurbo: number;
}

export interface TokenBreakdown {
  sessionId: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  compressionSavingsTokens: number;
  compressionSavingsPercent: number;
}

export interface ModeCostBreakdown {
  byMode: Record<string, { tokens: number; costUsd: number; sessions: number }>;
  mostExpensiveMode: string;
  cheapestMode: string;
}

export interface WastePattern {
  pattern: string;
  description: string;
  affectedSessions: number;
  wastedTokens: number;
  recommendation: string;
}

export interface CostProjection {
  dailyTokens: number;
  dailyCostUsd: number;
  monthlyCostUsd: number;
  yearlyCostUsd: number;
  withTurboMonthlyCostUsd: number;
  turbySavingsPercent: number;
}

/** Approximate USD cost per 1K tokens (blended input+output average) */
const COST_PER_1K: Record<string, number> = {
  'gpt-4o': 0.01,
  'gpt-4o-mini': 0.000375,
  'gpt-3.5-turbo': 0.001,
  'claude-3-5-sonnet': 0.009,
  'claude-3-haiku': 0.000875,
  'deepseek-chat': 0.00021,
  'deepseek-coder': 0.00021,
  'llama3-70b-8192': 0.00069,
  'llama3-8b-8192': 0.0000625,
  'MiniMax-Text-01': 0.0004,
  'gemini-1.5-flash': 0.0001875,
  'gemini-1.5-pro': 0.003125,
};

/**
 * TokenAnalytics — local analytics engine.
 * Reads from provided SessionData arrays — no external data sources.
 */
export class TokenAnalytics {
  /** Produce a waste report showing where tokens are being spent inefficiently. */
  generateWasteReport(sessions: SessionData[]): WasteReport {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalTokensSpent: 0,
        totalTokensWasted: 0,
        wastePercent: 0,
        patterns: [],
        topWastefulSessions: [],
        estimatedSavingsWithTurbo: 0
      };
    }

    const totalTokensSpent = sessions.reduce(
      (s, sess) => s + sess.promptTokens + sess.completionTokens, 0
    );
    const patterns = this.identifyWastePatterns(sessions);
    const totalTokensWasted = patterns.reduce((s, p) => s + p.wastedTokens, 0);
    const estimatedSavingsWithTurbo = sessions.reduce(
      (s, sess) => s + sess.compressionSavings, 0
    );

    const topWastefulSessions = [...sessions]
      .sort((a, b) => (b.promptTokens + b.completionTokens) - (a.promptTokens + a.completionTokens))
      .slice(0, 5);

    return {
      totalSessions: sessions.length,
      totalTokensSpent,
      totalTokensWasted,
      wastePercent: totalTokensSpent > 0
        ? Math.round((totalTokensWasted / totalTokensSpent) * 100)
        : 0,
      patterns,
      topWastefulSessions,
      estimatedSavingsWithTurbo
    };
  }

  /** Break down token usage for a single session. */
  getTokenBreakdown(sessions: SessionData[], sessionId: string): TokenBreakdown | null {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const totalTokens = session.promptTokens + session.completionTokens;
    const costPer1K = COST_PER_1K[session.model] ?? 0.001;
    const estimatedCostUsd = (totalTokens / 1000) * costPer1K;
    const compressionSavingsPercent = totalTokens > 0
      ? Math.round((session.compressionSavings / (totalTokens + session.compressionSavings)) * 100)
      : 0;

    return {
      sessionId,
      promptTokens: session.promptTokens,
      completionTokens: session.completionTokens,
      cachedTokens: session.cachedTokens,
      totalTokens,
      estimatedCostUsd,
      compressionSavingsTokens: session.compressionSavings,
      compressionSavingsPercent
    };
  }

  /** Show cost breakdown grouped by agent mode. */
  getCostByMode(sessions: SessionData[]): ModeCostBreakdown {
    const byMode: Record<string, { tokens: number; costUsd: number; sessions: number }> = {};

    for (const session of sessions) {
      const mode = session.mode || 'unknown';
      const tokens = session.promptTokens + session.completionTokens;
      const costPer1K = COST_PER_1K[session.model] ?? 0.001;
      const cost = (tokens / 1000) * costPer1K;

      if (!byMode[mode]) byMode[mode] = { tokens: 0, costUsd: 0, sessions: 0 };
      byMode[mode].tokens += tokens;
      byMode[mode].costUsd += cost;
      byMode[mode].sessions++;
    }

    const modes = Object.entries(byMode);
    const mostExpensiveMode = modes.sort((a, b) => b[1].costUsd - a[1].costUsd)[0]?.[0] ?? 'none';
    const cheapestMode = modes.sort((a, b) => a[1].costUsd - b[1].costUsd)[0]?.[0] ?? 'none';

    return { byMode, mostExpensiveMode, cheapestMode };
  }

  /** Identify recurring waste patterns in session data. */
  identifyWastePatterns(sessions: SessionData[]): WastePattern[] {
    const patterns: WastePattern[] = [];

    // Pattern 1: High prompt/completion ratio (too much context)
    const highRatioSessions = sessions.filter(
      s => s.promptTokens > 0 && s.completionTokens / s.promptTokens < 0.1
    );
    if (highRatioSessions.length > 0) {
      const wastedTokens = highRatioSessions.reduce(
        (s, sess) => s + Math.max(0, sess.promptTokens - sess.completionTokens * 10), 0
      );
      patterns.push({
        pattern: 'oversized_context',
        description: 'Prompts are much larger than responses — context may be over-provided',
        affectedSessions: highRatioSessions.length,
        wastedTokens,
        recommendation: 'Enable context_optimizer in turbo config to auto-trim irrelevant files'
      });
    }

    // Pattern 2: No cache hits despite similar requests
    const noCacheSessions = sessions.filter(s => s.cachedTokens === 0);
    if (noCacheSessions.length > sessions.length * 0.7) {
      patterns.push({
        pattern: 'low_cache_hit_rate',
        description: 'Cache hit rate is below 30% — similar requests are not being reused',
        affectedSessions: noCacheSessions.length,
        wastedTokens: noCacheSessions.reduce((s, sess) => s + sess.promptTokens * 0.1, 0),
        recommendation: 'Increase cache_ttl_days in turbo config or check that cache is enabled'
      });
    }

    // Pattern 3: Compression not applied
    const noCompressionSessions = sessions.filter(s => s.compressionSavings === 0);
    if (noCompressionSessions.length > 3) {
      patterns.push({
        pattern: 'no_compression',
        description: 'TurboQuant compression is not reducing token counts',
        affectedSessions: noCompressionSessions.length,
        wastedTokens: noCompressionSessions.reduce(
          (s, sess) => s + Math.round((sess.promptTokens + sess.completionTokens) * 0.3), 0
        ),
        recommendation: 'Set compression_level to "medium" or "aggressive" in turbo config'
      });
    }

    return patterns;
  }

  /** Project monthly cost at the current daily usage rate. */
  projectMonthlyCost(dailyTokens: number, costPerToken: number): CostProjection {
    const dailyCostUsd = dailyTokens * costPerToken;
    const monthlyCostUsd = dailyCostUsd * 30;
    const yearlyCostUsd = dailyCostUsd * 365;
    const turboSavingsPct = 40; // Conservative estimate: TurboQuant saves ~40% on average
    const withTurboMonthlyCostUsd = monthlyCostUsd * (1 - turboSavingsPct / 100);

    return {
      dailyTokens,
      dailyCostUsd,
      monthlyCostUsd,
      yearlyCostUsd,
      withTurboMonthlyCostUsd,
      turbySavingsPercent: turboSavingsPct
    };
  }

  /** Format a waste report as a human-readable string for CLI output. */
  formatWasteReport(report: WasteReport): string {
    const lines: string[] = [
      '┌─ TurboQuant Analytics Report ─────────────────────────────────┐',
      `│  Sessions analysed : ${report.totalSessions}`,
      `│  Total tokens spent: ${report.totalTokensSpent.toLocaleString()}`,
      `│  Waste identified  : ${report.totalTokensWasted.toLocaleString()} tokens (${report.wastePercent}%)`,
      `│  Turbo saved       : ${report.estimatedSavingsWithTurbo.toLocaleString()} tokens`,
      '├────────────────────────────────────────────────────────────────┤',
      '│  Waste Patterns:',
    ];

    for (const p of report.patterns) {
      lines.push(`│  • ${p.pattern}: ${p.description}`);
      lines.push(`│    → ${p.recommendation}`);
    }

    if (report.patterns.length === 0) {
      lines.push('│  No significant waste patterns detected.');
    }

    lines.push('└────────────────────────────────────────────────────────────────┘');
    return lines.join('\n');
  }
}
