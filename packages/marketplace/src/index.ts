import { spawnSync } from 'child_process';
import { spawn, type ChildProcess } from 'child_process';

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

export const MOCK_MCP_SERVERS: MCPServerDefinition[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and navigate the filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Git integration for version control',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git']
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search via Brave API',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: ''
    }
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages to Slack channels',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: {
      SLACK_BOT_TOKEN: '',
      SLACK_TEAM_ID: ''
    }
  }
];

export class Marketplace {
  private servers: Map<string, MCPServerDefinition> = new Map();
  private serverStatuses: Map<string, MCPServerStatus> = new Map();

  constructor() {
    for (const server of MOCK_MCP_SERVERS) {
      this.servers.set(server.id, server);
    }
  }

  getServers(): MCPServerDefinition[] {
    return Array.from(this.servers.values());
  }

  getServer(id: string): MCPServerDefinition | undefined {
    return this.servers.get(id);
  }

  getServerStatus(id: string): MCPServerStatus | undefined {
    return this.serverStatuses.get(id);
  }

  getAllStatuses(): MCPServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  addServer(server: MCPServerDefinition): void {
    this.servers.set(server.id, server);
  }

  removeServer(id: string): void {
    this.servers.delete(id);
    this.serverStatuses.delete(id);
  }

  generateConfig(id: string): string | null {
    const server = this.servers.get(id);
    if (!server) return null;

    return JSON.stringify({
      id: server.id,
      name: server.name,
      command: server.command,
      args: server.args,
      env: server.env || {}
    }, null, 2);
  }

  async installServer(id: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
    const server = this.servers.get(id);
    if (!server) {
      return { success: false, error: `Server ${id} not found in marketplace` };
    }

    const status: MCPServerStatus = {
      id,
      status: 'installing'
    };
    this.serverStatuses.set(id, status);

    try {
      // Use spawnSync with shell:false — each arg is a separate element,
      // preventing shell metacharacter injection from server.args values.
      const result = spawnSync(server.command, server.args, {
        cwd: cwd || process.cwd(),
        stdio: 'pipe',
        timeout: 120_000,
        shell: false
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(result.stderr?.toString() || `Process exited with code ${result.status}`);
      }

      status.status = 'stopped';
      status.installedAt = Date.now();
      return { success: true };

    } catch (error) {
      status.status = 'error';
      status.error = error instanceof Error ? error.message : 'Installation failed';
      return { success: false, error: status.error };
    }
  }

  startServer(id: string, cwd?: string): MCPServerStatus | null {
    const server = this.servers.get(id);
    if (!server) return null;

    const existingStatus = this.serverStatuses.get(id);
    if (existingStatus?.status === 'running') {
      return existingStatus;
    }

    const env = { ...process.env };
    if (server.env) {
      for (const [key, value] of Object.entries(server.env)) {
        if (value) env[key] = value;
      }
    }

    const proc = spawn(server.command, server.args, {
      cwd: cwd || process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const status: MCPServerStatus = {
      id,
      status: 'starting',
      process: proc
    };

    proc.on('error', (err) => {
      status.status = 'error';
      status.error = err.message;
    });

    proc.on('exit', (code) => {
      status.status = code === 0 ? 'stopped' : 'error';
    });

    setTimeout(() => {
      if (status.status === 'starting') {
        status.status = 'running';
      }
    }, 2000);

    this.serverStatuses.set(id, status);
    return status;
  }

  stopServer(id: string): boolean {
    const status = this.serverStatuses.get(id);
    if (!status || !status.process) return false;

    status.process.kill();
    status.status = 'stopped';
    return true;
  }

  restartServer(id: string, cwd?: string): MCPServerStatus | null {
    this.stopServer(id);
    return this.startServer(id, cwd);
  }

  async healthCheck(id: string): Promise<boolean> {
    const status = this.serverStatuses.get(id);
    return status?.status === 'running';
  }
}

let globalMarketplace: Marketplace | null = null;

export function getMarketplace(): Marketplace {
  if (!globalMarketplace) {
    globalMarketplace = new Marketplace();
  }
  return globalMarketplace;
}