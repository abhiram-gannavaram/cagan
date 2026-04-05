export class StreamingParser {
    buffer = '';
    decoder = new TextDecoder();
    parseChunk(chunk) {
        this.buffer += this.decoder.decode(chunk, { stream: true });
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    return null;
                }
                try {
                    const parsed = JSON.parse(data);
                    return this.convertDelta(parsed);
                }
                catch {
                    continue;
                }
            }
        }
        return null;
    }
    convertDelta(data) {
        const choices = data.choices || [];
        const choice = choices[0] || {};
        const delta = choice.delta || {};
        return {
            id: data.id || '',
            delta: {
                role: delta.role,
                content: delta.content,
                toolCalls: this.parseToolCalls(delta.tool_calls)
            },
            finishReason: choice.finish_reason,
            usage: data.usage
        };
    }
    parseToolCalls(toolCalls) {
        if (!toolCalls)
            return undefined;
        return toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
                name: tc.function?.name || '',
                arguments: typeof tc.function?.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function?.arguments || {})
            }
        }));
    }
    reset() {
        this.buffer = '';
    }
}
export class DeltaAccumulator {
    content = '';
    toolCalls = new Map();
    finished = false;
    finishReason;
    add(delta) {
        if (delta.delta.content) {
            this.content += delta.delta.content;
        }
        if (delta.delta.toolCalls) {
            for (const tc of delta.delta.toolCalls) {
                if (!this.toolCalls.has(tc.id)) {
                    this.toolCalls.set(tc.id, { name: tc.function.name, arguments: '' });
                }
                const existing = this.toolCalls.get(tc.id);
                existing.arguments += tc.function.arguments;
            }
        }
        if (delta.finishReason) {
            this.finished = true;
            this.finishReason = delta.finishReason;
        }
    }
    getContent() {
        return this.content;
    }
    getToolCalls() {
        return Array.from(this.toolCalls.entries()).map(([id, tc]) => ({
            id,
            name: tc.name,
            arguments: tc.arguments
        }));
    }
    isFinished() {
        return this.finished;
    }
    getFinishReason() {
        return this.finishReason;
    }
    reset() {
        this.content = '';
        this.toolCalls.clear();
        this.finished = false;
        this.finishReason = undefined;
    }
}
export async function* toAsyncIterator(stream) {
    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            yield value;
        }
    }
    finally {
        reader.releaseLock();
    }
}
//# sourceMappingURL=index.js.map