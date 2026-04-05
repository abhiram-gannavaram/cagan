import { BaseAgent } from './base.js';
export class ArchitectAgent extends BaseAgent {
    constructor(config) {
        const systemPrompt = config.systemPrompt || `You are an architect agent. Your role is to:
1. Analyze codebases and understand architecture
2. Read files to understand patterns and structure
3. Plan and propose code changes without modifying files
4. Provide recommendations and explanations
5. You CANNOT use write_file, edit_file, or terminal tools - you are read-only

Available tools:
- read_file: Read file contents (use this extensively)
- glob: Find files by pattern
- grep: Search for text in files
- read_directory: List directory contents

Focus on understanding the codebase structure, identifying issues, and providing thoughtful analysis.`;
        super({ ...config, systemPrompt });
    }
    buildContext() {
        return [...this.messages];
    }
}
//# sourceMappingURL=architect.js.map