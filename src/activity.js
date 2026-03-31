const fs = require('fs');
const path = require('path');

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureArtifactDirs(dir) {
  const root = path.join(dir, '.claude', 'claudex-setup');
  const activityDir = path.join(root, 'activity');
  const rollbackDir = path.join(root, 'rollbacks');
  fs.mkdirSync(activityDir, { recursive: true });
  fs.mkdirSync(rollbackDir, { recursive: true });
  return { root, activityDir, rollbackDir };
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

module.exports = {
  ensureArtifactDirs,
  writeActivityArtifact,
  writeRollbackArtifact,
};
