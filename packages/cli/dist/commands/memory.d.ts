interface MemoryOptions {
    scope: string;
    list?: boolean;
    search?: string;
    clear?: boolean;
}
export declare function memoryCommand(options: MemoryOptions): Promise<void>;
export {};
