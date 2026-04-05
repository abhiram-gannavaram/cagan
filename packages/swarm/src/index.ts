/**
 * index.ts — Agent Swarm public API.
 *
 * Agent Swarm enables parallel multi-agent development with DAG scheduling.
 * Multiple specialised agents run in parallel, each handling a different
 * aspect of a larger task (code, tests, docs, devops, etc.).
 *
 * Features:
 *  - LLM-driven task decomposition into atomic subtasks
 *  - DAG-based dependency resolution for safe parallelism
 *  - Conflict detection and resolution when agents touch the same files
 *  - Real-time terminal dashboard showing agent progress
 *  - Token budget enforcement across the entire swarm
 *
 * SECURITY: All processing is local. Task results, file content, and agent
 * outputs are never sent to third-party services. The only outbound network
 * calls are to the user's configured LLM provider.
 */

export { SwarmCoordinator } from './coordinator.js';
export { SwarmScheduler } from './scheduler.js';
export { SwarmWorker } from './worker.js';
export { OutputMerger } from './merger.js';
export { SwarmMonitor } from './monitor.js';
export type {
  SwarmTask,
  TaskResult,
  SwarmConfig,
  DAGNode,
  SwarmResult,
  Conflict,
  Resolution,
  SwarmPlan,
  CostEstimate,
  ValidationResult,
  WorkerContext,
  TaskStatus
} from './types.js';

import type { LLMProvider } from '@cagan/core';
import { SwarmCoordinator } from './coordinator.js';
import { SwarmScheduler } from './scheduler.js';
import { SwarmMonitor } from './monitor.js';
import type { SwarmConfig, SwarmPlan } from './types.js';

/**
 * AgentSwarm — high-level entry point for running a swarm.
 *
 * Usage:
 *   const swarm = new AgentSwarm(provider);
 *   const result = await swarm.run("Build a REST API with auth, tests, and docs", config);
 */
export class AgentSwarm {
  private coordinator: SwarmCoordinator;
  private monitor: SwarmMonitor;

  constructor(private readonly provider: LLMProvider) {
    this.coordinator = new SwarmCoordinator(provider);
    this.monitor = new SwarmMonitor();
  }

  /**
   * Run a complete swarm for the given high-level task.
   * NETWORK: sends decomposition prompt and each agent task to user's configured provider only.
   */
  async run(task: string, config: SwarmConfig, codebaseContext?: string) {
    // Step 1: Decompose the task into subtasks
    console.log(`\ncagan swarm — Decomposing: "${task}"\n`);
    const tasks = await this.coordinator.decomposeTask(task, codebaseContext);
    const dag = this.coordinator.buildDAG(tasks);

    // Validate DAG
    const validation = this.coordinator.validateDAG(dag);
    if (!validation.valid) {
      throw new Error(`Invalid task graph:\n${validation.errors.join('\n')}`);
    }

    // Step 2: Dry run — just show the plan
    if (config.dryRun) {
      const plan = this.coordinator.generatePlan(tasks, dag);
      this.monitor.showPlan(plan);
      return plan;
    }

    // Step 3: Execute
    const scheduler = new SwarmScheduler(this.provider, this.monitor);
    return scheduler.schedule(tasks, config);
  }

  /**
   * Preview a swarm without executing — returns the plan.
   * No LLM calls beyond decomposition. No file writes.
   */
  async dryRun(task: string, config: SwarmConfig, codebaseContext?: string): Promise<SwarmPlan> {
    const tasks = await this.coordinator.decomposeTask(task, codebaseContext);
    const dag = this.coordinator.buildDAG(tasks);
    const plan = this.coordinator.generatePlan(tasks, dag);
    this.monitor.showPlan(plan);
    return plan;
  }
}
