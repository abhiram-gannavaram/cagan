export class OpenAICompatibleProvider {
    name;
    type = 'openai-compatible';
    baseUrl;
    apiKey;
    defaultModel;
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
    constructor(name, config) {
        this.name = name;
        this.baseUrl = config.baseUrl;
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
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { Authorization: `Bearer ${this.apiKey}` }
            });
            const data = await response.json();
            return (data.data || []).map((m) => ({
                id: m.id,
                name: m.name || m.id,
                provider: this.name,
                contextWindow: 128000,
                supportsTools: true,
                supportsStreaming: true
            }));
        }
        catch {
            return [{ id: this.defaultModel, name: this.defaultModel, provider: this.name, contextWindow: 128000 }];
        }
    }
    async healthCheck() {
        try {
            await fetch(`${this.baseUrl}/models`, {
                headers: { Authorization: `Bearer ${this.apiKey}` }
            });
            return true;
        }
        catch {
            return false;
        }
    }
    async makeRequest(messages, stream, options) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
        return response.json();
    }
    formatMessages(messages) {
        return messages.map(m => {
            const msg = { role: m.role, content: m.content };
            if (m.name)
                msg.name = m.name;
            if (m.toolCalls) {
                msg.tool_calls = m.toolCalls.map(tc => ({
                    id: tc.id,
                    type: tc.type,
                    function: tc.function
                }));
            }
            if (m.toolCallId)
                msg.tool_call_id = m.toolCallId;
            return msg;
        });
    }
    parseDelta(data) {
        const choice = (data.choices || [])[0] || {};
        const delta = choice.delta || {};
        return {
            id: data.id || '',
            delta: {
                role: delta.role,
                content: delta.content,
                toolCalls: delta.tool_calls
            },
            finishReason: choice.finish_reason,
            usage: data.usage
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
//# sourceMappingURL=openai-compatible.js.map