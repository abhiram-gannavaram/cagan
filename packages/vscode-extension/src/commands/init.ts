import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Silent project-level init. For interactive first-time setup use SetupPanel.
 */
export async function initCommand(projectPath: string): Promise<void> {
  const caganDir = join(projectPath, '.cagan');
  if (existsSync(caganDir)) return;

  mkdirSync(caganDir, { recursive: true });
  mkdirSync(join(caganDir, 'backups'), { recursive: true });

  if (!existsSync(join(projectPath, '.caganignore'))) {
    writeFileSync(
      join(projectPath, '.caganignore'),
      ['.git/', 'node_modules/', 'dist/', 'build/', '*.env', '*.env.local',
       'credentials.json', '*.pem', 'key*.pem', 'secrets/', '.vscode/', '.idea/'].join('\n') + '\n',
      'utf-8'
    );
  }
}