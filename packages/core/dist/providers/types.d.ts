export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCalls?: ToolCall[];
    toolCallId?: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface ChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: ToolDefinition[];
    responseFormat?: 'text' | 'json_object';
    stream?: boolean;
}
export interface ChatCompletion {
    id: string;
    model: string;
    choices: Choice[];
    usage?: TokenUsage;
}
export interface Choice {
    index: number;
    message: Message;
    finishReason: string;
}
export interface ChatDelta {
    id: string;
    delta: {
        role?: string;
        content?: string;
        toolCalls?: ToolCall[];
    };
    finishReason?: string;
    usage?: TokenUsage;
}
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface Model {
    id: string;
    name: string;
    provider: string;
    contextWindow: number;
    supportsTools?: boolean;
    supportsStreaming?: boolean;
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface ProviderConfig {
    name: string;
    type: 'openai-compatible' | 'anthropic-compatible' | 'gemini';
    baseUrl: string;
    apiKey: string;
    models: {
        default: string;
        autocomplete?: string;
        reasoning?: string;
    };
    pricing: {
        input: number;
        output: number;
    };
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}
export interface CircuitBreakerState {
    failures: number;
    isOpen: boolean;
    lastFailure: number;
}
export interface LLMProvider {
    name: string;
    type: 'openai-compatible' | 'anthropic-compatible' | 'gemini';
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    chat(messages: Message[], options?: ChatOptions): Promise<ChatCompletion>;
    chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatDelta>;
    countTokens(messages: Message[]): Promise<number>;
    getModels(): Promise<Model[]>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=types.d.ts.map