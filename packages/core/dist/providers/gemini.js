export class GeminiProvider {
    name = 'gemini';
    type = 'gemini';
    apiKey;
    defaultModel;
    baseUrl = 'https://generativelanguage.googleapis.com';
    retryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 60000
    };
    circuitBreaker = {
        failures: 0,
        isOpen: false,
        lastFailure: 0,
        threshold: 5
    };
    constructor(config) {
        this.apiKey = config.apiKey;
        this.defaultModel = config.defaultModel;
    }
    async chat(messages, options) {
        return this.executeWithRetry(() => this.makeRequest(messages, false, options));
    }
    async *chatStream(messages, options) {
        const response = await this.executeWithRetry(() => this.makeRequest(messages, true, options));
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]')
                            return;
                        try {
                            const parsed = JSON.parse(data);
                            yield this.parseDelta(parsed);
                        }
                        catch { }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async countTokens(messages) {
        const content = messages.map(m => m.content).join('\n');
        return Math.ceil(content.length / 4);
    }
    async getModels() {
        return [{
                id: this.defaultModel,
                name: this.defaultModel,
                provider: this.name,
                contextWindow: 32768,
                supportsTools: true,
                supportsStreaming: true
            }];
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/v1beta/models?key=${this.apiKey}`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async makeRequest(messages, stream, options) {
        const model = options?.model || this.defaultModel;
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        const body = {
            contents,
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens || 4096
            },
            stream
        };
        const url = `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
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
        const data = await response.json();
        return this.convertToOpenAIFormat(data);
    }
    convertToOpenAIFormat(data) {
        const candidates = data.candidates || [];
        const firstCandidate = candidates[0] || {};
        const content = firstCandidate.content || {};
        const parts = content.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        const usage = data.usageMetadata;
        return {
            id: `gemini-${Date.now()}`,
            model: this.defaultModel,
            choices: [{
                    index: 0,
                    message: { role: 'assistant', content: text },
                    finishReason: firstCandidate.finishReason || 'stop'
                }],
            usage: {
                promptTokens: usage?.promptTokenCount || 0,
                completionTokens: usage?.candidatesTokenCount || 0,
                totalTokens: usage?.totalTokenCount || 0
            }
        };
    }
    parseDelta(data) {
        const candidates = data.candidates || [];
        const firstCandidate = candidates[0] || {};
        const content = firstCandidate.content || {};
        const parts = content.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        return {
            id: `gemini-${Date.now()}`,
            delta: { content: text },
            finishReason: firstCandidate.finishReason,
            usage: undefined
        };
    }
    async executeWithRetry(fn) {
        if (this.circuitBreaker.isOpen) {
            const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailure;
            if (timeSinceFailure < 60000) {
                throw new Error('Circuit breaker is open');
            }
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failures = 0;
        }
        let lastError = null;
        for (let i = 0; i <= this.retryConfig.maxRetries; i++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (lastError.message === 'RATE_LIMIT') {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, i), this.retryConfig.maxDelay);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                if (i === this.retryConfig.maxRetries)
                    break;
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
//# sourceMappingURL=gemini.js.map