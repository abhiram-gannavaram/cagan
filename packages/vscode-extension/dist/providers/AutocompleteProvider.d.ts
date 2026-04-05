import * as vscode from 'vscode';
import { CaganCore } from '@cagan/core';
export declare class AutocompleteProvider implements vscode.InlineCompletionItemProvider {
    private core;
    private lastTriggerTime;
    private debounceMs;
    private cachedCompletion;
    constructor(core: CaganCore);
    provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | undefined>;
}
