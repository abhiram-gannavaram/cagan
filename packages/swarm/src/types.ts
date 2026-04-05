/**
 * types.ts — Shared type definitions for Agent Swarm.
 *
 * All swarm operations run locally or send to the user's configured
 * LLM provider. No swarm data is ever sent to third-party services.
 */

import type { AgentMode } from '@cagan/core';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export interface SwarmTask {
  id: string;
  description: string;
  mode: AgentMode;
  /** IDs of tasks that must complete before this one can start */
  dependencies: string[];
  /** Files or outputs this task needs as input */
  inputs: string[];
  /** Files this task will produce or modify */
  outputs: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedTokens?: number;
  status: TaskStatus;
  result?: TaskResult;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  tokensUsed?: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  filesModified: string[];
  tokensUsed: number;
  durationMs: number;
}

export interface SwarmConfig {
  /** Maximum number of agents running in parallel. Default: 5 */
  maxParallelAgents: number;
  conflictResolution: 'ask' | 'merge' | 'latest-wins' | 'abort';
  /** If true, remaining tasks continue even if one fails */
  continueOnFailure: boolean;
  tokenBudget?: number;
  /** If true, plan the swarm but do not execute any agents */
  dryRun: boolean;
  provider: string;
  model: string;
  workspaceRoot: string;
}

export interface DAGNode {
  task: SwarmTask;
  dependencies: DAGNode[];
  dependents: DAGNode[];
  /** Which parallel wave this node belongs to (0-indexed) */
  level: number;
}

export interface SwarmResult {
  swarmId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  durationMs: number;
  conflicts: Conflict[];
  outputs: TaskResult[];
}

export interface Conflict {
  filePath: string;
  task1: string;
  task2: string;
  content1: string;
  content2: string;
  type: 'edit-edit' | 'create-create' | 'delete-edit';
}

export interface Resolution {
  conflict: Conflict;
  resolvedContent: string;
  strategy: 'merge' | 'task1' | 'task2' | 'manual';
}

export interface SwarmPlan {
  swarmId: string;
  tasks: SwarmTask[];
  waves: SwarmTask[][];
  estimatedTokens: number;
  estimatedCostUsd: number;
  maxParallelism: number;
  description: string;
}

export interface CostEstimate {
  totalTasks: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  breakdown: Array<{ taskId: string; tokens: number; costUsd: number }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WorkerContext {
  dependencyResults: Map<string, TaskResult>;
  tokenBudget: number;
  workspaceRoot: string;
}
