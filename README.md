# BYOA Dev - Universal Open-Source AI Coding Agent

**BYOK (Bring Your Own API) Developer** - A free, open-source coding assistant that works with ANY LLM provider. No subscription, no token limits, no agent limits.

[![CI](https://github.com/byoadev/byoadev/actions/workflows/ci.yml/badge.svg)](https://github.com/byoadev/byoadev/actions)
[![npm version](https://img.shields.io/npm/v/@byoadev/cli.svg)](https://www.npmjs.com/package/@byoadev/cli)

---

## Why BYOA Dev?

**15 Problems Fixed That Cline/Roo Code Have:**

1. **Provider Lock-in** - Only supports one LLM by default
2. **Token Waste** - Rewrites entire files for small changes
3. **Context Loss** - Loses conversation history in long sessions
4. **Hallucination on Large Codebases** - Acts without understanding code relationships
5. **No Rate Limit Handling** - Crashes on 429 errors
6. **No Inline Autocomplete** - Missing tab completion
7. **No Multi-File Awareness** - Agents act on single files only
8. **No Unified Model Switcher** - Can't switch models mid-session
9. **MCP Hard to Set Up** - Manual configuration required
10. **No Cost Tracking** - No visibility into spending
11. **VS Code Only** - No CLI for other IDEs
12. **No Git Integration** - No auto-commit on changes
13. **Security Issues** - API keys in plaintext config
14. **No Semantic Search** - Can't find code by meaning, only patterns
15. **No Parallel Agents** - Can't run multiple agents simultaneously

---

## Features

### 🤖 Universal Provider Support
- **OpenAI-compatible**: MiniMax, Kimi, DeepSeek, Groq, Together, Ollama, LM Studio, OpenRouter
- **Anthropic-compatible**: MiniMax API, Anthropic
- **Google Gemini**: Full support

### 🎯 9 Agent Modes
| Mode | Purpose |
|------|---------|
| `code` | Full file editing with diff-based changes |
| `architect` | Read-only planning and analysis |
| `devops` | Kubernetes, Terraform, CI/CD |
| `doc` | README and inline documentation |
| `test` | Writes and runs tests |
| `refactor` | Improves code without changing behavior |
| `orchestrator` | Breaks tasks into subtasks, delegates to sub-agents |
| `custom` | User-defined system prompt |
| `ask` | Quick questions |

### 🔧 Professional Tools
- **Diff-based editing** - Minimal changes, atomic file operations, rollback
- **Git integration** - status, commit, log, diff
- **Repo mapping** - Understands codebase structure
- **File search** - glob, grep with pattern matching
- **Terminal** - Execute any shell command

### 💾 Three-Tier Memory
- **Session** - Fast, in-memory, cleared on close
- **Project** - Persisted per project
- **Global** - Cross-project, shared across all projects

### 💰 Real-time Cost Tracking
- Per-model and per-provider cost breakdown
- Budget alerts when spending exceeds threshold
- Export usage to CSV

### 🔒 Security
- API keys stored in OS keychain (keytar)
- `.byoaignore` file support
- No telemetry - all data stays local

### 📦 MCP Integration
- Model Context Protocol client
- One-click server installation
- Health monitoring for MCP connections

---

## Quick Start

### Install

```bash
npm install -g @byoadev/cli
```

### Initialize a Project

```bash
cd your-project
byoadev init
```

### Configure Your Provider

Edit `.byoadev/config.yaml`:

```yaml
providers:
  minimax:
    type: anthropic-compatible
    base_url: https://api.minimax.io/anthropic
    api_key: ${MINIMAX_API_KEY}  # or use keytar
    models:
      default: MiniMax-M2.7
    pricing:
      input: 0.001
      output: 0.003

defaults:
  provider: minimax
  code_mode_model: MiniMax-M2.7
```

### Run an Agent

```bash
byoadev agent --mode code "add user authentication to the login page"
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `byoadev init [path]` | Initialize project |
| `byoadev agent --mode <mode> "task"` | Run agent |
| `byoadev chat "message"` | Interactive chat |
| `byoadev agents` | List running agents |
| `byoadev memory --scope <scope> --list` | View memories |
| `byoadev config --list-providers` | List providers |
| `byoadev cost` | Show cost breakdown |
| `byoadev index --rebuild` | Rebuild index |

---

## Architecture

```
packages/
├── core/           # Shared engine
│   ├── providers/  # OpenAI, Anthropic, Gemini adapters
│   ├── agents/     # 9 agent modes
│   ├── memory/     # Session, Project, Global tiers
│   ├── tools/      # File, git, terminal tools
│   ├── diff/       # Diff computation and apply
│   ├── cost/       # Token counting and USD
│   ├── indexer/    # Code indexing with semantic search
│   ├── mcp/        # Model Context Protocol
│   └── security/   # Keychain integration
├── cli/            # Terminal tool
└── vscode-extension/  # VS Code extension
```

---

## VS Code Extension

Install from VS Code marketplace (coming soon) or build from source:

```bash
cd packages/vscode-extension
npm install
npm run build
code --install-extension dist/*.vsix
```

Features:
- Sidebar panel with agent controls
- Chat history
- Memory viewer
- Real-time cost tracker
- Inline autocomplete (300ms debounce)
- MCP server management

---

## Development

```bash
# Clone
git clone https://github.com/byoadev/byoadev.git
cd byoadev

# Install
pnpm install

# Build
pnpm -r build

# Test
pnpm -r test

# Link CLI locally
cd packages/cli && pnpm link --global
```

---

## Comparison

| Feature | BYOA Dev | Cline | Roo Code |
|---------|----------|-------|----------|
| Provider agnostic | ✅ | ❌ | ❌ |
| Parallel agents | ✅ | ❌ | ❌ |
| 9 agent modes | ✅ | ❌ | ❌ |
| Diff-based editing | ✅ | ❌ | ❌ |
| Three-tier memory | ✅ | ❌ | ❌ |
| Cost tracking | ✅ | ❌ | ❌ |
| Keychain security | ✅ | ❌ | ❌ |
| Semantic search | ✅ | ❌ | ❌ |
| MCP integration | ✅ | ❌ | ❌ |
| CLI + VS Code | ✅ | ❌ | ✅ |
| Open source | ✅ | ❌ | ❌ |

---

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

---

**Ship it and let the community help build transformers.js embeddings as v1.1!** 🚀