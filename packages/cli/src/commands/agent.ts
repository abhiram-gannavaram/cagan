import chalk from 'chalk';
import { CaganCore } from '@cagan/core';
import { getConfigManager } from '@cagan/core';
import { DeltaAccumulator } from '@cagan/core';

interface AgentOptions {
  mode: string;
  provider?: string;
  model?: string;
}

export async function agentCommand(task: string, options: AgentOptions): Promise<void> {
  const cwd = process.cwd();
  const core = new CaganCore();
  
  try {
    await core.initialize(cwd);
  } catch (error) {
    console.log(chalk.yellow('Warning: Could not initialize core (config may not exist)'));
  }

  const configManager = getConfigManager(cwd);
  const providerName = options.provider || configManager.getDefaultProvider();
  const model = options.model || configManager.getDefaultModel(options.mode);

  if (!providerName) {
    console.log(chalk.red('No default provider configured. Run "cagan init" and configure a provider.'));
    process.exit(1);
  }

  const providerConfig = configManager.getResolvedProvider(providerName);
  if (!providerConfig) {
    console.log(chalk.red(`Provider ${providerName} not found in config`));
    process.exit(1);
  }

  console.log(chalk.cyan(`Starting ${options.mode} agent...`));
  console.log(chalk.gray(`Provider: ${providerName} | Model: ${model}`));
  console.log(chalk.gray(`Task: ${task}\n`));

  try {
    const agent = core.createAgent({
      mode: options.mode as 'code' | 'architect' | 'debug' | 'review' | 'ask',
      providerName,
      model,
      cwd,
      workspaceRoot: cwd
    });

    const accumulator = new DeltaAccumulator();

    // State machine to suppress <think>…</think> reasoning blocks
    // emitted by models like MiniMax M2.7, DeepSeek-R1, QwQ.
    let thinkBuffer = '';
    let inThink = false;

    for await (const event of agent.run(task)) {
      if (event.type === 'delta') {
        const delta = event.data as { delta?: { content?: string } };
        let chunk = delta?.delta?.content ?? '';
        if (!chunk) continue;

        // Feed through think-block filter
        thinkBuffer += chunk;
        let visible = '';

        while (thinkBuffer.length > 0) {
          if (inThink) {
            const end = thinkBuffer.indexOf('</think>');
            if (end !== -1) {
              thinkBuffer = thinkBuffer.slice(end + 8); // skip past </think>
              inThink = false;
            } else {
              thinkBuffer = ''; // still inside think block, discard
              break;
            }
          } else {
            const start = thinkBuffer.indexOf('<think>');
            if (start !== -1) {
              visible += thinkBuffer.slice(0, start);
              thinkBuffer = thinkBuffer.slice(start + 7);
              inThink = true;
            } else {
              // No think block — but keep last 7 chars buffered in case
              // <think> spans two chunks
              if (thinkBuffer.length > 7) {
                visible += thinkBuffer.slice(0, -7);
                thinkBuffer = thinkBuffer.slice(-7);
              }
              break;
            }
          }
        }

        if (visible) {
          process.stdout.write(visible);
          accumulator.add(event.data as any);
        }
      } else if (event.type === 'error') {
        console.log(chalk.red(`\nError: ${event.data}`));
        process.exit(1);
      }
    }

    // Flush any remaining buffered content
    if (thinkBuffer && !inThink) process.stdout.write(thinkBuffer);

    console.log('\n');

  } catch (error) {
    console.log(chalk.red(`Failed to run agent: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}