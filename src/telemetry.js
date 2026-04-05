/**
 * Nerviq Opt-In Telemetry Foundation
 *
 * Collects anonymous usage events ONLY when NERVIQ_TELEMETRY=1 is set.
 * No PII, no file contents, no absolute paths are ever stored.
 * Events are stored locally in <projectDir>/.nerviq/telemetry.json.
 *
 * This module is the foundation layer — actual transmission to a dashboard
 * is an explicit opt-in step configured separately.
 *
 * Privacy guarantees:
 *   - No usernames, emails, or identifiers
 *   - No file contents or code
 *   - No absolute paths (only hashed project fingerprint)
 *   - Stored only on local disk
 *   - Never sent anywhere without additional explicit configuration
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TELEMETRY_FILE = path.join(os.homedir(), '.nerviq', 'telemetry.json');
const MAX_EVENTS = 500; // cap file size at ~500 events

// ─── Opt-in check ─────────────────────────────────────────────────────────────

/**
 * Returns true only when the user has explicitly set NERVIQ_TELEMETRY=1.
 * Telemetry is opt-IN, not opt-out.
 * @returns {boolean}
 */
function shouldCollectTelemetry() {
  return process.env.NERVIQ_TELEMETRY === '1';
}

// ─── Anonymous fingerprinting ─────────────────────────────────────────────────

/**
 * Creates a one-way hash of the project directory.
 * This allows grouping events by project without exposing the path.
 * @param {string} dir
 * @returns {string} 8-char hex fingerprint
 */
function hashProject(dir) {
  try {
    return crypto.createHash('sha256').update(dir).digest('hex').slice(0, 8);
  } catch {
    return 'unknown';
  }
}

// ─── Event collection ────────────────────────────────────────────────────────

/**
 * Collect an anonymous usage event and append it to the local telemetry file.
 * Does nothing unless shouldCollectTelemetry() returns true.
 *
 * @param {string} event - Event name (e.g. 'audit', 'setup', 'convert')
 * @param {object} [data] - Additional anonymous data
 * @param {string} [data.platform] - Platform name (claude, codex, etc.)
 * @param {number} [data.score] - Audit score
 * @param {number} [data.checkCount] - Total checks evaluated
 * @param {number} [data.durationMs] - Execution time in ms
 * @param {string} [data.dir] - Project dir (hashed before storage)
 * @returns {object|null} The recorded event object, or null if telemetry is off
 */
function collectAnonymousEvent(event, data = {}) {
  if (!shouldCollectTelemetry()) return null;

  const record = {
    event: String(event),
    platform: data.platform || null,
    score: typeof data.score === 'number' ? data.score : null,
    checkCount: typeof data.checkCount === 'number' ? data.checkCount : null,
    durationMs: typeof data.durationMs === 'number' ? Math.round(data.durationMs) : null,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    os: `${os.platform()}-${os.arch()}`,
    projectFingerprint: data.dir ? hashProject(data.dir) : null,
    // Explicitly omit: paths, file contents, usernames, email, tokens
  };

  try {
    const telemetryDir = path.dirname(TELEMETRY_FILE);
    fs.mkdirSync(telemetryDir, { recursive: true });

    let events = [];
    if (fs.existsSync(TELEMETRY_FILE)) {
      try {
        const raw = fs.readFileSync(TELEMETRY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        events = Array.isArray(parsed.events) ? parsed.events : [];
      } catch {
        events = [];
      }
    }

    events.push(record);

    // Cap at MAX_EVENTS to prevent unbounded growth
    if (events.length > MAX_EVENTS) {
      events = events.slice(events.length - MAX_EVENTS);
    }

    const payload = {
      version: 1,
      telemetryOptIn: true,
      note: 'Local telemetry only. Set NERVIQ_TELEMETRY=0 or unset to disable.',
      events,
    };

    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // Telemetry failures are always silent — never block main flow
  }

  return record;
}

// ─── Read local telemetry ─────────────────────────────────────────────────────

/**
 * Read the local telemetry file.
 * @returns {{ version: number, events: object[] } | null}
 */
function readLocalTelemetry() {
  try {
    if (!fs.existsSync(TELEMETRY_FILE)) return null;
    return JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Clear all local telemetry events.
 * @returns {boolean} true if cleared successfully
 */
function clearLocalTelemetry() {
  try {
    if (fs.existsSync(TELEMETRY_FILE)) {
      fs.writeFileSync(TELEMETRY_FILE, JSON.stringify({ version: 1, events: [] }, null, 2), 'utf8');
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  shouldCollectTelemetry,
  collectAnonymousEvent,
  readLocalTelemetry,
  clearLocalTelemetry,
  TELEMETRY_FILE,
};
