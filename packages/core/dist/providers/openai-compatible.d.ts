import type { LLMProvider, Message, ChatOptions, ChatCompletion, ChatDelta, Model } from './types.js';
export interface OpenAICompatibleConfig {
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
}
export declare class OpenAICompatibleProvider implements LLMProvider {
    name: string;
    type: 'openai-compatible';
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    private retryConfig;
    private circuitBreaker;
    constructor(name: string, config: OpenAICompatibleConfig);
    chat(messages: Message[], options?: ChatOptions): Promise<ChatCompletion>;
    chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatDelta>;
    countTokens(messages: Message[]): Promise<number>;
    getModels(): Promise<Model[]>;
    healthCheck(): Promise<boolean>;
    private makeRequest;
    private formatMessages;
    private parseDelta;
    private executeWithRetry;
}
//# sourceMappingURL=openai-compatible.d.ts.map