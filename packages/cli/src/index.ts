#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { agentCommand } from './commands/agent.js';
import { chatCommand } from './commands/chat.js';
import { agentsCommand } from './commands/agents.js';
import { memoryCommand } from './commands/memory.js';
import { configCommand } from './commands/config.js';
import { costCommand } from './commands/cost.js';
import { indexCommand } from './commands/index.js';

const program = new Command();

program
  .name('cagan')
  .description('cagan - Code with any LLM')
  .version('0.1.0');

program
  .command('init [project-path]')
  .description('Initialize cagan in current directory')
  .action(initCommand);

program
  .command('agent')
  .description('Run agent in specified mode')
  .requiredOption('--mode <mode>', 'Agent mode (architect, code, debug, review)')
  .option('--provider <name>', 'Provider name')
  .option('--model <model>', 'Model name')
  .argument('<task>', 'Task to execute')
  .action(agentCommand);

program
  .command('chat')
  .description('Interactive chat with current project context')
  .option('--provider <name>', 'Provider name')
  .argument('<message>', 'Message to send')
  .action(chatCommand);

program
  .command('agents')
  .description('List running agents with status')
  .action(agentsCommand);

program
  .command('memory')
  .description('Manage memories')
  .requiredOption('--scope <scope>', 'Memory scope (session, project, global)')
  .option('--list', 'List memories')
  .option('--search <query>', 'Search memories')
  .option('--clear', 'Clear memories')
  .action(memoryCommand);

program
  .command('config')
  .description('Manage configuration')
  .option('--list-providers', 'List configured providers')
  .option('--add-provider <config-path>', 'Add provider from config file')
  .action(configCommand);

program
  .command('cost')
  .description('Show current session cost breakdown')
  .action(costCommand);

program
  .command('index')
  .description('Manage codebase index')
  .option('--rebuild', 'Rebuild index from scratch')
  .action(indexCommand);

program.parse();