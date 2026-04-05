#!/usr/bin/env node

/**
 * Performance Baseline Benchmark
 * Runs audit for each of the 8 platforms on an empty temp directory,
 * measures execution time, and reports results as a markdown table.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { audit } = require('../src/audit');

const PLATFORMS = ['claude', 'codex', 'gemini', 'copilot', 'cursor', 'windsurf', 'aider', 'opencode'];

async function runBenchmarks() {
  const results = [];

  for (const platform of PLATFORMS) {
    // Create a fresh empty temp directory for each platform
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `nerviq-bench-${platform}-`));

    try {
      const start = process.hrtime.bigint();
      const result = await audit({ dir: tmpDir, silent: true, platform });
      const end = process.hrtime.bigint();

      const timeMs = Number(end - start) / 1_000_000;
      const checksCount = result.checkCount || 0;
      const checksPerSec = timeMs > 0 ? Math.round((checksCount / timeMs) * 1000) : 0;

      results.push({
        platform,
        time_ms: Math.round(timeMs),
        checks_count: checksCount,
        checks_per_second: checksPerSec,
      });
    } catch (err) {
      results.push({
        platform,
        time_ms: -1,
        checks_count: 0,
        checks_per_second: 0,
        error: err.message,
      });
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }

  return results;
}

function formatMarkdownTable(results) {
  const lines = [];
  lines.push('# Performance Baseline');
  lines.push('');
  lines.push(`Benchmarked on ${new Date().toISOString().split('T')[0]} against empty temp directories.`);
  lines.push('');
  lines.push('| Platform | Time (ms) | Checks | Checks/sec |');
  lines.push('|---|---|---|---|');

  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.platform} | ERROR | - | - |`);
    } else {
      lines.push(`| ${r.platform} | ${r.time_ms} | ${r.checks_count} | ${r.checks_per_second} |`);
    }
  }

  lines.push('');
  const totalChecks = results.reduce((s, r) => s + r.checks_count, 0);
  const totalTime = results.reduce((s, r) => s + (r.time_ms > 0 ? r.time_ms : 0), 0);
  lines.push(`**Total:** ${totalChecks} checks across ${PLATFORMS.length} platforms in ${totalTime}ms`);
  lines.push('');

  return lines.join('\n');
}

async function main() {
  console.log('Running performance benchmark across 8 platforms...\n');
  const results = await runBenchmarks();
  const md = formatMarkdownTable(results);

  // Print to console
  console.log(md);

  // Write to PERFORMANCE.md
  const outPath = path.join(__dirname, '..', 'PERFORMANCE.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\nResults saved to ${outPath}`);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
