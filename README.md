# claudex-setup

> Score your repo's Claude Code setup against 84 checks. See what's missing, apply only what you approve with rollback, and benchmark the impact — without breaking existing config.

[![npm version](https://img.shields.io/npm/v/claudex-setup)](https://www.npmjs.com/package/claudex-setup)
[![npm downloads](https://img.shields.io/npm/dm/claudex-setup)](https://www.npmjs.com/package/claudex-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

### What this is

- The **Agentic DX layer for Claude Code** — audit, improve, govern, and benchmark how Claude works with your repo
- A **Claude Code workflow audit and improvement tool** — not an MCP installer, not a code generator
- Scores your repo 0-100 across CLAUDE.md, hooks, commands, agents, skills, MCP, security, and more
- Proposes changes as diffs you review — applies only what you approve, with rollback for every change
- Includes governance (permission profiles, hook registry, policy packs) and benchmark (isolated before/after)

### What this is NOT

- Not an MCP setup tool (MCP packs are one of 26 features, not the product)
- Not a code generator or refactoring tool — it configures how Claude works with your repo, not the code itself
- Not a replacement for hand-crafted CLAUDE.md — generated output is a strong starting point, not a final answer
- Not a score you should chase blindly — 90/100 with bad code is still bad code

## Quick Start

```bash
npx claudex-setup --lite      # Quick beginner scan: top 3 fixes + next command
npx claudex-setup              # Audit your project (10 seconds)
npx claudex-setup --snapshot   # Save a normalized snapshot under .claude/claudex-setup/
npx claudex-setup setup        # Create a starter-safe baseline
npx claudex-setup augment      # Repo-aware plan, no writes
npx claudex-setup plan         # Export proposal bundles with file previews
npx claudex-setup governance   # See permission profiles, packs, and pilot guidance
npx claudex-setup governance --out governance.md  # Export a shareable governance report
npx claudex-setup benchmark    # Measure before/after in an isolated temp copy
npx claudex-setup --threshold 60   # Fail CI if score is below 60
```

No install. No config. No dependencies.

## Real Results

Tested on 4 real projects — not demos:

| Project | Type | Before | After | Delta |
|---------|------|--------|-------|-------|
| CLAUDEX | Research engine, Python | 62 | 90 | **+28** |
| VTCLE | Marketing automation, FastAPI | 46 | 64 | **+18** |
| Social | Mobile app, React Native | 40 | 48 | **+8** |
| Polymiro | Prediction system, Python/Docker | 35 | 48 | **+13** |

Most common gaps found: missing secrets protection, no deny rules, no mermaid diagram, no hooks in settings.

> Scores measured with claudex-setup@1.10.3 on 2026-04-03. Full case studies: [VTCLE](https://github.com/DnaFin/claudex/blob/main/research/case-study-vtcle-2026-04-03.md) | [Social](https://github.com/DnaFin/claudex/blob/main/research/case-study-social-2026-04-03.md) | [Polymiro](https://github.com/DnaFin/claudex/blob/main/research/case-study-polymiro-2026-04-03.md)

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

  ⚡ Top 5 Next Actions
     1. Add CLAUDE.md verification criteria
        Why: Claude needs an explicit verification loop before handoff
        Trace: failed-check:verificationLoop | impact:critical | category:quality
        Risk: high | Confidence: high
        Fix: Add test/lint/build commands to CLAUDE.md so Claude can verify its own work

     2. Configure safe permissions + deny rules
        Why: Explicit permissions are the main safety layer for repo writes
        Trace: failed-check:permissionDeny | impact:high | category:security
        Risk: medium | Confidence: high
        Fix: Add permissions.deny rules to block dangerous operations

  Weakest areas:
      design: none (0/2)
     devops: none (0/4)

  29/84 checks passing
  Next command: npx claudex-setup setup
```

Want the shortest possible first run?

```bash
npx claudex-setup --lite
```

That prints a compact top-3 quick scan with one clear next command.

## All Commands

| Command | What it does |
|---------|-------------|
| `npx claudex-setup` | **Discover** - Score 0-100 against 84 checks |
| `npx claudex-setup discover` | **Discover** - Alias for audit mode |
| `npx claudex-setup setup` | **Starter** - Smart CLAUDE.md + hooks + commands + agents |
| `npx claudex-setup starter` | **Starter** - Alias for setup mode |
| `npx claudex-setup setup --auto` | **Auto-setup** - No prompts, apply all |
| `npx claudex-setup augment` | **Augment** - Repo-aware improvement plan, no writes |
| `npx claudex-setup suggest-only` | **Suggest-Only** - Structured recommendation report, no writes |
| `npx claudex-setup plan` | **Plan** - Export proposal bundles with previews, rationale, and file-level changes |
| `npx claudex-setup apply` | **Apply** - Apply ready proposal bundles with rollback + activity artifacts |
| `npx claudex-setup governance` | **Governance** - Permission profiles, hook registry, policy packs, pilot kit |
| `npx claudex-setup benchmark` | **Benchmark** - Before/after evidence from an isolated temp copy |
| `npx claudex-setup interactive` | **Wizard** - Step-by-step guided tour |
| `npx claudex-setup watch` | **Watch** - Live monitoring with score delta |
| `npx claudex-setup badge` | **Badge** - Generate shields.io badge for README |
| `npx claudex-setup deep-review` | **Deep Review** - AI-powered config analysis (needs API key) |
| `npx claudex-setup insights` | **Insights** - View community aggregate stats |

### Options

| Flag | Effect |
|------|--------|
| `--threshold N` | Exit with code 1 if score is below `N` (great for CI) |
| `--out FILE` | Write JSON or markdown output to a file |
| `--plan FILE` | Load a previously exported plan file |
| `--only A,B` | Limit plan/apply to selected proposal ids |
| `--profile NAME` | Choose a permission profile for write-capable flows |
| `--mcp-pack A,B` | Merge named MCP packs into generated or patched settings |
| `--snapshot` | Save a normalized artifact under `.claude/claudex-setup/snapshots/` |
| `--lite` | Show a short top-3 quick scan with one clear next command |
| `--dry-run` | Preview apply without writing files |
| `--verbose` | Show all recommendations (not just critical/high) |
| `--json` | Machine-readable JSON output (for CI) |
| `--auto` | Apply setup files without prompts |
| `--insights` | Enable anonymous usage insights (off by default) |

## Smart CLAUDE.md Generation

Not a generic template. The `setup` command actually analyzes your project:

- **Reads package.json** - includes your actual test, build, lint, dev commands
- **Reads pyproject.toml** - uses Python project name/description when package.json does not exist
- **Detects framework** - Next.js Server Components, Django models, FastAPI Pydantic, React hooks
- **TypeScript-aware** - detects strict mode, adds TS-specific rules
- **Auto Mermaid diagram** - scans directories and generates architecture visualization (Mermaid diagrams are more token-efficient than prose descriptions, per Anthropic docs)
- **XML constraint blocks** - adds `<constraints>` and `<verification>` with context-aware rules
- **Verification criteria** - auto-generates checklist from your actual commands
- **Safer settings.json** - generated hooks config now includes `acceptEdits` plus deny rules for dangerous or secret-sensitive operations

## Mode Model

- **Discover**: score the repo, surface critical issues, and show the best next actions
- **Starter**: generate a safe baseline when the repo has little or no Claude setup
- **Augment**: inspect the current repo and build a structured improvement plan without writing files
- **Suggest-Only**: same no-write analysis, optimized for sharing or manual review
- **Governance**: surface permission profiles, shipped hooks, policy packs, and pilot guidance
- **Benchmark**: prove value on an isolated copy before touching the real repo

## Proposal + Apply Workflow

Use `plan` when you want a file-by-file proposal bundle before any write happens:

```bash
npx claudex-setup plan --out claudex-plan.json
```

Each proposal bundle includes:

- trigger reasons tied to failed checks
- file previews and diff-style output
- `create`, `patch`, or `manual-review` classification
- risk/confidence labels

Apply only the bundles you want:

```bash
npx claudex-setup apply --plan claudex-plan.json --only claude-md,hooks
```

`apply` creates rollback manifests and activity artifacts under `.claude/claudex-setup/`, so every applied batch has a paper trail and a create-or-patch rollback path.

## Governance And Pilot Readiness

Use `governance` when the question is "can we pilot this safely?" instead of "what files can you generate?".

```bash
npx claudex-setup governance
npx claudex-setup governance --out governance.md
```

It exposes:

- permission profiles: `read-only`, `suggest-only`, `safe-write`, `power-user`, `internal-research`
- hook registry with trigger point, purpose, side effects, risk, and rollback path
- policy packs for baseline engineering, security-sensitive repos, OSS, and regulated-lite teams
- 16 domain packs: backend-api, frontend-ui, data-pipeline, infra-platform, oss-library, enterprise-governed, monorepo, mobile, regulated-lite, ecommerce, ai-ml, devops-cicd, design-system, docs-content, security-focused, baseline-general
- 26 MCP packs: Context7, Next.js devtools, GitHub, PostgreSQL, Playwright, Docker, Notion, Linear, Sentry, Slack, Stripe, Figma, Shopify, Hugging Face, Blender, WordPress, Jira/Confluence, GA4, Search Console, n8n, Zendesk, Infisical, Composio, memory, sequential-thinking, mcp-security
- a pilot rollout kit with scope, approvals, success metrics, and rollback expectations

Use `--out governance.md` if you want a shareable artifact for leads, platform teams, or security review.

## Domain Packs And MCP Packs

`augment` and `suggest-only` now recommend repo-shaped guidance instead of giving every project the same advice.

- 16 domain packs identify repo shape and recommend relevant modules
- 26 MCP packs recommend tooling companions matched to your detected domain and stack
- write-capable flows can merge MCP packs directly into `.claude/settings.json`

```bash
npx claudex-setup suggest-only --json
npx claudex-setup setup --mcp-pack context7-docs
npx claudex-setup apply --plan claudex-plan.json --only hooks --mcp-pack context7-docs,next-devtools
```

## Benchmark And Evidence

Use `benchmark` to measure the impact of starter-safe improvements without modifying your working repo:

```bash
npx claudex-setup benchmark --out benchmark.md
```

Benchmark mode:

- runs a baseline audit on your repo
- copies the repo to an isolated temp workspace
- applies starter-safe artifacts only in the copy
- reruns the audit and emits before/after deltas, workflow-evidence coverage, a case-study summary, and an executive recommendation

If you want repeatable evidence artifacts for before/after work, add `--snapshot` to `audit`, `augment`, `suggest-only`, `benchmark`, or `governance`.

```bash
npx claudex-setup --snapshot
npx claudex-setup augment --snapshot
npx claudex-setup benchmark --snapshot
```

Snapshots are written to `.claude/claudex-setup/snapshots/` with a shared envelope and an `index.json` history file.

## Use Inside Claude Code

If you want the first Claude-native entry point, copy the shipped skill template into your repo.

If `claudex-setup` is installed locally in `node_modules`, use:

```bash
mkdir -p .claude/skills/audit-repo
cp ./node_modules/claudex-setup/content/claude-code/audit-repo/SKILL.md .claude/skills/audit-repo/SKILL.md
```

If you are using `npx` only, copy the same file from the GitHub repo at `content/claude-code/audit-repo/SKILL.md`.

The skill runs `npx claudex-setup --json`, summarizes the score, shows the top next actions, and points to the right next command without applying changes.

## 62 Checks Across 14 Categories

The exact applicable count can be lower on a given repo because stack-specific checks are skipped when they do not apply.

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

Auto-detects and tailors output for 22 stacks:

| | |
|--|--|
| **Frontend** | React, Vue, Angular, Next.js, Svelte |
| **Backend** | Node.js, Python, Django, FastAPI |
| **Mobile** | Flutter, Swift, Kotlin |
| **Systems** | Rust, Go, Java, Ruby, C++, Bazel |
| **Language** | TypeScript |
| **Infra** | Docker, Terraform, Kubernetes |

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
      - uses: DnaFin/claudex-setup@v1.14.0
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
npx claudex-setup deep-review
```

Claude reads your actual config and gives specific feedback: what's strong, what has issues, what's missing for your stack. This is an AI-assisted review, not a local heuristic audit. Your config goes to the Anthropic API only when you run this command; we do not receive it.

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

- **Zero dependencies** - nothing extra to audit
- **Core flows run locally** - audit, setup, augment, plan, apply, governance, and benchmark run on your machine
- **Deep review is opt-in** - only `deep-review` sends selected config to Anthropic for analysis
- **Benchmark uses an isolated temp copy** - your live repo is not touched
- **Anonymous insights** - opt-in, no PII, no file contents (enable with `--insights`)
- **MIT Licensed** - use anywhere

## Backed by Research

Every check traces to a verified technique from a systematic audit of:
- All 73 official Claude Code documentation pages
- 100+ community MCP servers verified via GitHub API
- Anthropic blog posts and benchmark papers
- 194 hands-on experiments with real evidence

The catalog includes 1,107 entries (features, techniques, patterns, tools, stats, and known limitations) — not all are actionable checks. 948 were verified with real evidence. Continuously updated.

**Note:** A hand-crafted CLAUDE.md that reflects your real conventions will always be better than a generated one. This tool is most useful for projects starting from zero, or as a checklist for what you might be missing.

## Requirements

- Node.js 18+
- macOS, Linux, Windows
- No global install (npx handles it)

## License

MIT
