import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { detectProviders, validateApiKey } from '@cagan/core';
import type { DetectedProvider, ProviderKind } from '@cagan/core';

// ── Provider catalogue (for manual setup) ─────────────────────────────────
const PROVIDER_CHOICES: Array<{
  name: string;
  value: ProviderKind;
  envVar: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}> = [
  {
    name: 'Anthropic  (Claude 3.5 Sonnet / Opus)',
    value: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
  },
  {
    name: 'OpenAI     (GPT-4o / o1)',
    value: 'openai',
    envVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini']
  },
  {
    name: 'Google     (Gemini 2.0 Flash / 1.5 Pro)',
    value: 'gemini',
    envVar: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
  },
  {
    name: 'DeepSeek   (deepseek-chat / reasoner)',
    value: 'deepseek',
    envVar: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    name: 'Mistral    (mistral-large / codestral)',
    value: 'mistral',
    envVar: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest']
  },
  {
    name: 'Groq       (llama-3.3-70b — ultra-fast)',
    value: 'groq',
    envVar: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  }
];

// ── Config builder ─────────────────────────────────────────────────────────

function buildYamlConfig(provider: {
  kind: ProviderKind;
  envVar: string;
  model: string;
}): string {
  const providerType =
    provider.kind === 'anthropic' ? 'anthropic-compatible' :
    provider.kind === 'gemini' ? 'gemini' :
    'openai-compatible';

  const baseUrls: Partial<Record<ProviderKind, string>> = {
    anthropic: 'https://api.anthropic.com',
    openai: 'https://api.openai.com/v1',
    gemini: 'https://generativelanguage.googleapis.com',
    deepseek: 'https://api.deepseek.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    groq: 'https://api.groq.com/openai/v1'
  };

  return `version: "1.0"

providers:
  ${provider.kind}:
    type: ${providerType}
    base_url: "${baseUrls[provider.kind] ?? ''}"
    apiKey: "\${${provider.envVar}}"
    models:
      default: "${provider.model}"
      autocomplete: "${provider.model}"

defaults:
  provider: ${provider.kind}
  code_mode_model: "${provider.model}"
  architect_model: "${provider.model}"
  autocomplete_model: "${provider.model}"
  orchestrator_model: "${provider.model}"
  max_parallel_agents: 10
  auto_commit: false
  memory_enabled: true
  budget_alert_usd: 5.0

security:
  api_key_storage: keychain
  caganignore_path: ~/.cagan/caganignore
`;
}

const caganignoreContent = `.git/
node_modules/
dist/
build/
*.env
*.env.local
credentials.json
*.pem
key*.pem
secrets/
.vscode/
.idea/
`;

// ── Helpers ────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log('');
  console.log(chalk.bold.cyan('  ╔═══════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║') + chalk.bold.white('        cagan setup wizard          ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ║') + chalk.gray('   provider-agnostic AI coding       ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ╚═══════════════════════════════════╝'));
  console.log('');
}

function printStep(n: number, total: number, label: string): void {
  console.log(chalk.bold.cyan(`\n  [${n}/${total}] ${label}`));
  console.log(chalk.gray('  ' + '─'.repeat(40)));
}

function printSuccess(msg: string): void {
  console.log(chalk.bold.green('  ✓ ') + msg);
}

function printWarn(msg: string): void {
  console.log(chalk.bold.yellow('  ⚠ ') + msg);
}

function printInfo(msg: string): void {
  console.log(chalk.gray('  › ') + msg);
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 6) + '••••••••' + key.slice(-4);
}

// ── Main wizard ────────────────────────────────────────────────────────────

