import { OpenAICompatibleProvider } from './openai-compatible.js';
import { AnthropicCompatibleProvider } from './anthropic-compatible.js';
import { GeminiProvider } from './gemini.js';
export function createProvider(name, config) {
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
            });
        case 'gemini':
            return new GeminiProvider({
                apiKey: config.apiKey,
                defaultModel: config.models.default
            });
        default:
            throw new Error(`Unknown provider type: ${config.type}`);
    }
}
export { OpenAICompatibleProvider } from './openai-compatible.js';
export { AnthropicCompatibleProvider } from './anthropic-compatible.js';
export { GeminiProvider } from './gemini.js';
//# sourceMappingURL=index.js.map