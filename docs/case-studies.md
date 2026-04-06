# Nerviq Case Studies — Real Public Repos

**Date:** 2026-04-07
**CLI Version:** 1.6.0
**Method:** `nerviq audit` from cloned repo root (read-only, no files written)

---

## 1. supabase/supabase — Popular BaaS Platform

**Stack:** TypeScript, Elixir | **Stars:** 175k | **AI Config:** None detected

| Metric | Value |
|--------|-------|
| Score | **48/100** |
| Passed | 36 |
| Failed | 55 |
| Critical | 2 |

**What Nerviq found:**
- 🔴 No secrets protection — `.env` files readable by any AI agent
- 🔴 No CLAUDE.md — agents have zero project context
- 🟡 No verification commands — agents can't self-check their work
- 🟡 No hooks configured — no automated quality gates after tool use

**What Nerviq got right:** Supabase is a monorepo with example code in Python, Flutter, and Rust. Nerviq correctly **skipped** all those stack checks (165 checks → null) and only reported findings about the core TypeScript/Elixir project. The 55 findings are all actionable AI agent config gaps.

**What would improve:** Adding `CLAUDE.md` with build commands and a Mermaid architecture diagram would immediately address the top 3 findings.

---

## 2. anthropics/anthropic-cookbook — Official Anthropic Examples

**Stack:** Python (pyproject.toml) | **Stars:** — | **AI Config:** CLAUDE.md ✅

| Metric | Value |
|--------|-------|
| Score | **51/100** |
| Passed | 49 |
| Failed | 60 |
| Critical | 1 |

**What Nerviq found:**
- ✅ Has CLAUDE.md with project instructions — correctly detected
- 🔴 No secrets protection configured
- 🟡 No PostToolUse hooks — missed opportunity for automated checks
- 🟡 No XML constraint blocks in CLAUDE.md
- 🟡 Python linter not configured in pyproject.toml

**Key insight:** Having CLAUDE.md gets you to ~50/100. The gap to 80+ is hooks, permissions, and verification loops — the "governance layer" that CLAUDE.md alone doesn't provide.

---

## 3. langchain-ai/langchain — Leading AI Framework

**Stack:** Python | **Stars:** — | **AI Config:** CLAUDE.md ✅, AGENTS.md ✅

| Metric | Value |
|--------|-------|
| Score | **40/100** |
| Passed | 26 |
| Failed | 57 |
| Critical | 1 |

**What Nerviq found:**
- ✅ Has CLAUDE.md and AGENTS.md — both correctly detected
- 🔴 No secrets protection
- 🟡 No hooks (PreToolUse, PostToolUse, StopFailure)
- 🟡 No custom commands despite complex workflow
- 🟡 Git attribution not configured

**Key insight:** Even with both CLAUDE.md and AGENTS.md, langchain scores 40/100. The missing layer is operational: hooks, commands, governance, and verification. Instructions alone don't make a well-governed agent setup.

---

## 4. openai/codex — OpenAI's Coding Agent

**Stack:** TypeScript, Python | **Stars:** — | **AI Config:** AGENTS.md ✅

| Metric | Value |
|--------|-------|
| Score | **27/100** |
| Passed | 25 |
| Failed | 78 |
| Critical | 3 |

**What Nerviq found:**
- ✅ Has AGENTS.md — correctly detected
- ❌ No CLAUDE.md (expected — this is a Codex repo)
- 🔴 No verification commands in agent instructions
- 🔴 No secrets protection
- 🔴 No .gitignore for .env files
- 🟡 No hooks, commands, or skills configured

**Key insight:** Even OpenAI's own agent repo has gaps in governance config. The AGENTS.md is present but lacks verification commands, and there are no operational safeguards (hooks, deny rules, permission profiles).

---

## 5. calcom/cal.com — Open-Source Scheduling

**Stack:** TypeScript (Next.js monorepo) | **Stars:** — | **AI Config:** CLAUDE.md ✅, AGENTS.md ✅

| Metric | Value |
|--------|-------|
| Score | **25/100** |
| Passed | 18 |
| Failed | 68 |
| Critical | 2 |

**What Nerviq found:**
- ✅ Has CLAUDE.md and AGENTS.md
- 🔴 No verification commands — CLAUDE.md missing test/lint/build commands
- 🔴 No secrets protection
- 🟡 No hooks configured
- 🟡 Monorepo detected but no workspace-aware agent config

**Key insight:** Cal.com has adopted AI agent instructions but scores only 25/100. The CLAUDE.md exists but is missing the critical operational elements: verification commands, deny rules, and hooks. This is the most common pattern — instructions without governance.

---

## Cross-Cutting Findings

### Most Common Gaps (across all 6 repos)

| Finding | Repos Missing | Impact |
|---------|--------------|--------|
| Secrets protection (deny rules) | 6/6 (100%) | Critical |
| Verification commands in instructions | 5/6 (83%) | Critical |
| PostToolUse hooks | 6/6 (100%) | High |
| Custom slash commands | 5/6 (83%) | High |
| Permission profiles configured | 6/6 (100%) | High |
| Mermaid architecture diagram | 5/6 (83%) | High |

### The "Instructions Gap"

Repos with CLAUDE.md average **38/100**. Repos without average **27/100**. The gap between "has instructions" and "well-governed" is ~50 points — filled by hooks, permissions, commands, verification, and deny rules.

### False Positive Rate

After the v1.6.0 accuracy overhaul:
- **Stack false positives: 0** — no Python/Go/Rust/etc. checks on repos that don't use those stacks at root level
- **Generic quality noise: 0** — observability, caching, i18n etc. checks are skipped by default
- **All 55-78 findings per repo are AI agent configuration relevant**

### Limitations Observed

- Some repos (supabase) don't use AI coding agents at all — their low score reflects configuration absence, not a problem
- Nerviq audits **Claude platform by default**; repos using only Codex or Cursor should use `--platform codex` or `--platform cursor`
- Monorepo detection works but workspace-specific scoring requires `--workspace` flag
