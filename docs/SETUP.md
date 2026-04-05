# cagan — Complete Setup & Usage Guide

cagan is a provider-agnostic AI coding agent that runs entirely on your machine.  
No telemetry. No data leaves your network. All credentials are encrypted locally.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Installation — VS Code Extension](#2-installation--vs-code-extension)
3. [Installation — CLI](#3-installation--cli)
4. [Installation — Build from Source](#4-installation--build-from-source)
5. [First-Time Configuration](#5-first-time-configuration)
6. [Provider Configuration Reference](#6-provider-configuration-reference)
7. [CLI Usage](#7-cli-usage)
8. [VS Code Extension Usage](#8-vs-code-extension-usage)
9. [Agent Swarm — Creation & Management](#9-agent-swarm--creation--management)
10. [TurboQuant — Token Efficiency Engine](#10-turboquant--token-efficiency-engine)
11. [Memory System](#11-memory-system)
12. [MCP Server Integration](#12-mcp-server-integration)
13. [Security & Privacy](#13-security--privacy)
14. [Reporting Issues](#14-reporting-issues)

---

## 1. System Requirements

| Requirement | Minimum |
|---|---|
| Node.js | 20.0.0 or later |
| pnpm | 9.0.0 or later |
| Git | 2.x |
| OS | macOS 12+, Linux (glibc 2.28+), Windows 10+ |

---

## 2. Installation — VS Code Extension

### From VS Code Marketplace (recommended)

1. Open VS Code.
2. Press `Cmd+Shift+X` (macOS) or `Ctrl+Shift+X` (Windows/Linux).
3. Search for **cagan**.
4. Click **Install**.

### From `.vsix` file

```bash
code --install-extension cagan-*.vsix
```

After installation, run `cagan: Open Agent Panel` from the Command Palette (`Cmd+Shift+P`).

---

## 3. Installation — CLI

```bash
npm install -g @cagan/cli
```

Verify:

```bash
cagan --version
```

---

## 4. Installation — Build from Source

```bash
# Clone the repository
git clone https://github.com/abhiram-gannavaram/cagan.git
cd cagan

# Install pnpm if not already installed
npm install -g pnpm@9

# Install all workspace dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm -r build

# Link the CLI globally
cd packages/cli
npm link
cd ../..

# Verify
cagan --version
```

---

## 5. First-Time Configuration

Run the interactive setup wizard:

```bash
cagan init
```

This creates `~/.cagan/config.yaml` and a `.caganignore` file in your project.

### Manual configuration

Create `~/.cagan/config.yaml`:

```yaml
version: "1.0"

providers:
  my-openai:
    type: openai-compatible
    base_url: https://api.openai.com/v1
    apiKey: ${OPENAI_API_KEY}          # reads from environment variable
    models:
      default: gpt-4o
    pricing:
      input: 0.005
      output: 0.015

defaults:
  provider: my-openai
  code_mode_model: gpt-4o
  architect_model: gpt-4o
  max_parallel_agents: 5
  auto_commit: false
  memory_enabled: true
  budget_alert_usd: 5.0

security:
  api_key_storage: keychain
```

> **Security note:** Always use `${ENV_VAR}` syntax or the keychain — never paste raw API keys into config files.

Store your API key securely:

```bash
# Store in OS keychain
cagan keys set my-openai sk-...

# Or set as environment variable (session only)
export OPENAI_API_KEY=sk-...
```

---

## 6. Provider Configuration Reference

### OpenAI / OpenAI-compatible

```yaml
providers:
  openai:
    type: openai-compatible
    base_url: https://api.openai.com/v1
    apiKey: ${OPENAI_API_KEY}
    models:
      default: gpt-4o
      autocomplete: gpt-4o-mini
```

### Anthropic Claude

```yaml
providers:
  anthropic:
    type: anthropic-compatible
    base_url: https://api.anthropic.com
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      default: claude-3-5-sonnet-20241022
```

### Google Gemini

```yaml
providers:
  gemini:
    type: gemini
    apiKey: ${GEMINI_API_KEY}
    models:
      default: gemini-1.5-pro
```

### DeepSeek

```yaml
providers:
  deepseek:
    type: openai-compatible
    base_url: https://api.deepseek.com/v1
    apiKey: ${DEEPSEEK_API_KEY}
    models:
      default: deepseek-coder
```

### Local Ollama

```yaml
providers:
  ollama:
    type: openai-compatible
    base_url: http://localhost:11434/v1
    apiKey: ollama          # placeholder — Ollama ignores this
    models:
      default: codestral
```

### MiniMax

```yaml
providers:
  minimax:
    type: openai-compatible
    base_url: https://api.minimax.chat/v1
    apiKey: ${MINIMAX_API_KEY}
    models:
      default: MiniMax-Text-01
```

### Groq

```yaml
providers:
  groq:
    type: openai-compatible
    base_url: https://api.groq.com/openai/v1
    apiKey: ${GROQ_API_KEY}
    models:
      default: llama3-70b-8192
```

---

## 7. CLI Usage

### Core commands

```bash
# Interactive chat in code mode
cagan chat "Add error handling to the authentication module"

# Architect mode — high-level design and planning
cagan chat --mode architect "Design a microservices architecture for this monolith"

# Debug mode — root cause analysis
cagan chat --mode debug "Why is the login endpoint returning 500?"

# Review mode — code review and security audit
cagan chat --mode review "Review the changes in the last 3 commits"

# One-shot task (non-interactive)
cagan run "Write unit tests for src/auth/login.ts"
```

### Agent modes

| Mode | Flag | Best for |
|---|---|---|
| code | `--mode code` | Writing and editing code (default) |
| architect | `--mode architect` | System design, refactoring plans |
| debug | `--mode debug` | Diagnosing bugs and errors |
| review | `--mode review` | Code review, security checks |
| ask | `--mode ask` | Questions without file changes |
| test | `--mode test` | Generating test suites |
| refactor | `--mode refactor` | Structural code improvements |
| devops | `--mode devops` | CI/CD, infrastructure changes |
| doc | `--mode doc` | Documentation generation |
| orchestrator | `--mode orchestrator` | Coordinating multi-step tasks |

### Cost and usage

```bash
# Show session cost summary
cagan cost

# Show TurboQuant savings report
cagan turbo --stats

# Show cache hit rate
cagan turbo --cache

# Check remaining budget
cagan turbo --budget --usd 10.00

# Full waste analysis report
cagan turbo --report
```

### API key management

```bash
# Store a key securely (OS keychain / encrypted file)
cagan keys set openai sk-...

# List stored providers
cagan keys list

# Remove a key
cagan keys delete openai
```

### Initialisation

```bash
# Interactive setup wizard
cagan init

# Force re-run in an existing project
cagan init --force
```

---

## 8. VS Code Extension Usage

### Opening the agent panel

- Command Palette (`Cmd+Shift+P`): `cagan: Open Agent Panel`
- Keyboard shortcut: `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Windows/Linux)

### Running tasks

1. Open the panel.
2. Type your task in the input box.
3. Select a mode from the dropdown (defaults to `code`).
4. Press Enter or click **Run**.

### Switching modes mid-session

Use the mode badge in the top-right of the panel to switch between agent modes without losing conversation history.

### TurboQuant status bar

The bottom status bar shows:

```
cagan $0.0023 · 42% saved
```

Click it to open the full TurboQuant stats panel.

### Keyboard shortcuts

| Action | macOS | Windows/Linux |
|---|---|---|
| Open panel | `Cmd+Shift+A` | `Ctrl+Shift+A` |
| Run current task | `Enter` | `Enter` |
| Stop agent | `Cmd+.` | `Ctrl+.` |
| Show cost | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| Show memory | `Cmd+Shift+M` | `Ctrl+Shift+M` |
| Start swarm | via panel button | via panel button |

---

## 9. Agent Swarm — Creation & Management

The Agent Swarm decomposes a complex task into parallel sub-tasks, builds a dependency DAG, and executes them concurrently using multiple LLM calls.

### CLI

```bash
# Start a swarm (interactive — shows live dashboard)
cagan swarm "Build a complete REST API with authentication, database models, tests, and API docs"

# Dry run — show the execution plan without running anything
cagan swarm --dry-run "Migrate the codebase from CommonJS to ESM"

# Limit parallel agents
cagan swarm --max-agents 3 "Refactor all service classes to use dependency injection"

# Set conflict resolution strategy
cagan swarm --conflicts merge "Update all API endpoints to v2 format"
# Options: merge (default), ask, latest-wins, abort

# Set token budget (blocks execution if exceeded)
cagan swarm --budget 50000 "Add comprehensive error handling throughout the app"

# Continue on sub-task failure
cagan swarm --continue-on-failure "Add JSDoc comments to all public functions"

# Use a specific provider and model
cagan swarm --provider deepseek --model deepseek-coder "Optimise all database queries"
```

### Live terminal dashboard

While a swarm runs you see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cagan swarm — "Build REST API with auth and tests"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wave 1 (Architecture / Planning):
  ✓ architect   Design API schema & auth flow       [done  ] 4.2s 1,240 tokens
  ✓ architect   Define database models              [done  ] 3.8s   980 tokens

Wave 2 (Implementation):
  ✓ code        Implement User model                [done  ] 8.1s 2,100 tokens
  ✓ code        Implement auth middleware            [done  ] 7.4s 1,890 tokens
  ⟳ code        Implement /users endpoints          [running] 3.1s   640 tokens
  ● code        Implement /posts endpoints          [pending]

Wave 3 (Testing):
  ◌ test        Write auth tests                   [waiting on wave 2]
  ◌ test        Write API integration tests        [waiting on wave 2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress: 4/8 complete   Tokens: 6,850   Elapsed: 12.3s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Programmatic API

```typescript
import { AgentSwarm } from '@cagan/swarm';
import { createProvider } from '@cagan/core';

const provider = createProvider('myProvider', {
  type: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY!,
  models: { default: 'gpt-4o' },
  // ...
});

const swarm = new AgentSwarm(provider);

// Dry run first — inspect the plan
const plan = await swarm.dryRun('Build a complete auth system', {
  maxParallelAgents: 4,
  workspaceRoot: '/my/project'
});
console.log(`Planned ${plan.tasks.length} tasks in ${plan.waves.length} waves`);
console.log(`Estimated cost: $${plan.estimatedCost.totalUsd.toFixed(4)}`);

// Execute
const result = await swarm.run('Build a complete auth system', {
  maxParallelAgents: 4,
  conflictResolution: 'merge',
  continueOnFailure: false,
  workspaceRoot: '/my/project',
  provider: 'myProvider',
  model: 'gpt-4o'
});

console.log(`Completed: ${result.completedTasks}/${result.completedTasks + result.failedTasks}`);
```

### Conflict resolution strategies

| Strategy | Behaviour |
|---|---|
| `merge` (default) | 3-way line diff; AI resolves conflicts it can't diff |
| `ask` | Pauses and prompts you for each conflict |
| `latest-wins` | The task with the higher wave index wins |
| `abort` | Stops the swarm on the first conflict |

### VS Code swarm panel

1. Click **Swarm** in the cagan panel.
2. Enter your task.
3. Configure max agents and conflict resolution.
4. Click **Start Swarm** — a terminal opens showing the live dashboard.
5. Click **Swarm Status** in the panel to see progress.

---

## 10. TurboQuant — Token Efficiency Engine

TurboQuant reduces your API costs by 40–60% through five complementary techniques:

| Technique | What it does |
|---|---|
| Compression | Removes duplicate code blocks, minifies whitespace, summarises old history |
| Caching | Caches identical prompt → response pairs locally in `~/.cagan/cache/` |
| Budgeting | Blocks requests that would exceed your configured token/USD limits |
| Context optimisation | Ranks files by relevance (TF-IDF), sends only what matters |
| Analytics | Identifies waste patterns and projects monthly costs |

### CLI usage

```bash
# Show session savings and compression ratio
cagan turbo --stats

# Show cache hit rate, saved tokens, and oldest entry
cagan turbo --cache

# Set a session token budget and warn when 80% consumed
cagan turbo --budget --usd 2.00

# Full waste report with improvement suggestions
cagan turbo --report
```

### Programmatic API

```typescript
import { TurboQuant } from '@cagan/turbo';

const turbo = new TurboQuant({
  cacheDir: '~/.cagan/cache',
  compressionLevel: 'medium',   // light | medium | aggressive
  maxTokens: 50_000,
  budget: {
    maxUsdPerSession: 2.00,
    alertAtPercent: 80,
    fallbackModel: 'gpt-4o-mini'
  }
});

// Process messages before sending to LLM
const processed = await turbo.processMessages(messages, {
  compressionLevel: 'medium',
  maxTokens: 8_000,
  preserveLastN: 5
});

// After LLM responds, cache the result
await turbo.cacheResponse(messages, responseText, {
  provider: 'openai',
  model: 'gpt-4o',
  tokensUsed: 1_240,
  expiresIn: 24 * 60 * 60 * 1000  // 24 hours
});
```

---

## 11. Memory System

cagan maintains two memory scopes:

| Scope | Location | Persists |
|---|---|---|
| Global | `~/.cagan/global_memory.json` | Across all projects |
| Project | `{project}/.cagan/memory.json` | Per project |

### CLI

```bash
# View current memory
cagan memory show

# Clear project memory
cagan memory clear --project

# Clear global memory
cagan memory clear --global
```

Memory is read automatically at the start of every session. The agent uses it to remember your preferences, project context, and previous decisions.

---

## 12. MCP Server Integration

Model Context Protocol (MCP) servers extend cagan with additional tools (filesystem, web search, Slack, etc.).

### Adding MCP servers

In `~/.cagan/config.yaml`:

```yaml
mcp:
  servers:
    - id: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    - id: brave-search
      command: npx
      args: ["-y", "@modelcontextprotocol/server-brave-search"]
      env:
        BRAVE_API_KEY: ${BRAVE_API_KEY}
```

### From the marketplace

```bash
# List available MCP servers
cagan mcp list

# Install a server
cagan mcp install filesystem

# Start a server
cagan mcp start filesystem

# Check server status
cagan mcp status
```

---

## 13. Security & Privacy

- **Zero telemetry.** cagan never sends usage data, prompts, or code to any third party. See `SECURITY.md` for the full pledge.
- **Credentials are encrypted.** API keys are stored with AES-256-GCM encryption in `~/.cagan/credentials/store.enc` (permissions `600`) or via your OS keychain if `keytar` is installed.
- **`.caganignore`** prevents the agent from reading secrets, `.env` files, and sensitive paths. Review yours with `cat .caganignore`.
- **All outbound network calls** are documented with `// NETWORK:` comments and verified by CI. The agent only ever calls the provider endpoint you configured.

### Verify no telemetry

```bash
grep -r "segment\|mixpanel\|amplitude\|analytics\.track" packages/ --include="*.ts"
# Should return nothing
```

### Delete all local data

```bash
rm -rf ~/.cagan/          # all config, credentials, memory, cache
rm -rf {project}/.cagan/ # project-specific data
```

---

## 14. Reporting Issues

**All issues must be filed as GitHub Issues — no direct patches or merges from external contributors.**

### How to report

1. Go to **[https://github.com/abhiram-gannavaram/cagan/issues](https://github.com/abhiram-gannavaram/cagan/issues)**.
2. Click **New Issue**.
3. Choose the appropriate template:
   - **Bug report** — unexpected behaviour, crashes, or incorrect output.
   - **Security vulnerability** — use the private security advisory form (see below).
   - **Feature request** — new capabilities or improvements.

### Bug report checklist

Include:
- cagan version (`cagan --version`)
- OS and Node.js version
- Steps to reproduce (minimal)
- Expected vs actual behaviour
- Relevant log output (redact API keys)

### Security vulnerabilities

**Do not open a public issue for security vulnerabilities.**  
Use GitHub's private security advisory:  
[https://github.com/abhiram-gannavaram/cagan/security/advisories/new](https://github.com/abhiram-gannavaram/cagan/security/advisories/new)

### Contributing

External contributors may open Pull Requests. All PRs must:
1. Pass CI (build, tests, security audit, lint).
2. Be reviewed and approved by the repository owner.
3. Not be self-merged — only the owner may merge.

See `CONTRIBUTING.md` for the full contribution guide.
