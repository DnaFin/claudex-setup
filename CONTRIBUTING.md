# Contributing to Nerviq

Thank you for contributing to Nerviq — the intelligent audit engine for AI coding agent configuration.

This guide covers:

1. [How to add a new check](#1-how-to-add-a-new-check)
2. [How to add a new platform](#2-how-to-add-a-new-platform)
3. [How to run tests](#3-how-to-run-tests)
4. [How to report false positives](#4-how-to-report-false-positives)
5. [Code style](#5-code-style)
6. [PR requirements](#6-pr-requirements)

---

## 1. How to Add a New Check

### 1.1 Choose the right file

Checks live in platform-specific technique files. The `claude` (main) platform is `src/techniques.js`.
All other platforms have their own `src/{platform}/techniques.js`.

| Platform | Technique file | Current checks |
|----------|---------------|:--------------:|
| Claude Code | `src/techniques.js` | 90 |
| Codex | `src/codex/techniques.js` | 94 |
| Cursor | `src/cursor/techniques.js` | 88 |
| Copilot | `src/copilot/techniques.js` | 86 |
| Gemini CLI | `src/gemini/techniques.js` | 87 |
| Windsurf | `src/windsurf/techniques.js` | 84 |
| Aider | `src/aider/techniques.js` | 71 |
| OpenCode | `src/opencode/techniques.js` | 73 |

### 1.2 Required fields

Every check is a plain object with these fields:

```js
{
  // REQUIRED
  id: 'CU-A10',           // Unique string ID, format: {PLATFORM_PREFIX}-{CATEGORY}{NN}
  name: 'Short description of what is being checked',
  check: (ctx) => {       // Returns: true (pass) | false (fail) | null (N/A / skip)
    // ...
    return true;
  },
  impact: 'critical',     // 'critical' | 'high' | 'medium' | 'low'
  rating: 5,              // 1–5 (used for sorting/display, reflects importance)
  category: 'rules',      // Matches a category key already in SOURCE_URLS for this platform
  fix: 'Actionable 1-sentence fix instruction.',

  // OPTIONAL but strongly recommended
  template: null,         // Template key (e.g. 'cursor-rules') or null
  file: () => '.cursor/rules/',  // File/path relevant to the check result, or () => null
  line: () => null,       // Line number function or () => null

  // Added automatically at export time (do NOT set manually):
  // sourceUrl   — injected by attachSourceUrls() based on category + platform
  // confidence  — injected by resolveConfidence() based on evidence tier
}
```

### 1.3 `sourceUrl` and `confidence` (injected automatically)

You do **not** set `sourceUrl` or `confidence` manually in technique objects. They are attached
at module export time by `attachSourceUrls()` in `src/source-urls.js`:

```js
// End of each platform's techniques.js:
module.exports = {
  CURSOR_TECHNIQUES: attachSourceUrls('cursor', CURSOR_TECHNIQUES),
};
```

**`sourceUrl`** resolves using priority:
1. `SOURCE_URLS[platform].byKey[checkKey]` — exact check override
2. `SOURCE_URLS[platform].byCategory[check.category]` — category fallback
3. `SOURCE_URLS[platform].defaultUrl` — platform default

If your check's `category` is not yet in `SOURCE_URLS[platform].byCategory`, you must add it
to `src/source-urls.js` before your check will export correctly.

**`confidence`** levels:
- `'documented'` — behavior confirmed in official documentation
- `'runtime-verified'` — behavior confirmed by live experiment
- `'stale'` — source was once verified but may be outdated (listed in `STALE_CONFIDENCE_IDS`)

To mark a check as runtime-verified, add its ID to `RUNTIME_CONFIDENCE_IDS[platform]`
in `src/source-urls.js`.

### 1.4 The `check(ctx)` function

The context object `ctx` has a consistent interface across platforms. Key methods:

```js
ctx.files                 // string[] — all relative paths in the project
ctx.fileContent(path)     // string | null — content of a specific file
ctx.jsonFile(path)        // object | null — parsed JSON, or null on failure
ctx.dir                   // string — absolute path to the project root

// Platform-specific (example: cursor)
ctx.cursorRules()         // MDC rule objects with { name, frontmatter, body, ruleType }
ctx.alwaysApplyRules()    // rules with alwaysApply: true
ctx.mcpConfig()           // { ok, data, error } — parsed .cursor/mcp.json
ctx.environmentJson()     // { ok, data, error } — parsed .cursor/environment.json
ctx.automationsConfig()   // array of { name, content } for automation YAML files
```

**Return values from `check(ctx)`:**
- `true` — check **passes** (the property IS present/correct)
- `false` — check **fails** (fix suggestion is shown)
- `null` — check **is not applicable** (skipped entirely; not counted against score)

Use `null` when the check requires context that does not exist in this project
(e.g., a background-agent check returns `null` if no `environment.json` is present).

### 1.5 Example check

```js
// In src/cursor/techniques.js, inside the CURSOR_TECHNIQUES object:

cursorMcpServersRootKey: {
  id: 'CU-B08',
  name: 'MCP config has required mcpServers root key',
  check: (ctx) => {
    const raw = ctx.fileContent('.cursor/mcp.json');
    if (!raw) return null;
    const data = ctx.mcpConfig();
    if (!data || !data.ok) return null;
    return Object.prototype.hasOwnProperty.call(data.data, 'mcpServers');
  },
  impact: 'critical',
  rating: 5,
  category: 'config',
  fix: 'Ensure .cursor/mcp.json has the "mcpServers" root key. Any other key causes silent failure.',
  template: null,
  file: () => '.cursor/mcp.json',
  line: () => 1,
},
```

### 1.6 Update the test count

After adding a check, update the count assertion in the platform's test file.
For example, `test/cursor.test.js`:

```js
test('cursor v1.0 exposes the full 88-check catalog', () => {
  expect(Object.keys(CURSOR_TECHNIQUES)).toHaveLength(88); // bump this
});
```

Also update the header comment at the top of the techniques file:

```js
/**
 * Cursor techniques module - CHECK CATALOG
 *
 * 89 checks across ...   ← bump this number
 */
```

---

## 2. How to Add a New Platform

Adding a platform is a 17-deliverable checklist. Every platform follows the same module structure
as the existing 8 platforms. Use `src/cursor/` as the canonical reference implementation.

### Deliverables checklist

| # | File | Description |
|---|------|-------------|
| 1 | `src/{platform}/techniques.js` | Check catalog (`{PLATFORM}_TECHNIQUES` export) |
| 2 | `src/{platform}/context.js` | `{Platform}ProjectContext` — reads and interprets project files |
| 3 | `src/{platform}/config-parser.js` | Parses platform config format (YAML/JSON/TOML) |
| 4 | `src/{platform}/domain-packs.js` | Domain-specific packs (`detect{Platform}DomainPacks`) |
| 5 | `src/{platform}/mcp-packs.js` | MCP pack recommendations (`recommend{Platform}McpPacks`) |
| 6 | `src/{platform}/governance.js` | Permission profiles, hook registry, policy packs |
| 7 | `src/{platform}/setup.js` | Generates starter config files |
| 8 | `src/{platform}/plans.js` | Proposal bundle builder |
| 9 | `src/{platform}/patch.js` | Applies individual check fixes |
| 10 | `src/{platform}/deep-review.js` | AI-powered deep review |
| 11 | `src/{platform}/interactive.js` | Step-by-step guided wizard |
| 12 | `src/{platform}/premium.js` | Premium/paid features |
| 13 | `src/{platform}/activity.js` | Snapshot and activity tracking |
| 14 | `src/{platform}/freshness.js` | P0 sources, `checkReleaseGate()`, propagation checklist |
| 15 | `src/source-urls.js` | Add `SOURCE_URLS['{platform}']` entry with `defaultUrl`, `byCategory`, `byKey` |
| 16 | `src/audit.js` | Import the platform, add to the platform switch/dispatch |
| 17 | `test/{platform}.test.js` | Jest test suite mirroring `test/cursor.test.js` |

### Additional wiring

After creating the 17 deliverables, update these files:

- **`src/audit.js`** — add import and add platform to the audit dispatcher
- **`src/harmony/canon.js`** — register platform signals so harmony detection works
- **`bin/cli.js`** — add platform to the `SUPPORTED_PLATFORMS` validation list
- **`package.json`** — add platform keyword
- **`test/check-matrix.js`** or create `test/{platform}-check-matrix.js`
- **`test/{platform}-fixtures.js`** — helper functions to build test repositories
- **`test/{platform}-golden-matrix.js`** — golden audit results for regression testing
- **`package.json` test:all script** — add the new matrix test files

### `freshness.js` requirements

Every platform must export:

```js
module.exports = {
  P0_SOURCES,           // Array of { key, label, url, stalenessThresholdDays, verifiedAt }
  PROPAGATION_CHECKLIST,// Array of { trigger, targets[] }
  checkReleaseGate,     // (sourceVerifications: {}) => { ready, stale, fresh, results }
  formatReleaseGate,    // (gateResult) => string
  getPropagationTargets,// (triggerKeyword) => array
};
```

The platform is also registered in `.github/workflows/freshness-check.yml` under the matrix strategy.

---

## 3. How to Run Tests

### Quick test (smoke)

```bash
npm test
```

Runs `test/run.js` — a fast integration test covering the main CLI surfaces.
Takes ~5 seconds. Run this before every commit.

### Jest unit tests

```bash
npx jest
# or
npm run test:jest
```

Runs all `test/**/*.test.js` files. Covers:
- `audit.test.js` — core audit engine
- `cursor.test.js`, `codex.test.js`, `gemini.test.js`, `copilot.test.js` — platform-specific audits
- `governance.test.js`, `harmony.test.js`, `synergy.test.js` — cross-platform
- `techniques.test.js` — shared technique database
- `performance.test.js` — timing assertions (all platforms < 5 000 ms)
- `e2e.test.js` — CLI end-to-end via `spawnSync`

### Full matrix tests

```bash
npm run test:all
```

This runs everything — smoke tests, check matrices, golden matrices, security tests, and Jest:

```
node test/run.js
node test/check-matrix.js
node test/codex-check-matrix.js
node test/golden-matrix.js
node test/codex-golden-matrix.js
node test/gemini-check-matrix.js
node test/gemini-golden-matrix.js
node test/copilot-check-matrix.js
node test/copilot-golden-matrix.js
node test/cursor-check-matrix.js
node test/cursor-golden-matrix.js
node test/security-tests.js
jest
```

### Individual platform matrix

```bash
node test/cursor-check-matrix.js    # Cursor checks
node test/gemini-check-matrix.js    # Gemini checks
node test/copilot-check-matrix.js   # Copilot checks
```

### Coverage

```bash
npm run test:coverage
```

Generates HTML coverage report in `coverage/`. Target: all new check `check()` functions
must be exercised by at least one test scenario.

### Performance

```bash
npx jest performance.test.js --verbose
```

Asserts all platforms complete in < 5 000 ms and prints a p50 summary table.

---

## 4. How to Report False Positives

A **false positive** is when a check reports `false` (fail) for a project that is actually
correctly configured for its context.

### Before opening an issue

1. Re-read the check's `fix` text — is the recommendation genuinely wrong, or just
   worded confusingly?
2. Check if a more nuanced `null` (N/A) return would be correct — the check may need
   tightening rather than removal.
3. Search existing issues for `false-positive` label.

### Opening a false-positive issue

Use the issue title format: `[false-positive] {CHECK_ID}: {check name}`

Include:
- **Check ID** — e.g., `CU-B02`
- **Platform** — e.g., Cursor
- **Project type** — e.g., "Next.js monorepo with 12 MCP servers"
- **Why it's wrong** — what the check assumed vs. what your project actually does
- **Proposed fix** — a more nuanced `check()` function (optional but helpful)

### Fixing a false positive

Most false positives are fixed by:
1. Adding a `null` early-return for the edge case
2. Tightening the check to require more evidence before failing
3. Weakening `impact` from `'high'` to `'medium'` if the check is heuristic

Example: a check that fails for empty repos should return `null` when the relevant files
don't exist:

```js
check: (ctx) => {
  const rules = ctx.cursorRules();
  if (rules.length === 0) return null;  // N/A — no rules at all
  return rules.some(r => r.ruleType === 'always');
},
```

---

## 5. Code Style

### Zero production dependencies

`package.json` has **no `dependencies`** — only `devDependencies` (jest). All code uses
Node.js built-ins (`fs`, `path`, `child_process`, `os`, `https`).

Do not add npm packages. If you need a utility, write it in the ~20 line range using
standard Node.js APIs.

### CommonJS only

All files use `require()` and `module.exports`. No ES modules (`import`/`export`).
No TypeScript, no transpilation, no build step.

### Patterns to follow

**Check functions must be synchronous and pure:**
```js
// ✓ Good — synchronous, uses ctx methods
check: (ctx) => {
  const content = ctx.fileContent('CLAUDE.md');
  if (!content) return null;
  return /```mermaid/.test(content);
},

// ✗ Bad — async, accesses filesystem directly
check: async (ctx) => {
  const content = await fs.promises.readFile(path.join(ctx.dir, 'CLAUDE.md'), 'utf8');
  return content.includes('mermaid');
},
```

**Context methods, not raw filesystem:**
```js
// ✓ Good
const raw = ctx.fileContent('.cursor/mcp.json');

// ✗ Bad
const raw = fs.readFileSync(path.join(ctx.dir, '.cursor/mcp.json'), 'utf8');
```

**Null for N/A, never throw:**
```js
// ✓ Good
check: (ctx) => {
  const env = ctx.environmentJson();
  if (!env || !env.ok) return null;    // N/A if file missing/invalid
  return Boolean(env.data.baseImage);  // fail if file present but field missing
},
```

**No console output in check functions:**
Check functions must be side-effect-free. All output goes through the audit engine's
formatted output, not `console.log`.

**IDs follow platform-prefix convention:**

| Platform | Prefix | Example |
|----------|--------|---------|
| Claude | numeric | `1`, `51`, `681` |
| Codex | `CD-` | `CD-A01` |
| Cursor | `CU-` | `CU-A01` |
| Copilot | `CP-` | `CP-A01` |
| Gemini CLI | `GM-` | `GM-A01` |
| Windsurf | `WS-` | `WS-A01` |
| Aider | `AD-` | `AD-A01` |
| OpenCode | `OC-` | `OC-A01` |

IDs must be unique within a platform. Use the next sequential number in the category.

**Category strings must match `SOURCE_URLS[platform].byCategory` keys.**
If you add a new category, add it to `src/source-urls.js` first.

---

## 6. PR Requirements

### Before submitting

- [ ] `npm test` passes (< 5 seconds)
- [ ] `npx jest` passes — all tests green
- [ ] If adding a check: test count assertion in `test/{platform}.test.js` updated
- [ ] If adding a check: check is exercised in the platform's check-matrix
- [ ] No new `dependencies` added to `package.json`
- [ ] All new functions are synchronous and use `ctx` methods (not raw `fs`)
- [ ] `check()` returns `true | false | null` only (never `undefined`, never throws)

### PR description template

```markdown
## What
One paragraph describing what the PR adds or changes.

## Why
Why this is needed — link to community signals, experiment findings, or issue.

## Platform(s) affected
- [ ] claude  - [ ] codex  - [ ] cursor  - [ ] copilot
- [ ] gemini  - [ ] windsurf  - [ ] aider  - [ ] opencode

## Check IDs added/modified
- CU-A10: ...

## Confidence level
- [ ] documented (official docs confirm)
- [ ] runtime-verified (live experiment confirms)
- [ ] heuristic (reasonable inference)
```

### Review criteria

1. **No false positives on typical projects** — the check should pass on well-configured
   repos and return `null` when not applicable.
2. **Fix text is actionable** — a developer who has never seen nerviq should know exactly
   what to do from the `fix` string alone.
3. **Source URL resolves** — the URL in `SOURCE_URLS` should link to official documentation
   that confirms the check's basis.
4. **Test coverage** — the check-matrix must exercise at least the pass and fail paths.
5. **No regressions** — existing check counts must not change unless explicitly intended.

---

## Project structure reference

```
.
├── bin/cli.js                 # CLI entry point — command parsing and dispatch
├── src/
│   ├── techniques.js          # Claude Code check catalog (90 checks)
│   ├── context.js             # ProjectContext for Claude Code
│   ├── audit.js               # Platform-agnostic audit engine
│   ├── source-urls.js         # sourceUrl + confidence registry (all platforms)
│   ├── secret-patterns.js     # Shared regex patterns for secret detection
│   ├── {platform}/            # Platform-specific modules (see §2)
│   │   ├── techniques.js
│   │   ├── context.js
│   │   └── ...
│   ├── harmony/               # Cross-platform alignment engine
│   └── synergy/               # Recommendation synergy engine
├── test/
│   ├── *.test.js              # Jest tests (run via npx jest)
│   ├── *-check-matrix.js      # Exhaustive check-by-check matrix (run via node)
│   ├── *-golden-matrix.js     # Regression golden files
│   ├── *-fixtures.js          # Test repo builders
│   └── run.js                 # Fast smoke test suite
├── content/                   # Template files for setup command
└── .github/workflows/
    ├── ci.yml                 # CI: verify + publish (on tag)
    ├── release.yml            # Release: full publish with provenance on v* tags
    └── freshness-check.yml    # Daily freshness gate for all 8 platforms
```
