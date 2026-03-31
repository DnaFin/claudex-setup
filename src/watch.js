/**
 * Watch mode - monitors project for Claude Code config changes and re-audits.
 * Uses Node.js fs.watch (zero dependencies).
 */

const fs = require('fs');
const path = require('path');
const { audit } = require('./audit');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[36m',
};
const c = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

const WATCH_PATHS = [
  'CLAUDE.md',
  '.claude',
  '.gitignore',
  'package.json',
  'tsconfig.json',
  '.github',
];

async function watch(options) {
  console.log('');
  console.log(c('  claudex-setup watch mode', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log(c(`  Watching: ${options.dir}`, 'dim'));
  console.log(c('  Press Ctrl+C to stop', 'dim'));
  console.log('');

  // Initial audit
  let lastScore = null;
  try {
    const result = await audit({ ...options, silent: true });
    lastScore = result.score;
    console.log(`  ${c('Initial score:', 'bold')} ${scoreColor(result.score)}`);
    console.log(`  ${result.passed} / ${result.passed + result.failed} checks passing`);
    console.log('');
  } catch (e) {
    console.log(c(`  Initial audit failed: ${e.message}`, 'dim'));
  }

  // Watch relevant paths
  const watchers = [];
  let debounceTimer = null;

  for (const watchPath of WATCH_PATHS) {
    const fullPath = path.join(options.dir, watchPath);
    try {
      const watcher = fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
        // Debounce: wait 500ms after last change
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const timestamp = new Date().toLocaleTimeString();
          console.log(c(`  [${timestamp}] Change detected: ${filename || watchPath}`, 'dim'));

          try {
            const result = await audit({ ...options, silent: true });
            const delta = lastScore !== null ? result.score - lastScore : 0;
            const arrow = delta > 0 ? c(`+${delta}`, 'green') : delta < 0 ? c(String(delta), 'yellow') : '';

            console.log(`  Score: ${scoreColor(result.score)} ${arrow}  (${result.passed}/${result.passed + result.failed} passing)`);

            if (result.score > lastScore) {
              console.log(c('  Nice improvement!', 'green'));
            } else if (result.score < lastScore) {
              console.log(c('  Score dropped - check what changed.', 'yellow'));
            }
            lastScore = result.score;
            console.log('');
          } catch (e) {
            // Ignore transient errors during file saves
          }
        }, 500);
      });
      watchers.push(watcher);
    } catch (e) {
      // Path doesn't exist yet - that's fine
    }
  }

  if (watchers.length === 0) {
    console.log(c('  No watchable paths found. Create CLAUDE.md or .claude/ to start.', 'yellow'));
    return;
  }

  console.log(c(`  Watching ${watchers.length} paths for changes...`, 'dim'));
  console.log('');

  // Keep alive
  await new Promise(() => {});
}

function scoreColor(score) {
  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'dim';
  return c(`${score}/100`, color);
}

module.exports = { watch };
