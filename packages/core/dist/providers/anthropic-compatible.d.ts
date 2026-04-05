import type { LLMProvider, Message, ChatOptions, ChatCompletion, ChatDelta, Model } from './types.js';
export interface AnthropicCompatibleConfig {
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
}
export declare class AnthropicCompatibleProvider implements LLMProvider {
    name: string;
    type: 'anthropic-compatible';
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    private retryConfig;
    private circuitBreaker;
    constructor(name: string, config: AnthropicCompatibleConfig);
    chat(messages: Message[], options?: ChatOptions): Promise<ChatCompletion>;
    chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatDelta>;
    countTokens(messages: Message[]): Promise<number>;
    getModels(): Promise<Model[]>;
    healthCheck(): Promise<boolean>;
    private makeRequest;
    private formatMessagesForAnthropic;
    private convertToOpenAIFormat;
    private parseDelta;
    private executeWithRetry;
}
//# sourceMappingURL=anthropic-compatible.d.ts.map