import type { LLMProvider, ProviderConfig } from './types.js';
import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from './openai-compatible.js';
import { AnthropicCompatibleProvider, type AnthropicCompatibleConfig } from './anthropic-compatible.js';
import { GeminiProvider, type GeminiConfig } from './gemini.js';

export type { LLMProvider, ProviderConfig, OpenAICompatibleConfig, AnthropicCompatibleConfig, GeminiConfig };

export function createProvider(name: string, config: ProviderConfig): LLMProvider {
  const baseConfig = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    defaultModel: config.models.default
  };

  switch (config.type) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(name, baseConfig);
    case 'anthropic-compatible':
      return new AnthropicCompatibleProvider(name, {
        ...baseConfig,
        defaultModel: config.models.default
      } as AnthropicCompatibleConfig);
    case 'gemini':
      return new GeminiProvider({
        apiKey: config.apiKey,
        defaultModel: config.models.default
      } as GeminiConfig);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export { OpenAICompatibleProvider } from './openai-compatible.js';
export { AnthropicCompatibleProvider } from './anthropic-compatible.js';
export { GeminiProvider } from './gemini.js';