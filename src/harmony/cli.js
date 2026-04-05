/**
 * H9. Harmony CLI Commands
 *
 * Command handlers for harmony operations, to be called from bin/cli.js.
 * Each function returns a formatted output string (or prints to console).
 *
 * Zero external dependencies - imports from sibling harmony modules and parent platform modules.
 */

const path = require('path');
const { generateStrategicAdvice, PLATFORM_STRENGTHS } = require('./advisor');
const { startHarmonyWatch, buildHarmonyWatchPlan } = require('./watch');
const { saveHarmonyState, loadHarmonyState, getHarmonyHistory, recordPlatformScore } = require('./memory');
const { getHarmonyGovernanceSummary, formatHarmonyGovernanceReport } = require('./governance');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[36m',
  magenta: '\x1b[35m',
};
const c = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function resolveDir(options) {
  return path.resolve(options.dir || options.d || '.');
}

/**
 * Collect audit results from all detectable platforms.
 * This is a lightweight aggregation - each platform module is loaded lazily.
 */
function collectPlatformAudits(dir) {
  const results = [];

  // Try Claude audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'claude' });
    if (result) results.push({ platform: 'claude', ...result });
  } catch (_e) { /* platform not available */ }

  // Try Codex audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'codex' });
    if (result) results.push({ platform: 'codex', ...result });
  } catch (_e) { /* platform not available */ }

  // Try Gemini audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'gemini' });
    if (result) results.push({ platform: 'gemini', ...result });
  } catch (_e) { /* platform not available */ }

  // Try Copilot audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'copilot' });
    if (result) results.push({ platform: 'copilot', ...result });
  } catch (_e) { /* platform not available */ }

  // Try Cursor audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'cursor' });
    if (result) results.push({ platform: 'cursor', ...result });
  } catch (_e) { /* platform not available */ }

  // Try Windsurf audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'windsurf' });
    if (result) results.push({ platform: 'windsurf', ...result });
  } catch (_e) { /* platform not available */ }

  // Try Aider audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'aider' });
    if (result) results.push({ platform: 'aider', ...result });
  } catch (_e) { /* platform not available */ }

  // Try OpenCode audit
  try {
    const { audit } = require('../audit');
    const result = audit({ dir, silent: true, platform: 'opencode' });
    if (result) results.push({ platform: 'opencode', ...result });
  } catch (_e) { /* platform not available */ }

  return results;
}

// ─── Command: harmony audit ───────────────────────────────────────────────────

/**
 * Run a cross-platform audit and display per-platform scores.
 */
