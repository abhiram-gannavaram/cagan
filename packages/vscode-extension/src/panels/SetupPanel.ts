/**
 * SetupPanel.ts — First-time onboarding wizard for cagan VS Code extension.
 *
 * Opens a rich webview that auto-detects existing AI tools (env vars,
 * Claude Code, Copilot, Cursor), lets the user pick / paste a key,
 * tests it live, and writes ~/.cagan/config.yaml.
 *
 * No telemetry. No data leaves the machine except the 1-token probe to
 * the user's chosen provider endpoint for key validation.
 */

import * as vscode from 'vscode';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { detectProviders, validateApiKey } from '@cagan/core';
import type { DetectedProvider, ProviderKind } from '@cagan/core';

interface WebviewMessage {
  command: string;
  [key: string]: unknown;
}

interface ProviderInfo {
  kind: ProviderKind;
  name: string;
  envVar: string;
  defaultModel: string;
  models: string[];
  baseUrl: string;
  apiKey: string;
  source?: string;
}

const ALL_PROVIDERS: ProviderInfo[] = [
  { kind: 'minimax', name: 'MiniMax', envVar: 'MINIMAX_API_KEY', defaultModel: 'MiniMax-M2.7', models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'abab6.5s-chat'], baseUrl: 'https://api.minimax.io/v1', apiKey: '' },
  { kind: 'anthropic', name: 'Anthropic (Claude)', envVar: 'ANTHROPIC_API_KEY', defaultModel: 'claude-sonnet-4-6', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022'], baseUrl: 'https://api.anthropic.com', apiKey: '' },
  { kind: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o1'], baseUrl: 'https://api.openai.com/v1', apiKey: '' },
  { kind: 'gemini', name: 'Google Gemini', envVar: 'GEMINI_API_KEY', defaultModel: 'gemini-2.0-flash', models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'], baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '' },
  { kind: 'deepseek', name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', defaultModel: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-reasoner'], baseUrl: 'https://api.deepseek.com/v1', apiKey: '' },
  { kind: 'mistral', name: 'Mistral', envVar: 'MISTRAL_API_KEY', defaultModel: 'mistral-large-latest', models: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest'], baseUrl: 'https://api.mistral.ai/v1', apiKey: '' },
  { kind: 'groq', name: 'Groq (ultra-fast)', envVar: 'GROQ_API_KEY', defaultModel: 'llama-3.3-70b-versatile', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'], baseUrl: 'https://api.groq.com/openai/v1', apiKey: '' },
  { kind: 'custom', name: 'Custom (any OpenAI-compatible)', envVar: 'CUSTOM_API_KEY', defaultModel: '', models: [], baseUrl: '', apiKey: '' }
];

export class SetupPanel {
  static currentPanel: SetupPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;

  static show(context: vscode.ExtensionContext): void {
    if (SetupPanel.currentPanel) {
      SetupPanel.currentPanel.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'cagan-setup',
      'cagan — Setup',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    SetupPanel.currentPanel = new SetupPanel(panel, context);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.context = context;

    this.panel.onDidDispose(() => { SetupPanel.currentPanel = undefined; });
    this.panel.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handleMessage(msg));

    this.render('scanning');

    // Run detection and push results to webview
    setTimeout(() => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const result = detectProviders(cwd);
      this.panel.webview.postMessage({
        command: 'scanResult',
        providers: result.providers,
        hasClaudeCode: result.hasClaudeCode,
        hasCopilot: result.hasCopilot,
        hasCursor: result.hasCursor,
        allProviders: ALL_PROVIDERS
      });
    }, 300);
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.command) {
      case 'validateKey': {
        const kind = msg.kind as ProviderKind;
        const apiKey = msg.apiKey as string;
        const model = msg.model as string;
        const result = await validateApiKey(kind, apiKey, model);
        this.panel.webview.postMessage({ command: 'validationResult', ...result });
        break;
      }

      case 'saveConfig': {
        const kind = msg.kind as ProviderKind;
        const envVar = msg.envVar as string;
        const model = msg.model as string;
        const apiKey = msg.apiKey as string;
        const baseUrl = msg.baseUrl as string | undefined;

        try {
          this.writeConfig(kind, envVar, model, apiKey, baseUrl);
          this.panel.webview.postMessage({ command: 'saveResult', ok: true });
          // Auto-close after 2 seconds
          setTimeout(() => {
            this.panel.dispose();
            vscode.window.showInformationMessage(
              'cagan is ready! Open the cagan sidebar or run a command.',
              'Open cagan'
            ).then(choice => {
              if (choice) vscode.commands.executeCommand('cagan.chat.focus');
            });
          }, 2000);
        } catch (err) {
          this.panel.webview.postMessage({
            command: 'saveResult',
            ok: false,
            error: err instanceof Error ? err.message : String(err)
          });
        }
        break;
      }
    }
  }

  private writeConfig(kind: ProviderKind, envVar: string, model: string, apiKey: string, customBaseUrl?: string): void {
    const caganHome = join(homedir(), '.cagan');
    mkdirSync(caganHome, { recursive: true });

    // Save key to ~/.cagan/.env
    if (apiKey) {
      const envPath = join(caganHome, '.env');
      const line = `${envVar}="${apiKey}"\n`;
      writeFileSync(envPath, line, { mode: 0o600 });
    }

    const providerType =
      kind === 'anthropic' ? 'anthropic-compatible' :
      kind === 'gemini' ? 'gemini' : 'openai-compatible';

    const baseUrls: Partial<Record<ProviderKind, string>> = {
      anthropic: 'https://api.anthropic.com',
      openai: 'https://api.openai.com/v1',
      gemini: 'https://generativelanguage.googleapis.com',
      deepseek: 'https://api.deepseek.com/v1',
      mistral: 'https://api.mistral.ai/v1',
      groq: 'https://api.groq.com/openai/v1',
      minimax: 'https://api.minimax.io/v1',
      custom: customBaseUrl ?? ''
    };

    const yaml = `version: "1.0"

providers:
  ${kind}:
    type: ${providerType}
    base_url: "${baseUrls[kind] ?? ''}"
    apiKey: "\${${envVar}}"
    models:
      default: "${model}"
      autocomplete: "${model}"

defaults:
  provider: ${kind}
  code_mode_model: "${model}"
  architect_model: "${model}"
  autocomplete_model: "${model}"
  orchestrator_model: "${model}"
  max_parallel_agents: 10
  auto_commit: false
  memory_enabled: true
  budget_alert_usd: 5.0

security:
  api_key_storage: keychain
  caganignore_path: ~/.cagan/caganignore
`;

    writeFileSync(join(caganHome, 'config.yaml'), yaml, 'utf-8');

    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (wsRoot) {
      mkdirSync(join(wsRoot, '.cagan'), { recursive: true });
      writeFileSync(join(wsRoot, '.cagan', 'config.yaml'), yaml, 'utf-8');
      if (!existsSync(join(wsRoot, '.caganignore'))) {
        writeFileSync(join(wsRoot, '.caganignore'), [
          '.git/', 'node_modules/', 'dist/', 'build/',
          '*.env', '*.env.local', 'credentials.json',
          '*.pem', 'key*.pem', 'secrets/'
        ].join('\n') + '\n', 'utf-8');
      }
    }
  }

  private render(initialState: string): void {
    this.panel.webview.html = getWebviewHtml(initialState);
  }
}

function getWebviewHtml(_initialState: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>cagan Setup</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --accent: #58a6ff;
    --green: #3fb950;
    --yellow: #d29922;
    --red: #f85149;
    --text: #e6edf3;
    --muted: #8b949e;
    --input-bg: #0d1117;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg); color: var(--text); min-height: 100vh; padding: 0; }

  /* ── Layout ── */
  .shell { max-width: 640px; margin: 0 auto; padding: 32px 20px 60px; }
  .logo { text-align: center; margin-bottom: 32px; }
  .logo h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px;
    background: linear-gradient(135deg, #58a6ff, #79c0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .logo p { color: var(--muted); font-size: 14px; margin-top: 6px; }

  /* ── Steps indicator ── */
  .steps { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 36px; }
  .step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; border: 2px solid var(--border); background: var(--surface); color: var(--muted); transition: all .3s; }
  .step-dot.active { border-color: var(--accent); background: rgba(88,166,255,.15); color: var(--accent); }
  .step-dot.done { border-color: var(--green); background: rgba(63,185,80,.15); color: var(--green); }
  .step-label { font-size: 11px; color: var(--muted); text-align: center; max-width: 64px; }
  .step-label.active { color: var(--accent); }
  .step-line { flex: 1; height: 2px; background: var(--border); min-width: 32px; max-width: 64px; }
  .step-line.done { background: var(--green); }

  /* ── Cards ── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .card-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .card-sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; }

  /* ── Detection badges ── */
  .badge-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
    font-size: 12px; font-weight: 600; border: 1px solid; }
  .badge.green { border-color: var(--green); background: rgba(63,185,80,.12); color: var(--green); }
  .badge.blue  { border-color: var(--accent); background: rgba(88,166,255,.12); color: var(--accent); }
  .badge.gray  { border-color: var(--border); background: var(--surface); color: var(--muted); }

  /* ── Provider list ── */
  .provider-list { display: flex; flex-direction: column; gap: 10px; }
  .provider-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: all .15s;
    background: var(--bg); }
  .provider-item:hover { border-color: var(--accent); background: rgba(88,166,255,.05); }
  .provider-item.selected { border-color: var(--accent); background: rgba(88,166,255,.1); }
  .provider-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center;
    justify-content: center; font-size: 18px; background: var(--surface); flex-shrink: 0; }
  .provider-info { flex: 1; min-width: 0; }
  .provider-name { font-size: 14px; font-weight: 600; }
  .provider-sub { font-size: 12px; color: var(--muted); margin-top: 1px; }
  .provider-check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
  .provider-item.selected .provider-check { border-color: var(--accent); background: var(--accent); }

  /* ── Form elements ── */
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
  .field select, .field input[type=text], .field input[type=password] {
    width: 100%; padding: 10px 12px; background: var(--input-bg);
    border: 1px solid var(--border); border-radius: 8px; color: var(--text);
    font-size: 14px; font-family: inherit; transition: border-color .15s; outline: none; }
  .field select:focus, .field input:focus { border-color: var(--accent); }
  .field .hint { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* ── Buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px;
    font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; }
  .btn-primary { background: var(--accent); color: #0d1117; }
  .btn-primary:hover { background: #79c0ff; }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
  .btn-row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

  /* ── Status / feedback ── */
  .status-box { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
    border-radius: 8px; font-size: 13px; margin-top: 12px; }
  .status-box.success { background: rgba(63,185,80,.12); border: 1px solid rgba(63,185,80,.3); color: #3fb950; }
  .status-box.error   { background: rgba(248,81,73,.12); border: 1px solid rgba(248,81,73,.3); color: #f85149; }
  .status-box.info    { background: rgba(88,166,255,.12); border: 1px solid rgba(88,166,255,.3); color: #58a6ff; }
  .status-box.warning { background: rgba(210,153,34,.12); border: 1px solid rgba(210,153,34,.3); color: #d29922; }

  /* ── Scanning animation ── */
  .scan-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 14px; }
  .spin { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Done screen ── */
  .done-center { text-align: center; padding: 20px 0; }
  .done-icon { font-size: 56px; margin-bottom: 16px; animation: pop .4s cubic-bezier(.26,2,.46,.71); }
  @keyframes pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
  .done-title { font-size: 22px; font-weight: 800; color: var(--green); margin-bottom: 8px; }
  .done-sub { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
  .quick-start { text-align: left; background: var(--bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; }
  .quick-start .comment { color: var(--muted); }
  .quick-start .cmd { color: var(--accent); display: block; margin-top: 6px; }

  /* ── Hidden ── */
  .hidden { display: none !important; }
</style>
</head>
<body>
<div class="shell">

  <!-- LOGO -->
  <div class="logo">
    <h1>cagan</h1>
    <p>Provider-agnostic AI coding agent &mdash; TurboQuant · Agent Swarm · Memory</p>
  </div>

  <!-- STEPS -->
  <div class="steps">
    <div class="step">
      <div class="step-dot active" id="dot-1">1</div>
      <div class="step-label active" id="lbl-1">Detect</div>
    </div>
    <div class="step-line" id="line-1"></div>
    <div class="step">
      <div class="step-dot" id="dot-2">2</div>
      <div class="step-label" id="lbl-2">Choose</div>
    </div>
    <div class="step-line" id="line-2"></div>
    <div class="step">
      <div class="step-dot" id="dot-3">3</div>
      <div class="step-label" id="lbl-3">Test</div>
    </div>
    <div class="step-line" id="line-3"></div>
    <div class="step">
      <div class="step-dot" id="dot-4">4</div>
      <div class="step-label" id="lbl-4">Done</div>
    </div>
  </div>

  <!-- ── STEP 1: Scanning ── -->
  <div id="page-scan" class="card">
    <div class="card-title">Scanning your machine for AI tools…</div>
    <div class="card-sub">cagan works with any provider — Claude, GPT-4o, Gemini, Groq and more.</div>
    <div id="scan-items">
      <div class="scan-row"><span class="spin">⟳</span> Checking environment variables…</div>
    </div>
  </div>

  <!-- ── STEP 2: Choose provider ── -->
  <div id="page-choose" class="card hidden">
    <div class="card-title" id="choose-title">Select your AI provider</div>
    <div class="card-sub" id="choose-sub">Pick the provider you want cagan to use for coding tasks.</div>

    <div id="detected-banner" class="hidden">
      <div class="badge-row" id="detected-badges"></div>
    </div>

    <div class="provider-list" id="provider-list"></div>

    <div id="field-model" class="field" style="margin-top:16px;">
      <label for="sel-model">Model</label>
      <select id="sel-model"></select>
      <div class="hint">This model will be used for all agent modes. You can change it in config later.</div>
    </div>

    <div id="field-custom-url" class="field hidden">
      <label for="inp-base-url">Base URL (OpenAI-compatible endpoint)</label>
      <input type="text" id="inp-base-url" placeholder="https://api.minimax.io/v1" autocomplete="off">
      <div class="hint">The /v1 endpoint of your provider.</div>
    </div>

    <div id="field-custom-model" class="field hidden">
      <label for="inp-model-name">Model name</label>
      <input type="text" id="inp-model-name" placeholder="e.g. MiniMax-M2.7" autocomplete="off">
    </div>

    <div id="field-key" class="field hidden">
      <label for="inp-key">API Key</label>
      <input type="password" id="inp-key" placeholder="Paste your API key here…" autocomplete="off" spellcheck="false">
      <div class="hint" id="key-hint">Your key is stored locally in ~/.cagan/.env — never sent anywhere except your chosen provider.</div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" id="btn-next-choose" onclick="nextFromChoose()">
        Continue &rarr;
      </button>
    </div>
  </div>

  <!-- ── STEP 3: Test ── -->
  <div id="page-test" class="card hidden">
    <div class="card-title">Testing connection</div>
    <div class="card-sub">Sending a 1-token probe to verify your key works.</div>

    <div id="test-info" style="font-size:13px; color:var(--muted); margin-bottom:16px;"></div>
    <div id="test-status"></div>

    <div class="btn-row" id="test-actions" style="display:none;">
      <button class="btn btn-ghost" onclick="goBackToChoose()">← Change key</button>
      <button class="btn btn-primary" id="btn-save" onclick="saveConfig()">Save &amp; Start →</button>
    </div>
  </div>

  <!-- ── STEP 4: Done ── -->
  <div id="page-done" class="card hidden">
    <div class="done-center">
      <div class="done-icon">🚀</div>
      <div class="done-title">cagan is ready!</div>
      <div class="done-sub">Your AI coding agent is configured and raring to go.</div>
      <div class="quick-start">
        <span class="comment"># Quick start commands:</span>
        <span class="cmd">cagan "fix the bug in auth.ts"</span>
        <span class="cmd">cagan agent --mode architect "design a REST API"</span>
        <span class="cmd">cagan swarm "build a full-stack app with tests"</span>
      </div>
    </div>
  </div>

</div>

<script>
  const vscode = acquireVsCodeApi();

  let allProviders = [];
  let detectedProviders = [];
  let selectedProvider = null;
  let selectedModel = '';
  let apiKey = '';
  let needsKeyInput = false;

  // ── Receive messages from extension ──────────────────────────────────
  window.addEventListener('message', evt => {
    const msg = evt.data;
    switch (msg.command) {
      case 'scanResult':
        handleScanResult(msg);
        break;
      case 'validationResult':
        handleValidationResult(msg);
        break;
      case 'saveResult':
        handleSaveResult(msg);
        break;
    }
  });

  function handleScanResult(msg) {
    allProviders = msg.allProviders || [];
    detectedProviders = msg.providers || [];

    const scanItems = document.getElementById('scan-items');
    scanItems.innerHTML = '';

    // Show detected tools
    if (msg.hasClaudeCode) addScanResult(scanItems, '✓ Claude Code installed', 'green');
    if (msg.hasCopilot)   addScanResult(scanItems, '✓ GitHub Copilot detected', 'green');
    if (msg.hasCursor)    addScanResult(scanItems, '✓ Cursor IDE detected', 'green');

    if (detectedProviders.length > 0) {
      detectedProviders.forEach(p => {
        const src = p.source === 'env' ? 'environment variable' : p.source === 'dotenv' ? '.env file' : 'Claude Code';
        addScanResult(scanItems, '✓ ' + p.name + ' API key found (' + src + ')', 'green');
      });
    } else {
      addScanResult(scanItems, '— No AI provider keys found', 'gray');
    }

    setTimeout(() => transitionToChoose(), 800);
  }

  function addScanResult(container, text, type) {
    const d = document.createElement('div');
    d.className = 'scan-row';
    const b = document.createElement('span');
    b.textContent = text;
    if (type === 'green') b.style.color = 'var(--green)';
    else if (type === 'gray') b.style.color = 'var(--muted)';
    d.appendChild(b);
    container.appendChild(d);
  }

  function transitionToChoose() {
    setStep(2);
    hide('page-scan');
    show('page-choose');
    buildProviderList();
  }

  function buildProviderList() {
    const list = document.getElementById('provider-list');
    const badge = document.getElementById('detected-badges');
    const banner = document.getElementById('detected-banner');

    list.innerHTML = '';
    badge.innerHTML = '';

    // Show detected badges
    if (detectedProviders.length > 0) {
      show('detected-banner', 'flex');
      detectedProviders.forEach(p => {
        const b = document.createElement('span');
        b.className = 'badge green';
        b.textContent = '✓ ' + p.name;
        badge.appendChild(b);
      });
      document.getElementById('choose-title').textContent = 'AI providers found on this machine';
      document.getElementById('choose-sub').textContent = 'cagan can use an existing key — just select the one you want.';
    }

    // Build combined list (detected first, then rest)
    const detectedKinds = new Set(detectedProviders.map(p => p.kind));
    const orderedProviders = [
      ...detectedProviders,
      ...allProviders.filter(p => !detectedKinds.has(p.kind))
    ];

    orderedProviders.forEach((p, i) => {
      const isDetected = detectedKinds.has(p.kind);
      const item = document.createElement('div');
      item.className = 'provider-item' + (i === 0 ? ' selected' : '');
      item.dataset.kind = p.kind;
      item.dataset.envVar = p.envVar;
      item.dataset.apiKey = p.apiKey || '';
      item.dataset.defaultModel = p.defaultModel;
      item.dataset.models = JSON.stringify(p.models);
      item.onclick = () => selectProvider(item);

      const icons = { minimax: '🔶', anthropic: '🟣', openai: '🟢', gemini: '🔵', deepseek: '🐳', mistral: '🌊', groq: '⚡', custom: '⚙️' };
      item.innerHTML = \`
        <div class="provider-icon">\${icons[p.kind] || '🤖'}</div>
        <div class="provider-info">
          <div class="provider-name">\${p.name}\${isDetected ? ' <span style="font-size:10px;color:var(--green);margin-left:4px;">● configured</span>' : ''}</div>
          <div class="provider-sub">\${p.defaultModel}\${isDetected ? ' · key found' : ''}</div>
        </div>
        <div class="provider-check">\${i === 0 ? '✓' : ''}</div>
      \`;
      list.appendChild(item);
    });

    // Select first
    const first = orderedProviders[0];
    if (first) selectProvider(list.firstElementChild);
  }

  function selectProvider(el) {
    document.querySelectorAll('.provider-item').forEach(i => {
      i.classList.remove('selected');
      i.querySelector('.provider-check').textContent = '';
    });
    el.classList.add('selected');
    el.querySelector('.provider-check').textContent = '✓';

    const kind = el.dataset.kind;
    const storedKey = el.dataset.apiKey;
    const models = JSON.parse(el.dataset.models || '[]');
    const defaultModel = el.dataset.defaultModel;

    selectedProvider = { kind, envVar: el.dataset.envVar, apiKey: storedKey };

    // Populate model selector
    const sel = document.getElementById('sel-model');
    sel.innerHTML = models.map(m => \`<option value="\${m}"\${m === defaultModel ? ' selected' : ''}>\${m}</option>\`).join('');

    // Show/hide custom provider fields
    if (kind === 'custom') {
      hide('field-model');
      show('field-custom-url');
      show('field-custom-model');
    } else {
      show('field-model');
      hide('field-custom-url');
      hide('field-custom-model');
    }

    // Show/hide key input
    if (!storedKey) {
      show('field-key');
      needsKeyInput = true;
    } else {
      hide('field-key');
      needsKeyInput = false;
    }
  }

  function nextFromChoose() {
    if (!selectedProvider) return;

    // Handle custom provider
    if (selectedProvider.kind === 'custom') {
      const baseUrl = document.getElementById('inp-base-url').value.trim();
      const modelName = document.getElementById('inp-model-name').value.trim();
      if (!baseUrl) { document.getElementById('inp-base-url').style.borderColor = 'var(--red)'; return; }
      if (!modelName) { document.getElementById('inp-model-name').style.borderColor = 'var(--red)'; return; }
      selectedProvider.baseUrl = baseUrl;
      selectedModel = modelName;
    } else {
      selectedModel = document.getElementById('sel-model').value;
    }

    const keyInput = document.getElementById('inp-key').value.trim();

    if (needsKeyInput && !keyInput) {
      document.getElementById('inp-key').focus();
      document.getElementById('inp-key').style.borderColor = 'var(--red)';
      return;
    }

    apiKey = needsKeyInput ? keyInput : selectedProvider.apiKey;

    setStep(3);
    hide('page-choose');
    show('page-test');

    document.getElementById('test-info').textContent =
      'Provider: ' + selectedProvider.kind + '  ·  Model: ' + selectedModel + '  ·  Key: ' + maskKey(apiKey);

    // Run validation
    setStatus('info', '<span class="spin">⟳</span> Connecting to ' + selectedProvider.kind + '…');

    vscode.postMessage({
      command: 'validateKey',
      kind: selectedProvider.kind,
      apiKey,
      model: selectedModel
    });
  }

  function handleValidationResult(msg) {
    const actions = document.getElementById('test-actions');
    actions.style.display = 'flex';

    if (msg.ok) {
      setStatus('success', '✓ Connected successfully! (' + msg.latencyMs + 'ms)');
      document.getElementById('btn-save').textContent = 'Save & Start →';
    } else {
      setStatus('error', '✗ ' + (msg.error || 'Connection failed'));
      document.getElementById('btn-save').textContent = 'Save anyway →';
    }
  }

  function goBackToChoose() {
    setStep(2);
    hide('page-test');
    show('page-choose');
    document.getElementById('test-actions').style.display = 'none';
  }

  function saveConfig() {
    setStatus('info', '<span class="spin">⟳</span> Saving configuration…');
    document.getElementById('btn-save').disabled = true;

    vscode.postMessage({
      command: 'saveConfig',
      kind: selectedProvider.kind,
      envVar: selectedProvider.envVar,
      model: selectedModel,
      apiKey,
      baseUrl: selectedProvider.baseUrl || ''
    });
  }

  function handleSaveResult(msg) {
    if (msg.ok) {
      setStep(4);
      hide('page-test');
      show('page-done');
    } else {
      setStatus('error', '✗ Failed to save: ' + (msg.error || 'unknown error'));
      document.getElementById('btn-save').disabled = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function setStep(n) {
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById('dot-' + i);
      const lbl = document.getElementById('lbl-' + i);
      const line = document.getElementById('line-' + i);
      dot.classList.remove('active', 'done');
      lbl.classList.remove('active');
      if (line) line.classList.remove('done');
      if (i < n) { dot.classList.add('done'); dot.textContent = '✓'; }
      else if (i === n) { dot.classList.add('active'); lbl.classList.add('active'); }
    }
    // Mark lines
    for (let i = 1; i < n; i++) {
      const line = document.getElementById('line-' + i);
      if (line) line.classList.add('done');
    }
  }

  function setStatus(type, html) {
    const el = document.getElementById('test-status');
    el.innerHTML = '<div class="status-box ' + type + '">' + html + '</div>';
  }

  function maskKey(k) {
    if (!k || k.length <= 8) return '••••••••';
    return k.slice(0,6) + '••••••••' + k.slice(-4);
  }

  function show(id, display) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); if (display) el.style.display = display; }
  }
  function hide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
</script>
</body>
</html>`;
}
