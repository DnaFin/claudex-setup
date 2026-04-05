# Launch Posts — Proof-Backed Distribution Assets

**Status:** Complete — every asset below is anchored in measured proof, a canonical artifact, or a verified runtime surface  
**Date:** 2026-04-03

## Shared Proof Anchors

Use these links as the canonical sources behind public claims:

- Proof artifact index: https://github.com/DnaFin/claudex/blob/main/research/proof-artifacts/README.md
- CLAUDEX self-dogfood trace: https://github.com/DnaFin/claudex/blob/main/research/proof-artifacts/claudex-self-dogfood-proof-trace-2026-04-03.md
- VTCLE case study: https://github.com/DnaFin/claudex/blob/main/research/case-study-vtcle-2026-04-03.md
- Social case study: https://github.com/DnaFin/claudex/blob/main/research/case-study-social-2026-04-03.md
- Polymiro case study: https://github.com/DnaFin/claudex/blob/main/research/case-study-polymiro-2026-04-03.md
- Public proof metrics source: https://github.com/DnaFin/claudex/blob/main/research/claudex-proof-metrics-source-2026-04-03.md

Measured-result boundary to preserve:

- before/after scores were measured with `nerviq@1.10.3` on `2026-04-03`
- current npm latest is `1.16.1`
- current product surface is `85 checks`

## Post 1: Reddit r/ClaudeAI

**Title:** I built a CLI that audits your Claude Code setup — 85 checks, measured on 4 real repos

**Body:**
I built a zero-dependency CLI that audits how well a repo is set up for Claude Code.

It checks `85` things across `CLAUDE.md`, hooks, commands, agents, skills, MCP config, permissions, diagrams, and verification loops.

Measured on `2026-04-03` with `nerviq@1.10.3`:
- CLAUDEX: `62 -> 90`
- VTCLE: `46 -> 64`
- Social: `40 -> 48`
- Polymiro: `35 -> 48`

```bash
npx @nerviq/cli
```

It starts trust-first:
- audit first
- plan / suggest-only before writes
- apply only what you approve
- rollback artifacts for every applied batch

Zero dependencies. No API keys. Runs local.

GitHub: https://github.com/nerviq/nerviq

Proof and case studies:
- https://github.com/DnaFin/claudex/blob/main/research/proof-artifacts/README.md
- https://github.com/DnaFin/claudex/blob/main/research/case-study-vtcle-2026-04-03.md
- https://github.com/DnaFin/claudex/blob/main/research/case-study-social-2026-04-03.md
- https://github.com/DnaFin/claudex/blob/main/research/case-study-polymiro-2026-04-03.md

Would love feedback on what checks or rollout surfaces are still missing.

**Evidence anchor:** proof artifact index + 3 external case studies + current proof source

---

## Post 2: Reddit r/ChatGPTCoding

**Title:** Most Claude Code repos are missing the safety layer, not the model

**Body:**
The interesting problem with Claude Code is not "can it write code?".
It's "is the repo actually set up so Claude can work safely and predictably?".

I built `nerviq` to audit that surface:
- `85` checks
- zero dependencies
- local-only by default
- trust-first flow: audit -> plan -> apply -> rollback

Measured on 4 real repos:
- FastAPI repo: `46 -> 64`
- React Native repo: `40 -> 48`
- Python/Docker repo: `35 -> 48`
- research engine repo: `62 -> 90`

```bash
npx @nerviq/cli
```

The most common misses were not exotic:
- no deny rules
- no secrets protection
- no mermaid architecture
- no hooks registered in settings

Proof:
https://github.com/DnaFin/claudex/blob/main/research/proof-artifacts/README.md

**Evidence anchor:** measured before/after traces + common gap summary from public proof set

---

## Post 3: Dev.to Article

**Title:** What 4 Real Repos Taught Me About Claude Code Readiness

**Body (excerpt):**
I tested `nerviq` on 4 real repos and the pattern was clear:

- the best teams still miss permission deny rules
- mature repos often have hooks in files but not actually registered
- non-standard settings formats are a real adoption trap
- shared `settings.json` matters more than personal local overrides

Measured on `2026-04-03` with `nerviq@1.10.3`:
- CLAUDEX: `62 -> 90`
- VTCLE: `46 -> 64`
- Social: `40 -> 48`
- Polymiro: `35 -> 48`

The product today is strongest as:

`audit -> plan -> safe apply -> governance -> benchmark`

Not a code generator. Not an MCP installer. A trust layer for Claude Code repos.

Proof packet:
https://github.com/DnaFin/claudex/blob/main/research/proof-artifacts/README.md

**Evidence anchor:** proof artifact index + case-study docs + current proof source

---

## Post 4: Twitter/X Thread

**Tweet 1:**
I built a zero-dependency CLI that audits Claude Code readiness across `85` checks.

Measured on 4 real repos:
- `62 -> 90`
- `46 -> 64`
- `40 -> 48`
- `35 -> 48`

`npx @nerviq/cli`

Proof: github.com/DnaFin/claudex/blob/main/research/proof-artifacts/README.md

**Tweet 2:**
The most common misses were boring and important:
- no deny rules
- no secrets protection
- no mermaid diagram
- no hooks registered in settings

It is much more "trust layer" than "AI magic".

**Tweet 3:**
What it does well today:
- audit first
- suggest / plan before writes
- apply selectively
- emit rollback artifacts
- benchmark on isolated copy

**Tweet 4:**
Best result so far:
- CLAUDEX self-dogfood: `62 -> 90`

Best external proof:
- VTCLE: `46 -> 64`

Case studies:
- github.com/DnaFin/claudex/blob/main/research/case-study-vtcle-2026-04-03.md
- github.com/DnaFin/claudex/blob/main/research/case-study-social-2026-04-03.md
- github.com/DnaFin/claudex/blob/main/research/case-study-polymiro-2026-04-03.md

**Tweet 5:**
Measured results were captured on `nerviq@1.10.3` on `2026-04-03`.
Current npm latest is `1.16.1`, so exact scores can move slightly, but the proof packet is explicit about that boundary.

**Evidence anchor:** proof artifact index + per-repo traces

---

## Post 5: Hacker News (Show HN)

**Title:** Show HN: nerviq — audit Claude Code readiness with 85 checks

**Body:**
I built a CLI that audits how well a repo is set up for Claude Code.

This is not a code-quality linter and not an MCP installer.
It focuses on Claude workflow quality:
- `CLAUDE.md`
- hooks
- commands
- agents
- skills
- MCP config
- permissions / deny rules
- diagrams
- verification loops

Core workflow:
- `npx @nerviq/cli`
- `npx @nerviq/cli suggest-only`
- `npx @nerviq/cli plan`
- `npx @nerviq/cli apply`
- `npx @nerviq/cli benchmark`

Measured on 4 real repos on `2026-04-03` with `nerviq@1.10.3`:
- CLAUDEX: `62 -> 90`
- VTCLE: `46 -> 64`
- Social: `40 -> 48`
- Polymiro: `35 -> 48`

Trust decisions that mattered:
- zero dependencies
- audit before write
- rollback artifacts
- cross-platform Node hooks
- explicit proof packets instead of vague claims

Proof packet:
https://github.com/DnaFin/claudex/blob/main/research/proof-artifacts/README.md

**Evidence anchor:** proof artifact index + current npm proof source
