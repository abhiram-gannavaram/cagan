import * as vscode from 'vscode';
import { initCommand } from './commands/init.js';
import { AgentPanel } from './panels/AgentPanel.js';
export function activate(context) {
    const agentPanel = new AgentPanel(context);
    context.subscriptions.push(vscode.commands.registerCommand('cagan.init', async () => {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        await initCommand(cwd);
        vscode.window.showInformationMessage('cagan initialized');
    }), vscode.commands.registerCommand('cagan.agent.run', async () => {
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
    }), vscode.commands.registerCommand('cagan.agent.stop', () => {
        agentPanel.stopAgent();
    }), vscode.commands.registerCommand('cagan.chat.focus', () => {
        agentPanel.show();
    }), vscode.commands.registerCommand('cagan.memory.view', () => {
        agentPanel.showMemory();
    }), vscode.commands.registerCommand('cagan.config.edit', async () => {
        const configPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            ? `${vscode.workspace.workspaceFolders[0].uri.fsPath}/.cagan/config.yaml`
            : `${process.env.HOME}/.cagan/config.yaml`;
        const doc = await vscode.workspace.openTextDocument(configPath);
        vscode.window.showTextDocument(doc);
    }), vscode.commands.registerCommand('cagan.cost.show', () => {
        agentPanel.showCost();
    }));
}
export function deactivate() { }
//# sourceMappingURL=extension.js.map