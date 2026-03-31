# claudex-setup

> Audit and optimize any project for Claude Code. Powered by 1,107 verified techniques.

[![npm version](https://img.shields.io/npm/v/claudex-setup)](https://www.npmjs.com/package/claudex-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

One command to make your project Claude Code-ready. Detects your stack, scores your setup against 50+ checks, and auto-generates everything Claude Code needs to work at full capacity.

## Quick Start

```bash
# Audit your project
npx claudex-setup

# Apply recommended configuration
npx claudex-setup setup
```

That's it. No config files, no dependencies to install.

## Example Output

```
  claudex-setup v0.2.0
  ═══════════════════════════════════════════════════

  Detected stack: React, TypeScript, Docker

  ██████████████░░░░░░░░░░░░ 54/100

  ┌─────────────────────────────────────────────────┐
  │  CATEGORY          SCORE   CHECKS               │
  │  Memory              8/15  CLAUDE.md, rules      │
  │  Quality             6/15  verification, linting │
  │  Git Safety          5/10  hooks, permissions    │
  │  Workflow            4/10  commands, skills      │
  │  Security            3/10  permissions, secrets  │
  │  Automation          5/10  hooks, agents         │
  │  Design              4/10  Mermaid, XML tags     │
  │  DevOps              3/5   Docker, CI            │
  │  Hygiene             4/5   .gitignore, cleanup   │
  │  Performance         4/5   context, compaction   │
  │  MCP                 3/5   servers, tools        │
  │  Prompting           5/5   constraints, chains   │
  └─────────────────────────────────────────────────┘

  ✅ Passing (12)
     CLAUDE.md exists with project instructions
     Pre-commit hook configured
     Custom slash commands defined
     .gitignore tracks .claude/ correctly
     Docker stack detected and configured
     ...

  ⚠️  Warnings (6)
     No Mermaid architecture diagram in CLAUDE.md
     → Add a ```mermaid graph to visualize project structure
     Missing XML constraint tags
     → Wrap critical rules in <constraints> tags for 30% better adherence
     ...

  🔴 Critical (3)
     No verification criteria in CLAUDE.md
     → Add test/lint commands so Claude can verify its own work
       Example:
       ## Verification
       - Run `npm test` before committing
       - Run `npm run lint` to check style

     No security permissions configured
     → Create .claude/settings.json with allowed commands

     No self-correction workflow
     → Add review commands for generate → review → refine cycles

  ───────────────────────────────────────────────────
  Run `npx claudex-setup setup` to fix 9 issues automatically
```

## What It Checks

### 📋 Memory (8 checks)
- CLAUDE.md exists with project instructions
- CLAUDE.md includes stack-specific guidance
- Architecture section with Mermaid diagram
- Verification criteria (test/lint commands)
- Coding conventions documented
- Error handling patterns defined
- Session memory configured
- State tracking files present

### ✅ Quality (7 checks)
- Self-correction chains (generate → review → refine)
- Constraint-based validation blocks
- Verification loops for claims
- Quality gates before commits
- Duplicate detection rules
- Metadata sync requirements
- Iron Law enforcement (evidence for all claims)

### 🔒 Git Safety (5 checks)
- Pre-commit hooks configured
- Destructive command warnings
- Force-push protection
- Branch naming conventions
- Commit message standards

### 🔄 Workflow (6 checks)
- Custom slash commands defined
- Skills for domain workflows
- Rules for path-specific conventions
- Agents for specialized tasks
- Command templates present
- Workflow documentation

### 🛡️ Security (5 checks)
- Permissions configured in settings.json
- Secrets excluded from commits
- Allowed/denied command lists
- MCP server permissions
- Environment variable handling

### ⚙️ Automation (5 checks)
- Edit hooks for linting
- Save hooks for formatting
- Notification hooks
- Log rotation configured
- Auto-sync with knowledge base

### 🎨 Design (4 checks)
- Mermaid diagrams for architecture
- XML tags for structured prompts
- Documents at top of prompts
- Meta-prompting patterns

### 🚀 DevOps (3 checks)
- CI/CD pipeline detection
- Docker configuration
- Deployment instructions in CLAUDE.md

### 🧹 Hygiene (3 checks)
- .gitignore tracks .claude/ correctly
- No stale configuration files
- Clean project structure

### ⚡ Performance (3 checks)
- Context management strategy
- Compaction triggers documented
- Tool search over full loads

### 🔌 MCP (3 checks)
- MCP servers configured
- MCP tools documented
- Server permissions set

### 💬 Prompting (3 checks)
- Constraint tags used
- Self-validation blocks
- Research methodology defined

## Auto-Generated Setup

Running `npx claudex-setup setup` creates everything your project needs:

```
  ✅ Created CLAUDE.md              — project instructions with Mermaid diagram
  ✅ Created .claude/settings.json  — permissions and security
  ✅ Created .claude/hooks/         — pre-commit, on-edit linting
  ✅ Created .claude/commands/      — /test, /review, /deploy
  ✅ Created .claude/skills/        — domain-specific workflows
  ✅ Created .claude/rules/         — path-specific conventions
  ✅ Created .claude/agents/        — specialized subagents

  7 configs created. Your project is now Claude Code-ready.
```

All generated files are tailored to your detected stack. A React + TypeScript project gets different hooks, commands, and CLAUDE.md content than a Python + FastAPI project.

## Stack Detection

Automatically detects and tailors configuration for:

| Category | Frameworks |
|----------|-----------|
| Frontend | React, Vue, Angular, Next.js, Svelte |
| Backend | Node.js, Python, Django, FastAPI, Ruby |
| Mobile | Flutter, Swift, Kotlin |
| Systems | Rust, Go, Java |
| Language | TypeScript, JavaScript |
| Infra | Docker, Kubernetes |

Detection is based on package.json, requirements.txt, Cargo.toml, go.mod, pubspec.yaml, Gemfile, build.gradle, Package.swift, and other standard manifest files.

## Options

```bash
npx claudex-setup                    # Audit (default)
npx claudex-setup audit              # Audit explicitly
npx claudex-setup audit --verbose    # Show all checks with details
npx claudex-setup audit --json       # Machine-readable JSON output
npx claudex-setup setup              # Auto-generate missing configs
npx claudex-setup setup --auto       # Non-interactive, accept all defaults
npx claudex-setup --help             # Show help
```

## Backed by Research

Every check and template is derived from the [CLAUDEX](https://github.com/DnaFin/claudex-setup) research catalog — a systematic audit of 1,107 verified Claude Code techniques across 13 research categories. This includes findings from all 73 official Claude Code documentation pages, community reports, and hands-on experiments.

The knowledge base is continuously updated. Run `npx claudex-setup` periodically to pick up new checks and improved templates.

## Requirements

- Node.js 18+
- Works on macOS, Linux, and Windows
- No global install needed (npx handles it)

## License

MIT
