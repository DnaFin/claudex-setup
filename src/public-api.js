const fs = require('fs');
const path = require('path');
const { audit } = require('./audit');
const { harmonyAudit } = require('./harmony/audit');
const { generateCatalog } = require('./catalog');
const { compoundAudit, calculateAmplification } = require('./synergy/evidence');
const { analyzeCompensation } = require('./synergy/compensation');
const { discoverPatterns } = require('./synergy/patterns');
const { rankRecommendations } = require('./synergy/ranking');
const { generateSynergyReport } = require('./synergy/report');
const { routeTask } = require('./synergy/routing');
const { CodexProjectContext } = require('./codex/context');
const { GeminiProjectContext } = require('./gemini/context');
const { CopilotProjectContext } = require('./copilot/context');
const { CursorProjectContext } = require('./cursor/context');
const { WindsurfProjectContext } = require('./windsurf/context');
const { AiderProjectContext } = require('./aider/context');
const { OpenCodeProjectContext } = require('./opencode/context');

const PLATFORM_ORDER = [
  'claude',
  'codex',
  'gemini',
  'copilot',
  'cursor',
  'windsurf',
  'aider',
  'opencode',
];

const PLATFORM_DETECTORS = {
  claude: (dir) => exists(path.join(dir, 'CLAUDE.md')) || exists(path.join(dir, '.claude')),
  codex: (dir) => CodexProjectContext.isCodexRepo(dir),
  gemini: (dir) => GeminiProjectContext.isGeminiRepo(dir),
  copilot: (dir) => CopilotProjectContext.isCopilotRepo(dir),
  cursor: (dir) => CursorProjectContext.isCursorRepo(dir),
  windsurf: (dir) => WindsurfProjectContext.isWindsurfRepo(dir),
  aider: (dir) => AiderProjectContext.isAiderRepo(dir),
  opencode: (dir) => OpenCodeProjectContext.isOpenCodeRepo(dir),
};

const IMPACT_SCORES = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
};

function exists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function resolveDir(dir) {
  return path.resolve(dir || '.');
}

function detectPlatforms(dir) {
  const resolvedDir = resolveDir(dir);
  return PLATFORM_ORDER.filter((platform) => {
    const detect = PLATFORM_DETECTORS[platform];
    return typeof detect === 'function' ? detect(resolvedDir) : false;
  });
}

function getCatalog() {
  return generateCatalog();
}

function buildPatternHistory(dir, platformAudits) {
  const timestamp = new Date().toISOString();
  return Object.entries(platformAudits).map(([platform, result]) => ({
    dir,
    platform,
    score: result.score,
    findings: result.results || [],
    timestamp,
  }));
}

function buildRecommendationPool(platformAudits, compensation) {
  const recommendations = [];

  for (const [platform, result] of Object.entries(platformAudits)) {
    const topActions = Array.isArray(result.topNextActions) ? result.topNextActions : [];
    for (const action of topActions) {
      recommendations.push({
        key: action.key,
        name: action.name,
        description: action.fix,
        impact: action.impact,
        sourcePlatform: platform,
        applicablePlatforms: [platform],
        validatedOn: [platform],
        baseScore: IMPACT_SCORES[action.impact] || 1,
      });
    }
  }

  for (const addition of compensation.recommendedAdditions || []) {
    recommendations.push({
      key: `add-${addition.platform}`,
      name: `Add ${addition.platform}`,
      description: `Covers ${addition.wouldCover.map((item) => item.label).join(', ')}`,
      impact: addition.wouldCover.length >= 2 ? 'high' : 'medium',
      sourcePlatform: addition.platform,
      applicablePlatforms: [addition.platform],
      validatedOn: [],
      fillsGap: true,
      baseScore: Math.max(2, Math.min(5, Math.round(addition.estimatedBenefit / Math.max(1, addition.wouldCover.length)))),
    });
  }

  return recommendations;
}

async function synergyReport(dir) {
  const resolvedDir = resolveDir(dir);
  const activePlatforms = detectPlatforms(resolvedDir);
  const platformAudits = {};
  const errors = [];

  for (const platform of activePlatforms) {
    try {
      platformAudits[platform] = await audit({
        dir: resolvedDir,
        platform,
        silent: true,
      });
    } catch (error) {
      errors.push({ platform, message: error.message });
    }
  }

  const compound = compoundAudit(platformAudits);
  const amplification = calculateAmplification(platformAudits);
  const compensation = analyzeCompensation(activePlatforms, platformAudits);
  const patterns = discoverPatterns(buildPatternHistory(resolvedDir, platformAudits)).patterns;
  const recommendations = rankRecommendations(
    buildRecommendationPool(platformAudits, compensation),
    activePlatforms
  );
  const report = generateSynergyReport({
    platformAudits,
    activePlatforms,
    recommendations,
  });

  return {
    dir: resolvedDir,
    activePlatforms,
    platformAudits,
    compound,
    amplification,
    compensation,
    patterns,
    recommendations,
    errors,
    report,
  };
}

module.exports = {
  audit,
  harmonyAudit,
  detectPlatforms,
  getCatalog,
  routeTask,
  synergyReport,
};
