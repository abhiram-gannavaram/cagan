import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type ProviderKind =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'mistral'
  | 'groq'
  | 'azure-openai'
  | 'minimax'
  | 'custom';

export interface DetectedProvider {
  kind: ProviderKind;
  name: string;
  envVar: string;
  apiKey: string;
  defaultModel: string;
  models: string[];
  source: 'env' | 'dotenv' | 'claude-code';
}

export interface DetectionResult {
  providers: DetectedProvider[];
  hasClaudeCode: boolean;
  hasCopilot: boolean;
  hasCursor: boolean;
}

const KNOWN_PROVIDERS: Array<{
  kind: ProviderKind;
  envVar: string;
  name: string;
  defaultModel: string;
  models: string[];
}> = [
  {
    kind: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    name: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022']
  },
  {
    kind: 'openai',
    envVar: 'OPENAI_API_KEY',
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o1']
  },
  {
    kind: 'gemini',
    envVar: 'GEMINI_API_KEY',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro']
  },
  {
    kind: 'gemini',
    envVar: 'GOOGLE_API_KEY',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro']
  },
  {
    kind: 'deepseek',
    envVar: 'DEEPSEEK_API_KEY',
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    kind: 'mistral',
    envVar: 'MISTRAL_API_KEY',
    name: 'Mistral',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest']
  },
  {
    kind: 'groq',
    envVar: 'GROQ_API_KEY',
    name: 'Groq (ultra-fast inference)',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  },
  {
    kind: 'azure-openai',
    envVar: 'AZURE_OPENAI_API_KEY',
    name: 'Azure OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo']
  },
  {
    kind: 'minimax',
    envVar: 'MINIMAX_API_KEY',
    name: 'MiniMax',
    defaultModel: 'MiniMax-M2.7',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'abab6.5s-chat']
  }
];

function parseDotEnv(filePath: string): Record<string, string> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function detectProviders(workspacePath?: string): DetectionResult {
  const found = new Map<string, DetectedProvider>();

  // 1. Live environment variables
  for (const def of KNOWN_PROVIDERS) {
    const key = process.env[def.envVar];
    if (key && key.length > 10 && !found.has(def.kind)) {
      found.set(def.kind, {
        kind: def.kind,
        name: def.name,
        envVar: def.envVar,
        apiKey: key,
        defaultModel: def.defaultModel,
        models: def.models,
        source: 'env'
      });
    }
  }

  // 2. .env files (workspace and home)
  const dotEnvPaths: string[] = [
    join(homedir(), '.cagan', '.env'),
    ...(workspacePath ? [join(workspacePath, '.env'), join(workspacePath, '.env.local')] : []),
    join(homedir(), '.env')
  ].filter(p => existsSync(p));

  for (const envPath of dotEnvPaths) {
    const parsed = parseDotEnv(envPath);
    for (const def of KNOWN_PROVIDERS) {
      const key = parsed[def.envVar];
      if (key && key.length > 10 && !found.has(def.kind)) {
        found.set(def.kind, {
          kind: def.kind,
          name: def.name,
          envVar: def.envVar,
          apiKey: key,
          defaultModel: def.defaultModel,
          models: def.models,
          source: 'dotenv'
        });
      }
    }
  }

  // 3. Claude Code install detection
  const claudeCodePaths = [
    join(homedir(), '.claude'),
    join(homedir(), '.config', 'claude')
  ];
  const hasClaudeCode = claudeCodePaths.some(p => existsSync(p));

  if (hasClaudeCode && !found.has('anthropic')) {
    found.set('anthropic', {
      kind: 'anthropic',
      name: 'Anthropic (via Claude Code)',
      envVar: 'ANTHROPIC_API_KEY',
      apiKey: '',
      defaultModel: 'claude-3-5-sonnet-20241022',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
      source: 'claude-code'
    });
  }

  // 4. GitHub Copilot detection
  const copilotPaths = [
    join(homedir(), '.config', 'github-copilot'),
    join(homedir(), 'AppData', 'Roaming', 'GitHub Copilot'),
    join(homedir(), 'Library', 'Application Support', 'GitHub Copilot')
  ];
  const hasCopilot = copilotPaths.some(p => existsSync(p));

  // 5. Cursor detection
  const cursorPaths = [
    join(homedir(), '.cursor'),
    join(homedir(), 'AppData', 'Roaming', 'Cursor'),
    '/Applications/Cursor.app',
    join(homedir(), '.config', 'Cursor')
  ];
  const hasCursor = cursorPaths.some(p => existsSync(p));

  return {
    providers: Array.from(found.values()),
    hasClaudeCode,
    hasCopilot,
    hasCursor
  };
}
