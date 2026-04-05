# Nerviq

> The intelligent nervous system for AI coding agents — audit, align, and amplify every platform on every project.

[![npm version](https://img.shields.io/npm/v/@nerviq/cli)](https://www.npmjs.com/package/@nerviq/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Checks: 673](https://img.shields.io/badge/checks-673-brightgreen)](https://github.com/nerviq/nerviq)

---

### 8 Platforms Supported

Nerviq v1.0 ships with full audit, setup, governance, and benchmark support for **8 AI coding platforms**:

| Platform | Checks | Status |
|----------|--------|--------|
| Claude Code | 90 | Full |
| Codex (OpenAI) | 83 | Full |
| Gemini CLI (Google) | 83 | Full |
| GitHub Copilot | 83 | Full |
| Cursor | 83 | Full |
| Windsurf | 83 | Full |
| Aider | 85 | Full |
| OpenCode | 83 | Full |

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

## 673 Checks Across 14 Categories

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

## Harmony — Cross-Platform Alignment

Harmony detects drift between your AI coding platforms and keeps them in sync.

```bash
npx @nerviq/cli harmony-audit      # Cross-platform DX audit (0-100 harmony score)
npx @nerviq/cli harmony-sync       # Sync shared config across platforms
npx @nerviq/cli harmony-drift      # Detect drift between platform configs
npx @nerviq/cli harmony-advise     # Cross-platform improvement advice
npx @nerviq/cli harmony-watch      # Live monitoring for config drift
npx @nerviq/cli harmony-governance # Unified governance across platforms
```

## Synergy — Multi-Agent Amplification

Synergy analyzes how your platforms work together and finds amplification opportunities.

```bash
npx @nerviq/cli synergy-report     # Multi-agent synergy analysis
```

Synergy evaluates compound audit results, discovers compensation patterns (where one platform covers another's gaps), and ranks recommendations by cross-platform impact.

## SDK — `@nerviq/sdk`

Programmatic access to all Nerviq capabilities:

```js
const { audit, harmonyAudit, synergyReport, detectPlatforms } = require('@nerviq/sdk');

const result = await audit('.', 'claude');
console.log(`Score: ${result.score}/100`);

const platforms = detectPlatforms('.');
console.log(`Active platforms: ${platforms.join(', ')}`);

const harmony = await harmonyAudit('.');
console.log(`Harmony score: ${harmony.harmonyScore}/100`);
```

## MCP Server — `nerviq serve`

Nerviq ships with a built-in MCP-compatible HTTP server for integration with AI agents:

```bash
npx @nerviq/cli serve --port 3000
```

Endpoints:
- `GET /api/health` — Server health check
- `GET /api/catalog` — Full check catalog
- `POST /api/audit` — Run audit on a directory
- `GET /api/harmony` — Cross-platform harmony data

## Plugin System — `nerviq.config.js`

Extend Nerviq with custom checks via a config file in your project root:

```js
// nerviq.config.js
module.exports = {
  plugins: [
    {
      name: 'my-company-checks',
      checks: {
        internalDocs: {
          id: 'internalDocs',
          name: 'Internal docs present',
          check: (dir) => require('fs').existsSync(`${dir}/docs/internal.md`),
          impact: 'medium',
          category: 'Quality',
          fix: 'Add docs/internal.md with team-specific guidelines',
        },
      },
    },
  ],
};
```

See [docs/plugins.md](docs/plugins.md) for full plugin API reference.

## GitHub Action

Add Nerviq to your CI pipeline:

```yaml
# .github/workflows/nerviq.yml
name: Nerviq Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nerviq/nerviq@v1
        with:
          threshold: 60
```

The action outputs `score`, `passed`, and `total` for use in downstream steps. Fails the workflow if the score is below the configured threshold.

## Certification

Earn a Nerviq certification badge for your project:

```bash
npx @nerviq/cli certify            # Run certification and display badge
```

Levels:
- **Gold** — Harmony score >= 80, all platforms >= 70
- **Silver** — Harmony score >= 60, all platforms >= 50
- **Bronze** — Any platform >= 40

## All Commands

| Command | What it does |
|---------|-------------|
| `nerviq audit` | Score 0-100 against 673 checks |
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
| `nerviq certify` | Certification level + badge |
| `nerviq scan dir1 dir2` | Compare multiple repos |
| `nerviq harmony-audit` | Cross-platform DX audit |
| `nerviq harmony-sync` | Sync config across platforms |
| `nerviq harmony-drift` | Detect platform drift |
| `nerviq harmony-advise` | Cross-platform advice |
| `nerviq harmony-watch` | Live drift monitoring |
| `nerviq harmony-governance` | Unified platform governance |
| `nerviq synergy-report` | Multi-agent synergy analysis |
| `nerviq catalog` | Show check catalog for all 8 platforms |
| `nerviq doctor` | Self-diagnostics |
| `nerviq convert` | Convert config between platforms |
| `nerviq migrate` | Migrate platform config versions |
| `nerviq serve` | Start local MCP-compatible HTTP API |

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
| `--platform NAME` | Target platform (claude, codex, gemini, copilot, cursor, windsurf, aider, opencode) |

## Backed by Research

Nerviq is built on the CLAUDEX knowledge engine — the largest verified catalog of AI coding agent techniques:

- **315 research documents** covering all 8 platforms
- **100+ experiments** with tested, rated results
- **673 checks** each with `sourceUrl` and `confidence` level (0.0-1.0)
- Every check is traceable to primary documentation or verified experiment
- 90-day freshness cycle: stale findings are re-verified or pruned

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
