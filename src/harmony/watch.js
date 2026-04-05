/**
 * H6. Harmony Watch - Continuous Adaptation Loop
 *
 * Monitors repo for changes across ALL platform config files and triggers
 * cross-platform drift detection when changes occur.
 *
 * Extends the watch pattern from src/watch.js to cover all supported platforms.
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[36m', red: '\x1b[31m',
};
const c = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

// ─── Platform config file paths to watch ──────────────────────────────────────

const PLATFORM_WATCH_FILES = [
  // Claude
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/settings.local.json',
  // Codex
  'AGENTS.md',
  'codex.toml',
  '.codex/config.toml',
  // Gemini
  'GEMINI.md',
  '.gemini/settings.json',
  // Copilot
  '.github/copilot-instructions.md',
  '.github/copilot-review-instructions.md',
  // Cursor
  '.cursorrules',
  // Windsurf
  '.windsurfrules',
  // Aider
  '.aider.conf.yml',
  '.aiderignore',
  // OpenCode
  'opencode.json',
  // Shared
  '.gitignore',
  'package.json',
  'tsconfig.json',
];

const PLATFORM_WATCH_DIRS = [
  '.claude',
  '.claude/commands',
  '.claude/rules',
  '.claude/agents',
  '.claude/skills',
  '.codex',
  '.gemini',
  '.github',
  '.cursor',
  '.cursor/rules',
  '.windsurf',
  '.windsurf/rules',
  '.opencode',
];

// ─── fs.watch helpers (mirror pattern from src/watch.js) ──────────────────────

function supportsNativeRecursiveWatch(platform) {
  return (platform || process.platform) === 'win32' || (platform || process.platform) === 'darwin';
}

function statIfExists(fullPath) {
  try {
    return fs.statSync(fullPath);
  } catch (_e) {
    return null;
  }
}

function listRecursiveDirectories(dir) {
  const directories = [dir];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return directories;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      directories.push(...listRecursiveDirectories(path.join(dir, entry.name)));
    }
  }
  return directories;
}

/**
 * Build a watch plan that covers all platform config files and directories.
 */
function buildHarmonyWatchPlan(rootDir, platform) {
  const plan = [];
  const seen = new Set();
  const recursiveSupported = supportsNativeRecursiveWatch(platform);

  const addTarget = (fullPath, recursive, source) => {
    const resolved = path.resolve(fullPath);
    const key = `${resolved}|${recursive}`;
    if (seen.has(key)) return;
    seen.add(key);
    plan.push({ path: resolved, recursive, source });
  };

  // Watch repo root for top-level file creations
  addTarget(rootDir, false, 'repo-root');

  // Watch individual platform config files
  for (const watchPath of PLATFORM_WATCH_FILES) {
    const fullPath = path.join(rootDir, watchPath);
    const stat = statIfExists(fullPath);
    if (stat && stat.isFile()) {
      addTarget(fullPath, false, watchPath);
    }
  }

  // Watch platform config directories
  for (const watchPath of PLATFORM_WATCH_DIRS) {
    const fullPath = path.join(rootDir, watchPath);
    const stat = statIfExists(fullPath);
    if (!stat || !stat.isDirectory()) continue;

    if (recursiveSupported) {
      addTarget(fullPath, true, watchPath);
    } else {
      for (const dir of listRecursiveDirectories(fullPath)) {
        addTarget(dir, false, watchPath);
      }
    }
  }

  return plan;
}

// ─── Watcher registration ─────────────────────────────────────────────────────

function registerWatchers(rootDir, watchers, onChange, platform) {
  const plan = buildHarmonyWatchPlan(rootDir, platform);

  for (const item of plan) {
    const key = `${item.path}|${item.recursive}`;
    if (watchers.has(key)) continue;

    try {
      const watcher = fs.watch(item.path, { recursive: item.recursive }, (eventType, filename) => {
        onChange(item, eventType, filename);
      });
      watchers.set(key, watcher);
    } catch (_e) {
      // Ignore unsupported or transient watch registration failures
    }
  }

  return watchers.size;
}

function closeWatchers(watchers) {
  for (const watcher of watchers.values()) {
    try {
      watcher.close();
    } catch (_e) {
      // Ignore close errors during shutdown
    }
  }
  watchers.clear();
}

/**
 * Identify which platform a changed file belongs to.
 */
function identifyPlatform(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('.claude') || normalized.includes('claude.md')) return 'claude';
  if (normalized.includes('.codex') || normalized.includes('agents.md') || normalized.includes('codex.toml')) return 'codex';
  if (normalized.includes('.gemini') || normalized.includes('gemini.md')) return 'gemini';
  if (normalized.includes('copilot') || normalized.includes('.github')) return 'copilot';
  if (normalized.includes('.cursor') || normalized.includes('cursorrules')) return 'cursor';
  if (normalized.includes('.windsurf') || normalized.includes('windsurfrules')) return 'windsurf';
  if (normalized.includes('.aider') || normalized.includes('aiderignore')) return 'aider';
  if (normalized.includes('.opencode') || normalized.includes('opencode.json')) return 'opencode';
  return 'unknown';
}

// ─── Main watch loop ──────────────────────────────────────────────────────────

