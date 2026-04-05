const path = require('path');

function loadCore() {
  try {
    return require('@nerviq/cli');
  } catch {
    return require('..');
  }
}

function resolveDir(dir) {
  return path.resolve(dir || '.');
}

async function audit(dir, platform = 'claude') {
  const core = loadCore();
  return core.audit({
    dir: resolveDir(dir),
    platform,
    silent: true,
  });
}

async function harmonyAudit(dir) {
  const core = loadCore();
  return core.harmonyAudit({
    dir: resolveDir(dir),
    silent: true,
  });
}

async function synergyReport(dir) {
  const core = loadCore();
  return core.synergyReport(resolveDir(dir));
}

function detectPlatforms(dir) {
  const core = loadCore();
  return core.detectPlatforms(resolveDir(dir));
}

function getCatalog() {
  const core = loadCore();
  return core.getCatalog();
}

function routeTask(description, platforms) {
  const core = loadCore();
  return core.routeTask(description, platforms || []);
}

module.exports = {
  audit,
  harmonyAudit,
  synergyReport,
  detectPlatforms,
  getCatalog,
  routeTask,
};
