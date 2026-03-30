# claudex-setup

> Audit and optimize any project for Claude Code. Powered by 972 verified techniques.

One command to make your project Claude Code-ready.

## Quick Start

```bash
# Audit your project
npx claudex-setup

# Apply recommended configuration
npx claudex-setup setup
```

## What it does

**Audit** scans your project and scores it against 12 critical Claude Code best practices:

```
  claudex-setup audit
  ═══════════════════════════════════════
  Detected: React, TypeScript

  ██████████████░░░░░░ 71/100

  ✅ Passing
     CLAUDE.md project instructions
     Hooks for automation
     Custom slash commands
     ...

  🔴 Critical
     Verification criteria in CLAUDE.md
     → Add test/lint commands so Claude can verify its own work.

  Run npx claudex-setup setup to fix automatically
```

**Setup** creates the missing configuration automatically:

```
  ✅ Created CLAUDE.md
  ✅ Created .claude/hooks/on-edit-lint.sh
  ✅ Created .claude/commands/test.md
  ✅ Created .claude/commands/review.md
  ✅ Created .claude/skills/fix-issue/SKILL.md
  ✅ Created .claude/agents/security-reviewer.md

  7 files created.
```

## What it checks

| Check | Impact | What |
|-------|--------|------|
| CLAUDE.md | Critical | Project instructions for Claude |
| Verification | Critical | Test/lint commands for self-checking |
| Hooks | High | Automation on file edits |
| Commands | High | Custom slash commands |
| Mermaid diagram | High | Architecture visualization (73% token savings) |
| XML tags | High | Structured prompts |
| Skills | Medium | Domain-specific workflows |
| Rules | Medium | Path-specific coding conventions |
| Agents | Medium | Specialized subagents |
| MCP servers | Medium | External tool integration |
| Permissions | Medium | Security configuration |
| .gitignore | High | Track .claude/ in version control |

## Options

```bash
npx claudex-setup                # Audit (default)
npx claudex-setup audit          # Audit explicitly
npx claudex-setup audit --verbose  # Show all recommendations
npx claudex-setup audit --json   # JSON output
npx claudex-setup setup          # Apply fixes
npx claudex-setup --help         # Help
```

## Stack Detection

Automatically detects: React, Vue, Angular, Next.js, Python, Django, FastAPI, Node.js, TypeScript, Rust, Go, Docker — and tailors recommendations.

## Why

Claude Code is powerful but most projects are barely optimized for it. A proper CLAUDE.md, hooks, and skills can **3-5x your productivity**. This tool applies the knowledge from [CLAUDEX](https://github.com/DnaFin/claudex) — a research catalog of 972 verified Claude Code techniques.

## License

MIT
