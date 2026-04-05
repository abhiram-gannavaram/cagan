import chalk from 'chalk';
import { CaganCore } from '@cagan/core';
import { getConfigManager } from '@cagan/core';
import { DeltaAccumulator } from '@cagan/core';
export async function agentCommand(task, options) {
    const cwd = process.cwd();
    const core = new CaganCore();
    try {
        await core.initialize(cwd);
    }
    catch (error) {
        console.log(chalk.yellow('Warning: Could not initialize core (config may not exist)'));
    }
    const configManager = getConfigManager(cwd);
    const providerName = options.provider || configManager.getDefaultProvider();
    const model = options.model || configManager.getDefaultModel(options.mode);
    if (!providerName) {
        console.log(chalk.red('No default provider configured. Run "cagan init" and configure a provider.'));
        process.exit(1);
    }
    const providerConfig = configManager.getProvider(providerName);
    if (!providerConfig) {
        console.log(chalk.red(`Provider ${providerName} not found in config`));
        process.exit(1);
    }
    console.log(chalk.cyan(`Starting ${options.mode} agent...`));
    console.log(chalk.gray(`Provider: ${providerName} | Model: ${model}`));
    console.log(chalk.gray(`Task: ${task}\n`));
    try {
        const agent = core.createAgent({
            mode: options.mode,
            providerName,
            model,
            cwd,
            workspaceRoot: cwd
        });
        const accumulator = new DeltaAccumulator();
        for await (const event of agent.run(task)) {
            if (event.type === 'delta') {
                const delta = event.data;
                if (delta?.delta?.content) {
                    process.stdout.write(delta.delta.content);
                    accumulator.add(event.data);
                }
            }
            else if (event.type === 'error') {
                console.log(chalk.red(`\nError: ${event.data}`));
                process.exit(1);
            }
        }
        console.log('\n');
    }
    catch (error) {
        console.log(chalk.red(`Failed to run agent: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}
//# sourceMappingURL=agent.js.map