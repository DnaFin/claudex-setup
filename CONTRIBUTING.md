# Contributing to claudex-setup

## Quick Start

```bash
git clone https://github.com/DnaFin/claudex-setup
cd claudex-setup
npm test                    # 73 unit tests
node test/check-matrix.js   # 327 pass/fail scenario tests
node test/golden-matrix.js  # 12 golden tests (real repo profiles)
node bin/cli.js             # Run CLI locally
```

All 3 test suites must pass (412 total) before submitting a PR.

## Adding a New Check

1. Open `src/techniques.js`
2. Add a new entry to the `TECHNIQUES` object:

```js
myNewCheck: {
  id: NEXT_ID,                    // Increment from last ID
  name: 'Human-readable name',
  check: (ctx) => {
    // ctx.claudeMdContent()      — CLAUDE.md content (checks root + .claude/)
    // ctx.fileContent('path')    — any file content
    // ctx.files                  — array of root file/dir names
    // ctx.hasDir('path')         — directory exists?
    // ctx.jsonFile('path')       — parsed JSON file
    // ctx.dirFiles('path')       — files in a directory
    return true;                  // true=pass, false=fail, null=skip (not applicable)
  },
  impact: 'critical',             // critical | high | medium | low
  rating: 5,                      // 1-5 (5 = game-changer)
  category: 'quality',            // see CATEGORY_MODULES in audit.js
  fix: 'Actionable fix text.',
  template: null                  // null, or template key from TEMPLATES in setup.js
},
```

3. Run all 3 test suites to verify

## Adding a Domain Pack

Edit `src/domain-packs.js`:
- Add to `DOMAIN_PACKS` array (key, label, useWhen, recommendedModules, recommendedMcpPacks, benchmarkFocus)
- Add detection logic in `detectDomainPacks()` — use dependency checks, directory signals, or stack signals

## Adding an MCP Pack

Edit `src/mcp-packs.js`:
- Add to `MCP_PACKS` array (key, label, useWhen, adoption, servers config)
- Add recommendation logic in `recommendMcpPacks()` — gate on domain signals, not blanket recommendations

## Adding a Stack

Edit `src/techniques.js` — add to the `STACKS` object:

```js
'my-framework': {
  key: 'my-framework',
  label: 'My Framework',
  detect: ['my-framework.config.js'],  // files that indicate this stack
},
```

## Code Architecture

```
bin/cli.js         → CLI entry point, argument parsing, command routing
src/context.js     → ProjectContext: file scanning, caching, helpers
src/techniques.js  → 84 checks + 30 stacks (the knowledge base)
src/audit.js       → Scoring engine, quickWins, topNextActions
src/analyze.js     → augment/suggest-only analysis + markdown export
src/plans.js       → Proposal bundles, apply, rollback
src/governance.js  → Permission profiles, hooks, policy packs
src/benchmark.js   → Isolated before/after measurement
src/domain-packs.js → 16 domain detection packs
src/mcp-packs.js   → 26 MCP server packs
src/activity.js    → Snapshot/history/trend tracking
src/setup.js       → CLAUDE.md generator, hooks, commands, templates
```

## Design Constraints

- **Zero runtime dependencies** — this is a hard rule, not a suggestion
- **No TypeScript, no build step** — vanilla Node.js, runs directly
- **Cross-OS hooks** — generated hooks must be `.js` (Node.js), not `.sh` (bash)
- **Trust-first** — audit before write, plan before apply, rollback for every change

## Research Backing

Every check should trace to a technique in the [CLAUDEX catalog](https://github.com/DnaFin/claudex). Reference technique IDs in comments when adding checks.

## Reporting Issues

Use the [issue templates](https://github.com/DnaFin/claudex/issues/new/choose):
- **Wrong recommendation** — a check gave bad advice
- **Wrong pack** — a domain or MCP pack was incorrectly recommended
- **Domain pack proposal** — suggest a new domain pack
