/**
 * optimizer.ts — Context window optimiser for TurboQuant.
 *
 * Selects the most relevant files and code sections for a given task,
 * keeping the prompt well within the token budget.
 * All processing is local — no files are sent anywhere except to the
 * user's configured LLM provider as part of the normal agent flow.
 */

import { PromptCompressor } from './compressor.js';

export interface IndexedFile {
  path: string;
  content: string;
  language: string;
  tokens: number;
}

export interface RelevantFile {
  file: IndexedFile;
  relevanceScore: number;
  reason: string;
}

export interface RankedFile {
  file: IndexedFile;
  score: number;
}

export interface OptimalContext {
  files: RelevantFile[];
  totalTokens: number;
  tokenBudgetUsed: number;
  truncated: boolean;
}

export interface ContextUsageReport {
  promptTokens: number;
  usedTokens: number;
  unusedPercent: number;
  suggestedWindowReduction: number;
}

const compressor = new PromptCompressor();

/**
 * ContextOptimiser — selects and trims file context to fit token budgets.
 * All file content stays local — never sent anywhere by this class.
 */
export class ContextOptimiser {
  /**
   * Select the top `maxFiles` most relevant files for a given task.
   * FILE READ: caller is responsible for reading files; this class only
   * receives already-read content via `indexedFiles`.
   */
  selectRelevantFiles(
    task: string,
    indexedFiles: IndexedFile[],
    maxFiles: number
  ): RelevantFile[] {
    const ranked = this.rankByRelevance(task, indexedFiles);
    return ranked.slice(0, maxFiles).map(r => ({
      file: r.file,
      relevanceScore: r.score,
      reason: this.explainRelevance(task, r.file)
    }));
  }

  /**
   * Extract only the relevant portion of a file for the given task.
   * Returns at most `windowLines` lines centred on the most relevant symbol.
   */
  extractRelevantSection(file: string, task: string, windowLines: number): string {
    const lines = file.split('\n');
    // Find the line with the highest token overlap with the task
    const taskTokens = tokenise(task);

    let bestScore = 0;
    let bestLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineTokens = tokenise(lines[i]);
      const overlap = intersection(taskTokens, lineTokens).size;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestLine = i;
      }
    }

    const half = Math.floor(windowLines / 2);
    const start = Math.max(0, bestLine - half);
    const end = Math.min(lines.length, bestLine + half);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Rank files by TF-IDF-style relevance score.
   * Higher score = more relevant to the task.
   */
  rankByRelevance(task: string, files: IndexedFile[]): RankedFile[] {
    const taskTokens = tokenise(task.toLowerCase());
    if (taskTokens.size === 0) {
      return files.map(f => ({ file: f, score: 0 }));
    }

    // Build IDF: how many files contain each term
    const df = new Map<string, number>();
    for (const term of taskTokens) {
      for (const file of files) {
        if (file.content.toLowerCase().includes(term)) {
          df.set(term, (df.get(term) ?? 0) + 1);
        }
      }
    }

    const N = files.length || 1;

    const scored = files.map(file => {
      const fileContent = file.content.toLowerCase();
      const fileTokens = tokenise(fileContent);
      let score = 0;

      for (const term of taskTokens) {
        const tf = countOccurrences(fileContent, term) / (fileTokens.size || 1);
        const idf = Math.log(N / ((df.get(term) ?? 0) + 1));
        score += tf * idf;
      }

      // Bonus for filename containing task keywords
      const filenameLower = file.path.toLowerCase();
      for (const term of taskTokens) {
        if (filenameLower.includes(term)) score += 0.5;
      }

      return { file, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Build the optimal context array that fits within `tokenBudget` tokens.
   * Files are added in relevance order until the budget is exhausted.
   */
  buildOptimalContext(task: string, files: IndexedFile[], tokenBudget: number): OptimalContext {
    const ranked = this.rankByRelevance(task, files);
    const selected: RelevantFile[] = [];
    let totalTokens = compressor.estimateTokens(task);
    let truncated = false;

    for (const { file, score } of ranked) {
      if (totalTokens + file.tokens > tokenBudget) {
        // Try to fit a truncated version of the file
        const availableLines = Math.floor(((tokenBudget - totalTokens) / file.tokens) * file.content.split('\n').length);
        if (availableLines > 10) {
          const truncatedContent = this.extractRelevantSection(file.content, task, availableLines);
          const truncatedTokens = compressor.estimateTokens(truncatedContent);
          selected.push({
            file: { ...file, content: truncatedContent, tokens: truncatedTokens },
            relevanceScore: score,
            reason: `Truncated to fit budget (${availableLines} lines)`
          });
          totalTokens += truncatedTokens;
          truncated = true;
        }
        break;
      }

      selected.push({
        file,
        relevanceScore: score,
        reason: this.explainRelevance(task, file)
      });
      totalTokens += file.tokens;
    }

    return {
      files: selected,
      totalTokens,
      tokenBudgetUsed: Math.round((totalTokens / tokenBudget) * 100),
      truncated
    };
  }

  /**
   * Analyse which parts of the context were actually referenced in the response.
   * Used to tune future context window sizes.
   */
  analyzeContextUsage(prompt: string, response: string): ContextUsageReport {
    const promptTokens = compressor.estimateTokens(prompt);
    const responseTokens = compressor.estimateTokens(response);

    // Estimate usage by checking if unique n-grams from prompt appear in response
    const promptNgrams = ngrams(prompt, 4);
    const responseText = response.toLowerCase();
    let usedNgrams = 0;
    for (const ng of promptNgrams) {
      if (responseText.includes(ng)) usedNgrams++;
    }

    const usageRate = promptNgrams.length > 0
      ? usedNgrams / promptNgrams.length
      : 0;

    const usedTokens = Math.round(promptTokens * usageRate);
    const unusedPercent = Math.round((1 - usageRate) * 100);

    return {
      promptTokens,
      usedTokens,
      unusedPercent,
      suggestedWindowReduction: unusedPercent > 30 ? Math.round(unusedPercent * 0.8) : 0
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private explainRelevance(task: string, file: IndexedFile): string {
    const taskTokens = tokenise(task.toLowerCase());
    const matches: string[] = [];
    for (const term of taskTokens) {
      if (file.content.toLowerCase().includes(term)) {
        matches.push(term);
      }
    }
    if (matches.length === 0) return 'Low relevance (filename match)';
    return `Matches: ${matches.slice(0, 5).join(', ')}`;
  }
}

// ── Token utilities ──────────────────────────────────────────────────────────

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  );
}

function intersection(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter(x => b.has(x)));
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) { count++; pos += term.length; }
  return count;
}

function ngrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const result: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    result.push(words.slice(i, i + n).join(' '));
  }
  return result;
}
