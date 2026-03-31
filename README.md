# claudex-setup

> Score your project 0-100 for Claude Code readiness. Smart CLAUDE.md generator, 63 audit checks, interactive wizard, watch mode, CI action. Never overwrites existing config.

[![npm version](https://img.shields.io/npm/v/claudex-setup)](https://www.npmjs.com/package/claudex-setup)
[![npm downloads](https://img.shields.io/npm/dm/claudex-setup)](https://www.npmjs.com/package/claudex-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start

```bash
npx claudex-setup              # Audit your project (10 seconds)
npx claudex-setup setup        # Auto-fix everything
```

No install. No config. No dependencies.

## What You Get

```
  claudex-setup audit
  ═══════════════════════════════════════
  Detected: React, TypeScript, Docker

  ████████████████░░░░ 78/100

  ✅ Passing
     CLAUDE.md project instructions
     Mermaid architecture diagram
     Hooks (PreToolUse + PostToolUse)
     Custom slash commands (5 commands)
     XML constraint blocks
     Secrets protection configured

  🟡 High Impact
     CI pipeline configured
     → Add .github/workflows/ for automated testing

  ⚡ Quick wins
     1. Add LICENSE file
     2. Add CHANGELOG.md

  Weakest areas:
     design: none (0/2)
     devops: none (0/4)

  29/63 checks passing
  Run npx claudex-setup setup to fix
```

## All Commands

| Command | What it does |
|---------|-------------|
| `npx claudex-setup` | **Audit** - Score 0-100 against 63 checks |
| `npx claudex-setup setup` | **Setup** - Smart CLAUDE.md + hooks + commands + agents |
| `npx claudex-setup setup --auto` | **Auto-setup** - No prompts, apply all |
| `npx claudex-setup interactive` | **Wizard** - Step-by-step guided tour |
| `npx claudex-setup watch` | **Watch** - Live monitoring with score delta |
| `npx claudex-setup badge` | **Badge** - Generate shields.io badge for README |
| `npx claudex-setup deep-review` | **Deep Review** - AI-powered config analysis (needs API key) |
| `npx claudex-setup insights` | **Insights** - View community aggregate stats |

### Options

| Flag | Effect |
|------|--------|
| `--verbose` | Show all recommendations (not just critical/high) |
| `--json` | Machine-readable JSON output (for CI) |
| `--no-insights` | Disable anonymous usage insights |

## Smart CLAUDE.md Generation

Not a generic template. The `setup` command actually analyzes your project:

- **Reads package.json** - includes your actual test, build, lint, dev commands
- **Detects framework** - Next.js Server Components, Django models, FastAPI Pydantic, React hooks
- **TypeScript-aware** - detects strict mode, adds TS-specific rules
- **Auto Mermaid diagram** - scans directories and generates architecture visualization (73% token savings)
- **XML constraint blocks** - adds `<constraints>` and `<verification>` with context-aware rules
- **Verification criteria** - auto-generates checklist from your actual commands

## 63 Checks Across 14 Categories

| Category | Checks | Key items |
|----------|-------:|-----------|
| Memory | 8 | CLAUDE.md, architecture, conventions |
| Quality | 7 | verification loops, self-correction |
| Git Safety | 5 | hooks, force-push protection |
| Workflow | 6 | commands, skills, rules, agents |
| Security | 5 | permissions, secrets, deny rules |
| Automation | 5 | PreToolUse, PostToolUse, SessionStart |
| Design | 4 | Mermaid, XML tags, structured prompts |
| DevOps | 4 | Docker, CI, Terraform, K8s |
| Hygiene | 6 | .gitignore, cleanup, structure |
| Performance | 3 | context management, compaction |
| MCP | 3 | servers, Context7, integrations |
| Prompting | 3 | constraints, validation, patterns |
| Features | 2 | /security-review, Channels |
| **Quality Deep** | **9** | **freshness, contradictions, deprecated patterns, maxTurns, $ARGUMENTS** |

## Stack Detection

Auto-detects and tailors output for 18 stacks:

| | |
|--|--|
| **Frontend** | React, Vue, Angular, Next.js, Svelte |
| **Backend** | Node.js, Python, Django, FastAPI |
| **Mobile** | Flutter, Swift, Kotlin |
| **Systems** | Rust, Go, Java, Ruby |
| **Language** | TypeScript |
| **Infra** | Docker |

## GitHub Action

Add to `.github/workflows/claudex.yml`:

```yaml
name: CLAUDEX Audit
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DnaFin/claudex-setup@main
        with:
          threshold: 50
```

## Badge

Add a readiness badge to your README:

```bash
npx claudex-setup badge
# Output: [![Claude Code Ready](https://img.shields.io/badge/...)](...)
```

## For Veteran Claude Code Users

Already have a solid CLAUDE.md and hooks? Two things for you:

### Deep Review (AI-powered)

```bash
ANTHROPIC_API_KEY=sk-ant-... npx claudex-setup deep-review
```

Claude reads your actual config and gives specific feedback: what's strong, what has issues, what's missing for your stack. Not pattern matching — real analysis. Your config goes to Anthropic API only, we never see it.

### Quality-Deep Checks

The v0.4.0 quality-deep checks catch what basic audits miss:

| Check | What it catches |
|-------|----------------|
| **Freshness** | CLAUDE.md that doesn't mention modern features (hooks, skills, MCP) |
| **Conciseness** | CLAUDE.md over 200 lines (wastes tokens every session) |
| **Contradictions** | Conflicting rules ("always X" + "never X") |
| **Hook specificity** | Hooks without matchers that fire on every tool call |
| **Permission hygiene** | bypassPermissions still enabled in production |
| **Command flexibility** | Commands without $ARGUMENTS (static, not reusable) |
| **Agent limits** | Agents without maxTurns (can run forever) |
| **Security workflow** | No /security-review in your process |
| **Deprecated patterns** | Old model names, prefill, deprecated API formats |

These checks evaluate **quality**, not just existence. A well-configured project with stale patterns will surface real improvements.

## Privacy

- **Zero dependencies** - nothing to audit
- **Runs 100% locally** - no cloud processing
- **Anonymous insights** - opt-in, no PII, no file contents (disable with `--no-insights`)
- **MIT Licensed** - use anywhere

## Backed by Research

Every check traces to a verified technique from a systematic audit of:
- All 73 official Claude Code documentation pages
- 100+ community MCP servers verified via GitHub API
- Anthropic blog posts and benchmark papers
- 194 hands-on experiments with real evidence

The catalog includes 1,107 entries (features, techniques, patterns, tools, stats, and known limitations) — not all are actionable checks. 954 were verified with real evidence. Continuously updated.

**Note:** A hand-crafted CLAUDE.md that reflects your real conventions will always be better than a generated one. This tool is most useful for projects starting from zero, or as a checklist for what you might be missing.

## Requirements

- Node.js 18+
- macOS, Linux, Windows
- No global install (npx handles it)

## License

MIT
