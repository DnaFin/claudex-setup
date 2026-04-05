const fs = require('fs');
const path = require('path');

async function scanOrg(dirs, platform = 'claude') {
  const { audit } = require('./audit');
  const targets = Array.isArray(dirs) ? dirs : [];
  const repos = [];

  for (const dir of targets) {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) {
      repos.push({
        name: path.basename(dir),
        dir: resolved,
        platform,
        score: null,
        passed: 0,
        total: 0,
        topAction: null,
        error: 'directory not found',
      });
      continue;
    }

    try {
      const result = await audit({ dir: resolved, platform, silent: true });
      repos.push({
        name: path.basename(resolved),
        dir: resolved,
        platform,
        score: result.score,
        passed: result.passed,
        total: result.checkCount,
        topAction: result.topNextActions?.[0]?.name || null,
        result,
      });
    } catch (error) {
      repos.push({
        name: path.basename(resolved),
        dir: resolved,
        platform,
        score: null,
        passed: 0,
        total: 0,
        topAction: null,
        error: error.message,
      });
    }
  }

  const validScores = repos.filter((item) => typeof item.score === 'number').map((item) => item.score);
  const averageScore = validScores.length > 0
    ? Math.round(validScores.reduce((sum, value) => sum + value, 0) / validScores.length)
    : 0;

  return {
    platform,
    repoCount: repos.length,
    averageScore,
    maxScore: validScores.length > 0 ? Math.max(...validScores) : 0,
    minScore: validScores.length > 0 ? Math.min(...validScores) : 0,
    repos,
  };
}

module.exports = {
  scanOrg,
};
