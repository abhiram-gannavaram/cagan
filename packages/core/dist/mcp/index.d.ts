import { type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
export interface MCPConnection {
    id: string;
    name: string;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    process?: ChildProcess;
}
export interface MCPMessage {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
export declare class MCPClient extends EventEmitter {
    private connections;
    private messageHandlers;
    private idCounter;
    connect(id: string, name: string, command: string, args?: string[]): Promise<void>;
    disconnect(id: string): void;
    sendRequest(id: string, method: string, params?: Record<string, unknown>): Promise<unknown>;
    private handleMessage;
    getConnections(): MCPConnection[];
    isConnected(id: string): boolean;
}
export declare function getMCPClient(): MCPClient;
//# sourceMappingURL=index.d.ts.map