# Contributing to cagan

Thank you for your interest in contributing to cagan.

---

## Repository Access Policy — Read This First

> **Only the repository owner (@abhiram-gannavaram) may merge pull requests or push directly to `main`.**
>
> All other contributors — regardless of collaborator status — must open a Pull Request.  
> Self-merging is **never** permitted.

This policy is enforced via GitHub branch protection rules on `main`:

- Direct pushes to `main` are **blocked** for all non-owners.
- Every change requires a PR with an approving review from the owner.
- All CI checks (Build & Test, Lint, Security Audit) **must pass** before merge.
- Force-pushes and branch deletion are **disabled**.

---

## Reporting Issues

**All bugs, feature requests, and questions must be filed as GitHub Issues:**  
https://github.com/abhiram-gannavaram/cagan/issues

For **security vulnerabilities** use the private advisory form — do **not** open a public issue:  
https://github.com/abhiram-gannavaram/cagan/security/advisories/new

When reporting a bug, include:
- `cagan --version` output
- OS and Node.js version
- Exact steps to reproduce
- Expected vs. actual behaviour
- Relevant log output (redact any API keys)

---

## Development Setup

```bash
# 1. Fork then clone
git clone https://github.com/<your-fork>/cagan.git
cd cagan

# 2. Install deps (Node 20+, pnpm 9+ required)
pnpm install --frozen-lockfile

# 3. Build all packages
pnpm -r build

# 4. Run tests
pnpm -r test
```

See [docs/SETUP.md](docs/SETUP.md) for the complete guide including provider configuration.

---

## Project Structure

```
packages/
  core/          — Shared engine: providers, agents, tools, memory, cost tracking
  cli/           — Terminal CLI (@cagan/cli)
  vscode-extension/ — VS Code extension
  marketplace/   — MCP server registry
  turbo/         — TurboQuant token efficiency engine (@cagan/turbo)
  swarm/         — Agent Swarm orchestration (@cagan/swarm)
docs/
  SETUP.md       — Complete setup and usage guide
```

---

## Making a Contribution

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Write your changes** and add tests where appropriate.

3. **Ensure CI passes locally:**
   ```bash
   pnpm -r build    # must compile with zero errors
   pnpm -r test     # all tests must pass
   pnpm -r lint     # tsc --noEmit must succeed
   ```

4. **Commit** with a clear message:
   ```bash
   git commit -m "feat: describe what you added"
   ```

5. **Push** and open a Pull Request against `main`.

6. **Wait** for CI to pass and for the owner to review.  
   Do **not** merge your own PR.

---

## Code Standards

| Standard | Requirement |
|---|---|
| Language | TypeScript, `strict: true` throughout |
| Network calls | Every `fetch()` must have a `// NETWORK:` inline comment |
| Telemetry | Strictly prohibited (Segment, Mixpanel, Amplitude, etc.) |
| Secrets | No hardcoded API keys or tokens anywhere |
| Tests | New features must include Vitest unit tests |
| Lint | `pnpm -r lint` must pass with no errors |

All of the above are automatically enforced by CI on every PR.

---

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
