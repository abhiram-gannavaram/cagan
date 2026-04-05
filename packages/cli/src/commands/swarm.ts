/**
 * swarm.ts — CLI command handler for Agent Swarm.
 *
 * Parses swarm options, initialises the provider, and runs the swarm.
 * NETWORK: swarm sends task prompts to the user's configured provider only.
 */

import { AgentSwarm } from '@cagan/swarm';
import { getConfigManager, createProvider } from '@cagan/core';
import type { SwarmConfig } from '@cagan/swarm';

interface SwarmOptions {
  dryRun?: boolean;
  maxAgents?: string;
  conflicts?: 'ask' | 'merge' | 'latest-wins' | 'abort';
  budget?: string;
  continueOnFailure?: boolean;
  provider?: string;
  model?: string;
  status?: string;
}

export async function swarmCommand(task: string, options: SwarmOptions): Promise<void> {
  const cwd = process.cwd();
  const configManager = getConfigManager(cwd);
  const config = configManager.getConfig();

  const providerName = options.provider ?? configManager.getDefaultProvider();
  const providerConfig = configManager.getResolvedProvider(providerName);

  if (!providerConfig) {
    console.error(`Provider "${providerName}" not configured. Run: cagan init`);
    process.exit(1);
  }

  // NETWORK: the provider is used to send task prompts to the user's configured LLM endpoint only
  const provider = createProvider(providerName, providerConfig);
  const model = options.model ?? providerConfig.models.default;

  const swarmConfig: SwarmConfig = {
    maxParallelAgents: options.maxAgents ? parseInt(options.maxAgents, 10) : (config.defaults.max_parallel_agents ?? 5),
    conflictResolution: options.conflicts ?? 'merge',
    continueOnFailure: options.continueOnFailure ?? false,
    tokenBudget: options.budget ? parseInt(options.budget, 10) : undefined,
    dryRun: options.dryRun ?? false,
    provider: providerName,
    model,
    workspaceRoot: cwd
  };

  const swarm = new AgentSwarm(provider);

  try {
    const result = await swarm.run(task, swarmConfig);

    if (!swarmConfig.dryRun && 'completedTasks' in result) {
      if (result.failedTasks > 0) {
        console.warn(`\nWarning: ${result.failedTasks} task(s) failed. Check output above for details.`);
      }
    }
  } catch (error) {
    console.error(`\nSwarm failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
