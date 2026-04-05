/**
 * H7. Shared Memory / Knowledge Layer
 *
 * Cross-platform knowledge storage in .nerviq/harmony/ directory.
 * Persists canonical models, drift history, platform scores,
 * recommendation outcomes, and routing history.
 *
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');
const {
  resolveHarmonyStateReadPath,
  ensureHarmonyStateDir,
} = require('../state-paths');

const HARMONY_DIR = '.nerviq/harmony';

const STATE_FILES = {
  canon: 'canon.json',
  driftHistory: 'drift-history.json',
  platformScores: 'platform-scores.json',
  recommendationOutcomes: 'recommendation-outcomes.json',
  routingHistory: 'routing-history.json',
};

// ─── File I/O helpers ─────────────────────────────────────────────────────────

function ensureHarmonyDir(dir) {
  return ensureHarmonyStateDir(dir);
}

function readJsonSafe(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (_e) {
    return null;
  }
}

function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── State management ─────────────────────────────────────────────────────────

/**
 * Save the full harmony state to disk.
 *
 * @param {string} dir - Project root directory
 * @param {Object} state - State object with optional keys: canon, driftHistory, platformScores, recommendationOutcomes, routingHistory
 */
function saveHarmonyState(dir, state) {
  const harmonyPath = ensureHarmonyDir(dir);

  for (const [key, filename] of Object.entries(STATE_FILES)) {
    if (state[key] !== undefined) {
      const filePath = path.join(harmonyPath, filename);
      writeJsonAtomic(filePath, state[key]);
    }
  }

  // Write a combined manifest
  const manifest = {
    lastUpdated: new Date().toISOString(),
    files: Object.entries(STATE_FILES)
      .filter(([key]) => state[key] !== undefined)
      .map(([key, filename]) => ({ key, filename })),
  };
  writeJsonAtomic(path.join(harmonyPath, 'manifest.json'), manifest);
}

/**
 * Load the full harmony state from disk.
 *
 * @param {string} dir - Project root directory
 * @returns {Object} State object with all available keys populated
 */
function loadHarmonyState(dir) {
  const state = {};

  for (const [key, filename] of Object.entries(STATE_FILES)) {
    const filePath = resolveHarmonyStateReadPath(dir, filename);
    const data = readJsonSafe(filePath);
    if (data !== null) {
      state[key] = data;
    }
  }

  // Load manifest for metadata
  const manifest = readJsonSafe(resolveHarmonyStateReadPath(dir, 'manifest.json'));
  if (manifest) {
    state._manifest = manifest;
  }

  return state;
}

// ─── History helpers ──────────────────────────────────────────────────────────

/**
 * Get the full harmony history with optional filtering.
 *
 * @param {string} dir - Project root
 * @param {Object} [filter] - Optional filter: { platform, since, type }
 * @returns {Object} { driftHistory, platformScores, routingHistory, recommendationOutcomes }
 */
function getHarmonyHistory(dir, filter) {
  const state = loadHarmonyState(dir);

  const result = {
    driftHistory: state.driftHistory || [],
    platformScores: state.platformScores || [],
    routingHistory: state.routingHistory || [],
    recommendationOutcomes: state.recommendationOutcomes || [],
  };

  if (!filter) return result;

  const { platform, since, type } = filter;

  const matchesFilter = (entry) => {
    if (platform && entry.platform !== platform) return false;
    if (since && entry.timestamp && entry.timestamp < since) return false;
    if (type && entry.type !== type) return false;
    return true;
  };

  if (platform || since || type) {
    result.driftHistory = result.driftHistory.filter(matchesFilter);
    result.platformScores = result.platformScores.filter(matchesFilter);
    result.routingHistory = result.routingHistory.filter(matchesFilter);
    result.recommendationOutcomes = result.recommendationOutcomes.filter(matchesFilter);
  }

  return result;
}

// ─── Append helpers (for incremental state updates) ───────────────────────────

function appendToArray(dir, stateKey, entry) {
  const state = loadHarmonyState(dir);
  const arr = Array.isArray(state[stateKey]) ? state[stateKey] : [];
  arr.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  saveHarmonyState(dir, { ...state, [stateKey]: arr });
}

/**
 * Record a routing outcome (which platform was used for what, and how it went).
 *
 * @param {string} dir - Project root
 * @param {Object} outcome
 * @param {string} outcome.taskType - e.g. 'bug-fix', 'ci-review'
 * @param {string} outcome.platform - e.g. 'claude', 'codex'
 * @param {string} outcome.result - 'success' | 'partial' | 'failure'
 * @param {string} [outcome.notes] - Free-form notes
 */
function recordRoutingOutcome(dir, outcome) {
  appendToArray(dir, 'routingHistory', {
    type: 'routing',
    taskType: outcome.taskType,
    platform: outcome.platform,
    result: outcome.result,
    notes: outcome.notes || '',
  });
}

/**
 * Record a drift measurement.
 *
 * @param {string} dir - Project root
 * @param {Object} drift
 * @param {string} drift.platform - Platform that drifted
 * @param {number} drift.driftScore - Measured drift value
 * @param {Array} [drift.driftedFields] - Which fields drifted
 */
function recordDrift(dir, drift) {
  appendToArray(dir, 'driftHistory', {
    type: 'drift',
    platform: drift.platform,
    driftScore: drift.driftScore,
    driftedFields: drift.driftedFields || [],
  });
}

/**
 * Record a platform audit score snapshot.
 *
 * @param {string} dir - Project root
 * @param {string} platform - Platform key
 * @param {number} score - Audit score
 * @param {Object} [details] - Additional audit details
 */
function recordPlatformScore(dir, platform, score, details) {
  appendToArray(dir, 'platformScores', {
    type: 'score',
    platform,
    score,
    details: details || {},
  });
}

/**
 * Record a recommendation outcome.
 *
 * @param {string} dir - Project root
 * @param {Object} outcome
 * @param {string} outcome.recommendation - The recommendation text
 * @param {string} outcome.platform - Target platform
 * @param {string} outcome.result - 'accepted' | 'rejected' | 'deferred'
 * @param {string} [outcome.reason] - Why the outcome was chosen
 */
function recordRecommendationOutcome(dir, outcome) {
  appendToArray(dir, 'recommendationOutcomes', {
    type: 'recommendation',
    recommendation: outcome.recommendation,
    platform: outcome.platform,
    result: outcome.result,
    reason: outcome.reason || '',
  });
}

module.exports = {
  saveHarmonyState,
  loadHarmonyState,
  getHarmonyHistory,
  recordRoutingOutcome,
  recordDrift,
  recordPlatformScore,
  recordRecommendationOutcome,
  HARMONY_DIR,
  STATE_FILES,
};
