import { execSync } from 'child_process';
import { spawn } from 'child_process';
export const MOCK_MCP_SERVERS = [
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
    servers = new Map();
    serverStatuses = new Map();
    constructor() {
        for (const server of MOCK_MCP_SERVERS) {
            this.servers.set(server.id, server);
        }
    }
    getServers() {
        return Array.from(this.servers.values());
    }
    getServer(id) {
        return this.servers.get(id);
    }
    getServerStatus(id) {
        return this.serverStatuses.get(id);
    }
    getAllStatuses() {
        return Array.from(this.serverStatuses.values());
    }
    addServer(server) {
        this.servers.set(server.id, server);
    }
    removeServer(id) {
        this.servers.delete(id);
        this.serverStatuses.delete(id);
    }
    generateConfig(id) {
        const server = this.servers.get(id);
        if (!server)
            return null;
        return JSON.stringify({
            id: server.id,
            name: server.name,
            command: server.command,
            args: server.args,
            env: server.env || {}
        }, null, 2);
    }
    async installServer(id, cwd) {
        const server = this.servers.get(id);
        if (!server) {
            return { success: false, error: `Server ${id} not found in marketplace` };
        }
        const status = {
            id,
            status: 'installing'
        };
        this.serverStatuses.set(id, status);
        try {
            const installCommand = `${server.command} ${server.args.join(' ')}`;
            execSync(installCommand, {
                cwd: cwd || process.cwd(),
                stdio: 'pipe',
                timeout: 120000
            });
            status.status = 'stopped';
            status.installedAt = Date.now();
            return { success: true };
        }
        catch (error) {
            status.status = 'error';
            status.error = error instanceof Error ? error.message : 'Installation failed';
            return { success: false, error: status.error };
        }
    }
    startServer(id, cwd) {
        const server = this.servers.get(id);
        if (!server)
            return null;
        const existingStatus = this.serverStatuses.get(id);
        if (existingStatus?.status === 'running') {
            return existingStatus;
        }
        const env = { ...process.env };
        if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
                if (value)
                    env[key] = value;
            }
        }
        const proc = spawn(server.command, server.args, {
            cwd: cwd || process.cwd(),
            env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const status = {
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
    stopServer(id) {
        const status = this.serverStatuses.get(id);
        if (!status || !status.process)
            return false;
        status.process.kill();
        status.status = 'stopped';
        return true;
    }
    restartServer(id, cwd) {
        this.stopServer(id);
        return this.startServer(id, cwd);
    }
    async healthCheck(id) {
        const status = this.serverStatuses.get(id);
        return status?.status === 'running';
    }
}
let globalMarketplace = null;
export function getMarketplace() {
    if (!globalMarketplace) {
        globalMarketplace = new Marketplace();
    }
    return globalMarketplace;
}
//# sourceMappingURL=index.js.map