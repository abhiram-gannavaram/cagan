/**
 * AgentPanel.ts — Main VS Code webview panel for cagan.
 *
 * Hosts the agent chat UI, swarm status dashboard, memory viewer, and cost display.
 * All data stays local — nothing is sent to third-party services.
 */

import * as vscode from 'vscode';
import { CaganCore, getCostTracker } from '@cagan/core';

interface SwarmStartOptions {
  dryRun?: boolean;
  maxAgents?: number;
}

export class AgentPanel {
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;
  private core: CaganCore;
  private agent: ReturnType<CaganCore['createAgent']> | null = null;
  private messages: { role: string; content: string }[] = [];
  private currentMode = 'code';
  private swarmStatus: { running: boolean; task: string; progress: string } = {
    running: false,
    task: '',
    progress: ''
  };
  private costUpdateListeners: Array<(cost: number, compression: number) => void> = [];
  private turboSavingsPct = 0;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.core = new CaganCore();
  }

  /** Register a callback for cost/compression changes (used by status bar). */
  onCostUpdate(cb: (costUsd: number, compressionPct: number) => void): void {
    this.costUpdateListeners.push(cb);
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'cagan-agent',
      'cagan',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.onDidReceiveMessage(msg => {
      switch (msg.command) {
        case 'stop': this.stopAgent(); break;
        case 'memory': this.showMemory(); break;
        case 'cost': this.showCost(); break;
        case 'swarmStatus': this.showSwarmStatus(); break;
        case 'turboStats': this.showTurboStats(); break;
      }
    });

    this.panel.onDidDispose(() => { this.panel = null; });
    this.updateWebview();
  }

  async runAgent(mode: string, task: string): Promise<void> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    this.currentMode = mode;

    try {
      await this.core.initialize(cwd);
    } catch { /* health check failure is non-fatal */ }

    this.agent = this.core.createAgent({
      mode: mode as 'code' | 'architect' | 'debug' | 'review' | 'ask',
      cwd,
      workspaceRoot: cwd
    });

    this.messages.push({ role: 'user', content: task });
    this.updateWebview();

    try {
      for await (const event of this.agent.run(task)) {
        if (event.type === 'delta') {
          const delta = event.data as { delta?: { content?: string } };
          if (delta?.delta?.content) {
            const last = this.messages.at(-1);
            if (last?.role === 'assistant') {
              last.content += delta.delta.content;
            } else {
              this.messages.push({ role: 'assistant', content: delta.delta.content });
            }
            this.updateWebview();
            this.notifyCostListeners();
          }
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Agent error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  stopAgent(): void {
    this.agent?.stop();
    vscode.window.showInformationMessage('Agent stopped.');
  }

  switchMode(mode: string): void {
    this.currentMode = mode;
    vscode.window.showInformationMessage(`Switched to ${mode} mode.`);
    this.updateWebview();
  }

  showMemory(): void {
    vscode.window.showInformationMessage('Memory viewer: see ~/.cagan/global_memory.json or {project}/.cagan/memory.json');
  }

  showCost(): void {
    const tracker = getCostTracker();
    const summary = tracker.getSummary();
    vscode.window.showInformationMessage(
      `Session: $${summary.totalCostUsd.toFixed(6)} | ${summary.totalTokens.toLocaleString()} tokens`
    );
  }

  /** Show TurboQuant stats in an information message. */
  showTurboStats(): void {
    const tracker = getCostTracker();
    const summary = tracker.getSummary();
    vscode.window.showInformationMessage(
      `TurboQuant: $${summary.totalCostUsd.toFixed(6)} used | compression: ${this.turboSavingsPct}% savings`
    );
  }

  /** Start an Agent Swarm from the VS Code UI. */
  startSwarm(task: string, options: SwarmStartOptions = {}): void {
    this.swarmStatus = { running: !options.dryRun, task, progress: 'Decomposing task…' };
    this.messages.push({
      role: 'user',
      content: `[Swarm${options.dryRun ? ' (dry run)' : ''}] ${task}`
    });
    this.updateWebview();

    // In full implementation this would call AgentSwarm directly.
    // For now, show a status message and open the terminal.
    const terminal = vscode.window.createTerminal('cagan swarm');
    const dryFlag = options.dryRun ? ' --dry-run' : '';
    const agentFlag = options.maxAgents ? ` --max-agents ${options.maxAgents}` : '';
    terminal.sendText(`cagan swarm${dryFlag}${agentFlag} "${task.replace(/"/g, '\\"')}"`);
    terminal.show();

    this.swarmStatus.running = false;
    this.swarmStatus.progress = 'Running in terminal (see below)';
    this.updateWebview();
  }

  showSwarmStatus(): void {
    if (!this.swarmStatus.task) {
      vscode.window.showInformationMessage('No swarm has been started this session.');
    } else {
      vscode.window.showInformationMessage(
        `Swarm: "${this.swarmStatus.task}" — ${this.swarmStatus.progress}`
      );
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private notifyCostListeners(): void {
    const tracker = getCostTracker();
    const summary = tracker.getSummary();
    for (const cb of this.costUpdateListeners) {
      cb(summary.totalCostUsd, this.turboSavingsPct);
    }
  }

  private updateWebview(): void {
    if (!this.panel) return;

    const tracker = getCostTracker();
    const summary = tracker.getSummary();

    const messagesHtml = this.messages
      .map(m => `
        <div class="message ${m.role}">
          <div class="role">${m.role === 'user' ? 'You' : `cagan (${this.currentMode})`}</div>
          <div class="content">${escapeHtml(m.content)}</div>
        </div>
      `)
      .join('');

    this.panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 12px; background: #1e1e1e; color: #d4d4d4; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 12px; border-bottom: 1px solid #333; margin-bottom: 12px; }
    .title { font-size: 16px; font-weight: 700; color: #4fc3f7; }
    .meta { font-size: 11px; color: #888; display: flex; gap: 12px; }
    .badge { background: #333; padding: 2px 6px; border-radius: 10px; }
    .messages { max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
    .message { padding: 8px 10px; border-radius: 6px; }
    .message.user { background: #264f78; }
    .message.assistant { background: #2a2a2a; border: 1px solid #3a3a3a; }
    .role { font-size: 10px; font-weight: 600; color: #888; margin-bottom: 4px; text-transform: uppercase; }
    .content { white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }
    .btn-stop    { background: #f44336; color: #fff; }
    .btn-memory  { background: #9c27b0; color: #fff; }
    .btn-cost    { background: #4caf50; color: #fff; }
    .btn-turbo   { background: #ff9800; color: #fff; }
    .btn-swarm   { background: #2196f3; color: #fff; }
    .empty { color: #555; font-style: italic; padding: 20px 0; text-align: center; }
    .swarm-status { padding: 6px 8px; background: #1a3a1a; border-radius: 4px; margin-bottom: 8px; font-size: 11px; color: #8bc34a; }
  </style>
</head>
<body>
  <div class="header">
    <span class="title">cagan</span>
    <div class="meta">
      <span class="badge">mode: ${this.currentMode}</span>
      <span class="badge">$${summary.totalCostUsd.toFixed(4)}</span>
      <span class="badge">${summary.totalTokens.toLocaleString()} tokens</span>
    </div>
  </div>

  ${this.swarmStatus.running ? `<div class="swarm-status">⟳ Swarm running: "${this.swarmStatus.task}" — ${this.swarmStatus.progress}</div>` : ''}

  <div class="messages">
    ${messagesHtml || '<div class="empty">No messages yet. Run an agent or start a swarm.</div>'}
  </div>

  <div class="controls">
    <button class="btn-stop"   onclick="sendMsg('stop')">Stop</button>
    <button class="btn-memory" onclick="sendMsg('memory')">Memory</button>
    <button class="btn-cost"   onclick="sendMsg('cost')">Cost</button>
    <button class="btn-turbo"  onclick="sendMsg('turboStats')">TurboQuant</button>
    <button class="btn-swarm"  onclick="sendMsg('swarmStatus')">Swarm Status</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function sendMsg(command) { vscode.postMessage({ command }); }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
