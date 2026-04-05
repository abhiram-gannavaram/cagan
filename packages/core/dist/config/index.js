import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { homedir } from 'os';
import { join } from 'path';
const DEFAULT_CONFIG = {
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
        caganignore_path: '~/.cagan/caganignore'
    }
};
export class ConfigManager {
    config;
    configPath;
    constructor(projectPath) {
        const configDir = projectPath
            ? join(projectPath, '.cagan')
            : join(homedir(), '.cagan');
        this.configPath = join(configDir, 'config.yaml');
        this.config = this.loadConfig();
    }
    loadConfig() {
        if (existsSync(this.configPath)) {
            try {
                const content = readFileSync(this.configPath, 'utf-8');
                const parsed = parse(content);
                return this.mergeConfig(DEFAULT_CONFIG, parsed);
            }
            catch {
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    }
    mergeConfig(defaultConfig, parsed) {
        const result = { ...defaultConfig };
        if (parsed.version)
            result.version = parsed.version;
        if (parsed.defaults) {
            result.defaults = { ...result.defaults, ...parsed.defaults };
        }
        if (parsed.security) {
            result.security = { ...result.security, ...parsed.security };
        }
        if (parsed.providers) {
            result.providers = {};
            for (const [name, provider] of Object.entries(parsed.providers)) {
                const p = provider;
                result.providers[name] = {
                    name,
                    type: (p.type || 'openai-compatible'),
                    baseUrl: p.base_url || '',
                    apiKey: p.apiKey || '',
                    models: {
                        default: (p.models?.default) || '',
                        autocomplete: p.models?.autocomplete,
                        reasoning: p.models?.reasoning
                    },
                    pricing: {
                        input: (p.pricing?.input) || 0,
                        output: (p.pricing?.output) || 0
                    }
                };
            }
        }
        return result;
    }
    getConfig() {
        return this.config;
    }
    getProvider(name) {
        return this.config.providers[name];
    }
    getDefaultProvider() {
        return this.config.defaults.provider;
    }
    getDefaultModel(mode) {
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
    resolveApiKey(providerName) {
        const provider = this.config.providers[providerName];
        if (!provider)
            return '';
        const apiKey = provider.apiKey;
        if (apiKey.startsWith('${') && apiKey.endsWith('}')) {
            const envVar = apiKey.slice(2, -1);
            return process.env[envVar] || '';
        }
        return apiKey;
    }
    reload() {
        this.config = this.loadConfig();
    }
}
let globalConfigManager = null;
export function getConfigManager(projectPath) {
    if (!globalConfigManager) {
        globalConfigManager = new ConfigManager(projectPath);
    }
    return globalConfigManager;
}
//# sourceMappingURL=index.js.map