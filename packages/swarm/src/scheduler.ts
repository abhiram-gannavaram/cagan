/**
 * scheduler.ts — Dependency-aware task scheduler for Agent Swarm.
 *
 * Manages the lifecycle of swarm tasks: determines which tasks are ready,
 * starts workers, handles completions and failures, and respects parallelism limits.
 * NETWORK: each worker sends to the user's configured LLM provider only.
 */

import type {
  SwarmTask,
  SwarmConfig,
  SwarmResult,
  TaskResult,
  Conflict
} from './types.js';
import { SwarmWorker } from './worker.js';
import { OutputMerger } from './merger.js';
import { SwarmMonitor } from './monitor.js';
import type { LLMProvider } from '@cagan/core';

export class SwarmScheduler {
  private runningTasks: Map<string, Promise<TaskResult>> = new Map();
  private completedResults: Map<string, TaskResult> = new Map();
  private failedTasks: Set<string> = new Set();
  private allConflicts: Conflict[] = [];
  private monitor: SwarmMonitor;
  private merger: OutputMerger;

  constructor(
    private readonly provider: LLMProvider,
    monitor?: SwarmMonitor
  ) {
    this.monitor = monitor ?? new SwarmMonitor();
    this.merger = new OutputMerger(provider);
  }

  /**
   * Main scheduling loop. Returns when all tasks are complete or the swarm aborts.
   * NETWORK: workers send to user's configured LLM provider only.
   */
  async schedule(tasks: SwarmTask[], config: SwarmConfig): Promise<SwarmResult> {
    const swarmId = `swarm-${Date.now()}`;
    const startedAt = Date.now();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    this.monitor.startDashboard(swarmId, 'Running swarm', tasks, config.tokenBudget);

    // Main loop: keep scheduling until done or aborted
    while (!this.isComplete(tasks)) {
      const ready = this.getReadyTasks(tasks);
      const available = config.maxParallelAgents - this.runningTasks.size;

      // Start as many ready tasks as the parallel limit allows
      for (const task of ready.slice(0, available)) {
        await this.startTask(task, config, taskMap);
      }

      if (this.runningTasks.size === 0 && !this.isComplete(tasks)) {
        // Deadlock — no tasks running and no tasks ready
        const pendingBlocked = tasks.filter(t =>
          t.status === 'pending' || t.status === 'blocked'
        );
        for (const t of pendingBlocked) t.status = 'failed';
        break;
      }

      // Wait for any running task to finish
      if (this.runningTasks.size > 0) {
        await Promise.race(Array.from(this.runningTasks.values()));
      }
    }

    // Detect and resolve conflicts in outputs
    const allResults = Array.from(this.completedResults.values());
    const conflicts = this.merger.detectConflicts(allResults);
    this.allConflicts.push(...conflicts);

    if (conflicts.length > 0) {
      await this.resolveConflicts(conflicts, config);
    }

    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const failedCount = tasks.filter(t => t.status === 'failed').length;
    const totalTokens = allResults.reduce((s, r) => s + r.tokensUsed, 0);
    const COST_PER_1K = 0.002;

    const result: SwarmResult = {
      swarmId,
      totalTasks: tasks.length,
      completedTasks: completedCount,
      failedTasks: failedCount,
      totalTokensUsed: totalTokens,
      totalCostUsd: (totalTokens / 1000) * COST_PER_1K,
      durationMs: Date.now() - startedAt,
      conflicts: this.allConflicts,
      outputs: allResults
    };

    this.monitor.showSummary(result);
    return result;
  }

  /** Return tasks whose all dependencies have completed successfully. */
  getReadyTasks(tasks: SwarmTask[]): SwarmTask[] {
    return tasks.filter(task => {
      if (task.status !== 'pending') return false;
      return task.dependencies.every(depId => {
        const dep = tasks.find(t => t.id === depId);
        return dep?.status === 'completed';
      });
    });
  }

  /** Start a task on a new worker. */
  async startTask(
    task: SwarmTask,
    config: SwarmConfig,
    taskMap: Map<string, SwarmTask>
  ): Promise<void> {
    task.status = 'running';
    task.startedAt = Date.now();
    this.monitor.updateTask(task.id, 'running');

    const worker = new SwarmWorker(this.provider, config.model);
    worker.onProgress((pct, msg) => {
      // Forward progress messages to monitor
      if (pct === 100) this.monitor.updateTask(task.id, 'running', msg);
    });

    const tokenBudget = config.tokenBudget
      ? Math.floor(config.tokenBudget / Math.max(1, taskMap.size))
      : 0;

    const promise = worker.execute(task, {
      dependencyResults: this.completedResults,
      tokenBudget,
      workspaceRoot: config.workspaceRoot
    }).then(result => {
      this.onTaskComplete(task, result, config);
      return result;
    }).catch(error => {
      const result: TaskResult = {
        taskId: task.id,
        success: false,
        output: error instanceof Error ? error.message : String(error),
        filesModified: [],
        tokensUsed: 0,
        durationMs: Date.now() - (task.startedAt ?? Date.now())
      };
      this.onTaskFailed(task, error, config);
      return result;
    }).finally(() => {
      this.runningTasks.delete(task.id);
    });

    this.runningTasks.set(task.id, promise);
  }

  private onTaskComplete(task: SwarmTask, result: TaskResult, _config: SwarmConfig): void {
    task.status = 'completed';
    task.completedAt = Date.now();
    task.tokensUsed = result.tokensUsed;
    this.completedResults.set(task.id, result);
    this.monitor.updateTask(task.id, 'completed');
    this.monitor.recordTokenUsage(task.id, result.tokensUsed);
  }

  private onTaskFailed(task: SwarmTask, error: Error, config: SwarmConfig): void {
    task.status = 'failed';
    task.completedAt = Date.now();
    task.error = error.message;
    this.failedTasks.add(task.id);
    this.monitor.updateTask(task.id, 'failed', error.message);

    if (!config.continueOnFailure) {
      // Mark all pending tasks as failed
      // (caller's isComplete check will terminate the loop)
    }
  }

  isComplete(tasks: SwarmTask[]): boolean {
    return tasks.every(t =>
      t.status === 'completed' ||
      t.status === 'failed'
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async resolveConflicts(conflicts: Conflict[], config: SwarmConfig): Promise<void> {
    for (const conflict of conflicts) {
      switch (config.conflictResolution) {
        case 'merge':
          try {
            // NETWORK: sends conflict to user's configured LLM provider only
            const merged = await this.merger.aiMerge(conflict);
            this.completedResults.get(conflict.task1)?.filesModified.push(conflict.filePath);
            console.log(`  Merged conflict in ${conflict.filePath} via AI merge`);
          } catch {
            console.warn(`  AI merge failed for ${conflict.filePath} — keeping version 1`);
          }
          break;

        case 'latest-wins':
          // Keep task2's version (it ran last)
          console.log(`  Conflict in ${conflict.filePath} — keeping latest (${conflict.task2})`);
          break;

        case 'abort':
          throw new Error(
            `Swarm aborted: conflict detected in ${conflict.filePath} ` +
            `between tasks ${conflict.task1} and ${conflict.task2}`
          );

        case 'ask':
        default:
          await this.merger.interactiveResolve([conflict]);
          break;
      }
    }
  }
}