async function runHarmonyAudit(options) {
  const dir = resolveDir(options);
  const platformAudits = collectPlatformAudits(dir);

  if (options.json) {
    console.log(JSON.stringify({ dir, platforms: platformAudits }, null, 2));
    return { dir, platforms: platformAudits };
  }

  console.log('');
  console.log(c('  Harmony Cross-Platform Audit', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log(c(`  Directory: ${dir}`, 'dim'));
  console.log('');

  if (platformAudits.length === 0) {
    console.log(c('  No platform configurations detected.', 'yellow'));
    console.log(c('  Run "nerviq setup" to bootstrap a platform.', 'dim'));
    console.log('');
    return { dir, platforms: [] };
  }

  for (const audit of platformAudits) {
    const scoreColor = audit.score >= 70 ? 'green' : audit.score >= 40 ? 'yellow' : 'red';
    console.log(`  ${c(audit.platform.padEnd(12), 'bold')} ${c(`${audit.score}/100`, scoreColor)}  (${audit.passed || 0}/${(audit.passed || 0) + (audit.failed || 0)} checks)`);

    // Record score to memory
    try {
      recordPlatformScore(dir, audit.platform, audit.score, { passed: audit.passed, failed: audit.failed });
    } catch (_e) { /* memory write optional */ }
  }

  // Average score
  const avgScore = Math.round(platformAudits.reduce((sum, a) => sum + (a.score || 0), 0) / platformAudits.length);
  const avgColor = avgScore >= 70 ? 'green' : avgScore >= 40 ? 'yellow' : 'red';
  console.log('');
  console.log(`  ${c('Average:', 'bold')}      ${c(`${avgScore}/100`, avgColor)}`);
  console.log(`  ${c('Platforms:', 'bold')}    ${platformAudits.length}`);
  console.log('');

  return { dir, platforms: platformAudits, averageScore: avgScore };
}

// ─── Command: harmony sync ────────────────────────────────────────────────────

/**
 * Sync canonical model across platforms (detect drift and suggest fixes).
 */
async function runHarmonySync(options) {
  const dir = resolveDir(options);
  const platformAudits = collectPlatformAudits(dir);

  // Load or build canonical model from memory
  const state = loadHarmonyState(dir);
  const canonicalModel = state.canon || null;

  const advice = generateStrategicAdvice(canonicalModel, platformAudits);

  if (options.json) {
    console.log(JSON.stringify({ dir, sync: advice.crossPlatformActions }, null, 2));
    return advice.crossPlatformActions;
  }

  console.log('');
  console.log(c('  Harmony Sync', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log('');

  if (advice.crossPlatformActions.length === 0) {
    console.log(c('  All platforms are in sync. No actions needed.', 'green'));
    console.log('');
    return [];
  }

  for (const action of advice.crossPlatformActions) {
    const prioColor = action.priority === 'high' ? 'red' : action.priority === 'medium' ? 'yellow' : 'dim';
    console.log(`  ${c(`[${action.priority.toUpperCase()}]`, prioColor)} ${action.action}`);
    console.log(`    ${c('Affected:', 'dim')} ${action.affectedPlatforms.join(', ')}`);
    if (action.sourcePlatforms) {
      console.log(`    ${c('Source:', 'dim')} ${action.sourcePlatforms.join(', ')}`);
    }
    console.log('');
  }

  return advice.crossPlatformActions;
}

// ─── Command: harmony drift ──────────────────────────────────────────────────

/**
 * Detect and display drift between platforms.
 */
async function runHarmonyDrift(options) {
  const dir = resolveDir(options);
  const state = loadHarmonyState(dir);
  const history = getHarmonyHistory(dir, options.platform ? { platform: options.platform } : undefined);

  if (options.json) {
    console.log(JSON.stringify({ dir, drift: history.driftHistory }, null, 2));
    return history.driftHistory;
  }

  console.log('');
  console.log(c('  Harmony Drift History', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log('');

  const driftEntries = history.driftHistory;

  if (driftEntries.length === 0) {
    console.log(c('  No drift history recorded yet.', 'dim'));
    console.log(c('  Run "nerviq harmony audit" to start tracking.', 'dim'));
    console.log('');
    return [];
  }

  // Show recent drift entries (last 20)
  const recent = driftEntries.slice(-20);
  for (const entry of recent) {
    const driftColor = entry.driftScore > 20 ? 'red' : entry.driftScore > 10 ? 'yellow' : 'green';
    console.log(`  ${c(entry.timestamp || 'unknown', 'dim')} ${entry.platform.padEnd(12)} drift: ${c(String(entry.driftScore), driftColor)}`);
    if (entry.driftedFields && entry.driftedFields.length > 0) {
      console.log(`    ${c('Fields:', 'dim')} ${entry.driftedFields.join(', ')}`);
    }
  }
  console.log('');

  return driftEntries;
}

// ─── Command: harmony advise ──────────────────────────────────────────────────

/**
 * Generate and display strategic advice.
 */
async function runHarmonyAdvise(options) {
  const dir = resolveDir(options);
  const platformAudits = collectPlatformAudits(dir);
  const state = loadHarmonyState(dir);
  const canonicalModel = state.canon || null;

  const advice = generateStrategicAdvice(canonicalModel, platformAudits);

  if (options.json) {
    console.log(JSON.stringify(advice, null, 2));
    return advice;
  }

  console.log('');
  console.log(c('  Harmony Strategic Advisor', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log('');

  // Task routing
  console.log(c('  Task Routing Recommendations', 'bold'));
  console.log('');
  for (const route of advice.taskRouting) {
    const confColor = route.confidence === 'high' ? 'green' : route.confidence === 'medium' ? 'yellow' : 'dim';
    console.log(`  ${c(route.taskLabel.padEnd(22), 'bold')} → ${c(route.recommendedLabel, 'blue')} ${c(`[${route.confidence}]`, confColor)}`);
    console.log(`    ${c(route.reasoning, 'dim')}`);
    if (route.alternatives.length > 0) {
      const altLabels = route.alternatives.map(a => `${a.label} (${a.score})`).join(', ');
      console.log(`    ${c('Alternatives:', 'dim')} ${altLabels}`);
    }
    console.log('');
  }

  // Config recommendations
  if (advice.configRecommendations.length > 0) {
    console.log(c('  Configuration Recommendations', 'bold'));
    console.log('');
    for (const rec of advice.configRecommendations) {
      const impactColor = rec.impact === 'high' ? 'red' : rec.impact === 'medium' ? 'yellow' : 'dim';
      console.log(`  ${c(`[${rec.impact.toUpperCase()}]`, impactColor)} ${rec.platform}: ${rec.recommendation}`);
    }
    console.log('');
  }

  // Cross-platform actions
  if (advice.crossPlatformActions.length > 0) {
    console.log(c('  Cross-Platform Actions', 'bold'));
    console.log('');
    for (const action of advice.crossPlatformActions) {
      const prioColor = action.priority === 'high' ? 'red' : action.priority === 'medium' ? 'yellow' : 'dim';
      console.log(`  ${c(`[${action.priority.toUpperCase()}]`, prioColor)} ${action.action}`);
      console.log(`    ${c('Platforms:', 'dim')} ${action.affectedPlatforms.join(', ')}`);
    }
    console.log('');
  }

  return advice;
}

// ─── Command: harmony watch ───────────────────────────────────────────────────

/**
 * Start the harmony watch loop.
 */
async function runHarmonyWatch(options) {
  const dir = resolveDir(options);

  await startHarmonyWatch({
    dir,
    autoSync: !!options.autoSync,
    debounceMs: options.debounce || 800,
    onDriftDetected: (platform, details) => {
      console.log(c(`  DRIFT ALERT: ${platform} score dropped by ${Math.abs(details.delta)}`, 'red'));
    },
    onPlatformChange: (platform, file) => {
      // Logged by watch module itself
    },
    runAudit: options.noAudit ? null : async (auditDir) => {
      const audits = collectPlatformAudits(auditDir);
      const result = {};
      for (const audit of audits) {
        result[audit.platform] = audit;
      }
      return result;
    },
  });
}

// ─── Command: harmony governance ──────────────────────────────────────────────

/**
 * Display the cross-platform governance summary.
 */
async function runHarmonyGovernance(options) {
  const dir = resolveDir(options);
  const platformAudits = collectPlatformAudits(dir);
  const state = loadHarmonyState(dir);
  const canonicalModel = state.canon || null;

  const summary = getHarmonyGovernanceSummary(canonicalModel, platformAudits);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  const report = formatHarmonyGovernanceReport(summary, options);
  console.log(report);

  return summary;
}

module.exports = {
  runHarmonyAudit,
  runHarmonySync,
  runHarmonyDrift,
  runHarmonyAdvise,
  runHarmonyWatch,
  runHarmonyGovernance,
};
