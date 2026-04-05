import { spawn, type ChildProcess } from 'child_process';
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
  error?: { code: number; message: string };
}

export class MCPClient extends EventEmitter {
  private connections: Map<string, MCPConnection> = new Map();
  private messageHandlers: Map<string, (result: unknown) => void> = new Map();
  private idCounter = 0;

  async connect(id: string, name: string, command: string, args: string[] = []): Promise<void> {
    if (this.connections.has(id)) {
      throw new Error(`Connection ${id} already exists`);
    }

    const connection: MCPConnection = {
      id,
      name,
      status: 'connecting'
    };

    this.connections.set(id, connection);

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      connection.process = proc;

      proc.on('error', (err) => {
        connection.status = 'error';
        this.emit('error', { id, error: err.message });
        reject(err);
      });

      proc.on('exit', (code) => {
        connection.status = 'disconnected';
        this.emit('disconnect', { id, code });
      });

      let buffer = '';
      proc.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as MCPMessage;
              this.handleMessage(id, msg);
            } catch {}
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        this.emit('error', { id, error: data.toString() });
      });

      setTimeout(() => {
        if (connection.status === 'connecting') {
          connection.status = 'connected';
          this.emit('connect', { id });
          resolve();
        }
      }, 1000);
    });
  }

  disconnect(id: string): void {
    const connection = this.connections.get(id);
    if (connection?.process) {
      connection.process.kill();
      connection.status = 'disconnected';
    }
    this.connections.delete(id);
  }

  async sendRequest(id: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const connection = this.connections.get(id);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Connection ${id} not connected`);
    }

    return new Promise((resolve, reject) => {
      const msgId = ++this.idCounter;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id: msgId,
        method,
        params
      };

      this.messageHandlers.set(String(msgId), (result) => {
        this.messageHandlers.delete(String(msgId));
        resolve(result);
      });

      connection.process?.stdin?.write(JSON.stringify(message) + '\n');

      setTimeout(() => {
        if (this.messageHandlers.has(String(msgId))) {
          this.messageHandlers.delete(String(msgId));
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private handleMessage(id: string, msg: MCPMessage): void {
    if (msg.id !== undefined && this.messageHandlers.has(String(msg.id))) {
      if (msg.error) {
        this.messageHandlers.get(String(msg.id))!(null);
      } else {
        this.messageHandlers.get(String(msg.id))!(msg.result);
      }
    }

    if (msg.method) {
      this.emit('notification', { id, method: msg.method, params: msg.params });
    }
  }

  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  isConnected(id: string): boolean {
    return this.connections.get(id)?.status === 'connected';
  }
}

let globalMCPClient: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!globalMCPClient) {
    globalMCPClient = new MCPClient();
  }
  return globalMCPClient;
}