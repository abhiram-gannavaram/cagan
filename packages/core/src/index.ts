export * from './providers/index.js';
export * from './agents/index.js';
export * from './memory/index.js';
export * from './tools/index.js';
export * from './diff/index.js';
export * from './cost/index.js';
export * from './streaming/index.js';
export * from './mcp/index.js';
export * from './config/index.js';
export * from './detection/index.js';
export * from './validation/index.js';

import { createProvider } from './providers/index.js';
import { createAgent } from './agents/index.js';
import { getConfigManager } from './config/index.js';
import { getMemoryManager } from './memory/index.js';
import { getCostTracker } from './cost/index.js';

export class CaganCore {
  async initialize(projectPath?: string): Promise<void> {
    const config = getConfigManager(projectPath);
    const memory = getMemoryManager(projectPath);
    const cost = getCostTracker(config.getConfig().defaults.budget_alert_usd);

    for (const [name, providerConfig] of Object.entries(config.getConfig().providers)) {
      const provider = createProvider(name, providerConfig);
      const health = await provider.healthCheck();
      if (!health) {
        console.warn(`Provider ${name} health check failed`);
      }
    }
  }

  createAgent(config: {
    mode: 'code' | 'architect' | 'debug' | 'review' | 'ask';
    providerName?: string;
    model?: string;
    cwd: string;
    workspaceRoot: string;
  }) {
    const configManager = getConfigManager(config.workspaceRoot);
    const providerName = config.providerName || configManager.getDefaultProvider();
    const providerConfig = configManager.getProvider(providerName);

    if (!providerConfig) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const provider = createProvider(providerName, providerConfig);
    const model = config.model || configManager.getDefaultModel(config.mode);

    return createAgent({
      id: `agent-${Date.now()}`,
      mode: config.mode,
      provider,
      model,
      cwd: config.cwd,
      workspaceRoot: config.workspaceRoot
    });
  }
}

export const core = new CaganCore();