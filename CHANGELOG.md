# Changelog

All notable changes to the **Nerviq** CLI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.4] - 2026-04-05

### Added
- H8: Unified platform capability matrices into a single source of truth
- Windsurf, Aider, and OpenCode intelligence added to Harmony module
- Codex platform additions synced to metadata

### Changed
- MG5-MG11: Complete CLAUDEX to NERVIQ migration in CLI codebase
- Hardcoded `.claude/claudex-setup/` paths migrated to `.nerviq/` with fallback

## [1.2.3] - 2026-04-05

### Added
- Batch Q1: check-matrix and golden-matrix tests for Windsurf, Aider, OpenCode
- Quality Perfection Q1: Gold certification, harmony+synergy proof
- SDK/server tests and plugin dogfood validation

### Changed
- Self-audit score improved from 80 to 90
- CI self-audit integrated into pipeline

## [1.2.1] - 2026-04-05

### Fixed
- Skip API/DB/Auth/Monitoring checks on irrelevant projects (false positive reduction)
- Self-dogfood: added `.mcp.json` to own project
- LICENSE updated to AGPL-3.0 full text
- CI test assertions updated for new error messages and .npmignore changes

## [1.2.0] - 2026-04-05

### Added
- Massive expansion: 673 to 2,306 checks (+1,633)
- Batch 4: 25 case studies (10 single-platform + 10 harmony/synergy + 5 existing) with INDEX
- Batch 3: +104 experiments (228 to 332) and +133 research docs (315 to 448)
- 27 cross-platform research documents

## [1.1.1] - 2026-04-05

### Added
- Batch 2: +24 domain packs (16 to 40) and +23 MCP packs (26 to 49) across all 8 platforms

## [1.1.0] - 2026-04-05

### Added
- Batch 1: +383 checks (673 to 1,056) across 8 new categories for all 8 platforms

## [1.0.2] - 2026-04-05

### Fixed
- Scorecard: 15 dimensions improved (privacy, security, monorepo, org, integrations, telemetry, OTel, SLSA, versioning, errors, audit log, deprecation, large files, relevance decay, case studies)

### Added
- Methodology documentation, FP ranking, SBOM, CI experiments
- Improved `.npmignore` and `test:all` script

## [1.0.1] - 2026-03-31

### Fixed
- Mermaid diagram rendering in README
- macOS `grep` compatibility issue
- Version stamp display

## [1.0.0] - 2026-04-05

### Changed
- **Renamed from claudex-setup to Nerviq** — "The intelligent nervous system for AI coding agents"
- Full rebrand across CLI, docs, and package metadata

## [0.9.6] - 2026-04-05

### Added
- SDK for programmatic access
- REST API server with Express
- Plugin system for extensibility
- SLSA provenance for supply chain security
- CONTRIBUTING.md for open-source contributors

## [0.9.5] - 2026-04-05

### Added
- VS Code extension
- `catalog` command for browsing checks
- Performance baselines and benchmarks
- Feedback loop for community contributions

### Changed
- All 673 checks now include `sourceUrl` and `confidence` metadata

## [0.9.4] - 2026-04-05

### Added
- GitHub Action for CI/CD integration
- MCP server for tool integration
- `doctor`, `convert`, and `migrate` commands
- Freshness pipeline for check staleness detection
- 3 case studies with real project data
- Harmony, Synergy, and E2E test suites (187 total tests)

## [0.9.3] - 2026-04-05

### Fixed
- Checks updated from experiment findings: Gemini +5, Copilot +5, Cursor +4, Aider +3, Windsurf/OpenCode fixes
- Stale checks cleaned and new checks added
- CI: added `npm ci` step for dependency install

### Changed
- README updated with beta notice and coming-soon platform list

## [0.9.x] - 2026-04-04

### Changed
- README updated with claudex-setup to Nerviq migration notice

## [0.5.1] - 2026-03-31

### Changed
- Deep-review auto-detects Claude Code presence (no API key needed)
- Landing page and help text updated

## [0.5.0] - 2026-03-31

### Added
- AI-powered `deep-review` command using Claude API
- Intelligent analysis beyond static checks

## [0.4.0] - 2026-03-31

### Added
- 9 quality-deep checks for veteran Claude Code users
- Deeper analysis for experienced workflows

### Changed
- Community feedback addressed: improved honesty, no-overwrite behavior, less dogmatic tone

## [0.3.2] - 2026-03-31

### Changed
- README v2: all commands documented, smart gen showcase, 54 checks table, GitHub Action, privacy section

## [0.3.1] - 2026-03-31

### Added
- Anonymous insights collection
- Weakest areas analysis
- Community statistics dashboard

### Fixed
- Insights endpoint corrected to `claudex.workers.dev`

## [0.3.0] - 2026-03-31

### Added
- Interactive wizard for guided setup
- Watch mode for continuous monitoring
- Landing page with FAQ, trust signals, badges

## [0.2.1] - 2026-03-31

### Added
- Smart `CLAUDE.md` generator based on project analysis
- `badge` command for README status badges
- GitHub Action for automated auditing
- Quick wins recommendations

## [0.2.0] - 2026-03-31

### Added
- Expanded to 54 checks across 18 technology stacks
- Improved CLAUDE.md templates

### Fixed
- Security: removed hardcoded Dev.to API key from CLAUDE.md
- Security: made CLAUDEX catalog links private

## [0.1.0] - 2026-03-30

### Added
- Initial release of claudex-setup (later renamed to Nerviq)
- Project audit and optimization for Claude Code workflows
- Landing page (GitHub Pages ready)
- Launch content and community posts

[Unreleased]: https://github.com/nerviq/nerviq/compare/v1.2.4...HEAD
[1.2.4]: https://github.com/nerviq/nerviq/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/nerviq/nerviq/compare/v1.2.1...v1.2.3
[1.2.1]: https://github.com/nerviq/nerviq/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/nerviq/nerviq/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/nerviq/nerviq/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nerviq/nerviq/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/nerviq/nerviq/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/nerviq/nerviq/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nerviq/nerviq/compare/v0.9.6...v1.0.0
[0.9.6]: https://github.com/nerviq/nerviq/compare/v0.9.5...v0.9.6
[0.9.5]: https://github.com/nerviq/nerviq/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/nerviq/nerviq/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/nerviq/nerviq/compare/v0.9.x...v0.9.3
[0.9.x]: https://github.com/nerviq/nerviq/compare/v0.5.1...v0.9.x
[0.5.1]: https://github.com/nerviq/nerviq/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/nerviq/nerviq/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nerviq/nerviq/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/nerviq/nerviq/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nerviq/nerviq/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nerviq/nerviq/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/nerviq/nerviq/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/nerviq/nerviq/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nerviq/nerviq/releases/tag/v0.1.0
