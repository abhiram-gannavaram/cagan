import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
export async function initCommand(projectPath) {
    const cwd = projectPath || process.cwd();
    const byoaDir = join(cwd, '.byoadev');
    if (existsSync(byoaDir)) {
        console.log(chalk.yellow('BYOA Dev already initialized in this directory'));
        return;
    }
    mkdirSync(byoaDir, { recursive: true });
    mkdirSync(join(byoaDir, 'backups'), { recursive: true });
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
  .byoaignore_path: ~/.byoadev/byoaignore
`;
    writeFileSync(join(byoaDir, 'config.yaml'), configTemplate, 'utf-8');
    const byoaignoreTemplate = `.git/
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
    writeFileSync(join(cwd, '.byoaignore'), byoaignoreTemplate, 'utf-8');
    console.log(chalk.green('BYOA Dev initialized successfully!'));
    console.log(chalk.cyan('Created:'));
    console.log(`  ${join(byoaDir, 'config.yaml')}`);
    console.log(`  ${join(byoaDir, 'backups/')}`);
    console.log(`  ${join(cwd, '.byoaignore')}`);
    console.log(chalk.yellow('\nPlease configure your provider in .byoadev/config.yaml'));
}
//# sourceMappingURL=init.js.map