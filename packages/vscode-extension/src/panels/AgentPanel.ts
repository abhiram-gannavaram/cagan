import * as vscode from 'vscode';
import { CaganCore } from '@cagan/core';
import { getCostTracker } from '@cagan/core';

export class AgentPanel {
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;
  private core: CaganCore;
  private agent: ReturnType<CaganCore['createAgent']> | null = null;
  private messages: { role: string; content: string }[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.core = new CaganCore();
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
      { enableScripts: true }
    );

    this.panel.onDidDispose(() => {
      this.panel = null;
    });

    this.updateWebview();
  }

  async runAgent(mode: string, task: string): Promise<void> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    
    try {
      await this.core.initialize(cwd);
    } catch {}

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
            this.messages.push({ role: 'assistant', content: delta.delta.content });
            this.updateWebview();
          }
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Agent error: ${error}`);
    }
  }

  stopAgent(): void {
    this.agent?.stop();
  }

  showMemory(): void {
    vscode.window.showInformationMessage('Memory panel coming soon');
  }

  showCost(): void {
    const tracker = getCostTracker();
    const summary = tracker.getSummary();
    vscode.window.showInformationMessage(
      `Session Cost: $${summary.totalCostUsd.toFixed(6)} (${summary.totalTokens} tokens)`
    );
  }

  private updateWebview(): void {
    if (!this.panel) return;

    const costTracker = getCostTracker();
    const summary = costTracker.getSummary();

    this.panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: system-ui; padding: 16px; background: #1e1e1e; color: #d4d4d4; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; color: #4fc3f7; }
          .cost { font-size: 12px; color: #a0a0a0; }
          .messages { max-height: 400px; overflow-y: auto; margin-bottom: 16px; }
          .message { margin-bottom: 12px; padding: 8px 12px; border-radius: 4px; }
          .message.user { background: #264f78; }
          .message.assistant { background: #2d2d2d; }
          .message .role { font-size: 10px; color: #808080; margin-bottom: 4px; }
          .controls { display: flex; gap: 8px; }
          button { 
            padding: 6px 12px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 12px;
          }
          button.stop { background: #f44336; color: white; }
          button.memory { background: #2196f3; color: white; }
          button.cost { background: #4caf50; color: white; }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="title">cagan</span>
          <span class="cost">$${summary.totalCostUsd.toFixed(6)} | ${summary.totalTokens} tokens</span>
        </div>
        <div class="messages">
          ${this.messages.map(m => `
            <div class="message ${m.role}">
              <div class="role">${m.role}</div>
              <div>${m.content}</div>
            </div>
          `).join('')}
        </div>
        <div class="controls">
          <button class="stop" onclick="stopAgent()">Stop</button>
          <button class="memory" onclick="showMemory()">Memory</button>
          <button class="cost" onclick="showCost()">Cost</button>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          function stopAgent() { vscode.postMessage({ command: 'stop' }); }
          function showMemory() { vscode.postMessage({ command: 'memory' }); }
          function showCost() { vscode.postMessage({ command: 'cost' }); }
        </script>
      </body>
      </html>
    `;
  }
}