# Changelog

## [1.16.2] - 2026-04-03

### Changed
- bumped the local release line to `1.16.2` so the next publish does not overwrite the already-live `1.16.1` npm release
- synchronized README, docs, launch copy, and proof-facing state to distinguish clearly between public npm latest (`1.16.1`) and local release prep (`1.16.2`)

### Fixed
- release-truth drift across package metadata, docs, and public-facing proof references

## [1.16.1] - 2026-04-03

### Added
- `feedback` command validation on the public npm package line
- stronger secret detection coverage for Anthropic-style keys
- deep-review sanitization and secret redaction hardening
- watch-mode resilience improvements across recursive and non-recursive platforms

### Changed
- increased verified check count from `84` to `85`
- proof-backed product copy and case-study traceability improvements

## [1.10.3] - 2026-04-02

### Added
- `--snapshot` support for `audit`, `augment`, `suggest-only`, `benchmark`, and `governance`, writing normalized evidence artifacts under `.claude/claudex-setup/snapshots/`
- shared snapshot history via `index.json` so before/after work can accumulate into a single local evidence spine
- `governance --out governance.md` for a shareable governance / pilot-readiness artifact
- packaged Claude-native `audit-repo` skill template under `content/claude-code/audit-repo/`
- lightweight release checklist in `content/release-checklist.md`

### Changed
- default audit now surfaces `Top 5 Next Actions` with rationale, traceability, risk, confidence, and a suggested next command
- `--lite` now gives a shorter beginner-first top-3 quick scan
- README and docs now reflect snapshot artifacts, governance export, and the Claude-native skill path
- packaged content and public-facing counts are now aligned with the current CLAUDEX state

## [1.14.0] - 2026-04-03

### Added
- Check-level test matrix: 327 verified scenarios across all 84 checks
- Golden matrix: 12 repo profile tests with expected results

### Fixed
- `hooks` check now detects hooks in settings.json (not only .claude/hooks/ dir)
- `context7Mcp` check now reads .mcp.json
- `skillUsesPaths` now traverses skill subdirectories (skills/name/SKILL.md)
- `lintCommand` now matches npm/yarn/pnpm/bun lint commands

## [1.13.0] - 2026-04-03

### Added
- 10 new checks (74→84): project description, directory structure, multiple hook types, stop-failure hook, skill paths, MCP env config, gitignore local settings, .env.example, package scripts, type checking
- 15 new tests (58→73): history/compare/trend, new checks structure, CLI commands, deny depth, negative instructions, --require flag
- All references updated to 74→84 checks

## [1.12.0] - 2026-04-03

### Added
- 12 new checks (62→74): test coverage, agent tool restrictions, auto-memory, sandbox, deny rule depth, git attribution, effort level, snapshot history, worktree, negative instructions, output style, CI variants
- 8 new stacks (22→30): Deno, Bun, Elixir, Astro, Remix, NestJS, Laravel, .NET
- Deeper domain detection: llamaindex, crewai, autogen, ollama for AI/ML; paypal, square, adyen, medusa for ecommerce; chromatic, style-dictionary for design; capacitor, ionic for mobile

### Fixed
- `githubActionsOrCI` check used non-existent `ctx.hasFile()` — now uses `ctx.fileContent()`
- `.NET` stack detection no longer uses glob patterns

## [1.11.0] - 2026-04-03

### Added
- `history` command — show score timeline from saved snapshots
- `compare` command — diff latest vs previous snapshot with delta, regressions, improvements
- `trend --out report.md` — export trend report as shareable markdown
- `--require A,B` CI flag — exit code 1 if named checks fail (policy guardrails)
- Agentic DX positioning in README
- Real results table (4 case studies) in README
- Claude-native integration guide (skill, hook, agent examples)
- Trust-first help text reordering

### Fixed
- Hook checks (hooksInSettings, preToolUse, postToolUse, sessionStart) now OR across settings.json and settings.local.json

## [1.10.2] - 2026-04-02

### Fixed
- MCP recommendations are now less speculative: `postgres-mcp` requires explicit Postgres signals, `figma-mcp` only appears for design-system repos, and `mcp-security` is no longer auto-added just because multiple packs were suggested
- `sentry-mcp` now requires real observability signals or stricter operational domains instead of appearing for every frontend/backend repo
- design-system detection now respects `.storybook/` directories directly, improving frontend pack accuracy

### Added
- MCP preflight warnings for `setup`, `plan`, and `apply` when selected packs require missing environment variables
- user-facing docs now reflect the actual 22 detected stacks

