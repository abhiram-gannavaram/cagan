import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'cagan-sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.onDidReceiveMessage((msg: { command: string; task?: string; mode?: string }) => {
      switch (msg.command) {
        case 'runAgent':
          vscode.commands.executeCommand('cagan.agent.run');
          break;
        case 'setup':
          vscode.commands.executeCommand('cagan.setup');
          break;
        case 'swarm':
          vscode.commands.executeCommand('cagan.swarm.start');
          break;
        case 'cost':
          vscode.commands.executeCommand('cagan.cost.show');
          break;
        case 'editConfig':
          vscode.commands.executeCommand('cagan.config.edit');
          break;
      }
    });

    this._render();
  }

  private _render(): void {
    if (!this._view) return;

    const isConfigured =
      existsSync(join(homedir(), '.cagan', 'config.yaml')) ||
      (vscode.workspace.workspaceFolders?.[0] &&
        existsSync(join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.cagan', 'config.yaml')));

    this._view.webview.html = isConfigured ? this._readyHtml() : this._setupHtml();
  }

  private _setupHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground); padding: 16px; height: 100vh; display: flex;
    flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .logo { font-size: 22px; font-weight: 800; color: var(--vscode-textLink-foreground); margin-bottom: 8px; }
  .sub { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 24px; line-height: 1.5; }
  button { width: 100%; padding: 10px; border: none; border-radius: 6px; cursor: pointer;
    font-size: 13px; font-weight: 600; background: var(--vscode-button-background);
    color: var(--vscode-button-foreground); margin-bottom: 8px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
  <div class="logo">cagan</div>
  <div class="sub">No provider configured yet.<br>Run setup to get started.</div>
  <button onclick="send('setup')">⚙ Run Setup Wizard</button>
<script>
  const vscode = acquireVsCodeApi();
  function send(command) { vscode.postMessage({ command }); }
</script>
</body>
</html>`;
  }

  private _readyHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground); padding: 12px; font-size: 13px; }

  .section-label {
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: var(--vscode-descriptionForeground); margin: 16px 0 6px;
  }
  .section-label:first-child { margin-top: 0; }

  .btn {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px;
    border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
    text-align: left; margin-bottom: 4px;
    background: var(--vscode-button-secondaryBackground, rgba(255,255,255,.06));
    color: var(--vscode-foreground);
  }
  .btn:hover { background: var(--vscode-list-hoverBackground); }
  .btn .icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
  .btn .label { flex: 1; }
  .btn .hint { font-size: 10px; color: var(--vscode-descriptionForeground); font-weight: 400; }

  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    margin-bottom: 12px;
  }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }

  .divider { height: 1px; background: var(--vscode-sideBarSectionHeader-border, rgba(255,255,255,.1));
    margin: 12px 0; }

  .mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px; }
  .mode-btn { padding: 6px 8px; border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.1));
    border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: 600; text-align: center;
    background: transparent; color: var(--vscode-foreground); }
  .mode-btn:hover { background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-focusBorder); }

  .footer { margin-top: 16px; }
  .footer .btn { font-size: 11px; font-weight: 400; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>

  <div class="section-label">Quick Run</div>

  <button class="btn btn-primary" onclick="send('runAgent')">
    <span class="icon">▶</span>
    <span class="label">Run Agent</span>
  </button>

  <button class="btn" onclick="send('swarm')">
    <span class="icon">⟳</span>
    <div>
      <div class="label">Agent Swarm</div>
      <div class="hint">parallel multi-agent task</div>
    </div>
  </button>

  <div class="section-label">Agent Modes</div>

  <div class="mode-grid">
    <button class="mode-btn" onclick="runMode('code')">💻 Code</button>
    <button class="mode-btn" onclick="runMode('architect')">🏛 Architect</button>
    <button class="mode-btn" onclick="runMode('debug')">🐛 Debug</button>
    <button class="mode-btn" onclick="runMode('review')">👁 Review</button>
    <button class="mode-btn" onclick="runMode('test')">🧪 Test</button>
    <button class="mode-btn" onclick="runMode('refactor')">♻ Refactor</button>
    <button class="mode-btn" onclick="runMode('doc')">📝 Docs</button>
    <button class="mode-btn" onclick="runMode('devops')">🚀 DevOps</button>
  </div>

  <div class="divider"></div>

  <div class="footer">
    <button class="btn" onclick="send('cost')">
      <span class="icon">💰</span>
      <span class="label">Session Cost</span>
    </button>
    <button class="btn" onclick="send('editConfig')">
      <span class="icon">⚙</span>
      <span class="label">Edit Config</span>
    </button>
    <button class="btn" onclick="send('setup')">
      <span class="icon">🔄</span>
      <span class="label">Change Provider</span>
    </button>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  function send(command, extra) { vscode.postMessage({ command, ...extra }); }
  function runMode(mode) {
    // Opens the run agent quick pick pre-filtered to the chosen mode
    send('runAgent', { mode });
  }
</script>
</body>
</html>`;
  }
}
