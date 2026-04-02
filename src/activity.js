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

module.exports = {
  ensureArtifactDirs,
  writeActivityArtifact,
  writeRollbackArtifact,
  writeSnapshotArtifact,
};
