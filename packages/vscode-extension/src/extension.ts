/**
 * extension.ts — VS Code extension entry point for cagan.
 *
 * Registers all commands, panels, and status bar items.
 * No telemetry. No data collection. All agent operations go to the user's
 * configured LLM provider only (see SECURITY.md).
 */

import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { initCommand } from './commands/init.js';
import { AgentPanel } from './panels/AgentPanel.js';
import { SetupPanel } from './panels/SetupPanel.js';
import { SidebarProvider } from './providers/SidebarProvider.js';

export function activate(context: vscode.ExtensionContext) {
  const agentPanel = new AgentPanel(context);

  // ── Sidebar webview provider ───────────────────────────────────────────
  const sidebarProvider = new SidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebarProvider)
  );

  // ── First-time setup: show wizard if no config exists ──────────────────
  const hasGlobalConfig  = existsSync(join(homedir(), '.cagan', 'config.yaml'));
  const wsRoot           = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const hasProjectConfig = wsRoot ? existsSync(join(wsRoot, '.cagan', 'config.yaml')) : false;

  if (!hasGlobalConfig && !hasProjectConfig) {
    // Small delay so VS Code fully loads before the panel opens
    setTimeout(() => SetupPanel.show(context), 800);
  }

  // ── TurboQuant status bar ──────────────────────────────────────────────
  // Shows current session cost and compression ratio in the status bar.
  // All data is local — no network calls to display this.
  const turboStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  turboStatusBar.text = '$(zap) cagan: $0.00';
  turboStatusBar.tooltip = 'cagan: current session cost (click for TurboQuant stats)';
  turboStatusBar.command = 'cagan.turbo.stats';
  turboStatusBar.show();
  context.subscriptions.push(turboStatusBar);

  // Update status bar when agent panel reports cost changes
  agentPanel.onCostUpdate((costUsd: number, compressionPct: number) => {
    const costStr = costUsd < 0.001 ? '<$0.001' : `$${costUsd.toFixed(3)}`;
    const compStr = compressionPct > 0 ? ` (-${compressionPct}%)` : '';
    turboStatusBar.text = `$(zap) cagan: ${costStr}${compStr}`;
  });

  context.subscriptions.push(
    // ── Core commands ───────────────────────────────────────────────────

    vscode.commands.registerCommand('cagan.init', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      await initCommand(cwd);
      vscode.window.showInformationMessage('cagan initialized successfully.');
    }),

    vscode.commands.registerCommand('cagan.setup', () => {
      SetupPanel.show(context);
    }),

    vscode.commands.registerCommand('cagan.agent.run', async () => {
      const modes = ['code', 'architect', 'debug', 'review', 'ask', 'test', 'refactor', 'devops', 'doc', 'orchestrator'];
      const mode = await vscode.window.showQuickPick(modes, {
        placeHolder: 'Select agent mode'
      });
      if (!mode) return;

      agentPanel.show();
      const task = await vscode.window.showInputBox({
        prompt: `Enter task for ${mode} agent`,
        placeHolder: 'Describe what you want the agent to do'
      });
      if (task) {
        agentPanel.runAgent(mode, task);
      }
    }),

    vscode.commands.registerCommand('cagan.agent.stop', () => {
      agentPanel.stopAgent();
    }),

    vscode.commands.registerCommand('cagan.agent.switchMode', async () => {
      const modes = ['code', 'architect', 'debug', 'review', 'ask', 'test', 'refactor', 'devops', 'doc'];
      const mode = await vscode.window.showQuickPick(modes, {
        placeHolder: 'Switch agent mode'
      });
      if (mode) agentPanel.switchMode(mode);
    }),

    vscode.commands.registerCommand('cagan.chat.focus', () => {
      agentPanel.show();
    }),

    vscode.commands.registerCommand('cagan.memory.view', () => {
      agentPanel.showMemory();
    }),

    vscode.commands.registerCommand('cagan.config.edit', async () => {
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const configPath = wsRoot
        ? `${wsRoot}/.cagan/config.yaml`
        : `${process.env.HOME}/.cagan/config.yaml`;
      try {
        const doc = await vscode.workspace.openTextDocument(configPath);
        vscode.window.showTextDocument(doc);
      } catch {
        vscode.window.showErrorMessage(
          `cagan config not found at ${configPath}. Run "cagan init" first.`
        );
      }
    }),

    vscode.commands.registerCommand('cagan.cost.show', () => {
      agentPanel.showCost();
    }),

    // ── TurboQuant commands ────────────────────────────────────────────

    vscode.commands.registerCommand('cagan.turbo.stats', () => {
      // Shows TurboQuant stats in the agent panel
      // All data is local — reads from ~/.cagan/cache/
      agentPanel.showTurboStats();
    }),

    // ── Swarm commands ─────────────────────────────────────────────────

    vscode.commands.registerCommand('cagan.swarm.start', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'Describe the task for the agent swarm',
        placeHolder: 'e.g. Build a REST API with auth, tests, and documentation'
      });
      if (!task) return;

      const dryRunChoice = await vscode.window.showQuickPick(
        ['Execute swarm', 'Dry run (show plan only)'],
        { placeHolder: 'How would you like to run this swarm?' }
      );
      if (!dryRunChoice) return;

      const dryRun = dryRunChoice.includes('Dry run');
      agentPanel.show();
      agentPanel.startSwarm(task, { dryRun });
    }),

    vscode.commands.registerCommand('cagan.swarm.status', () => {
      agentPanel.showSwarmStatus();
    })
  );
}

export function deactivate() {
  // Nothing to clean up — no persistent connections
}
