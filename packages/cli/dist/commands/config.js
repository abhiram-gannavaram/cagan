import chalk from 'chalk';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { getConfigManager } from '@byoadev/core';
import { createProvider } from '@byoadev/core';
export async function configCommand(options) {
    const cwd = process.cwd();
    const configManager = getConfigManager(cwd);
    if (options.listProviders) {
        const config = configManager.getConfig();
        const providers = Object.entries(config.providers);
        if (providers.length === 0) {
            console.log(chalk.yellow('No providers configured'));
            console.log(chalk.gray('Add a provider to .byoadev/config.yaml'));
            return;
        }
        console.log(chalk.cyan('Configured Providers:\n'));
        for (const [name, provider] of providers) {
            console.log(chalk.green(`${name} (${provider.type})`));
            console.log(chalk.gray(`  URL: ${provider.baseUrl}`));
            console.log(chalk.gray(`  Default Model: ${provider.models.default}`));
            try {
                const providerInstance = createProvider(name, provider);
                const healthy = await providerInstance.healthCheck();
                console.log(chalk.gray(`  Status: ${healthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unreachable')}`));
            }
            catch {
                console.log(chalk.gray(`  Status: ${chalk.red('✗ Error')}`));
            }
            console.log();
        }
        return;
    }
    if (options.addProvider) {
        try {
            const content = readFileSync(options.addProvider, 'utf-8');
            const config = parse(content);
            if (!config || !config.providers) {
                console.log(chalk.red('Invalid config file'));
                process.exit(1);
            }
            console.log(chalk.green(`Provider config loaded from ${options.addProvider}`));
            console.log(chalk.yellow('Note: You need to manually merge the config into .byoadev/config.yaml'));
            return;
        }
        catch (error) {
            console.log(chalk.red(`Failed to read config: ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    }
    const config = configManager.getConfig();
    console.log(chalk.cyan('Current Configuration:\n'));
    console.log(chalk.green('Defaults:'));
    console.log(`  Provider: ${config.defaults.provider || 'not set'}`);
    console.log(`  Code Model: ${config.defaults.code_mode_model || 'not set'}`);
    console.log(`  Architect Model: ${config.defaults.architect_model || 'not set'}`);
    console.log(`  Budget Alert: $${config.defaults.budget_alert_usd}`);
    console.log(`  Memory Enabled: ${config.defaults.memory_enabled}`);
    console.log(`  Auto Commit: ${config.defaults.auto_commit}`);
}
//# sourceMappingURL=config.js.map