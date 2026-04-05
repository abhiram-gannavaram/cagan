import * as vscode from 'vscode';
import { BYOACore } from '@byoadev/core';
export declare class AutocompleteProvider implements vscode.InlineCompletionItemProvider {
    private core;
    private lastTriggerTime;
    private debounceMs;
    private cachedCompletion;
    constructor(core: BYOACore);
    provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | undefined>;
}
