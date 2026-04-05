import chalk from 'chalk';
import { getMemoryManager, type MemoryScope } from '@cagan/core';

interface MemoryOptions {
  scope: string;
  list?: boolean;
  search?: string;
  clear?: boolean;
}

export async function memoryCommand(options: MemoryOptions): Promise<void> {
  const cwd = process.cwd();
  const scope = options.scope as MemoryScope;

  if (!['session', 'project', 'global'].includes(scope)) {
    console.log(chalk.red('Invalid scope. Must be: session, project, or global'));
    process.exit(1);
  }

  const memory = getMemoryManager(cwd);

  if (options.clear) {
    memory.clear(scope);
    console.log(chalk.green(`Cleared ${scope} memory`));
    return;
  }

  if (options.search) {
    const results = memory.search(scope, options.search);
    if (results.length === 0) {
      console.log(chalk.yellow(`No results found for "${options.search}"`));
      return;
    }
    console.log(chalk.cyan(`Search results for "${options.search}":\n`));
    for (const result of results) {
      console.log(chalk.gray(`[${new Date(result.timestamp).toLocaleString()}]`));
      console.log(result.value.slice(0, 200) + (result.value.length > 200 ? '...' : ''));
      console.log();
    }
    return;
  }

  if (options.list) {
    const entries = memory.getAll(scope);
    if (entries.length === 0) {
      console.log(chalk.yellow(`No ${scope} memories`));
      return;
    }
    console.log(chalk.cyan(`${scope} memories:\n`));
    for (const entry of entries.slice(0, 50)) {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      console.log(chalk.gray(`[${timestamp}]`));
      if ('key' in entry && entry.key) {
        console.log(chalk.cyan(`${entry.key}:`));
      }
      console.log(entry.value.slice(0, 200) + (entry.value.length > 200 ? '...' : ''));
      console.log();
    }
    if (entries.length > 50) {
      console.log(chalk.gray(`... and ${entries.length - 50} more`));
    }
    return;
  }

  console.log(chalk.yellow('Please specify --list, --search, or --clear'));
  console.log('Usage: cagan memory --scope <scope> [--list | --search <query> | --clear]');
}