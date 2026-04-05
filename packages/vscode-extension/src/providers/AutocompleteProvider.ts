import * as vscode from 'vscode';
import { BYOACore } from '@byoadev/core';

export class AutocompleteProvider implements vscode.InlineCompletionItemProvider {
  private core: BYOACore;
  private lastTriggerTime = 0;
  private debounceMs = 300;
  private cachedCompletion: string | null = null;

  constructor(core: BYOACore) {
    this.core = core;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.debounceMs) {
      return this.cachedCompletion ? [
        new vscode.InlineCompletionItem(
          new vscode.SnippetString(this.cachedCompletion),
          new vscode.Range(position, position)
        )
      ] : undefined;
    }

    this.lastTriggerTime = now;

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) return undefined;

    const line = document.lineAt(position).text;
    const beforeCursor = line.substring(0, position.character);

    if (beforeCursor.length < 3) return undefined;

    try {
      const agent = this.core.createAgent({
        mode: 'ask',
        cwd,
        workspaceRoot: cwd
      });

      let completion = '';
      for await (const event of agent.run(`Complete this line. Only respond with the completion, nothing else:\n${beforeCursor}`)) {
        if (event.type === 'delta') {
          const delta = event.data as { delta?: { content?: string } };
          if (delta?.delta?.content) {
            completion += delta.delta.content;
          }
        }
      }

      const trimmed = completion.trim();
      if (trimmed && !trimmed.includes('\n')) {
        this.cachedCompletion = trimmed;
        return [
          new vscode.InlineCompletionItem(
            new vscode.SnippetString(trimmed),
            new vscode.Range(position, position)
          )
        ];
      }
    } catch {}

    return undefined;
  }
}