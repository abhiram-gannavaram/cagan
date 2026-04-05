import type { ChatDelta } from '../providers/types.js';

export class StreamingParser {
  private buffer: string = '';
  private decoder = new TextDecoder();

  parseChunk(chunk: Uint8Array): ChatDelta | null {
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
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private convertDelta(data: Record<string, unknown>): ChatDelta {
    const choices = data.choices as Record<string, unknown>[] || [];
    const choice = choices[0] || {};
    const delta = choice.delta as Record<string, unknown> || {};

    return {
      id: data.id as string || '',
      delta: {
        role: delta.role as string,
        content: delta.content as string,
        toolCalls: this.parseToolCalls(delta.tool_calls as Record<string, unknown>[])
      },
      finishReason: choice.finish_reason as string,
      usage: data.usage as ChatDelta['usage']
    };
  }

  private parseToolCalls(toolCalls: Record<string, unknown>[] | undefined): ChatDelta['delta']['toolCalls'] {
    if (!toolCalls) return undefined;
    
    return toolCalls.map(tc => ({
      id: tc.id as string,
      type: 'function' as const,
      function: {
        name: (tc.function as { name?: string })?.name as string || '',
        arguments: typeof (tc.function as { arguments?: unknown })?.arguments === 'string' 
          ? (tc.function as { arguments: string }).arguments 
          : JSON.stringify((tc.function as { arguments?: unknown })?.arguments || {})
      }
    }));
  }

  reset(): void {
    this.buffer = '';
  }
}

export class DeltaAccumulator {
  private content: string = '';
  private toolCalls: Map<string, { name: string; arguments: string }> = new Map();
  private finished = false;
  private finishReason: string | undefined;

  add(delta: ChatDelta): void {
    if (delta.delta.content) {
      this.content += delta.delta.content;
    }

    if (delta.delta.toolCalls) {
      for (const tc of delta.delta.toolCalls) {
        if (!this.toolCalls.has(tc.id)) {
          this.toolCalls.set(tc.id, { name: tc.function.name, arguments: '' });
        }
        const existing = this.toolCalls.get(tc.id)!;
        existing.arguments += tc.function.arguments;
      }
    }

    if (delta.finishReason) {
      this.finished = true;
      this.finishReason = delta.finishReason;
    }
  }

  getContent(): string {
    return this.content;
  }

  getToolCalls(): { id: string; name: string; arguments: string }[] {
    return Array.from(this.toolCalls.entries()).map(([id, tc]) => ({
      id,
      name: tc.name,
      arguments: tc.arguments
    }));
  }

  isFinished(): boolean {
    return this.finished;
  }

  getFinishReason(): string | undefined {
    return this.finishReason;
  }

  reset(): void {
    this.content = '';
    this.toolCalls.clear();
    this.finished = false;
    this.finishReason = undefined;
  }
}

export async function* toAsyncIterator<T>(
  stream: ReadableStream<T>
): AsyncIterable<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}