# Security Policy

## Our Security Promise

cagan is built with security as the foundation, not an afterthought.
Every design decision prioritises user privacy and data sovereignty.

---

## What We NEVER Do

| Action | Status |
|--------|--------|
| Collect telemetry, analytics, or usage data | **NEVER** |
| Send your code, prompts, or responses to any server we control | **NEVER** |
| Use your data for training any AI model | **NEVER** |
| Store your API keys in plaintext files | **NEVER** |
| Make network calls except to your explicitly configured LLM provider | **NEVER** |
| Sync memory, cache, or index data to any cloud service | **NEVER** |
| Read files listed in `.caganignore` | **NEVER** |
| Log API keys or secrets anywhere | **NEVER** |

---

## What We DO

- Store API keys in the OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Keep all memory, cache, and index data locally at `~/.cagan/` and `{project}/.cagan/`
- Filter `.caganignore` before any file indexing or API calls
- Document every network call in source code with a `// NETWORK:` comment explaining what it does and why
- Document every file read with a `// FILE READ:` comment
- Run entirely from GitHub-hosted open source code — no compiled binaries, no obfuscation

---

## Verifying Our Claims

Because cagan is fully open source, you can verify everything yourself:

```bash
# See every outbound network call
grep -r "// NETWORK:" packages/ --include="*.ts"

# Verify no telemetry URLs
grep -r "segment\|mixpanel\|amplitude\|analytics\.track\|telemetry" packages/ --include="*.ts"
# Expected: no results

# Check keychain usage
cat packages/core/src/security/keychain.ts

# Check .caganignore filtering
cat packages/core/src/tools/executor.ts

# Verify TurboQuant cache is local-only
cat packages/turbo/src/cache.ts

# Check all HTTPS calls are documented
grep -r "https://" packages/ --include="*.ts" | grep -v "// NETWORK:" | grep -v "test\|spec\|mock"
# Expected: no results
```

---

## API Key Storage

Keys are stored using **keytar**, which uses the OS native credential store:

| Platform | Storage |
|----------|---------|
| macOS | Keychain Access |
| Windows | Credential Manager |
| Linux | libsecret / GNOME Keyring |

**Fallback:** If the OS keychain is unavailable, keys are stored in an encrypted file at `~/.cagan/credentials/`. Keys are **never** stored in plaintext.

Keys are loaded into memory only when needed for an API call and are never:
- Written to log files
- Included in error messages
- Sent to any service other than the user's configured provider endpoint

---

## Data Locations (All Local)

```
~/.cagan/
├── global_memory.json    — cross-project memory (local only, never uploaded)
├── cache/                — TurboQuant response cache (local only, never uploaded)
│   └── <sha256>.json     — individual cache entries, keyed by hashed prompts
├── credentials/          — fallback key storage (local only, never uploaded)
└── config.yaml           — your configuration (local only)

{project}/.cagan/
├── config.yaml           — project-level config
└── memory.json           — project memory (local only)
```

**Delete `~/.cagan/` at any time to remove all cagan data from your machine.**
No accounts. No cloud. Nothing to delete remotely.

---

## .caganignore

Create a `.caganignore` file in your project root to prevent cagan from
reading, indexing, or sending specific files to any API:

```gitignore
# Secrets
.env
.env.*
**/*.pem
**/*.key
**/secrets/

# Large binaries
**/*.zip
**/*.tar.gz
node_modules/

# Personal files
NOTES.md
TODO-private.md
```

Files in `.caganignore` are **never** read, indexed, or included in API prompts.
This is enforced at the tool executor level before any file content is processed.

---

## TurboQuant Cache Security

The TurboQuant response cache at `~/.cagan/cache/` stores:
- A SHA-256 hash of the prompt (no raw prompt text)
- The LLM response text
- Metadata: provider name, model name, timestamp, token count

The cache **never** stores:
- Raw prompt text
- API keys
- File contents outside of what the LLM would normally receive

Cache entries expire after a configurable TTL (default: 7 days).
Delete `~/.cagan/cache/` at any time to clear all cached responses.

---

## Agent Swarm Security

Agent Swarm runs multiple agents in parallel. Each agent:
- Runs in the same local process (no separate containers or VMs)
- Uses the same provider and API key as the main session
- Reads only files it needs (respects `.caganignore`)
- Writes only to the local workspace

The swarm coordinator uses the LLM to decompose tasks. This decomposition
prompt is sent to **your configured provider only** — the same endpoint you
use for all other cagan operations.

---

## Reporting Security Issues

If you discover a security vulnerability, please report it via
[GitHub Security Advisories](https://github.com/abhiram-gannavaram/cagan/security/advisories/new).

**Please do not open a public GitHub issue for security vulnerabilities.**

We aim to respond within 48 hours and release a patch within 7 days for
critical issues.

---

## Open Source Guarantee

cagan will always be:
1. Fully open source (Apache 2.0)
2. Free of telemetry and data collection
3. Auditable by anyone at any time

If any future version introduces telemetry, data collection, or mandatory
cloud connectivity, it is no longer cagan — it is a different product.

---

## License

Apache 2.0 — you are free to audit, fork, and modify cagan.
No contributor agreement requires you to give up your rights.
