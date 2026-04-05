/**
 * Certification system for Nerviq.
 * Evaluates a project against all active platforms and assigns a certification level.
 */

const path = require('path');
const { audit } = require('./audit');
const { harmonyAudit } = require('./harmony/audit');
const { detectPlatforms } = require('./public-api');

const LEVELS = {
  GOLD: 'Nerviq Certified Gold',
  SILVER: 'Nerviq Certified Silver',
  BRONZE: 'Nerviq Certified Bronze',
  NONE: 'Not Certified',
};

const BADGE_COLORS = {
  [LEVELS.GOLD]: 'gold',
  [LEVELS.SILVER]: 'silver',
  [LEVELS.BRONZE]: 'cd7f32',
  [LEVELS.NONE]: 'lightgrey',
};

/**
 * Certify a project directory.
 * Runs harmony audit and per-platform audits, then determines certification level.
 *
 * @param {string} dir - Project directory path
 * @returns {Promise<{ level: string, harmonyScore: number, platformScores: Object, badge: string }>}
 */
async function certifyProject(dir) {
  const resolvedDir = path.resolve(dir || '.');

  // Detect active platforms
  const platforms = detectPlatforms(resolvedDir);

  // Run per-platform audits
  const platformScores = {};
  for (const platform of platforms) {
    try {
      const result = await audit({ dir: resolvedDir, platform, silent: true });
      platformScores[platform] = result.score;
    } catch {
      platformScores[platform] = 0;
    }
  }

  // Run harmony audit
  let harmonyScore = 0;
  try {
    const harmonyResult = await harmonyAudit({ dir: resolvedDir, silent: true });
    harmonyScore = harmonyResult.harmonyScore || 0;
  } catch {
    harmonyScore = 0;
  }

  // Determine certification level
  const scores = Object.values(platformScores);
  const allAbove70 = scores.length > 0 && scores.every(s => s >= 70);
  const allAbove50 = scores.length > 0 && scores.every(s => s >= 50);
  const anyAbove40 = scores.some(s => s >= 40);

  let level;
  if (harmonyScore >= 80 && allAbove70) {
    level = LEVELS.GOLD;
  } else if (harmonyScore >= 60 && allAbove50) {
    level = LEVELS.SILVER;
  } else if (anyAbove40) {
    level = LEVELS.BRONZE;
  } else {
    level = LEVELS.NONE;
  }

  const badge = generateCertBadge(level);

  return {
    level,
    harmonyScore,
    platformScores,
    platforms,
    badge,
  };
}

/**
 * Generate a shields.io badge markdown string for a certification level.
 *
 * @param {string} level - One of the LEVELS values
 * @returns {string} Markdown badge string
 */
function generateCertBadge(level) {
  const color = BADGE_COLORS[level] || 'lightgrey';
  const label = encodeURIComponent('Nerviq');
  const message = encodeURIComponent(level);
  const url = `https://img.shields.io/badge/${label}-${message}-${color}`;
  return `[![${level}](${url})](https://nerviq.net)`;
}

module.exports = { certifyProject, generateCertBadge, LEVELS };
