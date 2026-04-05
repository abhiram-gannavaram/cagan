import chalk from 'chalk';
import { CaganCore } from '@cagan/core';
import { getConfigManager } from '@cagan/core';

interface ChatOptions {
  provider?: string;
}

export async function chatCommand(message: string, options: ChatOptions): Promise<void> {
  const cwd = process.cwd();
  const core = new CaganCore();
  
  try {
    await core.initialize(cwd);
  } catch {}

  const configManager = getConfigManager(cwd);
  const providerName = options.provider || configManager.getDefaultProvider();

  if (!providerName) {
    console.log(chalk.red('No default provider configured'));
    process.exit(1);
  }

  try {
    const agent = core.createAgent({
      mode: 'ask',
      providerName,
      cwd,
      workspaceRoot: cwd
    });

    for await (const event of agent.run(message)) {
      if (event.type === 'delta') {
        const delta = event.data as { delta?: { content?: string } };
        if (delta?.delta?.content) {
          process.stdout.write(delta.delta.content);
        }
      } else if (event.type === 'error') {
        console.log(chalk.red(`\nError: ${event.data}`));
      }
    }
    console.log('\n');

  } catch (error) {
    console.log(chalk.red(`Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}