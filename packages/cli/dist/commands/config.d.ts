interface ConfigOptions {
    listProviders?: boolean;
    addProvider?: string;
}
export declare function configCommand(options: ConfigOptions): Promise<void>;
export {};
