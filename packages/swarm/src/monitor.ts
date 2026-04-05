/**
 * monitor.ts — Real-time swarm progress dashboard.
 *
 * Renders a live terminal UI showing agent status, token usage, and timing.
 * All output goes to stdout — no data is sent anywhere.
 */

import type { SwarmTask, SwarmResult, SwarmPlan } from './types.js';

const STATUS_ICON: Record<SwarmTask['status'], string> = {
  pending:   '●',
  running:   '⟳',
  completed: '✓',
  failed:    '✗',
  blocked:   '◌'
};

const STATUS_LABEL: Record<SwarmTask['status'], string> = {
  pending:   'pending',
  running:   'running',
  completed: 'done',
  failed:    'FAILED',
  blocked:   'blocked'
};

export class SwarmMonitor {
  private tasks: Map<string, SwarmTask> = new Map();
  private messages: Map<string, string> = new Map();
  private startedAt: number = Date.now();
  private swarmDescription: string = '';
  private totalBudgetTokens: number = 0;
  private totalTokensUsed: number = 0;
  private isLive: boolean = false;

  /** Begin the live dashboard. Prints initial state. */
  startDashboard(swarmId: string, description: string, tasks: SwarmTask[], tokenBudget?: number): void {
    this.swarmDescription = description;
    this.startedAt = Date.now();
    this.totalBudgetTokens = tokenBudget ?? 0;
    this.isLive = true;

    for (const task of tasks) {
      this.tasks.set(task.id, { ...task });
    }

    this.render();
  }

  /** Update a single task's status and re-render. */
  updateTask(taskId: string, status: SwarmTask['status'], message?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    if (status === 'running') task.startedAt = Date.now();
    if (status === 'completed' || status === 'failed') task.completedAt = Date.now();

    if (message) this.messages.set(taskId, message);

    if (this.isLive) this.render();
  }

  /** Record token usage for a completed task. */
  recordTokenUsage(taskId: string, tokens: number): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.tokensUsed = tokens;
      this.totalTokensUsed += tokens;
    }
  }

  /** Display the final summary when the swarm completes. */
  showSummary(result: SwarmResult): void {
    this.isLive = false;
    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1);

    console.log('\n' + '━'.repeat(60));
    console.log(`cagan swarm — Complete`);
    console.log('━'.repeat(60));
    console.log(`  Tasks completed : ${result.completedTasks} / ${result.totalTasks}`);
    if (result.failedTasks > 0) {
      console.log(`  Tasks failed    : ${result.failedTasks}`);
    }
    console.log(`  Total tokens    : ${result.totalTokensUsed.toLocaleString()}`);
    console.log(`  Estimated cost  : $${result.totalCostUsd.toFixed(4)}`);
    console.log(`  Duration        : ${elapsed}s`);
    if (result.conflicts.length > 0) {
      console.log(`  Conflicts       : ${result.conflicts.length} (resolved)`);
    }
    console.log('━'.repeat(60) + '\n');
  }

  /** Print a dry-run plan without executing. */
  showPlan(plan: SwarmPlan): void {
    console.log('\n' + '━'.repeat(60));
    console.log(`cagan swarm — Dry Run Plan`);
    console.log('━'.repeat(60));
    console.log(`  ${plan.description}`);
    console.log(`  Estimated tokens : ${plan.estimatedTokens.toLocaleString()}`);
    console.log(`  Estimated cost   : $${plan.estimatedCostUsd.toFixed(4)}`);
    console.log('');

    plan.waves.forEach((wave, waveIdx) => {
      console.log(`Wave ${waveIdx + 1} (${wave.length} task${wave.length !== 1 ? 's' : ''} in parallel):`);
      for (const task of wave) {
        const depsStr = task.dependencies.length > 0
          ? ` [depends on: ${task.dependencies.join(', ')}]`
          : '';
        console.log(`  ${STATUS_ICON.pending} ${task.mode.padEnd(12)} ${task.description}${depsStr}`);
      }
      console.log('');
    });

    console.log('━'.repeat(60));
    console.log('Run without --dry-run to execute this swarm.\n');
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private render(): void {
    const allTasks = Array.from(this.tasks.values());
    const waves = this.groupByWave(allTasks);
    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(0);
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const budgetStr = this.totalBudgetTokens > 0
      ? `/${this.totalBudgetTokens.toLocaleString()}`
      : '';

    // Move cursor up to overwrite previous render (if not first render)
    // For simplicity, we just print a new block each time
    console.log('\n' + '━'.repeat(60));
    console.log(`cagan swarm — "${this.swarmDescription}"`);
    console.log('━'.repeat(60));

    waves.forEach((waveTasks, waveIdx) => {
      const waveLabel = waveIdx === 0 ? '(Architecture / Planning)' : `(Wave ${waveIdx + 1})`;
      console.log(`Wave ${waveIdx + 1} ${waveLabel}:`);
      for (const task of waveTasks) {
        const icon = STATUS_ICON[task.status];
        const label = STATUS_LABEL[task.status].padEnd(10);
        const msg = this.messages.get(task.id) ?? '';
        const elapsed = task.startedAt
          ? ` ${Math.round((Date.now() - task.startedAt) / 1000)}s`
          : '';
        const tokens = task.tokensUsed ? ` ${task.tokensUsed.toLocaleString()} tokens` : '';
        console.log(`  ${icon} ${task.mode.padEnd(14)} ${task.description.slice(0, 35).padEnd(35)} [${label}]${elapsed}${tokens}`);
        if (msg) console.log(`      ${msg}`);
      }
    });

    const tokenStr = `${this.totalTokensUsed.toLocaleString()}${budgetStr}`;
    console.log('');
    console.log(`Progress: ${completed}/${allTasks.length} complete   Tokens: ${tokenStr}   Elapsed: ${elapsed}s`);
    console.log('━'.repeat(60));
  }

  private groupByWave(tasks: SwarmTask[]): SwarmTask[][] {
    const waves: SwarmTask[][] = [];
    // Group tasks by their dependency chains (simple heuristic)
    const placed = new Set<string>();
    let remaining = [...tasks];

    while (remaining.length > 0) {
      const wave = remaining.filter(t =>
        t.dependencies.every(dep => placed.has(dep))
      );

      if (wave.length === 0) {
        // Avoid infinite loop on bad dependency graph
        waves.push(remaining);
        break;
      }

      waves.push(wave);
      for (const t of wave) placed.add(t.id);
      remaining = remaining.filter(t => !placed.has(t.id));
    }

    return waves;
  }
}
