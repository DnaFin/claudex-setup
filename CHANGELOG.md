# Changelog

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
