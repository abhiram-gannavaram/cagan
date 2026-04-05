import type { ChatDelta } from '../providers/types.js';
export declare class StreamingParser {
    private buffer;
    private decoder;
    parseChunk(chunk: Uint8Array): ChatDelta | null;
    private convertDelta;
    private parseToolCalls;
    reset(): void;
}
export declare class DeltaAccumulator {
    private content;
    private toolCalls;
    private finished;
    private finishReason;
    add(delta: ChatDelta): void;
    getContent(): string;
    getToolCalls(): {
        id: string;
        name: string;
        arguments: string;
    }[];
    isFinished(): boolean;
    getFinishReason(): string | undefined;
    reset(): void;
}
export declare function toAsyncIterator<T>(stream: ReadableStream<T>): AsyncIterable<T>;
//# sourceMappingURL=index.d.ts.map