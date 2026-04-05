import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { homedir } from 'os';
import { join } from 'path';
import type { ProviderConfig } from '../providers/types.js';

export interface AppConfig {
  version: string;
  providers: Record<string, ProviderConfig>;
  defaults: {
    provider: string;
    code_mode_model: string;
    architect_model: string;
    autocomplete_model: string;
    orchestrator_model: string;
    max_parallel_agents: number;
    auto_commit: boolean;
    memory_enabled: boolean;
    budget_alert_usd: number;
  };
  security: {
    api_key_storage: string;
    byoaignore_path: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0',
  providers: {},
  defaults: {
    provider: 'minimax',
    code_mode_model: 'MiniMax-M2.7',
    architect_model: 'MiniMax-M2.7',
    autocomplete_model: 'MiniMax-M2.7-highspeed',
    orchestrator_model: 'MiniMax-M2.7',
    max_parallel_agents: 10,
    auto_commit: true,
    memory_enabled: true,
    budget_alert_usd: 5.0
  },
  security: {
    api_key_storage: 'keychain',
    byoaignore_path: '~/.byoadev/byoaignore'
  }
};

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor(projectPath?: string) {
    const configDir = projectPath 
      ? join(projectPath, '.byoadev')
      : join(homedir(), '.byoadev');
    this.configPath = join(configDir, 'config.yaml');
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        const parsed = parse(content) as Partial<AppConfig>;
        return this.mergeConfig(DEFAULT_CONFIG, parsed);
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  }

  private mergeConfig(defaultConfig: AppConfig, parsed: Partial<AppConfig>): AppConfig {
    const result: AppConfig = { ...defaultConfig };

    if (parsed.version) result.version = parsed.version;

    if (parsed.defaults) {
      result.defaults = { ...result.defaults, ...parsed.defaults };
    }

    if (parsed.security) {
      result.security = { ...result.security, ...parsed.security };
    }

    if (parsed.providers) {
      result.providers = {};
      for (const [name, provider] of Object.entries(parsed.providers as Record<string, unknown>)) {
        const p = provider as Record<string, unknown>;
        result.providers[name] = {
          name,
          type: ((p.type as string) || 'openai-compatible') as 'openai-compatible' | 'anthropic-compatible' | 'gemini',
          baseUrl: (p.base_url as string) || '',
          apiKey: (p.apiKey as string) || '',
          models: {
            default: ((p.models as Record<string, string>)?.default) || '',
            autocomplete: (p.models as Record<string, string>)?.autocomplete,
            reasoning: (p.models as Record<string, string>)?.reasoning
          },
          pricing: {
            input: ((p.pricing as Record<string, number>)?.input) || 0,
            output: ((p.pricing as Record<string, number>)?.output) || 0
          }
        };
      }
    }

    return result;
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getProvider(name: string): ProviderConfig | undefined {
    return this.config.providers[name];
  }

  getDefaultProvider(): string {
    return this.config.defaults.provider;
  }

  getDefaultModel(mode: string): string {
    switch (mode) {
      case 'code':
        return this.config.defaults.code_mode_model;
      case 'architect':
        return this.config.defaults.architect_model;
      case 'autocomplete':
        return this.config.defaults.autocomplete_model;
      case 'orchestrator':
        return this.config.defaults.orchestrator_model;
      default:
        return this.config.defaults.code_mode_model;
    }
  }

  resolveApiKey(providerName: string): string {
    const provider = this.config.providers[providerName];
    if (!provider) return '';
    
    const apiKey = provider.apiKey;
    if (apiKey.startsWith('${') && apiKey.endsWith('}')) {
      const envVar = apiKey.slice(2, -1);
      return process.env[envVar] || '';
    }
    return apiKey;
  }

  reload(): void {
    this.config = this.loadConfig();
  }
}

let globalConfigManager: ConfigManager | null = null;

export function getConfigManager(projectPath?: string): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(projectPath);
  }
  return globalConfigManager;
}