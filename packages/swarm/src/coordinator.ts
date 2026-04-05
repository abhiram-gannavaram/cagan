/**
 * coordinator.ts — Task decomposition and DAG builder for Agent Swarm.
 *
 * Uses the user's configured LLM to decompose high-level tasks into
 * atomic subtasks and builds a dependency graph for parallel execution.
 * NETWORK: the decomposition prompt is sent to the user's configured
 * LLM provider only — nowhere else.
 */

import type { LLMProvider } from '@cagan/core';
import type {
  SwarmTask,
  DAGNode,
  SwarmPlan,
  CostEstimate,
  ValidationResult
} from './types.js';

const DECOMPOSITION_SYSTEM_PROMPT = `You are a software project manager for an AI coding agent swarm.
Break down the given task into specific, atomic subtasks.

For each subtask return a JSON object with:
- id: unique snake_case identifier (e.g. "implement_auth_middleware")
- description: one-sentence description of what to do
- mode: one of [code, architect, test, doc, devops, refactor]
- dependencies: array of other task IDs that must complete first
- inputs: array of file paths this task needs to read
- outputs: array of file paths this task will create or modify
- priority: "high" | "medium" | "low"
- estimatedTokens: rough estimate (500-5000)

Rules:
1. Be specific about file paths
2. Minimise dependencies to maximise parallelism
3. The architect task (if any) should run first with no dependencies
4. Test tasks should depend on the code tasks they test
5. Doc tasks should depend on their corresponding code tasks
6. Return ONLY a valid JSON array of task objects — no prose

Return JSON only.`;

export class SwarmCoordinator {
  constructor(private provider: LLMProvider) {}

