/**
 * Windsurf Repeat-Usage Surfaces
 *
 * Adapts the shared activity/snapshot backend for Windsurf platform.
 * Provides: history, compare, trend, feedback, insights.
 *
 * 6 repeat-usage surfaces filtered by platform='windsurf':
 * 1. History — audit snapshot history
 * 2. Compare — latest vs previous snapshot
 * 3. Trend — score trend over time
 * 4. Feedback — recommendation outcome tracking
 * 5. Insights — pattern detection from history
 * 6. Surface tracking — per-surface (rules/workflows/memories) progress
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

function getWindsurfHistory(dir, limit = 20) {
  const entries = readSnapshotIndex(dir);
  return entries
    .filter(e => e.snapshotKind === 'audit' && (e.platform === 'windsurf' || e.summary?.platform === 'windsurf'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function formatWindsurfHistory(dir) {
  const history = getWindsurfHistory(dir, 10);
  if (history.length === 0) {
    return 'No Windsurf snapshots found. Run `npx nerviq --platform windsurf --snapshot` to save one.';
  }

  const lines = ['Windsurf Score History (most recent first):', ''];
  for (const entry of history) {
    const date = entry.createdAt?.split('T')[0] || 'unknown';
    const score = entry.summary?.score ?? '?';
    const passed = entry.summary?.passed ?? '?';
    const total = entry.summary?.checkCount ?? '?';
    const surfaces = entry.summary?.surfaces || {};
    const surfaceStr = [
      surfaces.foreground ? 'FG' : null,
      surfaces.workflows ? 'WF' : null,
      surfaces.memories ? 'Mem' : null,
      surfaces.cascadeignore ? 'CI' : null,
    ].filter(Boolean).join('+') || 'unknown';
    lines.push(`  ${date}  ${score}/100  (${passed}/${total} passing)  [${surfaceStr}]`);
  }

  const comparison = compareWindsurfLatest(dir);
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

function compareWindsurfLatest(dir) {
  const audits = getWindsurfHistory(dir, 2);
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
    platform: 'windsurf',
    current: { date: current.createdAt, score: current.summary?.score, passed: current.summary?.passed },
    previous: { date: previous.createdAt, score: previous.summary?.score, passed: previous.summary?.passed },
    delta,
    regressions,
    improvements,
    trend: delta.score > 0 ? 'improving' : delta.score < 0 ? 'regressing' : 'stable',
  };
}

// --- Trend ---

function exportWindsurfTrendReport(dir) {
  const history = getWindsurfHistory(dir, 50);
  if (history.length === 0) return null;

  const comparison = compareWindsurfLatest(dir);
  const lines = [
    '# Windsurf Setup Trend Report',
    '',
    `**Project:** ${path.basename(dir)}`,
    `**Platform:** Windsurf (Cascade)`,
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
    const surfaceStr = [surfaces.foreground ? 'FG' : null, surfaces.workflows ? 'WF' : null, surfaces.memories ? 'Mem' : null].filter(Boolean).join('+') || '?';
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

  lines.push('', '---', `*Generated by nerviq v${version} for Windsurf*`);
  return lines.join('\n');
}

// --- Feedback ---

function recordWindsurfFeedback(dir, payload) {
  return recordRecommendationOutcome(dir, {
    ...payload,
    source: payload.source || 'windsurf',
    platform: 'windsurf',
  });
}

function getWindsurfFeedbackSummary(dir) {
  const entries = readOutcomeIndex(dir)
    .filter(e => e.source === 'windsurf' || e.platform === 'windsurf');
  return summarizeOutcomeEntries(entries);
}

function formatWindsurfFeedback(dir) {
  const summary = getWindsurfFeedbackSummary(dir);
  if (!summary || Object.keys(summary).length === 0) {
    return 'No Windsurf feedback recorded yet. Use `npx nerviq --platform windsurf feedback` to rate recommendations.';
  }
  const lines = ['Windsurf Recommendation Feedback:', ''];
  const entries = Array.isArray(summary) ? summary : Object.values(summary);
  for (const entry of entries) {
    lines.push(`  ${entry.key || 'unknown'}: ${entry.accepted || 0} accepted, ${entry.rejected || 0} rejected (${entry.total || 0} total)`);
  }
  return lines.join('\n');
}

// --- Insights ---

function generateWindsurfInsights(dir) {
  const history = getWindsurfHistory(dir, 50);
  const feedback = getWindsurfFeedbackSummary(dir);
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

  // Windsurf-specific Pattern 4: Legacy .windsurfrules persistence
  if (history.length >= 3) {
    const legacyKeys = [];
    for (const entry of history.slice(0, 5)) {
      for (const key of (entry.summary?.topActionKeys || [])) {
        if (key.includes('legacy') || key.includes('windsurfrules') || key === 'windsurfNoLegacyWindsurfrules') {
          legacyKeys.push(key);
        }
      }
    }
    if (legacyKeys.length >= 2) {
      insights.push({ type: 'legacy-migration-stall', severity: 'high', message: `Legacy .windsurfrules migration check has persisted across ${legacyKeys.length} audits. Migrate to .windsurf/rules/*.md.`, keys: [...new Set(legacyKeys)] });
    }
  }

  // Windsurf-specific Pattern 5: Memories secrets risk
  if (history.length >= 2) {
    const latest = history[0];
    const memoryKeys = (latest.summary?.topActionKeys || []).filter(k => k.includes('memor'));
    if (memoryKeys.length >= 1) {
      insights.push({ type: 'memories-secrets-risk', severity: 'high', message: `Memory-related checks failing. Memories sync across team — check for secrets/PII.`, keys: memoryKeys });
    }
  }

  // Windsurf-specific Pattern 6: Missing cascadeignore
  if (history.length >= 2) {
    const latest = history[0];
    const cascadeKeys = (latest.summary?.topActionKeys || []).filter(k => k.includes('cascade') || k.includes('ignore'));
    if (cascadeKeys.length >= 1) {
      insights.push({ type: 'cascadeignore-gap', severity: 'medium', message: `Cascadeignore checks failing. Use .cascadeignore to protect sensitive files.`, keys: cascadeKeys });
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
    platform: 'windsurf',
    generatedAt: new Date().toISOString(),
    snapshotCount: history.length,
    feedbackCount: feedbackEntries.length,
    insights,
    summary: insights.length === 0
      ? 'No actionable insights detected. Keep running audits to build pattern data.'
      : `${insights.length} insight(s) detected across ${history.length} snapshots.`,
  };
}

function formatWindsurfInsights(dir) {
  const result = generateWindsurfInsights(dir);
  if (result.insights.length === 0) return result.summary;
  const lines = ['Windsurf Insights:', ''];
  for (const insight of result.insights) {
    lines.push(`  [${insight.severity.toUpperCase()}] ${insight.message}`);
  }
  lines.push('', result.summary);
  return lines.join('\n');
}

module.exports = {
  getWindsurfHistory,
  formatWindsurfHistory,
  compareWindsurfLatest,
  exportWindsurfTrendReport,
  recordWindsurfFeedback,
  getWindsurfFeedbackSummary,
  formatWindsurfFeedback,
  generateWindsurfInsights,
  formatWindsurfInsights,
};
