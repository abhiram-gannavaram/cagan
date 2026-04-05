import type { LLMProvider, ProviderConfig } from './types.js';
import { type OpenAICompatibleConfig } from './openai-compatible.js';
import { type AnthropicCompatibleConfig } from './anthropic-compatible.js';
import { type GeminiConfig } from './gemini.js';
export type { LLMProvider, ProviderConfig, OpenAICompatibleConfig, AnthropicCompatibleConfig, GeminiConfig };
export declare function createProvider(name: string, config: ProviderConfig): LLMProvider;
export { OpenAICompatibleProvider } from './openai-compatible.js';
export { AnthropicCompatibleProvider } from './anthropic-compatible.js';
export { GeminiProvider } from './gemini.js';
//# sourceMappingURL=index.d.ts.map