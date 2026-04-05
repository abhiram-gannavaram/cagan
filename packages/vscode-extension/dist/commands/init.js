import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
export async function initCommand(projectPath) {
    const caganDir = join(projectPath, '.cagan');
    if (existsSync(caganDir)) {
        return;
    }
    mkdirSync(caganDir, { recursive: true });
    mkdirSync(join(caganDir, 'backups'), { recursive: true });
    const configTemplate = `version: "1.0"
providers: {}
defaults:
  provider: ""
  code_mode_model: ""
  architect_model: ""
  autocomplete_model: ""
  orchestrator_model: ""
  max_parallel_agents: 10
  auto_commit: true
  memory_enabled: true
  budget_alert_usd: 5.0
security:
  api_key_storage: keychain
  caganignore_path: ~/.cagan/caganignore
`;
    writeFileSync(join(caganDir, 'config.yaml'), configTemplate, 'utf-8');
    const caganignoreTemplate = `.git/
node_modules/
dist/
build/
*.env
*.env.local
credentials.json
*.pem
key*.pem
secrets/
.vscode/
.idea/
`;
    writeFileSync(join(projectPath, '.caganignore'), caganignoreTemplate, 'utf-8');
}
//# sourceMappingURL=init.js.map