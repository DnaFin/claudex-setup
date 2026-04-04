/**
 * Cursor Repeat-Usage Surfaces
 *
 * Adapts the shared activity/snapshot backend for Cursor platform.
 * Provides: history, compare, trend, feedback, insights.
 *
 * 6 repeat-usage surfaces filtered by platform='cursor':
 * 1. History — audit snapshot history
 * 2. Compare — latest vs previous snapshot
 * 3. Trend — score trend over time
 * 4. Feedback — recommendation outcome tracking
 * 5. Insights — pattern detection from history
 * 6. Surface tracking — per-surface (foreground/background/automations) progress
 */

const path = require('path');
const {
  readSnapshotIndex,
  recordRecommendationOutcome,
  readOutcomeIndex,
  summarizeOutcomeEntries,
} = require('../activity');
const { version } = require('../../package.json');

// --- History ---

function getCursorHistory(dir, limit = 20) {
  const entries = readSnapshotIndex(dir);
  return entries
    .filter(e => e.snapshotKind === 'audit' && (e.platform === 'cursor' || e.summary?.platform === 'cursor'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function formatCursorHistory(dir) {
  const history = getCursorHistory(dir, 10);
  if (history.length === 0) {
    return 'No Cursor snapshots found. Run `npx nerviq --platform cursor --snapshot` to save one.';
  }

  const lines = ['Cursor Score History (most recent first):', ''];
  for (const entry of history) {
    const date = entry.createdAt?.split('T')[0] || 'unknown';
    const score = entry.summary?.score ?? '?';
    const passed = entry.summary?.passed ?? '?';
    const total = entry.summary?.checkCount ?? '?';
    const surfaces = entry.summary?.surfaces || {};
    const surfaceStr = [
      surfaces.foreground ? 'FG' : null,
      surfaces.background ? 'BG' : null,
      surfaces.automations ? 'Auto' : null,
    ].filter(Boolean).join('+') || 'unknown';
    lines.push(`  ${date}  ${score}/100  (${passed}/${total} passing)  [${surfaceStr}]`);
  }

  const comparison = compareCursorLatest(dir);
  if (comparison) {
    lines.push('');
    const sign = comparison.delta.score >= 0 ? '+' : '';
    lines.push(`  Trend: ${comparison.trend} (${sign}${comparison.delta.score} since previous)`);
    if (comparison.improvements.length > 0) lines.push(`  Fixed: ${comparison.improvements.join(', ')}`);
    if (comparison.regressions.length > 0) lines.push(`  New gaps: ${comparison.regressions.join(', ')}`);
  }

  return lines.join('\n');
}

// --- Compare ---

function compareCursorLatest(dir) {
  const audits = getCursorHistory(dir, 2);
  if (audits.length < 2) return null;

  const current = audits[0];
  const previous = audits[1];

  const delta = {
    score: (current.summary?.score || 0) - (previous.summary?.score || 0),
    organic: (current.summary?.organicScore || 0) - (previous.summary?.organicScore || 0),
    passed: (current.summary?.passed || 0) - (previous.summary?.passed || 0),
  };

  const regressions = [];
  const improvements = [];
  const prevKeys = new Set(previous.summary?.topActionKeys || []);
  const currKeys = new Set(current.summary?.topActionKeys || []);

  for (const key of currKeys) { if (!prevKeys.has(key)) regressions.push(key); }
  for (const key of prevKeys) { if (!currKeys.has(key)) improvements.push(key); }

  return {
    platform: 'cursor',
    current: { date: current.createdAt, score: current.summary?.score, passed: current.summary?.passed },
    previous: { date: previous.createdAt, score: previous.summary?.score, passed: previous.summary?.passed },
    delta,
    regressions,
    improvements,
    trend: delta.score > 0 ? 'improving' : delta.score < 0 ? 'regressing' : 'stable',
  };
}

// --- Trend ---

function exportCursorTrendReport(dir) {
  const history = getCursorHistory(dir, 50);
  if (history.length === 0) return null;

  const comparison = compareCursorLatest(dir);
  const lines = [
    '# Cursor Setup Trend Report',
    '',
    `**Project:** ${path.basename(dir)}`,
    `**Platform:** Cursor AI`,
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    `**Snapshots:** ${history.length}`,
    '',
    '## Score History',
    '',
    '| Date | Score | Passed | Checks | Surfaces |',
    '|------|-------|--------|--------|----------|',
  ];

  for (const entry of history) {
    const date = entry.createdAt?.split('T')[0] || '?';
    const surfaces = entry.summary?.surfaces || {};
    const surfaceStr = [surfaces.foreground ? 'FG' : null, surfaces.background ? 'BG' : null, surfaces.automations ? 'Auto' : null].filter(Boolean).join('+') || '?';
    lines.push(`| ${date} | ${entry.summary?.score ?? '?'}/100 | ${entry.summary?.passed ?? '?'} | ${entry.summary?.checkCount ?? '?'} | ${surfaceStr} |`);
  }

  if (comparison) {
    lines.push('', '## Latest Comparison', '');
    lines.push(`- **Previous:** ${comparison.previous.score}/100 (${comparison.previous.date?.split('T')[0]})`);
    lines.push(`- **Current:** ${comparison.current.score}/100 (${comparison.current.date?.split('T')[0]})`);
    lines.push(`- **Delta:** ${comparison.delta.score >= 0 ? '+' : ''}${comparison.delta.score} points`);
    lines.push(`- **Trend:** ${comparison.trend}`);
    if (comparison.improvements.length > 0) lines.push(`- **Fixed:** ${comparison.improvements.join(', ')}`);
    if (comparison.regressions.length > 0) lines.push(`- **New gaps:** ${comparison.regressions.join(', ')}`);
  }

  if (history.length >= 3) {
    lines.push('', '## Trend Chart', '', '```');
    const scores = history.slice().reverse().map(e => e.summary?.score ?? 0);
    const max = Math.max(...scores, 100);
    const chartHeight = 10;
    for (let row = chartHeight; row >= 0; row--) {
      const threshold = (row / chartHeight) * max;
      const rowLabel = String(Math.round(threshold)).padStart(3);
      const bar = scores.map(s => s >= threshold ? '#' : ' ').join('');
      lines.push(`${rowLabel} |${bar}`);
    }
    lines.push(`    +${'─'.repeat(scores.length)}`);
    lines.push('```');
  }

  lines.push('', '---', `*Generated by nerviq v${version} for Cursor*`);
  return lines.join('\n');
}

// --- Feedback ---

function recordCursorFeedback(dir, payload) {
  return recordRecommendationOutcome(dir, {
    ...payload,
    source: payload.source || 'cursor',
    platform: 'cursor',
  });
}

function getCursorFeedbackSummary(dir) {
  const entries = readOutcomeIndex(dir)
    .filter(e => e.source === 'cursor' || e.platform === 'cursor');
  return summarizeOutcomeEntries(entries);
}

function formatCursorFeedback(dir) {
  const summary = getCursorFeedbackSummary(dir);
  if (!summary || Object.keys(summary).length === 0) {
    return 'No Cursor feedback recorded yet. Use `npx nerviq --platform cursor feedback` to rate recommendations.';
  }
  const lines = ['Cursor Recommendation Feedback:', ''];
  const entries = Array.isArray(summary) ? summary : Object.values(summary);
  for (const entry of entries) {
    lines.push(`  ${entry.key || 'unknown'}: ${entry.accepted || 0} accepted, ${entry.rejected || 0} rejected (${entry.total || 0} total)`);
  }
  return lines.join('\n');
}

// --- Insights ---

function generateCursorInsights(dir) {
  const history = getCursorHistory(dir, 50);
  const feedback = getCursorFeedbackSummary(dir);
  const insights = [];

  // Pattern 1: Persistent failures
  if (history.length >= 3) {
    const recentFailKeys = new Map();
    for (const entry of history.slice(0, 5)) {
      for (const key of (entry.summary?.topActionKeys || [])) {
        recentFailKeys.set(key, (recentFailKeys.get(key) || 0) + 1);
      }
    }
    for (const [key, count] of recentFailKeys) {
      if (count >= 3) {
        insights.push({ type: 'persistent-failure', severity: 'high', key, message: `Check ${key} has failed in ${count} of the last ${Math.min(history.length, 5)} audits.` });
      }
    }
  }

  // Pattern 2: Score regression
  if (history.length >= 2) {
    const scores = history.map(e => e.summary?.score ?? 0);
    if (scores[0] < scores[1]) {
      insights.push({ type: 'regression-pattern', severity: 'medium', message: `Score dropped from ${scores[1]} to ${scores[0]} in the most recent audit.`, delta: scores[0] - scores[1] });
    }
  }

  // Pattern 3: Velocity stall
  if (history.length >= 5) {
    const recentScores = history.slice(0, 5).map(e => e.summary?.score ?? 0);
    const range = Math.max(...recentScores) - Math.min(...recentScores);
    if (range <= 2) {
      insights.push({ type: 'velocity-stall', severity: 'low', message: `Score flat (range: ${range}) over last 5 audits.` });
    }
  }

  // Cursor-specific Pattern 4: Legacy .cursorrules persistence
  if (history.length >= 3) {
    const legacyKeys = [];
    for (const entry of history.slice(0, 5)) {
      for (const key of (entry.summary?.topActionKeys || [])) {
        if (key.includes('legacy') || key.includes('cursorrules') || key === 'cursorNoLegacyCursorrules') {
          legacyKeys.push(key);
        }
      }
    }
    if (legacyKeys.length >= 2) {
      insights.push({ type: 'legacy-migration-stall', severity: 'high', message: `Legacy .cursorrules migration check has persisted across ${legacyKeys.length} audits. Migrate to .cursor/rules/*.mdc.`, keys: [...new Set(legacyKeys)] });
    }
  }

  // Cursor-specific Pattern 5: MCP tool limit approaching
  if (history.length >= 2) {
    const latest = history[0];
    const mcpKeys = (latest.summary?.topActionKeys || []).filter(k => k.includes('mcp') || k.includes('tool'));
    if (mcpKeys.length >= 1) {
      insights.push({ type: 'mcp-tool-limit-risk', severity: 'medium', message: `MCP-related checks failing. Cursor has a hard ~40 tool limit that silently drops tools.`, keys: mcpKeys });
    }
  }

  // Cursor-specific Pattern 6: Privacy Mode gap
  if (history.length >= 2) {
    const latest = history[0];
    const privacyKeys = (latest.summary?.topActionKeys || []).filter(k => k.includes('privacy'));
    if (privacyKeys.length >= 1) {
      insights.push({ type: 'privacy-mode-gap', severity: 'high', message: `Privacy Mode check failing. Privacy Mode is OFF by default — code sent to providers.`, keys: privacyKeys });
    }
  }

  // Feedback signals
  const feedbackEntries = Array.isArray(feedback) ? feedback : Object.values(feedback || {});
  for (const entry of feedbackEntries) {
    if (entry.rejected > entry.accepted && entry.total >= 2) {
      insights.push({ type: 'feedback-signal', severity: 'medium', key: entry.key, message: `Recommendation ${entry.key} has been rejected more than accepted (${entry.rejected}/${entry.total}).` });
    }
  }

  return {
    platform: 'cursor',
    generatedAt: new Date().toISOString(),
    snapshotCount: history.length,
    feedbackCount: feedbackEntries.length,
    insights,
    summary: insights.length === 0
      ? 'No actionable insights detected. Keep running audits to build pattern data.'
      : `${insights.length} insight(s) detected across ${history.length} snapshots.`,
  };
}

function formatCursorInsights(dir) {
  const result = generateCursorInsights(dir);
  if (result.insights.length === 0) return result.summary;
  const lines = ['Cursor Insights:', ''];
  for (const insight of result.insights) {
    lines.push(`  [${insight.severity.toUpperCase()}] ${insight.message}`);
  }
  lines.push('', result.summary);
  return lines.join('\n');
}

module.exports = {
  getCursorHistory,
  formatCursorHistory,
  compareCursorLatest,
  exportCursorTrendReport,
  recordCursorFeedback,
  getCursorFeedbackSummary,
  formatCursorFeedback,
  generateCursorInsights,
  formatCursorInsights,
};