## [1.10.1] - 2026-04-02

### Fixed
- corrected MCP pack package names to verified npm packages
- aligned settings hierarchy checks with shared settings precedence

## [1.10.0] - 2026-04-01

### Added
- 11 new MCP packs (15→26): sequential-thinking, jira-confluence, ga4-analytics, search-console, n8n-workflows, zendesk, infisical-secrets, shopify, huggingface, blender, wordpress
- 7 new domain packs (10→17→16 final): ecommerce, ai-ml, devops-cicd, design-system, docs-content, security-focused
- Smart recommendation for all new packs based on detected stack and domain
- Detection logic: Storybook, Docusaurus, Stripe, LangChain, GitHub Actions, auth deps

## [1.9.0] - 2026-03-31

### Added
- 3 new domain packs: `monorepo`, `mobile`, `regulated-lite` (7→10 total)
- 3 new MCP packs: `github-mcp`, `postgres-mcp`, `memory-mcp` (2→5 total)
- smart MCP pack recommendation based on detected domain packs
- `suggest-only --out report.md` exports full analysis as shareable markdown
- `why` explanations for all strengths preserved (20+ specific reasons)
- `why` explanations for all gap findings (12+ specific reasons)
- 5 new hooks in governance registry: duplicate-id-check, injection-defense, trust-drift-check, session-init, protect-catalog
- case study template in `content/case-study-template.md`
- hook risk level display in governance output (color-coded low/medium/high)

### Fixed
- **Settings hierarchy bug**: `noBypassPermissions` and `secretsProtection` checks now correctly read `.claude/settings.json` before `.claude/settings.local.json`, so personal maintainer overrides no longer fail the shared audit
- domain pack detection now handles monorepo (nx.json, turbo.json, lerna.json, workspaces), mobile (React Native, Flutter, iOS/Android dirs), and regulated repos (SECURITY.md, compliance dirs)

### Changed
- strengths preserved section now shows 8 items (was 6) with specific value explanations
- claudex-sync.json updated with domain pack, MCP pack, and anti-pattern counts

## [1.8.0] - 2026-03-31

### Added
- domain pack recommendations for backend, frontend, data, infra, OSS, and enterprise-governed repos
- MCP pack recommendations and merge support for `context7-docs` and `next-devtools`
- workflow-evidence coverage in benchmark reports
- runtime settings overlays so `apply --plan` still respects current `--profile` and `--mcp-pack` flags

### Changed
- benchmark now respects the selected profile and MCP pack options during isolated-copy runs
- governance and suggest-only outputs now expose domain packs and MCP packs directly
- README and docs clarify the local-vs-opt-in-network boundary for core flows vs `deep-review`
- audit output now frames `setup` as starter-safe generation instead of an automatic full fix

## [1.7.0] - 2026-03-31

### Added
- `augment` / `suggest-only` repo-aware analysis with strengths, gaps, top actions, risk notes, and rollout order
- `plan` command for exportable proposal bundles with file previews and diff-style output
- `apply` command for selective starter-safe apply flows with rollback manifests and activity artifacts
- `governance` command with permission profiles, hook registry, policy packs, and pilot rollout guidance
- `benchmark` command that measures before/after impact in an isolated temp copy and exports evidence reports
- claims governance and pilot rollout docs in `content/`

### Changed
- `setup` now exposes reusable planning primitives and returns written/preserved file summaries
- CLI now supports `--out`, `--plan`, `--only`, and `--dry-run`
- README and docs now reflect the actual product surface instead of only audit/setup flows
- benchmark and proposal workflows now preserve existing files by default and treat mature repos as review-first

## [0.2.0] - 2026-03-31

### Added
- 50+ audit checks (up from 16)
- 8 new categories: Design, DevOps, Hygiene, Performance, MCP, Prompting, Git Safety, Automation
- 6 new stack detections: Svelte, Flutter, Ruby, Java, Kotlin, Swift
- Improved CLAUDE.md template with Mermaid diagrams and XML constraints
- Auto-sync with CLAUDEX research catalog (1,107 items)
- Copy-paste config snippets in fix suggestions

### Changed
- Knowledge base upgraded from 972 to 1,107 verified techniques
- Better scoring weights per category

## [0.1.0] - 2026-03-30

### Added
- Initial release
- 16 audit checks
- Automatic setup with CLAUDE.md, hooks, commands, skills, rules, agents
- Stack detection for 12 frameworks
- JSON output mode
