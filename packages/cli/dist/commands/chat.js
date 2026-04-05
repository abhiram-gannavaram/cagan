import chalk from 'chalk';
import { BYOACore } from '@byoadev/core';
import { getConfigManager } from '@byoadev/core';
export async function chatCommand(message, options) {
    const cwd = process.cwd();
    const core = new BYOACore();
    try {
        await core.initialize(cwd);
    }
    catch { }
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
                const delta = event.data;
                if (delta?.delta?.content) {
                    process.stdout.write(delta.delta.content);
                }
            }
            else if (event.type === 'error') {
                console.log(chalk.red(`\nError: ${event.data}`));
            }
        }
        console.log('\n');
    }
    catch (error) {
        console.log(chalk.red(`Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}
//# sourceMappingURL=chat.js.map