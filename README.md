# cagan

> Code with any LLM. Free forever. Your code stays yours.

[![npm version](https://img.shields.io/npm/v/@cagan/cli)](https://www.npmjs.com/package/@cagan/cli)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/abhiram-gannavaram/cagan/actions/workflows/ci.yml/badge.svg)](https://github.com/abhiram-gannavaram/cagan/actions/workflows/ci.yml)

cagan is a free, open-source AI coding agent that works with **any LLM API**.
No subscriptions. No token limits. No data collection. Ever.

Built by developers, for developers. Every line of code is public.

---

## Why cagan?

| Feature | cagan | Cline | Roo Code | Cursor | GitHub Copilot |
|---------|:-----:|:-----:|:--------:|:------:|:--------------:|
| Price | **Free** | Free* | Free* | $20/mo | $19/mo |
| Parallel agents | ✅ Unlimited | ❌ | ❌ | Limited | ❌ |
| Any LLM provider | ✅ | Partial | Partial | ❌ | ❌ |
| Token optimizer | ✅ TurboQuant | ❌ | ❌ | ❌ | ❌ |
| Agent swarm (DAG) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Data collection | ❌ Never | Unknown | Unknown | Yes | Yes |
| 100% open source | ✅ | ✅ | ✅ | ❌ | ❌ |
| CLI + VS Code | ✅ | VS Code only | VS Code only | ❌ | Partial |
| Works offline | ✅ (Ollama) | Partial | Partial | ❌ | ❌ |

*API costs apply for both

---

## Security — Our Promise

- **ZERO telemetry** — cagan never sends usage data anywhere
- **ZERO training** — your code is never used to train any model
- **API keys in OS keychain** — never stored in plaintext files
- **Code stays local** — indexed and cached on your machine only
- **Auditable** — every network call has a `// NETWORK:` comment in source

See [SECURITY.md](SECURITY.md) for the full security policy and how to verify our claims.

---

## Installation

### VS Code Extension (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` / `Cmd+Shift+X`
3. Search for **cagan**
4. Click **Install**

Or install from VSIX:
```bash
code --install-extension cagan-0.1.0.vsix
```

### CLI

```bash
npm install -g @cagan/cli
cagan init
```

### Build from Source

```bash
git clone https://github.com/abhiram-gannavaram/cagan
cd cagan
pnpm install
pnpm build
cd packages/cli && npm link
```

---

## Quick Start (5 Minutes)

```bash
# 1. Install
npm install -g @cagan/cli

# 2. Initialize in your project
cd my-project
cagan init

# 3. Run your first agent
cagan agent --mode code "Add input validation to the login endpoint"

# 4. See what it costs
cagan cost
```

---

## Providers

cagan works with any OpenAI-compatible or Anthropic-compatible API.

### MiniMax (Cheapest — Recommended for Cost)
```yaml
providers:
  minimax:
    type: openai-compatible
    base_url: https://api.minimax.chat/v1
    api_key: YOUR_KEY
    models:
      default: MiniMax-Text-01
    pricing:
      input: 0.0002
      output: 0.0006
```

### Ollama (Free, Local, Fully Private)
```yaml
providers:
  ollama:
    type: openai-compatible
    base_url: http://localhost:11434/v1
    api_key: ollama
    models:
      default: llama3
    pricing:
      input: 0
      output: 0
```

### Claude (Anthropic)
```yaml
providers:
  anthropic:
    type: anthropic-compatible
    base_url: https://api.anthropic.com
    api_key: YOUR_KEY
    models:
      default: claude-3-5-sonnet-20241022
    pricing:
      input: 0.003
      output: 0.015
```

### DeepSeek
```yaml
providers:
  deepseek:
    type: openai-compatible
    base_url: https://api.deepseek.com/v1
    api_key: YOUR_KEY
    models:
      default: deepseek-chat
    pricing:
      input: 0.00014
      output: 0.00028
```

### Groq (Fastest)
```yaml
providers:
  groq:
    type: openai-compatible
    base_url: https://api.groq.com/openai/v1
    api_key: YOUR_KEY
    models:
      default: llama3-70b-8192
    pricing:
      input: 0.00059
      output: 0.00079
```

### OpenRouter (Most Variety)
```yaml
providers:
  openrouter:
    type: openai-compatible
    base_url: https://openrouter.ai/api/v1
    api_key: YOUR_KEY
    models:
      default: anthropic/claude-3.5-sonnet
    pricing:
      input: 0.003
      output: 0.015
```

### Gemini
```yaml
providers:
  gemini:
    type: gemini
    base_url: https://generativelanguage.googleapis.com
    api_key: YOUR_KEY
    models:
      default: gemini-1.5-flash
    pricing:
      input: 0.000075
      output: 0.0003
```

---

## Features

### 1. Agent Modes

cagan has 9 specialised agent modes, each with a tuned system prompt and tool set.

#### Code Mode — Write and edit code
```bash
cagan agent --mode code "Add input validation to the user registration endpoint in src/auth/register.ts"
```

#### Architect Mode — Read-only analysis (cannot edit files)
```bash
cagan agent --mode architect "Review src/payment/ for security vulnerabilities and suggest improvements"
```

#### Debug Mode — Find and fix bugs
```bash
cagan agent --mode debug "TypeError: Cannot read property 'id' of undefined at userController.js:45"
```

#### Test Mode — Write tests
```bash
cagan agent --mode test "Write unit tests for src/auth/jwt.ts with 100% branch coverage"
```

#### Refactor Mode — Improve code quality
```bash
cagan agent --mode refactor "Extract the database logic from userController into a UserRepository class"
```

#### DevOps Mode — Infrastructure as code
```bash
cagan agent --mode devops "Generate Kubernetes deployment for this Node.js app with 3 replicas and health checks"
```

#### Doc Mode — Write documentation
```bash
cagan agent --mode doc "Write JSDoc for all exported functions in src/api/"
```

#### Orchestrator Mode — Multi-step tasks
```bash
cagan agent --mode orchestrator "Implement user profile feature: REST API, frontend, tests, and docs"
```

#### Custom Mode — Your own system prompt
```bash
cagan agent --mode custom --system-prompt "You are a security auditor reviewing for OWASP top 10." "Audit src/auth/"
```

---

### 2. TurboQuant — Token Efficiency Engine

TurboQuant reduces your API costs by 40–60% through intelligent compression,
caching, and context optimisation. Runs entirely locally — no data leaves your machine.

#### How it works

```
Request pipeline with TurboQuant:

  Messages → [Dedup & compress] → [Cache check] → [Budget check] → LLM provider
                 -40% tokens         ↓ hit? skip        ↓ block if over limit
```

1. **Compression** — removes comments, deduplicates repeated context, summarises old history turns
2. **Caching** — stores responses at `~/.cagan/cache/`, returns cached result for identical prompts
3. **Context Optimiser** — selects only relevant file sections using TF-IDF scoring
4. **Budget Enforcer** — alerts at 80% of budget, blocks at 100%

#### Configuration
```yaml
turbo:
  enabled: true
  compression_level: medium     # light | medium | aggressive
  cache_enabled: true
  cache_ttl_days: 7
  budget:
    max_usd_per_session: 10.0
    alert_at_percent: 80
    block_at_percent: 100
    fallback_model: gpt-4o-mini
  context_optimizer: true
  max_context_files: 20
```

#### Commands
```bash
cagan turbo --stats                    # session token savings
cagan turbo --cache stats              # cache hit rate and tokens saved
cagan turbo --budget set --usd 5.0    # set session budget
cagan turbo --report                   # full analytics report
```

#### Real savings example
```
Without TurboQuant:  45,230 prompt tokens  →  $0.18
With TurboQuant:     21,480 prompt tokens  →  $0.08  (3 cache hits skipped)
Savings: 56%
```

---

### 3. Agent Swarm — Parallel Multi-Agent Development

Agent Swarm decomposes a high-level task into atomic subtasks, builds a dependency
graph (DAG), and runs multiple specialised agents in parallel.

#### Example: Build Complete Auth System
```bash
cagan swarm "Build JWT authentication: login, register, middleware, tests, and docs"
```

Terminal output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cagan swarm — "Build JWT authentication"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wave 1 (Architecture / Planning):
  ✓ architect       Plan auth system                    [done]    1,230 tokens

Wave 2 (Wave 2) — 2 tasks running in parallel:
  ⟳ code            Implement JWT middleware             [running] 45s
  ⟳ code            Build login/register endpoints      [running] 38s

Wave 3 (Wave 3) — waiting on Wave 2:
  ● test            Write auth tests                    [pending]
  ● doc             Write auth documentation            [pending]

Wave 4 (Wave 4):
  ● devops          Generate Docker + K8s configs       [pending]

Progress: 1/6 complete   Tokens: 1,230/10,000   Elapsed: 83s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Swarm commands
```bash
cagan swarm "Build a complete REST API with auth, tests, and docs"
cagan swarm --dry-run "Build authentication system"
cagan swarm --max-agents 3 "Refactor the entire frontend"
cagan swarm --conflicts merge "Update all TypeScript types"
cagan swarm --budget 50000 "Complete security audit"
cagan swarm --continue-on-failure "Run full test suite and fix failures"
```

#### Conflict resolution

When two agents modify the same file:
- `--conflicts merge` (default) — LLM intelligently merges both versions
- `--conflicts ask` — prompts you to choose
- `--conflicts latest-wins` — keeps the last agent's version
- `--conflicts abort` — stops on any conflict

---

### 4. Memory System

Three-tier memory that persists context across sessions.

```bash
# Project memory
cagan memory --scope project --list
cagan memory --scope project --search "auth conventions"
cagan memory --scope project --clear

# Global memory (available in every project)
cagan memory --scope global --list
```

---

### 5. Cost Tracking

```bash
cagan cost
```

```
Session Cost Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Provider  : anthropic
  Requests  : 12
  Input     : 34,210 tokens   $0.103
  Output    :  6,840 tokens   $0.103
  Total     :                 $0.206
  TurboQuant saved: 18,240 tokens ($0.055)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 6. .caganignore — Keep Secrets Safe

```gitignore
.env
.env.*
**/*.pem
**/*.key
secrets/
node_modules/
dist/
```

Files in `.caganignore` are **never** read, indexed, or sent to any API.

---

## VS Code Extension Features

| Feature | Shortcut |
|---------|----------|
| Run agent | `Ctrl+Shift+A` / `Cmd+Shift+A` |
| Accept inline suggestion | `Tab` |
| Open agent panel | Sidebar icon |
| Switch mode | `Ctrl+Shift+M` |
| View memory | `Ctrl+Shift+Y` |
| Show cost | `Ctrl+Shift+$` |

Features: inline autocomplete, agent chat panel, swarm visual dashboard,
memory viewer, cost tracker in status bar, provider switcher.

---

## CLI Reference

```
cagan init [path]                Initialize cagan
cagan agent --mode <m> <task>    Run an agent
cagan chat <message>             Interactive chat
cagan agents                     List running agents
cagan memory --scope <s>         Manage memories
cagan config                     Manage configuration
cagan cost                       Show session cost
cagan index [--rebuild]          Manage codebase index
cagan turbo [--stats|--report]   TurboQuant controls
cagan swarm [--dry-run] <task>   Run agent swarm
```

---

## Configuration Reference

```yaml
defaults:
  provider: anthropic
  mode: code
  budget_alert_usd: 5.0
  require_confirmation: true

providers:
  anthropic:
    type: anthropic-compatible
    base_url: https://api.anthropic.com
    api_key: ${ANTHROPIC_API_KEY}
    models:
      default: claude-3-5-sonnet-20241022
    pricing:
      input: 0.003
      output: 0.015

turbo:
  enabled: true
  compression_level: medium
  cache_enabled: true
  cache_ttl_days: 7
  budget:
    max_usd_per_session: 10.0
    alert_at_percent: 80
    block_at_percent: 100
  context_optimizer: true
  max_context_files: 20

swarm:
  max_parallel_agents: 5
  conflict_resolution: merge
  continue_on_failure: false
  default_token_budget: 50000
```

---

## Contributing

We welcome contributions. All contributors agree the project remains free,
open source, and never collects user data. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Security Policy

See [SECURITY.md](SECURITY.md) to learn how to report vulnerabilities.

---

## License

[Apache 2.0](LICENSE) — free to use, modify, and distribute.

---

## Built By

**Abhiram Gannavaram** — Cloud Architect, open-source developer
GitHub: [@abhiram-gannavaram](https://github.com/abhiram-gannavaram)