/**
 * Start the harmony watch loop.
 *
 * @param {Object} options
 * @param {string} options.dir - Root directory to watch
 * @param {Function} [options.onDriftDetected] - Callback when drift increases: (platform, details) => void
 * @param {Function} [options.onPlatformChange] - Callback on any platform config change: (platform, file) => void
 * @param {Function} [options.runAudit] - Optional audit function to re-run on changes
 * @param {boolean} [options.autoSync=false] - Auto-apply harmony sync when drift is detected
 * @param {number} [options.debounceMs=800] - Debounce interval in ms
 */
async function startHarmonyWatch(options) {
  const {
    dir,
    onDriftDetected,
    onPlatformChange,
    runAudit,
    autoSync = false,
    debounceMs = 800,
  } = options;

  const recursiveSupported = supportsNativeRecursiveWatch();

  console.log('');
  console.log(c('  nerviq harmony watch', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log(c(`  Watching: ${dir}`, 'dim'));
  console.log(c(`  Platforms: Claude, Codex, Gemini, Copilot, Cursor, Windsurf, Aider, OpenCode`, 'dim'));
  if (autoSync) {
    console.log(c(`  Auto-sync: ON — drift will be auto-corrected`, 'green'));
  }
  console.log(c(`  Mode: ${recursiveSupported ? 'native recursive' : 'expanded directory fallback'}`, 'dim'));
  console.log(c('  Press Ctrl+C to stop', 'dim'));
  console.log('');

  // Initial audit if provided
  let lastScores = {};
  if (runAudit) {
    try {
      const results = await runAudit(dir);
      if (results && typeof results === 'object') {
        for (const [platform, result] of Object.entries(results)) {
          lastScores[platform] = result.score || 0;
        }
      }
      console.log(c('  Initial scores:', 'bold'));
      for (const [platform, score] of Object.entries(lastScores)) {
        console.log(`    ${platform}: ${scoreColor(score)}`);
      }
      console.log('');
    } catch (e) {
      console.log(c(`  Initial audit skipped: ${e.message}`, 'dim'));
    }
  }

  const watchers = new Map();
  let debounceTimer = null;
  let shuttingDown = false;

  const cleanupAndExit = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(debounceTimer);
    closeWatchers(watchers);
    console.log('');
    console.log(c('  Harmony watch stopped.', 'dim'));
    process.exit(0);
  };

  const handleChange = (item, _eventType, filename) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const changedLabel = filename
        ? String(filename)
        : path.relative(dir, item.path) || path.basename(item.path);

      const platform = identifyPlatform(changedLabel);
      const timestamp = new Date().toLocaleTimeString();

      console.log(c(`  [${timestamp}] Change: ${changedLabel} (${platform})`, 'dim'));

      // Notify callback
      if (onPlatformChange) {
        try {
          onPlatformChange(platform, changedLabel);
        } catch (_e) {
          // Ignore callback errors
        }
      }

      // Re-register to pick up new dirs/files
      registerWatchers(dir, watchers, handleChange);

      // Re-audit if possible
      if (runAudit) {
        try {
          const results = await runAudit(dir);
          if (results && typeof results === 'object') {
            for (const [p, result] of Object.entries(results)) {
              const newScore = result.score || 0;
              const oldScore = lastScores[p] || 0;
              const delta = newScore - oldScore;

              if (delta !== 0) {
                const arrow = delta > 0
                  ? c(`+${delta}`, 'green')
                  : c(String(delta), 'yellow');
                console.log(`    ${p}: ${scoreColor(newScore)} ${arrow}`);
              }

              // Drift detection
              if (delta < 0 && onDriftDetected) {
                try {
                  onDriftDetected(p, { oldScore, newScore, delta, changedFile: changedLabel });
                } catch (_e) {
                  // Ignore callback errors
                }
              }

              // Auto-sync on drift
              if (delta < 0 && autoSync) {
                try {
                  const { applyHarmonySync } = require('./sync');
                  const syncResult = applyHarmonySync(dir);
                  if (syncResult.applied.length > 0) {
                    console.log(c(`    Auto-sync: applied ${syncResult.applied.length} fix(es)`, 'green'));
                    for (const item of syncResult.applied) {
                      console.log(c(`      ✓ ${item.action} ${item.path}`, 'dim'));
                    }
                  }
                } catch (_e) {
                  console.log(c(`    Auto-sync failed: ${_e.message}`, 'yellow'));
                }
              }

              lastScores[p] = newScore;
            }
          }
        } catch (_e) {
          // Ignore transient errors during file saves
        }
      }

      console.log('');
    }, debounceMs);
  };

  registerWatchers(dir, watchers, handleChange);

  if (watchers.size === 0) {
    console.log(c('  Could not register any filesystem watchers.', 'yellow'));
    return { watchers, close: () => {} };
  }

  process.once('SIGINT', cleanupAndExit);
  process.once('SIGTERM', cleanupAndExit);

  console.log(c(`  Watching ${watchers.size} targets for changes...`, 'dim'));
  console.log('');

  // Keep alive
  await new Promise(() => {});
}

function scoreColor(score) {
  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'dim';
  return c(`${score}/100`, color);
}

module.exports = {
  startHarmonyWatch,
  buildHarmonyWatchPlan,
  PLATFORM_WATCH_FILES,
  PLATFORM_WATCH_DIRS,
  identifyPlatform,
};
