interface ChatOptions {
    provider?: string;
}
export declare function chatCommand(message: string, options: ChatOptions): Promise<void>;
export {};
