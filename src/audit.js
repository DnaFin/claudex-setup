/**
 * Audit engine - evaluates project against CLAUDEX technique database.
 */

const { TECHNIQUES, STACKS } = require('./techniques');
const { ProjectContext } = require('./context');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function progressBar(score, max = 100, width = 20) {
  const filled = Math.round((score / max) * width);
  const empty = width - filled;
  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  return colorize('█'.repeat(filled), color) + colorize('░'.repeat(empty), 'dim');
}

async function audit(options) {
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const results = [];

  // Run all technique checks
  for (const [key, technique] of Object.entries(TECHNIQUES)) {
    const passed = technique.check(ctx);
    results.push({
      key,
      ...technique,
      passed,
    });
  }

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  const critical = failed.filter(r => r.impact === 'critical');
  const high = failed.filter(r => r.impact === 'high');
  const medium = failed.filter(r => r.impact === 'medium');

  // Calculate score
  const weights = { critical: 15, high: 10, medium: 5 };
  const maxScore = results.reduce((sum, r) => sum + (weights[r.impact] || 5), 0);
  const earnedScore = passed.reduce((sum, r) => sum + (weights[r.impact] || 5), 0);
  const score = Math.round((earnedScore / maxScore) * 100);

  if (options.json) {
    console.log(JSON.stringify({ score, stacks, passed: passed.length, failed: failed.length, results }, null, 2));
    return;
  }

  // Display results
  console.log('');
  console.log(colorize('  claudex-setup audit', 'bold'));
  console.log(colorize('  ═══════════════════════════════════════', 'dim'));
  console.log(colorize(`  Scanning: ${options.dir}`, 'dim'));

  if (stacks.length > 0) {
    console.log(colorize(`  Detected: ${stacks.map(s => s.label).join(', ')}`, 'blue'));
  }

  console.log('');

  // Score
  console.log(`  ${progressBar(score)} ${colorize(`${score}/100`, 'bold')}`);
  console.log('');

  // Passed
  if (passed.length > 0) {
    console.log(colorize('  ✅ Passing', 'green'));
    for (const r of passed) {
      console.log(colorize(`     ${r.name}`, 'dim'));
    }
    console.log('');
  }

  // Failed - by priority
  if (critical.length > 0) {
    console.log(colorize('  🔴 Critical (fix immediately)', 'red'));
    for (const r of critical) {
      console.log(`     ${colorize(r.name, 'bold')}`);
      console.log(colorize(`     → ${r.fix}`, 'dim'));
    }
    console.log('');
  }

  if (high.length > 0) {
    console.log(colorize('  🟡 High Impact', 'yellow'));
    for (const r of high) {
      console.log(`     ${colorize(r.name, 'bold')}`);
      console.log(colorize(`     → ${r.fix}`, 'dim'));
    }
    console.log('');
  }

  if (medium.length > 0 && options.verbose) {
    console.log(colorize('  🔵 Recommended', 'blue'));
    for (const r of medium) {
      console.log(`     ${colorize(r.name, 'bold')}`);
      console.log(colorize(`     → ${r.fix}`, 'dim'));
    }
    console.log('');
  } else if (medium.length > 0) {
    console.log(colorize(`  🔵 ${medium.length} more recommendations (use --verbose)`, 'blue'));
    console.log('');
  }

  // Summary
  console.log(colorize('  ─────────────────────────────────────', 'dim'));
  console.log(`  ${colorize(`${passed.length}/${results.length}`, 'bold')} checks passing`);

  if (failed.length > 0) {
    console.log(`  Run ${colorize('npx claudex-setup setup', 'bold')} to fix automatically`);
  }

  console.log('');
  console.log(colorize('  Powered by CLAUDEX - 972 verified Claude Code techniques', 'dim'));
  console.log(colorize('  https://github.com/naorp/claudex-setup', 'dim'));
  console.log('');

  return { score, passed: passed.length, failed: failed.length, stacks };
}

module.exports = { audit };
