/**
 * Interactive mode - guides users step-by-step through Claude Code setup.
 * Uses Node.js readline (zero dependencies).
 */

const readline = require('readline');
const { TECHNIQUES, STACKS } = require('./techniques');
const { ProjectContext } = require('./context');
const { setup } = require('./setup');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[36m', magenta: '\x1b[35m',
};
const c = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function interactive(options) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);

  console.log('');
  console.log(c('  ╔═══════════════════════════════════════╗', 'magenta'));
  console.log(c('  ║   nerviq interactive wizard    ║', 'magenta'));
  console.log(c('  ╚═══════════════════════════════════════╝', 'magenta'));
  console.log('');

  if (stacks.length > 0) {
    console.log(c(`  Detected stack: ${stacks.map(s => s.label).join(', ')}`, 'blue'));
  }
  console.log(c(`  Working directory: ${options.dir}`, 'dim'));
  console.log('');

  // Run audit silently
  const results = [];
  for (const [key, technique] of Object.entries(TECHNIQUES)) {
    results.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const failed = results.filter(r => r.passed === false);
  const passed = results.filter(r => r.passed === true);

  console.log(`  ${c(`${passed.length}/${results.length}`, 'bold')} checks already passing.`);
  console.log(`  ${c(String(failed.length), 'yellow')} improvements available.`);
  console.log('');

  if (failed.length === 0) {
    console.log(c('  Your project is fully optimized for Claude Code!', 'green'));
    rl.close();
    return;
  }

  // Group by priority
  const critical = failed.filter(r => r.impact === 'critical');
  const high = failed.filter(r => r.impact === 'high');
  const medium = failed.filter(r => r.impact === 'medium');
  const groups = [
    { label: 'Critical', color: 'red', items: critical },
    { label: 'High Impact', color: 'yellow', items: high },
    { label: 'Recommended', color: 'blue', items: medium },
  ].filter(g => g.items.length > 0);

  const toFix = [];

  for (const group of groups) {
    console.log(c(`  ── ${group.label} (${group.items.length}) ──`, group.color));
    console.log('');

    for (const item of group.items) {
      console.log(`  ${c(item.name, 'bold')}`);
      console.log(c(`  ${item.fix}`, 'dim'));
      const answer = await ask(rl, c('  Fix this? (y/n/q) ', 'magenta'));

      if (answer.toLowerCase() === 'q') {
        console.log('');
        console.log(c('  Stopping wizard.', 'dim'));
        break;
      }
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === '') {
        toFix.push(item.key);
        console.log(c('  → Will fix', 'green'));
      } else {
        console.log(c('  → Skipped', 'dim'));
      }
      console.log('');
    }
  }

  rl.close();

  if (toFix.length === 0) {
    console.log(c('  No changes selected.', 'dim'));
    return;
  }

  console.log('');
  console.log(c('  ── Summary ──', 'magenta'));
  console.log(`  Selected ${c(String(toFix.length), 'bold')} improvements to apply:`);
  for (const key of toFix) {
    const item = results.find(r => r.key === key);
    console.log(c(`    • ${item ? item.name : key}`, 'dim'));
  }
  console.log('');
  console.log(c(`  Applying...`, 'bold'));
  console.log('');

  // Run setup in auto mode
  await setup({ ...options, auto: true, only: toFix });

  console.log('');
  console.log(c('  Done! Run `npx nerviq` to see your new score.', 'green'));
}

module.exports = { interactive };
