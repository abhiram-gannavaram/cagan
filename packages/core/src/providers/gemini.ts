import type {
  LLMProvider,
  Message,
  ChatOptions,
  ChatCompletion,
  ChatDelta,
  Model
} from './types.js';

export interface GeminiConfig {
  apiKey: string;
  defaultModel: string;
}

export class GeminiProvider implements LLMProvider {
  name: string = 'gemini';
  type: 'gemini' = 'gemini';
  apiKey: string;
  defaultModel: string;
  baseUrl: string = 'https://generativelanguage.googleapis.com';

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

  constructor(config: GeminiConfig) {
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
      contextWindow: 32768,
      supportsTools: true,
      supportsStreaming: true
    }];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1beta/models?key=${this.apiKey}`); // NETWORK: health check to Google Gemini API using user's API key
      return response.ok;
    } catch {
      return false;
    }
  }

  private async makeRequest(messages: Message[], stream: boolean, options?: ChatOptions): Promise<ChatCompletion | Response> {
    const model = options?.model || this.defaultModel;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens || 4096
      },
      stream
    };

    const url = `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, { // NETWORK: sends chat messages to Google Gemini API using user's API key
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  private convertToOpenAIFormat(data: Record<string, unknown>): ChatCompletion {
    const candidates = data.candidates as Record<string, unknown>[] || [];
    const firstCandidate = candidates[0] || {};
    const content = firstCandidate.content as Record<string, unknown> || {};
    const parts = content.parts as Record<string, unknown>[] || [];
    const text = parts.map((p: Record<string, unknown>) => p.text || '').join('');
    const usage = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;

    return {
      id: `gemini-${Date.now()}`,
      model: this.defaultModel,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finishReason: (firstCandidate.finishReason as string) || 'stop'
      }],
      usage: {
        promptTokens: usage?.promptTokenCount || 0,
        completionTokens: usage?.candidatesTokenCount || 0,
        totalTokens: usage?.totalTokenCount || 0
      }
    };
  }

  private parseDelta(data: Record<string, unknown>): ChatDelta {
    const candidates = data.candidates as Record<string, unknown>[] || [];
    const firstCandidate = candidates[0] || {};
    const content = firstCandidate.content as Record<string, unknown> || {};
    const parts = content.parts as Record<string, unknown>[] || [];
    const text = parts.map((p: Record<string, unknown>) => p.text || '').join('');

    return {
      id: `gemini-${Date.now()}`,
      delta: { content: text },
      finishReason: firstCandidate.finishReason as string,
      usage: undefined
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