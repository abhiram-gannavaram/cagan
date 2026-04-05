import * as vscode from 'vscode';
import { initCommand } from './commands/init.js';
import { AgentPanel } from './panels/AgentPanel.js';

export function activate(context: vscode.ExtensionContext) {
  const agentPanel = new AgentPanel(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('byoa.dev.init', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      await initCommand(cwd);
      vscode.window.showInformationMessage('BYOA Dev initialized');
    }),

    vscode.commands.registerCommand('byoa.dev.agent.run', async () => {
      const modes = ['code', 'architect', 'debug', 'review', 'ask'];
      const mode = await vscode.window.showQuickPick(modes, {
        placeHolder: 'Select agent mode'
      });
      if (mode) {
        agentPanel.show();
        const task = await vscode.window.showInputBox({
          prompt: 'Enter task description'
        });
        if (task) {
          agentPanel.runAgent(mode, task);
        }
      }
    }),

    vscode.commands.registerCommand('byoa.dev.agent.stop', () => {
      agentPanel.stopAgent();
    }),

    vscode.commands.registerCommand('byoa.dev.chat.focus', () => {
      agentPanel.show();
    }),

    vscode.commands.registerCommand('byoa.dev.memory.view', () => {
      agentPanel.showMemory();
    }),

    vscode.commands.registerCommand('byoa.dev.config.edit', async () => {
      const configPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        ? `${vscode.workspace.workspaceFolders[0].uri.fsPath}/.byoadev/config.yaml`
        : `${process.env.HOME}/.byoadev/config.yaml`;
      const doc = await vscode.workspace.openTextDocument(configPath);
      vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand('byoa.dev.cost.show', () => {
      agentPanel.showCost();
    })
  );
}

export function deactivate() {}