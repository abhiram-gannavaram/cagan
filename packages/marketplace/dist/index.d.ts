import { type ChildProcess } from 'child_process';
export interface MCPServerDefinition {
    id: string;
    name: string;
    description: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled?: boolean;
}
export interface MCPServerStatus {
    id: string;
    status: 'installing' | 'starting' | 'running' | 'stopped' | 'error';
    process?: ChildProcess;
    error?: string;
    installedAt?: number;
}
export declare const MOCK_MCP_SERVERS: MCPServerDefinition[];
export declare class Marketplace {
    private servers;
    private serverStatuses;
    constructor();
    getServers(): MCPServerDefinition[];
    getServer(id: string): MCPServerDefinition | undefined;
    getServerStatus(id: string): MCPServerStatus | undefined;
    getAllStatuses(): MCPServerStatus[];
    addServer(server: MCPServerDefinition): void;
    removeServer(id: string): void;
    generateConfig(id: string): string | null;
    installServer(id: string, cwd?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    startServer(id: string, cwd?: string): MCPServerStatus | null;
    stopServer(id: string): boolean;
    restartServer(id: string, cwd?: string): MCPServerStatus | null;
    healthCheck(id: string): Promise<boolean>;
}
export declare function getMarketplace(): Marketplace;
