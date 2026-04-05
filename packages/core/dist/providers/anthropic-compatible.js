export class AnthropicCompatibleProvider {
    name;
    type = 'anthropic-compatible';
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
        return [{
                id: this.defaultModel,
                name: this.defaultModel,
                provider: this.name,
                contextWindow: 200000,
                supportsTools: true,
                supportsStreaming: true
            }];
    }
    async healthCheck() {
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
        }
        catch {
            return false;
        }
    }
    async makeRequest(messages, stream, options) {
        const anthropicMessages = this.formatMessagesForAnthropic(messages);
        const body = {
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
        const data = await response.json();
        return this.convertToOpenAIFormat(data);
    }
    formatMessagesForAnthropic(messages) {
        const result = [];
        let systemContent = '';
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemContent += msg.content + '\n';
            }
            else {
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
    convertToOpenAIFormat(data) {
        const content = data.content || [];
        const text = content.map((c) => c.text || '').join('');
        const usage = data.usage;
        return {
            id: `ant-${Date.now()}`,
            model: data.model || this.defaultModel,
            choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: text
                    },
                    finishReason: data.stop_reason || 'stop'
                }],
            usage: {
                promptTokens: usage?.input_tokens || 0,
                completionTokens: usage?.output_tokens || 0,
                totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
            }
        };
    }
    parseDelta(data) {
        const type = data.type;
        if (type === 'content_block_start') {
            const content = data.content || {};
            return {
                id: String(data.index || 0),
                delta: { content: content.text || '' },
                finishReason: undefined,
                usage: undefined
            };
        }
        if (type === 'content_block_delta') {
            const delta = data.delta || {};
            return {
                id: String(data.index || 0),
                delta: { content: delta.text || '' },
                finishReason: undefined,
                usage: undefined
            };
        }
        if (type === 'message_delta') {
            const usage = data.usage;
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
//# sourceMappingURL=anthropic-compatible.js.map