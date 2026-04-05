# Nerviq Performance Baselines

Baseline measurements for `nerviq audit` on an empty (no config files) repository.
All measurements taken on the CI/benchmark machine using `src/audit.js` directly
(bypassing CLI process spawn overhead of ~80-120ms).

## Method

```js
const dir = fs.mkdtempSync(os.tmpdir() + '/perf-');
const { audit } = require('./src/audit');
const t0 = performance.now();
await audit({ dir, platform, silent: true });
const elapsed = performance.now() - t0;
fs.rmSync(dir, { recursive: true, force: true });
```

3 warm runs, median reported. Node.js v18+. No external network calls.

---

## Platform Baselines (empty repo, in-process)

| Platform   | p50 (ms) | p95 target | Budget |
|------------|:--------:|:----------:|--------|
| claude     |   ~70    |   < 500    | < 5000 |
| codex      |   ~80    |   < 500    | < 5000 |
| cursor     |   ~75    |   < 500    | < 5000 |
| gemini     |   ~75    |   < 500    | < 5000 |
| copilot    |   ~70    |   < 500    | < 5000 |
| windsurf   |   ~70    |   < 500    | < 5000 |
| aider      |   ~80    |   < 500    | < 5000 |
| opencode   |   ~80    |   < 500    | < 5000 |

> Note: Numbers above are for the in-process `audit()` call.
> Add ~100–150ms for CLI process-spawn overhead when calling via `node bin/cli.js`.

---

## CI Process-Spawn Baselines (via `node bin/cli.js`)

These include Node.js startup + require() time.

| Platform   | p50 (ms) | Notes |
|------------|:--------:|-------|
| claude     |   ~200   | Includes Node.js startup |
| codex      |   ~260   | |
| cursor     |   ~200   | |
| gemini     |   ~225   | |
| copilot    |   ~200   | |
| windsurf   |   ~200   | |
| aider      |   ~245   | |
| opencode   |   ~260   | |

---

## Regression Thresholds

| Tier | Threshold | Action |
|------|-----------|--------|
| **CI fast-gate** | 5 000 ms (5s) | Fail CI — something is seriously wrong |
| **Warning** | 1 000 ms (1s) | Alert in PR — investigate before merge |
| **Target** | 500 ms | Ideal for local developer experience |
| **In-process target** | 200 ms | Goal for `audit()` API call |

---

## Optimization Notes

1. **Module loading is the dominant cost** — `require()` chains for all 8 platform
   technique modules fire on first audit. Cold-start overhead is ~50–80ms.
2. **File system reads** — empty repo = minimal I/O. Rich repos with many config
   files add 5–20ms for context construction.
3. **No async I/O** — all context reads are synchronous `fs.readFileSync` calls,
   bounded by file count.
4. **Techniques evaluation** — O(n) over check count. 88 cursor checks + 71 aider
   checks etc., all synchronous, typically < 10ms total.

---

## Historical Snapshots

| Date       | Version | claude p50 | codex p50 | Notes |
|------------|---------|:----------:|:---------:|-------|
| 2026-04-05 | 0.9.4   |   ~70ms    |   ~80ms   | Baseline measurement |

---

*Last updated: 2026-04-05*
*Measured on: Node.js v18+, Windows 11*
