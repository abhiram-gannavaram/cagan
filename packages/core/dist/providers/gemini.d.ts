import type { LLMProvider, Message, ChatOptions, ChatCompletion, ChatDelta, Model } from './types.js';
export interface GeminiConfig {
    apiKey: string;
    defaultModel: string;
}
export declare class GeminiProvider implements LLMProvider {
    name: string;
    type: 'gemini';
    apiKey: string;
    defaultModel: string;
    baseUrl: string;
    private retryConfig;
    private circuitBreaker;
    constructor(config: GeminiConfig);
    chat(messages: Message[], options?: ChatOptions): Promise<ChatCompletion>;
    chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatDelta>;
    countTokens(messages: Message[]): Promise<number>;
    getModels(): Promise<Model[]>;
    healthCheck(): Promise<boolean>;
    private makeRequest;
    private convertToOpenAIFormat;
    private parseDelta;
    private executeWithRetry;
}
//# sourceMappingURL=gemini.d.ts.map