export async function initCommand(projectPath?: string): Promise<void> {
  const cwd = projectPath ?? process.cwd();

  printBanner();

  // ── Step 1: scan ──────────────────────────────────────────────────────
  printStep(1, 4, 'Scanning for existing AI tools…');

  const detection = detectProviders(cwd);

  if (detection.hasClaudeCode) {
    printSuccess('Claude Code detected on this machine');
  }
  if (detection.hasCopilot) {
    printSuccess('GitHub Copilot detected');
  }
  if (detection.hasCursor) {
    printSuccess('Cursor IDE detected');
  }

  let chosen: { kind: ProviderKind; envVar: string; model: string; apiKey: string } | null = null;

  if (detection.providers.length > 0) {
    // ── Step 2: use detected provider ─────────────────────────────────
    printStep(2, 4, 'AI providers found on this machine');
    console.log('');

    const detectedChoices = detection.providers.map((p, i) => ({
      name: `  ${i + 1}. ${p.name.padEnd(35)} ${chalk.gray(p.source === 'env' ? `($${p.envVar})` : p.source === 'dotenv' ? '(.env file)' : '(claude code)')}`,
      value: i,
      short: p.name
    }));

    detectedChoices.push({
      name: `  ${detection.providers.length + 1}. ${chalk.dim('Use a different provider (enter API key)')}`,
      value: -1,
      short: 'Different provider'
    });

    const { providerIdx } = await inquirer.prompt<{ providerIdx: number }>([
      {
        type: 'list',
        name: 'providerIdx',
        message: chalk.white('Which provider should cagan use?'),
        choices: detectedChoices,
        pageSize: detectedChoices.length
      }
    ]);

    if (providerIdx >= 0) {
      const detected: DetectedProvider = detection.providers[providerIdx];

      // Pick model
      const { model } = await inquirer.prompt<{ model: string }>([
        {
          type: 'list',
          name: 'model',
          message: chalk.white(`Model for ${detected.name}:`),
          choices: detected.models,
          default: detected.defaultModel
        }
      ]);

      chosen = {
        kind: detected.kind,
        envVar: detected.envVar,
        model,
        apiKey: detected.apiKey
      };
    }
  } else {
    printInfo('No AI providers detected. Let\'s set one up.');
    printStep(2, 4, 'Choose your AI provider');
  }

  // ── Step 2b: manual provider setup if needed ──────────────────────────
  if (!chosen) {
    const { providerKind } = await inquirer.prompt<{ providerKind: ProviderKind }>([
      {
        type: 'list',
        name: 'providerKind',
        message: chalk.white('Select provider:'),
        choices: PROVIDER_CHOICES.map(p => ({ name: p.name, value: p.value })),
        pageSize: PROVIDER_CHOICES.length
      }
    ]);

    const providerDef = PROVIDER_CHOICES.find(p => p.value === providerKind)!;

    const { model } = await inquirer.prompt<{ model: string }>([
      {
        type: 'list',
        name: 'model',
        message: chalk.white('Select model:'),
        choices: providerDef.models,
        default: providerDef.defaultModel
      }
    ]);

    const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
      {
        type: 'password',
        name: 'apiKey',
        message: chalk.white(`Paste your ${providerDef.name.split(' ')[0]} API key:`),
        mask: '•',
        validate: (v: string) => v.trim().length > 10 ? true : 'Key looks too short — check and try again'
      }
    ]);

    chosen = {
      kind: providerKind,
      envVar: providerDef.envVar,
      model,
      apiKey: apiKey.trim()
    };
  }

  // ── Step 3: test the key ───────────────────────────────────────────────
  printStep(3, 4, 'Testing connection…');
  printInfo(`Provider: ${chosen.kind}  |  Model: ${chosen.model}  |  Key: ${maskKey(chosen.apiKey)}`);
  console.log('');

  // Skip test if key is empty (claude-code source with no direct key)
  let validated = false;
  if (chosen.apiKey) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let si = 0;
    const timer = setInterval(() => {
      process.stdout.write(`\r  ${chalk.cyan(spinner[si++ % spinner.length])} Connecting to ${chosen!.kind}…`);
    }, 80);

    const result = await validateApiKey(chosen.kind, chosen.apiKey, chosen.model);
    clearInterval(timer);
    process.stdout.write('\r  ' + ' '.repeat(50) + '\r');

    if (result.ok) {
      printSuccess(`Connected! (${result.latencyMs}ms latency)`);
      validated = true;
    } else {
      printWarn(`Connection failed: ${result.error}`);
      const { continueAnyway } = await inquirer.prompt<{ continueAnyway: boolean }>([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: chalk.yellow('Save config anyway? (you can fix the key later)'),
          default: false
        }
      ]);
      if (!continueAnyway) {
        console.log(chalk.red('\n  Setup cancelled.\n'));
        process.exit(1);
      }
    }
  } else {
    printInfo('Skipping key test (using Claude Code auth)');
    validated = true;
  }

  // ── Step 4: write config ───────────────────────────────────────────────
  printStep(4, 4, 'Writing configuration…');

  const caganHome = join(homedir(), '.cagan');
  const projectCaganDir = join(cwd, '.cagan');

  mkdirSync(caganHome, { recursive: true, mode: 0o700 });
  mkdirSync(join(caganHome, 'backups'), { recursive: true });
  mkdirSync(projectCaganDir, { recursive: true });

  // Write API key to ~/.cagan/.env (not committed to git)
  const envFilePath = join(caganHome, '.env');
  const envLine = `${chosen.envVar}="${chosen.apiKey}"\n`;
  if (chosen.apiKey) {
    if (existsSync(envFilePath)) {
      const existing = readFileSync(envFilePath, 'utf-8');
      const lines = existing.split('\n').filter(l => !l.startsWith(`${chosen!.envVar}=`));
      lines.push(envLine.trim());
      writeFileSync(envFilePath, lines.join('\n') + '\n', { mode: 0o600 });
    } else {
      writeFileSync(envFilePath, envLine, { mode: 0o600 });
    }
    printSuccess(`API key saved to ${chalk.dim(envFilePath)}`);
  }

  // Write config.yaml to project dir
  const configYaml = buildYamlConfig({
    kind: chosen.kind,
    envVar: chosen.envVar,
    model: chosen.model
  });
  writeFileSync(join(projectCaganDir, 'config.yaml'), configYaml, 'utf-8');

  // Write global config to ~/.cagan/config.yaml if not already there
  const globalConfig = join(caganHome, 'config.yaml');
  if (!existsSync(globalConfig)) {
    writeFileSync(globalConfig, configYaml, 'utf-8');
  }

  // Write .caganignore
  if (!existsSync(join(cwd, '.caganignore'))) {
    writeFileSync(join(cwd, '.caganignore'), caganignoreContent, 'utf-8');
  }

  console.log('');
  console.log(chalk.bold.green('  ┌─────────────────────────────────────┐'));
  console.log(chalk.bold.green('  │') + chalk.bold.white('   cagan is ready. Start coding! 🚀   ') + chalk.bold.green('│'));
  console.log(chalk.bold.green('  └─────────────────────────────────────┘'));
  console.log('');
  console.log(chalk.bold('  Quick start:'));
  console.log(chalk.cyan('    cagan "fix the bug in auth.ts"'));
  console.log(chalk.cyan('    cagan agent --mode architect "design a REST API"'));
  console.log(chalk.cyan('    cagan swarm "build a full-stack app with tests"'));
  console.log('');

  if (!validated) {
    printWarn('Key validation was skipped. Update your key in ~/.cagan/.env when ready.');
  }
}