  /**
   * Decompose a high-level task into atomic SwarmTasks using the LLM.
   * NETWORK: sends decomposition prompt to user's configured provider only.
   */
  async decomposeTask(
    task: string,
    codebaseContext: string = ''
  ): Promise<SwarmTask[]> {
    const userPrompt = codebaseContext
      ? `Codebase context:\n${codebaseContext}\n\nTask to decompose:\n${task}`
      : `Task to decompose:\n${task}`;

    // NETWORK: sends to user's configured LLM provider only
    const response = await this.provider.chat(
      [
        { role: 'system', content: DECOMPOSITION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { responseFormat: 'json_object', temperature: 0.2 }
    );

    const raw = response.choices[0]?.message?.content ?? '[]';
    let parsed: unknown[];

    try {
      // Strip <think>…</think> reasoning blocks emitted by models like MiniMax M2.7,
      // DeepSeek-R1, QwQ etc. before attempting JSON parse.
      const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      // Extract the first JSON array or object from the response
      const jsonMatch = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[0] : stripped;
      const obj = JSON.parse(jsonStr);
      parsed = Array.isArray(obj) ? obj : (obj.tasks as unknown[] ?? []);
    } catch {
      throw new Error(`LLM returned invalid JSON during task decomposition: ${raw.slice(0, 200)}`);
    }

    return parsed.map((t: unknown, i: number) => {
      const task = t as Record<string, unknown>;
      return {
        id: (task.id as string) ?? `task_${i}`,
        description: (task.description as string) ?? '',
        mode: (task.mode as SwarmTask['mode']) ?? 'code',
        dependencies: (task.dependencies as string[]) ?? [],
        inputs: (task.inputs as string[]) ?? [],
        outputs: (task.outputs as string[]) ?? [],
        priority: (task.priority as SwarmTask['priority']) ?? 'medium',
        estimatedTokens: (task.estimatedTokens as number) ?? 1000,
        status: 'pending' as const
      };
    });
  }

  /** Build a DAG from a list of tasks based on their declared dependencies. */
  buildDAG(tasks: SwarmTask[]): DAGNode[] {
    const nodeMap = new Map<string, DAGNode>();

    // First pass: create all nodes
    for (const task of tasks) {
      nodeMap.set(task.id, {
        task,
        dependencies: [],
        dependents: [],
        level: 0
      });
    }

    // Second pass: wire up edges
    for (const task of tasks) {
      const node = nodeMap.get(task.id)!;
      for (const depId of task.dependencies) {
        const depNode = nodeMap.get(depId);
        if (depNode) {
          node.dependencies.push(depNode);
          depNode.dependents.push(node);
        }
      }
    }

    // Third pass: compute levels using topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    for (const [id, node] of nodeMap) {
      inDegree.set(id, node.dependencies.length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    let level = 0;
    let currentWave = [...queue];

    while (currentWave.length > 0) {
      const nextWave: string[] = [];
      for (const id of currentWave) {
        const node = nodeMap.get(id)!;
        node.level = level;
        for (const dependent of node.dependents) {
          const newDeg = (inDegree.get(dependent.task.id) ?? 1) - 1;
          inDegree.set(dependent.task.id, newDeg);
          if (newDeg === 0) nextWave.push(dependent.task.id);
        }
      }
      currentWave = nextWave;
      level++;
    }

    return Array.from(nodeMap.values());
  }

  /** Validate that the DAG has no circular dependencies. */
  validateDAG(dag: DAGNode[]): ValidationResult {
    const errors: string[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (node: DAGNode): boolean => {
      if (inStack.has(node.task.id)) return true;
      if (visited.has(node.task.id)) return false;

      visited.add(node.task.id);
      inStack.add(node.task.id);

      for (const dep of node.dependencies) {
        if (hasCycle(dep)) {
          errors.push(`Circular dependency detected involving task: ${node.task.id}`);
          return true;
        }
      }

      inStack.delete(node.task.id);
      return false;
    };

    for (const node of dag) {
      if (!visited.has(node.task.id)) {
        hasCycle(node);
      }
    }

    // Check for references to non-existent tasks
    const taskIds = new Set(dag.map(n => n.task.id));
    for (const node of dag) {
      for (const dep of node.task.dependencies) {
        if (!taskIds.has(dep)) {
          errors.push(`Task "${node.task.id}" depends on unknown task "${dep}"`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Return tasks grouped by which parallel wave they belong to.
   * Wave 0 runs first (no dependencies), wave 1 depends on wave 0, etc.
   */
  getParallelWaves(dag: DAGNode[]): SwarmTask[][] {
    const maxLevel = Math.max(0, ...dag.map(n => n.level));
    const waves: SwarmTask[][] = [];
    for (let i = 0; i <= maxLevel; i++) {
      waves.push(dag.filter(n => n.level === i).map(n => n.task));
    }
    return waves.filter(w => w.length > 0);
  }

  /** Estimate total tokens and cost before running the swarm. */
  estimateSwarmCost(tasks: SwarmTask[]): CostEstimate {
    const COST_PER_1K = 0.002; // conservative blended estimate
    let totalTokens = 0;
    const breakdown: CostEstimate['breakdown'] = [];

    for (const task of tasks) {
      const tokens = task.estimatedTokens ?? 1000;
      totalTokens += tokens;
      breakdown.push({
        taskId: task.id,
        tokens,
        costUsd: (tokens / 1000) * COST_PER_1K
      });
    }

    return {
      totalTasks: tasks.length,
      estimatedTokens: totalTokens,
      estimatedCostUsd: (totalTokens / 1000) * COST_PER_1K,
      breakdown
    };
  }

  /** Generate a dry-run plan report. */
  generatePlan(tasks: SwarmTask[], dag: DAGNode[]): SwarmPlan {
    const waves = this.getParallelWaves(dag);
    const cost = this.estimateSwarmCost(tasks);
    const maxParallelism = Math.max(0, ...waves.map(w => w.length));

    return {
      swarmId: `swarm-${Date.now()}`,
      tasks,
      waves,
      estimatedTokens: cost.estimatedTokens,
      estimatedCostUsd: cost.estimatedCostUsd,
      maxParallelism,
      description: `${tasks.length} tasks across ${waves.length} waves, max ${maxParallelism} agents in parallel`
    };
  }
}
