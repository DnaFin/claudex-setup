# Nerviq

> The intelligent nervous system for AI coding agents — audit, align, and amplify every platform on every project.

[![npm version](https://img.shields.io/npm/v/@nerviq/cli)](https://www.npmjs.com/package/@nerviq/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

---

### ⚠️ Beta — Currently Claude Code only

Nerviq is in **beta**. The current release fully supports **Claude Code** (90 checks, audit, setup, governance, benchmark).

**Coming soon:**
- Codex (OpenAI)
- Gemini CLI (Google)
- GitHub Copilot
- Cursor
- Windsurf
- Aider
- OpenCode
- **Harmony** — cross-platform drift detection
- **Synergy** — multi-agent amplification

---

## What Nerviq Does

Nerviq scores your AI coding agent setup from 0 to 100, finds what's missing, and fixes it — with rollback for every change.

```
  nerviq audit
  ═══════════════════════════════════════
  Detected: React, TypeScript, Docker

  ████████████████░░░░ 78/100

  ✅ CLAUDE.md with architecture diagram
  ✅ Hooks (PreToolUse + PostToolUse)
  ✅ Custom skills (3 skills)
  ✅ MCP servers configured

  ⚡ Top 3 Next Actions
     1. Add verification commands to CLAUDE.md
     2. Configure deny rules for dangerous operations
     3. Add path-specific rules in .claude/rules/

  Next: nerviq setup
```

## Quick Start

```bash
npx @nerviq/cli audit              # Score your project (10 seconds)
npx @nerviq/cli audit --lite       # Quick top-3 scan
npx @nerviq/cli setup              # Generate starter-safe baseline
npx @nerviq/cli augment            # Improvement plan, no writes
npx @nerviq/cli governance         # Permission profiles + policy packs
npx @nerviq/cli benchmark          # Before/after in isolated copy
```

No install required. Zero dependencies.

## 90 Checks Across 14 Categories

| Category | Checks | Examples |
|----------|--------|---------|
| Memory & Context | 9 | CLAUDE.md, architecture, @path imports, CLAUDE.local.md |
| Quality | 8 | verification loops, test/lint/build commands |
| Security | 7 | permissions, deny rules, secrets detection |
| Automation | 8 | hooks (30+ event types), notification, subagent tracking |
| Workflow | 9 | skills, subagents, rules, commands, snapshots |
| Git & Hygiene | 14 | .gitignore, env protection, README, changelog |
| Tools & MCP | 4 | .mcp.json, Context7, multi-server |
| Prompting | 6 | XML tags, constraints, examples, role definition |
| DevOps | 5 | Docker, CI, Terraform |
| Design | 2 | frontend anti-slop, Tailwind |
| Performance | 3 | compaction, context management, effort level |
| Features | 2 | channels, worktrees |
| Quality Deep | 9 | freshness, contradictions, deprecated patterns |

## All Commands

| Command | What it does |
|---------|-------------|
| `nerviq audit` | Score 0-100 against 90 checks |
| `nerviq audit --lite` | Quick top-3 scan |
| `nerviq setup` | Generate starter-safe CLAUDE.md + hooks + commands |
| `nerviq augment` | Repo-aware improvement plan (no writes) |
| `nerviq suggest-only` | Structured report for sharing |
| `nerviq plan` | Export proposal bundles with previews |
| `nerviq apply` | Apply proposals with rollback |
| `nerviq governance` | Permission profiles, hooks, policy packs |
| `nerviq benchmark` | Before/after in isolated temp copy |
| `nerviq deep-review` | AI-powered config review (opt-in) |
| `nerviq interactive` | Step-by-step guided wizard |
| `nerviq watch` | Live monitoring with score delta |
| `nerviq history` | Score history from snapshots |
| `nerviq compare` | Compare latest vs previous |
| `nerviq trend` | Export trend report |
| `nerviq feedback` | Record recommendation outcomes |
| `nerviq badge` | shields.io badge for README |
| `nerviq scan dir1 dir2` | Compare multiple repos |

## Options

| Flag | Effect |
|------|--------|
| `--threshold N` | Exit 1 if score < N (for CI) |
| `--json` | Machine-readable JSON output |
| `--out FILE` | Write output to file |
| `--snapshot` | Save audit snapshot for trending |
| `--lite` | Compact top-3 quick scan |
| `--dry-run` | Preview apply without writing |
| `--auto` | Apply without prompts |
| `--verbose` | Show all recommendations |
| `--format sarif` | SARIF output for code scanning |

## Privacy

- **Zero dependencies** — nothing to audit
- **Runs locally** — audit, setup, plan, apply, governance, benchmark all run on your machine
- **Deep review is opt-in** — only `deep-review` sends selected config for AI analysis
- **AGPL-3.0 Licensed** — open source

## Links

- **npm**: [@nerviq/cli](https://www.npmjs.com/package/@nerviq/cli)
- **GitHub**: [github.com/nerviq/nerviq](https://github.com/nerviq/nerviq)
- **Website**: [nerviq.net](https://nerviq.net)

## Previously claudex-setup

Nerviq was previously published as `claudex-setup`. If you were using it:

```bash
# Old
npx claudex-setup

# New
npx @nerviq/cli audit
```

All features are preserved and expanded.
