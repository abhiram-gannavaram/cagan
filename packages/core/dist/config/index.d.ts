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
        caganignore_path: string;
    };
}
export declare class ConfigManager {
    private config;
    private configPath;
    constructor(projectPath?: string);
    private loadConfig;
    private mergeConfig;
    getConfig(): AppConfig;
    getProvider(name: string): ProviderConfig | undefined;
    getDefaultProvider(): string;
    getDefaultModel(mode: string): string;
    resolveApiKey(providerName: string): string;
    reload(): void;
}
export declare function getConfigManager(projectPath?: string): ConfigManager;
//# sourceMappingURL=index.d.ts.map