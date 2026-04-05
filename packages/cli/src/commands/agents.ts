import chalk from 'chalk';

const runningAgents: Map<string, {
  id: string;
  mode: string;
  provider: string;
  model: string;
  status: string;
  cost: number;
  startedAt: number;
}> = new Map();

export async function agentsCommand(): Promise<void> {
  if (runningAgents.size === 0) {
    console.log(chalk.yellow('No running agents'));
    return;
  }

  console.log(chalk.cyan('Running Agents:\n'));
  console.log('ID          Mode       Provider    Model              Status    Cost');
  console.log('─'.repeat(80));

  for (const agent of runningAgents.values()) {
    const duration = Math.floor((Date.now() - agent.startedAt) / 1000);
    console.log(
      `${agent.id.padEnd(12)} ${agent.mode.padEnd(11)} ${agent.provider.padEnd(11)} ` +
      `${agent.model.padEnd(17)} ${agent.status.padEnd(9)} $${agent.cost.toFixed(4)}`
    );
    console.log(chalk.gray(`  Started ${duration}s ago`));
  }
}

export function registerAgent(agent: {
  id: string;
  mode: string;
  provider: string;
  model: string;
}): void {
  runningAgents.set(agent.id, {
    ...agent,
    status: 'running',
    cost: 0,
    startedAt: Date.now()
  });
}

export function unregisterAgent(id: string): void {
  runningAgents.delete(id);
}

export function updateAgentCost(id: string, cost: number): void {
  const agent = runningAgents.get(id);
  if (agent) {
    agent.cost = cost;
  }
}