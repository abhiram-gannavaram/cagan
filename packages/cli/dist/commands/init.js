import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
export async function initCommand(projectPath) {
    const cwd = projectPath || process.cwd();
    const caganDir = join(cwd, '.cagan');
    if (existsSync(caganDir)) {
        console.log(chalk.yellow('cagan already initialized in this directory'));
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
    writeFileSync(join(cwd, '.caganignore'), caganignoreTemplate, 'utf-8');
    console.log(chalk.green('cagan initialized successfully!'));
    console.log(chalk.cyan('Created:'));
    console.log(`  ${join(caganDir, 'config.yaml')}`);
    console.log(`  ${join(caganDir, 'backups/')}`);
    console.log(`  ${join(cwd, '.caganignore')}`);
    console.log(chalk.yellow('\nPlease configure your provider in .cagan/config.yaml'));
}
//# sourceMappingURL=init.js.map