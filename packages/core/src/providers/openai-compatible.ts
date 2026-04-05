import type {
  LLMProvider,
  Message,
  ChatOptions,
  ChatCompletion,
  ChatDelta,
  Model,
  ToolDefinition
} from './types.js';

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  name: string;
  type: 'openai-compatible' = 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  
  private retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 60000
  };
  
  private circuitBreaker = {
    failures: 0,
    isOpen: false,
    lastFailure: 0,
    threshold: 5
  };

  constructor(name: string, config: OpenAICompatibleConfig) {
    this.name = name;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatCompletion> {
    return this.executeWithRetry(() => this.makeRequest(messages, false, options)) as Promise<ChatCompletion>;
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatDelta> {
    const response = await this.executeWithRetry(() => this.makeRequest(messages, true, options));
    const reader = (response as Response).body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              yield this.parseDelta(parsed);
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    const content = messages.map(m => m.content).join('\n');
    return Math.ceil(content.length / 4);
  }

  async getModels(): Promise<Model[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, { // NETWORK: lists models at user's configured provider endpoint
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      const data = await response.json() as { data?: Record<string, unknown>[] };
      return (data.data || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: m.name as string || m.id as string,
        provider: this.name,
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true
      }));
    } catch {
      return [{ id: this.defaultModel, name: this.defaultModel, provider: this.name, contextWindow: 128000 }];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/models`, { // NETWORK: health check ping to user's configured provider endpoint
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return true;
    } catch {
      return false;
    }
  }

  private async makeRequest(messages: Message[], stream: boolean, options?: ChatOptions): Promise<ChatCompletion | Response> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, { // NETWORK: sends chat messages to user's configured provider endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages: this.formatMessages(messages),
        tools: options?.tools?.map(t => ({
          type: t.type,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        stream
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMIT');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    if (stream) {
      return response;
    }

    return response.json() as Promise<ChatCompletion>;
  }

  private formatMessages(messages: Message[]): object[] {
    return messages.map(m => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.name) msg.name = m.name;
      if (m.toolCalls) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: tc.function
        }));
      }
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      return msg;
    });
  }

  private parseDelta(data: Record<string, unknown>): ChatDelta {
    const choice = (data.choices as Record<string, unknown>[] || [])[0] || {};
    const delta = choice.delta as Record<string, unknown> || {};
    return {
      id: data.id as string || '',
      delta: {
        role: delta.role as string,
        content: delta.content as string,
        toolCalls: delta.tool_calls as ChatDelta['delta']['toolCalls']
      },
      finishReason: choice.finish_reason as string,
      usage: data.usage as ChatDelta['usage']
    };
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    if (this.circuitBreaker.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailure;
      if (timeSinceFailure < 60000) {
        throw new Error('Circuit breaker is open');
      }
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
    }

    let lastError: Error | null = null;
    for (let i = 0; i <= this.retryConfig.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (lastError.message === 'RATE_LIMIT') {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, i),
            this.retryConfig.maxDelay
          );
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (i === this.retryConfig.maxRetries) break;
        await new Promise(r => setTimeout(r, this.retryConfig.baseDelay * Math.pow(2, i)));
      }
    }

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
    }
    throw lastError;
  }
}