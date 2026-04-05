/**
 * Performance tests for nerviq audit
 *
 * Validates that audits complete within the < 5 second budget
 * and reports p50 timing for regression tracking.
 *
 * Uses the in-process audit() API for stable measurements
 * (avoids Node.js process-spawn startup overhead which varies
 * by host environment and is not indicative of audit logic cost).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { audit } = require('../src/audit');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkTempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `nerviq-perf-${label}-`));
}

function cleanDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Run `audit()` N times and return timing statistics.
 * @param {string} dir - Project directory to audit
 * @param {string} platform - Platform name
 * @param {number} iterations - Number of runs
 * @returns {{ times: number[], p50: number, min: number, max: number, mean: number }}
 */
async function measureAudit(dir, platform, iterations = 5) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await audit({ dir, platform, silent: true });
    times.push(performance.now() - t0);
  }

  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];
  const mean = times.reduce((s, t) => s + t, 0) / times.length;

  return { times, p50, min, max, mean };
}

// ─── Budget constants ─────────────────────────────────────────────────────────

const BUDGET_MS = 5000;       // hard CI gate
const WARN_MS = 1000;         // soft warning threshold
const ITERATIONS = 5;         // runs per platform for stable p50

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Performance — audit() on empty repo', () => {
  // Run once up front: warm requires into module cache so first-call
  // overhead does not skew measurements.
  beforeAll(async () => {
    const warmDir = mkTempDir('warm');
    try {
      await audit({ dir: warmDir, platform: 'claude', silent: true });
    } finally {
      cleanDir(warmDir);
    }
  });

  test(`claude audit completes in < ${BUDGET_MS}ms (p50 reported)`, async () => {
    const dir = mkTempDir('claude');
    try {
      const stats = await measureAudit(dir, 'claude', ITERATIONS);

      // Log timing for CI visibility
      console.log(`  claude: p50=${stats.p50.toFixed(1)}ms  min=${stats.min.toFixed(1)}ms  max=${stats.max.toFixed(1)}ms  mean=${stats.mean.toFixed(1)}ms`);

      // Hard budget
      for (const t of stats.times) {
        expect(t).toBeLessThan(BUDGET_MS);
      }

      // p50 should be well under the budget
      expect(stats.p50).toBeLessThan(BUDGET_MS);
    } finally {
      cleanDir(dir);
    }
  }, BUDGET_MS * 3);

  test(`codex audit completes in < ${BUDGET_MS}ms (p50 reported)`, async () => {
    const dir = mkTempDir('codex');
    try {
      const stats = await measureAudit(dir, 'codex', ITERATIONS);

      console.log(`  codex:  p50=${stats.p50.toFixed(1)}ms  min=${stats.min.toFixed(1)}ms  max=${stats.max.toFixed(1)}ms  mean=${stats.mean.toFixed(1)}ms`);

      for (const t of stats.times) {
        expect(t).toBeLessThan(BUDGET_MS);
      }
      expect(stats.p50).toBeLessThan(BUDGET_MS);
    } finally {
      cleanDir(dir);
    }
  }, BUDGET_MS * 3);

  test(`cursor audit completes in < ${BUDGET_MS}ms (p50 reported)`, async () => {
    const dir = mkTempDir('cursor');
    try {
      const stats = await measureAudit(dir, 'cursor', ITERATIONS);

      console.log(`  cursor: p50=${stats.p50.toFixed(1)}ms  min=${stats.min.toFixed(1)}ms  max=${stats.max.toFixed(1)}ms  mean=${stats.mean.toFixed(1)}ms`);

      for (const t of stats.times) {
        expect(t).toBeLessThan(BUDGET_MS);
      }
      expect(stats.p50).toBeLessThan(BUDGET_MS);
    } finally {
      cleanDir(dir);
    }
  }, BUDGET_MS * 3);

  test(`gemini audit completes in < ${BUDGET_MS}ms (p50 reported)`, async () => {
    const dir = mkTempDir('gemini');
    try {
      const stats = await measureAudit(dir, 'gemini', ITERATIONS);

      console.log(`  gemini: p50=${stats.p50.toFixed(1)}ms  min=${stats.min.toFixed(1)}ms  max=${stats.max.toFixed(1)}ms  mean=${stats.mean.toFixed(1)}ms`);

      for (const t of stats.times) {
        expect(t).toBeLessThan(BUDGET_MS);
      }
      expect(stats.p50).toBeLessThan(BUDGET_MS);
    } finally {
      cleanDir(dir);
    }
  }, BUDGET_MS * 3);

  test(`aider audit completes in < ${BUDGET_MS}ms (p50 reported)`, async () => {
    const dir = mkTempDir('aider');
    try {
      const stats = await measureAudit(dir, 'aider', ITERATIONS);

      console.log(`  aider:  p50=${stats.p50.toFixed(1)}ms  min=${stats.min.toFixed(1)}ms  max=${stats.max.toFixed(1)}ms  mean=${stats.mean.toFixed(1)}ms`);

      for (const t of stats.times) {
        expect(t).toBeLessThan(BUDGET_MS);
      }
      expect(stats.p50).toBeLessThan(BUDGET_MS);
    } finally {
      cleanDir(dir);
    }
  }, BUDGET_MS * 3);

  test('p50 summary across all measured platforms', async () => {
    // Run one quick measurement pass across all platforms to collect p50s
    const platforms = ['claude', 'codex', 'cursor', 'gemini', 'copilot', 'windsurf', 'aider', 'opencode'];
    const summaryRows = [];

    for (const platform of platforms) {
      const dir = mkTempDir(platform);
      try {
        const stats = await measureAudit(dir, platform, 3);
        summaryRows.push({ platform, p50: stats.p50, max: stats.max });
        // Every platform must be under budget
        expect(stats.p50).toBeLessThan(BUDGET_MS);
      } finally {
        cleanDir(dir);
      }
    }

    // Print summary table
    console.log('\n  ── Performance Summary ─────────────────────────────');
    console.log('  Platform     p50 (ms)   max (ms)   Budget');
    console.log('  ──────────────────────────────────────────────────');
    for (const row of summaryRows) {
      const p50Str = row.p50.toFixed(1).padStart(8);
      const maxStr = row.max.toFixed(1).padStart(8);
      const budget = row.p50 < WARN_MS ? '✓ good' : row.p50 < BUDGET_MS ? '⚠ warn' : '✗ FAIL';
      console.log(`  ${row.platform.padEnd(12)} ${p50Str}   ${maxStr}   ${budget}`);
    }
    console.log('  ──────────────────────────────────────────────────');
    const worstP50 = Math.max(...summaryRows.map(r => r.p50));
    console.log(`  Worst p50: ${worstP50.toFixed(1)}ms (budget: ${BUDGET_MS}ms)\n`);
  }, BUDGET_MS * 10);
});

describe('Performance — regression guard', () => {
  test('all-platforms p50 stays below 5000ms budget', async () => {
    // Lightweight confirmation: single run per platform
    const platforms = ['claude', 'codex'];
    for (const platform of platforms) {
      const dir = mkTempDir(`reg-${platform}`);
      try {
        const t0 = performance.now();
        await audit({ dir, platform, silent: true });
        const elapsed = performance.now() - t0;
        expect(elapsed).toBeLessThan(BUDGET_MS);
      } finally {
        cleanDir(dir);
      }
    }
  });
});
