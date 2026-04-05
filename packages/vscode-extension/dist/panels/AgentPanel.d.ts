import * as vscode from 'vscode';
export declare class AgentPanel {
    private panel;
    private context;
    private core;
    private agent;
    private messages;
    constructor(context: vscode.ExtensionContext);
    show(): void;
    runAgent(mode: string, task: string): Promise<void>;
    stopAgent(): void;
    showMemory(): void;
    showCost(): void;
    private updateWebview;
}
