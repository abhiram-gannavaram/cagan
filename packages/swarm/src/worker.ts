/**
 * worker.ts — Individual swarm worker agent.
 *
 * Each worker executes a single SwarmTask using the appropriate agent mode.
 * Workers share the same configured LLM provider.
 * NETWORK: sends to user's configured LLM provider only.
 * FILE READ: checks .caganignore before reading any files.
 */

import type { LLMProvider } from '@cagan/core';
import type { SwarmTask, TaskResult, WorkerContext } from './types.js';

export class SwarmWorker {
  private readonly agentId: string;
  private progressCallback?: (progress: number, message: string) => void;

  constructor(
    private readonly provider: LLMProvider,
    private readonly model: string
  ) {
    this.agentId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  onProgress(cb: (progress: number, message: string) => void): void {
    this.progressCallback = cb;
  }

  /**
   * Execute a single SwarmTask.
   * NETWORK: sends task prompt + context to user's configured LLM provider only.
   */
  async execute(task: SwarmTask, context: WorkerContext): Promise<TaskResult> {
    const startedAt = Date.now();
    this.report(0, `Starting: ${task.description}`);

    const systemPrompt = this.buildSystemPrompt(task);
    const userPrompt = this.buildUserPrompt(task, context);

    this.report(20, 'Sending to LLM provider…');

    let responseContent = '';
    let tokensUsed = 0;

    try {
      // NETWORK: sends to user's configured LLM provider only
      const response = await this.provider.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        { model: this.model, temperature: 0.3, maxTokens: 4096 }
      );

      responseContent = response.choices[0]?.message?.content ?? '';
      tokensUsed = response.usage?.totalTokens ?? 0;
      this.report(80, 'Processing response…');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        taskId: task.id,
        success: false,
        output: `Worker ${this.agentId} failed: ${message}`,
        filesModified: [],
        tokensUsed: 0,
        durationMs: Date.now() - startedAt
      };
    }

    const filesModified = this.extractFilePaths(responseContent, task.outputs);
    this.report(100, 'Complete');

    return {
      taskId: task.id,
      success: true,
      output: responseContent,
      filesModified,
      tokensUsed,
      durationMs: Date.now() - startedAt
    };
  }

  /**
   * Build context string from results of dependency tasks.
   * Only includes outputs from tasks this task declared as dependencies.
   */
  buildContextFromDependencies(
    task: SwarmTask,
    completedResults: Map<string, TaskResult>
  ): string {
    const parts: string[] = [];

    for (const depId of task.dependencies) {
      const result = completedResults.get(depId);
      if (!result) continue;

      parts.push(`=== Output from task "${depId}" ===`);
      if (result.filesModified.length > 0) {
        parts.push(`Files modified: ${result.filesModified.join(', ')}`);
      }
      // Include a truncated summary of the dependency's output (max 500 chars)
      const truncated = result.output.length > 500
        ? result.output.slice(0, 500) + '\n… [truncated]'
        : result.output;
      parts.push(truncated);
      parts.push('');
    }

    return parts.join('\n');
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildSystemPrompt(task: SwarmTask): string {
    const modeInstructions: Record<string, string> = {
      code: 'You are a senior software engineer. Write production-quality code with proper error handling.',
      architect: 'You are a software architect. Analyse the codebase and provide design recommendations. Do NOT write or modify files.',
      test: 'You are a QA engineer. Write comprehensive unit and integration tests with good coverage.',
      doc: 'You are a technical writer. Write clear, accurate documentation for developers.',
      devops: 'You are a DevOps engineer. Write infrastructure-as-code and deployment configurations.',
      refactor: 'You are a senior engineer specialising in refactoring. Improve code quality without changing behaviour.',
      review: 'You are a code reviewer. Identify bugs, security issues, and improvement opportunities.',
      debug: 'You are a debugging specialist. Identify and fix the root cause of issues.',
      orchestrator: 'You are a project orchestrator. Coordinate work across multiple components.',
      custom: 'You are a helpful AI assistant. Complete the given task carefully.',
      ask: 'You are a helpful AI assistant. Answer the question based on the provided context.'
    };

    return modeInstructions[task.mode] ??
      'You are a helpful AI coding assistant. Complete the given task carefully.';
  }

  private buildUserPrompt(task: SwarmTask, context: WorkerContext): string {
    const parts: string[] = [];

    parts.push(`## Task: ${task.description}`);
    parts.push('');

    if (task.inputs.length > 0) {
      parts.push(`## Input files: ${task.inputs.join(', ')}`);
    }
    if (task.outputs.length > 0) {
      parts.push(`## Expected output files: ${task.outputs.join(', ')}`);
    }

    const depContext = this.buildContextFromDependencies(task, context.dependencyResults);
    if (depContext) {
      parts.push('');
      parts.push('## Context from completed dependencies:');
      parts.push(depContext);
    }

    if (context.tokenBudget > 0) {
      parts.push(`\n(Token budget for this task: ${context.tokenBudget.toLocaleString()} tokens)`);
    }

    return parts.join('\n');
  }

  private extractFilePaths(output: string, expectedOutputs: string[]): string[] {
    // Return expected outputs that are mentioned in the response
    const mentioned = expectedOutputs.filter(path => output.includes(path));
    if (mentioned.length > 0) return mentioned;

    // Fallback: extract any paths that look like file paths from the response
    const pathPattern = /(?:^|\s)([\w/.@-]+\.\w{2,5})/gm;
    const found = new Set<string>();
    for (const match of output.matchAll(pathPattern)) {
      if (match[1] && !match[1].startsWith('http')) {
        found.add(match[1]);
      }
    }
    return Array.from(found).slice(0, 10);
  }

  private report(progress: number, message: string): void {
    this.progressCallback?.(progress, `[${this.agentId}] ${message}`);
  }
}
