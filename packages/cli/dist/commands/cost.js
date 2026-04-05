import chalk from 'chalk';
import { getCostTracker } from '@cagan/core';
export async function costCommand() {
    const tracker = getCostTracker();
    const summary = tracker.getSummary();
    console.log(chalk.cyan('Session Cost Summary\n'));
    console.log(chalk.green('Totals:'));
    console.log(`  Prompt Tokens: ${summary.totalPromptTokens.toLocaleString()}`);
    console.log(`  Completion Tokens: ${summary.totalCompletionTokens.toLocaleString()}`);
    console.log(`  Total Tokens: ${summary.totalTokens.toLocaleString()}`);
    console.log(chalk.bold(`  Total Cost: $${summary.totalCostUsd.toFixed(6)}\n`));
    const models = Object.entries(summary.byModel);
    if (models.length > 0) {
        console.log(chalk.green('By Model:'));
        for (const [model, data] of models) {
            console.log(`  ${model}: ${data.tokens.toLocaleString()} tokens ($${data.costUsd.toFixed(6)})`);
        }
        console.log();
    }
    const providers = Object.entries(summary.byProvider);
    if (providers.length > 0) {
        console.log(chalk.green('By Provider:'));
        for (const [provider, data] of providers) {
            console.log(`  ${provider}: ${data.tokens.toLocaleString()} tokens ($${data.costUsd.toFixed(6)})`);
        }
        console.log();
    }
    const duration = tracker.getSessionDuration();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    console.log(chalk.gray(`Session Duration: ${minutes}m ${seconds}s`));
}
//# sourceMappingURL=cost.js.map