const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureArtifactDirs(dir) {
  const root = path.join(dir, '.claude', 'claudex-setup');
  const activityDir = path.join(root, 'activity');
  const rollbackDir = path.join(root, 'rollbacks');
  const snapshotDir = path.join(root, 'snapshots');
  fs.mkdirSync(activityDir, { recursive: true });
  fs.mkdirSync(rollbackDir, { recursive: true });
  fs.mkdirSync(snapshotDir, { recursive: true });
  return { root, activityDir, rollbackDir, snapshotDir };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function writeActivityArtifact(dir, type, payload) {
  const id = timestampId();
  const { activityDir } = ensureArtifactDirs(dir);
  const filePath = path.join(activityDir, `${id}-${type}.json`);
  writeJson(filePath, {
    id,
    type,
    createdAt: new Date().toISOString(),
    ...payload,
  });
  return {
    id,
    filePath,
    relativePath: path.relative(dir, filePath),
  };
}

function writeRollbackArtifact(dir, payload) {
  const id = timestampId();
  const { rollbackDir } = ensureArtifactDirs(dir);
  const filePath = path.join(rollbackDir, `${id}.json`);
  writeJson(filePath, {
    id,
    createdAt: new Date().toISOString(),
    rollbackType: 'delete-created-files',
    ...payload,
  });
  return {
    id,
    filePath,
    relativePath: path.relative(dir, filePath),
  };
}

function summarizeSnapshot(snapshotKind, payload) {
  if (snapshotKind === 'audit') {
    return {
      score: payload.score,
      organicScore: payload.organicScore,
      passed: payload.passed,
      failed: payload.failed,
      checkCount: payload.checkCount,
      suggestedNextCommand: payload.suggestedNextCommand,
      topActionKeys: Array.isArray(payload.topNextActions)
        ? payload.topNextActions.slice(0, 3).map(item => item.key)
        : [],
    };
  }

  if (snapshotKind === 'augment' || snapshotKind === 'suggest-only') {
    return {
      score: payload.projectSummary?.score,
      organicScore: payload.projectSummary?.organicScore,
      maturity: payload.projectSummary?.maturity,
      domains: payload.projectSummary?.domains || [],
      topActionKeys: Array.isArray(payload.topNextActions)
        ? payload.topNextActions.slice(0, 3).map(item => item.key)
        : [],
    };
  }

  if (snapshotKind === 'benchmark') {
    return {
      beforeScore: payload.before?.score,
      afterScore: payload.after?.score,
      scoreDelta: payload.delta?.score,
      organicDelta: payload.delta?.organicScore,
      decisionGuidance: payload.executiveSummary?.decisionGuidance || null,
    };
  }

  if (snapshotKind === 'governance') {
    return {
      permissionProfiles: Array.isArray(payload.permissionProfiles) ? payload.permissionProfiles.length : 0,
      hooks: Array.isArray(payload.hookRegistry) ? payload.hookRegistry.length : 0,
      policyPacks: Array.isArray(payload.policyPacks) ? payload.policyPacks.length : 0,
      domainPacks: Array.isArray(payload.domainPacks) ? payload.domainPacks.length : 0,
      mcpPacks: Array.isArray(payload.mcpPacks) ? payload.mcpPacks.length : 0,
    };
  }

  return {};
}

function updateSnapshotIndex(snapshotDir, record) {
  const indexPath = path.join(snapshotDir, 'index.json');
  let entries = [];

  if (fs.existsSync(indexPath)) {
    try {
      entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      if (!Array.isArray(entries)) {
        entries = [];
      }
    } catch {
      entries = [];
    }
  }

  entries.push(record);
  fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf8');
}

function writeSnapshotArtifact(dir, snapshotKind, payload, meta = {}) {
  const id = timestampId();
  const { snapshotDir } = ensureArtifactDirs(dir);
  const filePath = path.join(snapshotDir, `${id}-${snapshotKind}.json`);
  const summary = summarizeSnapshot(snapshotKind, payload);
  const envelope = {
    schemaVersion: 1,
    artifactType: 'snapshot',
    snapshotKind,
    id,
    createdAt: new Date().toISOString(),
    generatedBy: `claudex-setup@${version}`,
    directory: dir,
    summary,
    ...meta,
    payload,
  };

  writeJson(filePath, envelope);

  const record = {
    id,
    snapshotKind,
    createdAt: envelope.createdAt,
    relativePath: path.relative(dir, filePath),
    summary,
  };
  updateSnapshotIndex(snapshotDir, record);

  return {
    id,
    filePath,
    relativePath: path.relative(dir, filePath),
    indexPath: path.relative(dir, path.join(snapshotDir, 'index.json')),
    summary,
  };
}

function readSnapshotIndex(dir) {
  const indexPath = path.join(dir, '.claude', 'claudex-setup', 'snapshots', 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  try {
    const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function getHistory(dir, limit = 20) {
  const entries = readSnapshotIndex(dir);
  return entries
    .filter(e => e.snapshotKind === 'audit')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function compareLatest(dir) {
  const audits = getHistory(dir, 2);
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

  for (const key of currKeys) {
    if (!prevKeys.has(key)) regressions.push(key);
  }
  for (const key of prevKeys) {
    if (!currKeys.has(key)) improvements.push(key);
  }

  return {
    current: { date: current.createdAt, score: current.summary?.score, passed: current.summary?.passed },
    previous: { date: previous.createdAt, score: previous.summary?.score, passed: previous.summary?.passed },
    delta,
    regressions,
    improvements,
    trend: delta.score > 0 ? 'improving' : delta.score < 0 ? 'regressing' : 'stable',
  };
}

function formatHistory(dir) {
  const history = getHistory(dir, 10);
  if (history.length === 0) return 'No snapshots found. Run `npx claudex-setup --snapshot` to save one.';

  const lines = ['Score history (most recent first):', ''];
  for (const entry of history) {
    const date = entry.createdAt?.split('T')[0] || 'unknown';
    const score = entry.summary?.score ?? '?';
    const passed = entry.summary?.passed ?? '?';
    const total = entry.summary?.checkCount ?? '?';
    lines.push(`  ${date}  ${score}/100  (${passed}/${total} passing)`);
  }

  const comparison = compareLatest(dir);
  if (comparison) {
    lines.push('');
    const sign = comparison.delta.score >= 0 ? '+' : '';
    lines.push(`  Trend: ${comparison.trend} (${sign}${comparison.delta.score} since previous)`);
    if (comparison.improvements.length > 0) {
      lines.push(`  Fixed: ${comparison.improvements.join(', ')}`);
    }
    if (comparison.regressions.length > 0) {
      lines.push(`  New gaps: ${comparison.regressions.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function exportTrendReport(dir) {
  const history = getHistory(dir, 50);
  if (history.length === 0) return null;

  const comparison = compareLatest(dir);
  const lines = [
    '# Claude Code Setup Trend Report',
    '',
    `**Project:** ${path.basename(dir)}`,
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    `**Snapshots:** ${history.length}`,
    '',
    '## Score History',
    '',
    '| Date | Score | Passed | Checks |',
    '|------|-------|--------|--------|',
  ];

  for (const entry of history) {
    const date = entry.createdAt?.split('T')[0] || '?';
    lines.push(`| ${date} | ${entry.summary?.score ?? '?'}/100 | ${entry.summary?.passed ?? '?'} | ${entry.summary?.checkCount ?? '?'} |`);
  }

  if (comparison) {
    lines.push('');
    lines.push('## Latest Comparison');
    lines.push('');
    lines.push(`- **Previous:** ${comparison.previous.score}/100 (${comparison.previous.date?.split('T')[0]})`);
    lines.push(`- **Current:** ${comparison.current.score}/100 (${comparison.current.date?.split('T')[0]})`);
    lines.push(`- **Delta:** ${comparison.delta.score >= 0 ? '+' : ''}${comparison.delta.score} points`);
    lines.push(`- **Trend:** ${comparison.trend}`);
    if (comparison.improvements.length > 0) lines.push(`- **Fixed:** ${comparison.improvements.join(', ')}`);
    if (comparison.regressions.length > 0) lines.push(`- **New gaps:** ${comparison.regressions.join(', ')}`);
  }

  lines.push('');
  lines.push(`---`);
  lines.push(`*Generated by claudex-setup v${version}*`);
  return lines.join('\n');
}

module.exports = {
  ensureArtifactDirs,
  writeActivityArtifact,
  writeRollbackArtifact,
  writeSnapshotArtifact,
  readSnapshotIndex,
  getHistory,
  compareLatest,
  formatHistory,
  exportTrendReport,
};
