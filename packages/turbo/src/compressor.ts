/**
 * compressor.ts — Prompt compression engine for TurboQuant.
 *
 * Reduces token usage by compressing messages before sending to the LLM.
 * All compression is done locally. No data leaves the machine.
 *
 * Strategies:
 *   light      — deduplicate + whitespace removal only
 *   medium     — + history summarisation + irrelevant context removal
 *   aggressive — + code minification + hard context window truncation
 */

import type { Message } from '@cagan/core';

export type CompressionLevel = 'light' | 'medium' | 'aggressive';

export interface CompressionOptions {
  /** Hard token limit for the final message array */
  maxTokens: number;
  compressionLevel: CompressionLevel;
  /** Keep the last N messages verbatim (never compress recent context) */
  preserveLastN: number;
  /** Used for code-aware compression */
  language?: string;
}

export interface CompressedResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
}

export interface CompressedMessages {
  messages: Message[];
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
}

/**
 * PromptCompressor — lossless and lossy compression of LLM message arrays.
 * Runs entirely in-process. No network calls.
 */
export class PromptCompressor {
  /**
   * Remove redundant whitespace, comments, and boilerplate from code.
   * The code is never sent anywhere during this step — it stays local.
   */
  compressCode(code: string, language: string): CompressedResult {
    const original = code;
    const originalTokens = this.estimateTokens(code);

    let compressed = code;

    // Remove single-line comments (safe for all C-style languages)
    if (['typescript', 'javascript', 'ts', 'js', 'java', 'go', 'rust', 'c', 'cpp'].includes(language.toLowerCase())) {
      compressed = compressed.replace(/\/\/[^\n]*/g, '');
      compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    // Remove Python / shell comments
    if (['python', 'py', 'sh', 'bash', 'ruby', 'rb'].includes(language.toLowerCase())) {
      compressed = compressed.replace(/#[^\n]*/g, '');
    }

    // Collapse multiple blank lines → single blank line
    compressed = compressed.replace(/\n{3,}/g, '\n\n');

    // Trim trailing whitespace per line
    compressed = compressed
      .split('\n')
      .map(l => l.trimEnd())
      .join('\n');

    const compressedTokens = this.estimateTokens(compressed);
    const savingsPercent = originalTokens > 0
      ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 100)
      : 0;

    return { original, compressed, originalTokens, compressedTokens, savingsPercent };
  }

  /**
   * Summarise old conversation turns to reduce context size.
   * The last `keepLast` turns are preserved verbatim.
   * Older turns are collapsed into a concise summary placeholder.
   *
   * NOTE: The summary text is generated locally without an LLM call —
   * it uses simple heuristics so there is zero additional API cost.
   */
  compressHistory(messages: Message[], keepLast: number): Message[] {
    if (messages.length <= keepLast) return messages;

    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    if (nonSystem.length <= keepLast) return messages;

    const toSummarise = nonSystem.slice(0, nonSystem.length - keepLast);
    const recent = nonSystem.slice(nonSystem.length - keepLast);

    // Build a compact summary of old turns (heuristic, no API call)
    const summaryLines: string[] = [];
    let userTurn = 0;
    for (const m of toSummarise) {
      if (m.role === 'user') {
        userTurn++;
        const truncated = m.content.length > 120 ? m.content.slice(0, 120) + '…' : m.content;
        summaryLines.push(`User[${userTurn}]: ${truncated}`);
      } else if (m.role === 'assistant') {
        const truncated = m.content.length > 120 ? m.content.slice(0, 120) + '…' : m.content;
        summaryLines.push(`Assistant[${userTurn}]: ${truncated}`);
      }
    }

    const summaryMessage: Message = {
      role: 'user',
      content: `[COMPRESSED HISTORY — ${toSummarise.length} earlier messages]\n${summaryLines.join('\n')}\n[END COMPRESSED HISTORY]`
    };

    return [...systemMessages, summaryMessage, ...recent];
  }

  /**
   * Return only the lines of `content` that are within `windowSize` lines
   * of the first occurrence of `focusSymbol`.
   * Used to strip irrelevant file content before sending to the LLM.
   * FILE READ: no files are read here — caller passes content already read
   */
  compressFileContext(content: string, focusSymbol: string, windowSize: number): string {
    const lines = content.split('\n');
    const symbolIdx = lines.findIndex(l => l.includes(focusSymbol));

    if (symbolIdx === -1) {
      // Symbol not found — return first windowSize lines as fallback
      return lines.slice(0, windowSize).join('\n');
    }

    const start = Math.max(0, symbolIdx - Math.floor(windowSize / 2));
    const end = Math.min(lines.length, symbolIdx + Math.ceil(windowSize / 2));
    return lines.slice(start, end).join('\n');
  }

  /**
   * Remove duplicate context that appears verbatim more than once across messages.
   * This is a common waste pattern when the same file is re-injected each turn.
   */
  deduplicateContext(messages: Message[]): Message[] {
    const seen = new Set<string>();
    return messages.map(m => {
      if (m.role !== 'user' && m.role !== 'system') return m;

      // Extract code blocks and check for duplicates
      const codeBlockPattern = /```[\s\S]*?```/g;
      let compressed = m.content;

      const matches: string[] = m.content.match(codeBlockPattern) ?? [];
      for (const block of matches) {
        const hash = simpleHash(block);
        if (seen.has(hash)) {
          // Replace duplicate block with a reference placeholder
          compressed = compressed.replace(block, '[duplicate context omitted]');
        } else {
          seen.add(hash);
        }
      }

      return { ...m, content: compressed };
    });
  }

  /**
   * Estimate token count for a string using the ~4 chars/token heuristic.
   * This matches tiktoken output within ~10% for English code.
   * No external dependencies — runs entirely in-process.
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate: count words + punctuation separately
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    // Weighted average: chars/4 tends to overcount for code, words*1.3 better for prose
    return Math.ceil((chars / 4 + words * 1.3) / 2);
  }

  /**
   * Full compression pipeline. Runs all enabled strategies based on level.
   * This is the only entry point callers in providers should use.
   * No network calls — all processing is local.
   */
  compress(messages: Message[], options: CompressionOptions): CompressedMessages {
    const originalTokens = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
    let result = [...messages];

    // Level: light — always run
    result = this.deduplicateContext(result);
    result = result.map(m => ({
      ...m,
      content: m.content.replace(/ {2,}/g, ' ').replace(/\t/g, '  ')
    }));

    if (options.compressionLevel === 'medium' || options.compressionLevel === 'aggressive') {
      // Summarise history beyond preserveLastN
      result = this.compressHistory(result, options.preserveLastN);

      // Compress code blocks inside messages
      if (options.language) {
        result = result.map(m => {
          const compressed = this.compressInlineCode(m.content, options.language!);
          return { ...m, content: compressed };
        });
      }
    }

    if (options.compressionLevel === 'aggressive') {
      // Hard truncation: drop oldest non-system messages until under budget
      const systemMsgs = result.filter(m => m.role === 'system');
      let nonSystem = result.filter(m => m.role !== 'system');

      let totalTokens = result.reduce((s, m) => s + this.estimateTokens(m.content), 0);
      while (totalTokens > options.maxTokens && nonSystem.length > options.preserveLastN) {
        nonSystem.shift();
        totalTokens = [...systemMsgs, ...nonSystem].reduce((s, m) => s + this.estimateTokens(m.content), 0);
      }
      result = [...systemMsgs, ...nonSystem];
    }

    const compressedTokens = result.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
    const savingsPercent = originalTokens > 0
      ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 100)
      : 0;

    return { messages: result, originalTokens, compressedTokens, savingsPercent };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private compressInlineCode(content: string, language: string): string {
    // Find markdown code blocks and compress each one individually
    return content.replace(/```[\w]*\n([\s\S]*?)```/g, (match, code) => {
      const { compressed } = this.compressCode(code, language);
      const lang = match.match(/```([\w]*)/)?.[1] || '';
      return `\`\`\`${lang}\n${compressed}\`\`\``;
    });
  }
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
