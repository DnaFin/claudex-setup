# How Nerviq Verifies 2,431 Checks

Nerviq is an evidence-based audit engine for AI coding agent configurations. Every check we ship is traceable from official documentation through runtime verification to test coverage. This document explains how.

## Check Structure

Every check in the Nerviq catalog is a structured object with these fields:

| Field | Description |
|-------|-------------|
| `id` | Unique numeric identifier |
| `name` | Human-readable check name |
| `check` | Function that evaluates the project context and returns `true`/`false`/`null` |
| `impact` | Severity level: `critical`, `high`, `medium`, or `low` |
| `category` | Functional grouping (e.g., `memory`, `security`, `quality`, `automation`) |
| `fix` | Actionable remediation text shown when the check fails |
| `sourceUrl` | URL pointing to the official documentation backing this check |
| `confidence` | Numeric score (0.0–1.0) reflecting how certain we are this check is accurate |

Checks are keyed by a stable string identifier (e.g., `claudeMd`, `permissionDeny`, `codexAgentsMd`) that remains consistent across versions, enabling feedback tracking and trend analysis.

## The 5-Layer Evidence Chain

Every check passes through five layers before reaching users:

### Layer 1: Official Source
Each check starts with an official documentation reference. The `sourceUrl` field links directly to the platform vendor's docs (Anthropic, OpenAI, Google, GitHub, Cursor, Windsurf, Aider, OpenCode). No check exists without a traceable origin.

### Layer 2: Research Memo
Findings from official sources are documented in structured research memos stored in the CLAUDEX research corpus. These memos follow the Anthropic-recommended research methodology: explore from multiple angles, hypothesize, triangulate across independent sources, extract quotes before analyzing, identify gaps and contradictions, integrate with confidence levels, and self-critique.

**448+ research documents** feed the current check catalog.

### Layer 3: Runtime Experiment
Claims are tested in real project environments. Each experiment runs the actual check logic against controlled fixtures — real directory structures, real configuration files, real tool outputs. We do not mark anything as verified without executing it and observing the output.

**332+ experiments across 8 platforms** with real runtime evidence.

### Layer 4: Check Implementation
The verified finding becomes a check function that inspects the `ProjectContext` — a normalized view of the project's files, configuration, and environment. Check functions return:
- `true` — the practice is present
- `false` — the practice is missing (a finding)
- `null` — the check is not applicable (e.g., a Node.js check in a Python project)

### Layer 5: Test Coverage
Every check is covered by matrix tests that verify correct behavior across project shapes. Golden matrices lock expected pass/fail outcomes so regressions are caught immediately. Platform-specific matrices (Claude, Codex, Gemini, Copilot, Cursor, Windsurf, Aider, OpenCode) ensure cross-platform correctness.

## Freshness System

Stale checks are worse than missing checks — they create false confidence.

### Daily Changelog Watch
The freshness engine monitors platform changelogs and release notes. When a platform ships a breaking change or deprecation, affected checks are flagged for review.

### 90-Day Rule
Any check that has not been re-verified against current platform behavior within 90 days is marked stale. Stale checks:
- Have their confidence score reduced to **0.3**
- Are flagged in audit output with a staleness warning
- Are blocked from appearing as top recommendations until re-verified

### Staleness Blocking
Stale checks cannot graduate to "recommended" status. They remain in the catalog for completeness but are deprioritized in all ranking algorithms until a maintainer re-verifies them against current platform behavior.

## False Positive Handling

False positives erode trust. Nerviq has a structured feedback loop to catch and suppress them.

### FP Feedback Loop
Users can report whether a finding was helpful or not helpful via the CLI:
```
npx nerviq feedback --key <checkKey> --status rejected --effect negative
```

Feedback is stored locally in `.nerviq/outcomes/` and aggregated per check key.

### Auto-Suppression Above 30%
When a check accumulates a "not helpful" rate exceeding 30% across recorded feedback, it is automatically deprioritized:
- Checks with >50% negative feedback have their priority score reduced by 30%
- Checks with >80% positive feedback receive a 20% priority boost
- These adjustments compound with impact-based scoring to produce a ranking that improves over time

### Feedback-Aware Ranking
The `getRecommendationAdjustment` function computes a bounded adjustment (±8 points) based on:
- Accepted vs. rejected outcomes
- Positive vs. negative effect ratings
- Average score delta from before/after measurements

This adjustment feeds directly into `topNextActions` and `quickWins` ranking, ensuring recommendations get smarter with use.

## Confidence Score Calculation

Confidence scores reflect how certain Nerviq is that a check is accurate and current:

| Condition | Confidence |
|-----------|------------|
| Default (documented, not yet runtime-verified) | **0.7** |
| Runtime-verified (experiment passed, test covered) | **0.9** |
| Stale (not re-verified within 90 days) | **0.3** |
| Community-confirmed (positive feedback > 80%) | **0.9** (boosted) |
| Disputed (negative feedback > 50%) | **0.5** (reduced) |

Confidence is used in priority scoring: higher-confidence checks rank above lower-confidence checks at the same impact level.

## Plugin Extension

The check catalog is extensible via plugins. Any project can add custom checks by placing plugin modules in a configured directory. Plugins:

1. Export an object of technique definitions matching the standard check structure
2. Are loaded at audit time via `loadPlugins()` and merged into the active technique set via `mergePluginChecks()`
3. Follow the same scoring, ranking, and feedback rules as built-in checks
4. Can target any platform or be platform-agnostic

This allows organizations to enforce internal standards (naming conventions, required configurations, compliance rules) using the same evidence-based audit infrastructure.

## Transparency

Every check has a `sourceUrl` pointing to official vendor documentation. This means:

- Users can verify any finding by clicking through to the source
- Disputed checks can be resolved by comparing the check logic against current docs
- The audit is not a black box — it is a structured interpretation of documented best practices

## By the Numbers

| Metric | Value |
|--------|-------|
| Total checks | **2,431** |
| Platforms covered | **8** (Claude, Codex, Gemini, Copilot, Cursor, Windsurf, Aider, OpenCode) |
| Stack-specific languages | **10** (Python, Go, Rust, Java, Ruby, PHP, .NET, Flutter, Swift, Kotlin) |
| Research documents | **448+** |
| Runtime experiments | **332+** |
| Domain packs | **62** |
| Impact levels | 4 (critical, high, medium, low) |
| Feedback tracking | Per-check, per-project, with trend analysis |
| Freshness window | 90 days before staleness flag |
| Confidence range | 0.0–1.0, computed from evidence + feedback |

---

*This methodology is maintained as part of the Nerviq project. For implementation details, see the source code in `src/audit.js`, `src/activity.js`, `src/feedback.js`, and `src/freshness.js`.*
