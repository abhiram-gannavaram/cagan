import type {
  LLMProvider,
  Message,
  ChatOptions,
  ChatCompletion,
  ChatDelta,
  Model
} from './types.js';

export interface AnthropicCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

export class AnthropicCompatibleProvider implements LLMProvider {
  name: string;
  type: 'anthropic-compatible' = 'anthropic-compatible';
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

  constructor(name: string, config: AnthropicCompatibleConfig) {
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
    return [{
      id: this.defaultModel,
      name: this.defaultModel,
      provider: this.name,
      contextWindow: 200000,
      supportsTools: true,
      supportsStreaming: true
    }];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  }

  private async makeRequest(messages: Message[], stream: boolean, options?: ChatOptions): Promise<ChatCompletion | Response> {
    const anthropicMessages = this.formatMessagesForAnthropic(messages);
    const body: Record<string, unknown> = {
      model: options?.model || this.defaultModel,
      messages: anthropicMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096
    };

    if (options?.tools?.length) {
      body.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }

    body.stream = stream;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
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

    const data = await response.json() as Record<string, unknown>;
    return this.convertToOpenAIFormat(data);
  }

  private formatMessagesForAnthropic(messages: Message[]): object[] {
    const result: object[] = [];
    let systemContent = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemContent += msg.content + '\n';
      } else {
        result.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    if (systemContent) {
      result.unshift({ role: 'user', content: systemContent });
    }

    return result;
  }

  private convertToOpenAIFormat(data: Record<string, unknown>): ChatCompletion {
    const content = data.content as Record<string, unknown>[] || [];
    const text = content.map((c: Record<string, unknown>) => c.text || '').join('');
    const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;

    return {
      id: `ant-${Date.now()}`,
      model: data.model as string || this.defaultModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: text
        },
        finishReason: data.stop_reason as string || 'stop'
      }],
      usage: {
        promptTokens: usage?.input_tokens || 0,
        completionTokens: usage?.output_tokens || 0,
        totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
      }
    };
  }

  private parseDelta(data: Record<string, unknown>): ChatDelta {
    const type = data.type as string;
    
    if (type === 'content_block_start') {
      const content = data.content as Record<string, unknown> || {};
      return {
        id: String(data.index || 0),
        delta: { content: content.text as string || '' },
        finishReason: undefined,
        usage: undefined
      };
    }

    if (type === 'content_block_delta') {
      const delta = data.delta as Record<string, unknown> || {};
      return {
        id: String(data.index || 0),
        delta: { content: delta.text as string || '' },
        finishReason: undefined,
        usage: undefined
      };
    }

    if (type === 'message_delta') {
      const usage = data.usage as { input_tokens?: number; output_tokens?: number; stop_reason?: string } | undefined;
      return {
        id: '',
        delta: {},
        finishReason: usage?.stop_reason,
        usage: {
          promptTokens: usage?.input_tokens || 0,
          completionTokens: usage?.output_tokens || 0,
          totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
        }
      };
    }

    return { id: '', delta: {}, finishReason: undefined, usage: undefined };
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