import { z } from 'zod';
import type { ToolDefinition, ToolCall } from '../providers/types.js';

export const ReadFileSchema = z.object({
  path: z.string().describe('Absolute path to the file to read'),
  offset: z.number().optional().describe('Line number to start reading from'),
  limit: z.number().optional().describe('Maximum number of lines to read')
});

export const WriteFileSchema = z.object({
  path: z.string().describe('Absolute path to the file to write'),
  content: z.string().describe('Content to write to the file'),
  createBackup: z.boolean().optional().describe('Whether to create a backup before writing')
});

export const EditFileSchema = z.object({
  path: z.string().describe('Absolute path to the file to edit'),
  oldString: z.string().describe('The exact string to replace'),
  newString: z.string().describe('The replacement string')
});

export const GlobSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "src/**/*.ts")'),
  cwd: z.string().optional().describe('Working directory for the search')
});

export const GrepSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z.string().optional().describe('Directory or file to search in'),
  include: z.string().optional().describe('File pattern to include (e.g., "*.ts")'),
  caseSensitive: z.boolean().optional().default(false)
});

export const TerminalSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  cwd: z.string().optional().describe('Working directory for the command'),
  timeout: z.number().optional().describe('Timeout in milliseconds')
});

export const ReadDirSchema = z.object({
  path: z.string().describe('Absolute path to the directory to read')
});

export const GitStatusSchema = z.object({
  cwd: z.string().optional().describe('Working directory for the git command')
});

export const GitCommitSchema = z.object({
  message: z.string().describe('Commit message'),
  cwd: z.string().optional().describe('Working directory for the git command'),
  addAll: z.boolean().optional().describe('Stage all changes before committing')
});

export const GitLogSchema = z.object({
  cwd: z.string().optional().describe('Working directory for the git command'),
  maxCount: z.number().optional().describe('Maximum number of commits to show')
});

export const GitDiffSchema = z.object({
  cwd: z.string().optional().describe('Working directory for the git command'),
  file: z.string().optional().describe('Specific file to show diff for')
});

export const RepoMapSchema = z.object({
  maxFiles: z.number().optional().describe('Maximum number of files to include in the map')
});

export type ToolInput = {
  'read_file'?: z.infer<typeof ReadFileSchema>;
  'write_file'?: z.infer<typeof WriteFileSchema>;
  'edit_file'?: z.infer<typeof EditFileSchema>;
  'glob'?: z.infer<typeof GlobSchema>;
  'grep'?: z.infer<typeof GrepSchema>;
  'terminal'?: z.infer<typeof TerminalSchema>;
  'read_directory'?: z.infer<typeof ReadDirSchema>;
  'git_status'?: z.infer<typeof GitStatusSchema>;
  'git_commit'?: z.infer<typeof GitCommitSchema>;
  'git_log'?: z.infer<typeof GitLogSchema>;
  'git_diff'?: z.infer<typeof GitDiffSchema>;
  'repo_map'?: z.infer<typeof RepoMapSchema>;
};

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export type ToolExecutor = (input: ToolInput[keyof ToolInput]) => Promise<ToolResult>;

export interface ToolContext {
  cwd: string;
  workspaceRoot: string;
}

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to read' },
          offset: { type: 'number', description: 'Line number to start reading from' },
          limit: { type: 'number', description: 'Maximum number of lines to read' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file, creating it if it does not exist',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
          createBackup: { type: 'boolean', description: 'Whether to create a backup before writing' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace a specific string within a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to edit' },
          oldString: { type: 'string', description: 'The exact string to replace' },
          newString: { type: 'string', description: 'The replacement string' }
        },
        required: ['path', 'oldString', 'newString']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to match files' },
          cwd: { type: 'string', description: 'Working directory for the search' }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for text within files using regular expressions',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression pattern to search for' },
          path: { type: 'string', description: 'Directory or file to search in' },
          include: { type: 'string', description: 'File pattern to include' },
          caseSensitive: { type: 'boolean', description: 'Whether the search is case sensitive' }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'terminal',
      description: 'Execute a shell command and return its output',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory for the command' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_directory',
      description: 'List the contents of a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the directory to read' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show the working tree status of a git repository',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory for the git command' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Commit changes to a git repository with a message',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message describing the changes' },
          cwd: { type: 'string', description: 'Working directory for the git command' },
          addAll: { type: 'boolean', description: 'Stage all changes before committing' }
        },
        required: ['message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent git commit history',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory for the git command' },
          maxCount: { type: 'number', description: 'Maximum number of commits to show' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show changes between commits or working tree',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory for the git command' },
          file: { type: 'string', description: 'Specific file to show diff for' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'repo_map',
      description: 'Get a map of the repository structure with files and their symbols',
      parameters: {
        type: 'object',
        properties: {
          maxFiles: { type: 'number', description: 'Maximum number of files to include' }
        }
      }
    }
  }
];

export function validateToolInput(toolName: string, input: unknown): { valid: boolean; error?: string } {
  try {
    switch (toolName) {
      case 'read_file':
        ReadFileSchema.parse(input);
        break;
      case 'write_file':
        WriteFileSchema.parse(input);
        break;
      case 'edit_file':
        EditFileSchema.parse(input);
        break;
      case 'glob':
        GlobSchema.parse(input);
        break;
      case 'grep':
        GrepSchema.parse(input);
        break;
      case 'terminal':
        TerminalSchema.parse(input);
        break;
      case 'read_directory':
        ReadDirSchema.parse(input);
        break;
      default:
        return { valid: false, error: `Unknown tool: ${toolName}` };
    }
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { valid: false, error: 'Validation failed' };
  }
}