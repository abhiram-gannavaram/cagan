declare class SimpleKeychain {
    private storePath;
    private store;
    constructor();
    private load;
    private save;
    setPassword(service: string, account: string, password: string): Promise<void>;
    getPassword(service: string, account: string): Promise<string | null>;
    deletePassword(service: string, account: string): Promise<boolean>;
    findCredentials(service: string): Promise<{
        account: string;
        password: string;
    }[]>;
}
export declare function getKeychain(): Promise<SimpleKeychain>;
export declare function storeApiKey(provider: string, apiKey: string): Promise<void>;
export declare function retrieveApiKey(provider: string): Promise<string | null>;
export declare function deleteApiKey(provider: string): Promise<boolean>;
export declare function listStoredProviders(): Promise<string[]>;
export declare class KeytarKeychain {
    private keytar;
    constructor();
    setPassword(account: string, password: string): Promise<void>;
    getPassword(account: string): Promise<string | null>;
    deletePassword(account: string): Promise<boolean>;
    findCredentials(): Promise<{
        account: string;
        password: string;
    }[]>;
}
export declare function getKeytarKeychain(): KeytarKeychain;
export {};
//# sourceMappingURL=keychain.d.ts.map