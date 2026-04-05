/**
 * S4. Strength/Weakness Compensation
 *
 * Identifies where platforms complement each other and recommends
 * platform additions to fill coverage gaps.
 */

const { PLATFORM_CAPABILITIES, CAPABILITY_LABELS: AREA_LABELS } = require('../shared/capabilities');

const WEAKNESS_THRESHOLD = 3;
const STRENGTH_THRESHOLD = 4;

/**
 * Analyze where platforms compensate for each other's weaknesses.
 *
 * @param {string[]} activePlatforms - Currently active platforms
 * @param {Object} [platformAudits] - Optional audit results per platform
 * @returns {Object} Compensation analysis
 */
function analyzeCompensation(activePlatforms, platformAudits) {
  const platforms = (activePlatforms || []).filter(p => PLATFORM_CAPABILITIES[p]);
  const compensations = [];
  const uncoveredGaps = [];

  // Gather all capability areas across active platforms
  const allAreas = new Set();
  for (const platform of platforms) {
    for (const area of Object.keys(PLATFORM_CAPABILITIES[platform])) {
      allAreas.add(area);
    }
  }

  // For each platform, find weaknesses and check if another compensates
  for (const platform of platforms) {
    const caps = PLATFORM_CAPABILITIES[platform];

    for (const area of allAreas) {
      const score = caps[area] || 0;
      if (score >= WEAKNESS_THRESHOLD) continue;

      // This is a weakness — look for compensation
      let bestCompensator = null;

      for (const other of platforms) {
        if (other === platform) continue;
        const otherScore = (PLATFORM_CAPABILITIES[other] || {})[area] || 0;
        if (otherScore >= STRENGTH_THRESHOLD) {
          if (!bestCompensator || otherScore > bestCompensator.score) {
            bestCompensator = { platform: other, area, score: otherScore };
          }
        }
      }

      if (bestCompensator) {
        compensations.push({
          weakness: { platform, area, score, label: AREA_LABELS[area] || area },
          compensatedBy: {
            platform: bestCompensator.platform,
            area: bestCompensator.area,
            score: bestCompensator.score,
            label: AREA_LABELS[area] || area,
          },
          netBenefit: bestCompensator.score - score,
        });
      } else {
        uncoveredGaps.push({
          area,
          label: AREA_LABELS[area] || area,
          weakPlatforms: [{ platform, score }],
        });
      }
    }
  }

  // Deduplicate uncovered gaps by area
  const gapsByArea = {};
  for (const gap of uncoveredGaps) {
    if (!gapsByArea[gap.area]) {
      gapsByArea[gap.area] = { area: gap.area, label: gap.label, weakPlatforms: [] };
    }
    gapsByArea[gap.area].weakPlatforms.push(...gap.weakPlatforms);
  }
  const dedupedGaps = Object.values(gapsByArea);

  // Recommend platform additions that would fill gaps
  const inactivePlatforms = Object.keys(PLATFORM_CAPABILITIES).filter(
    p => !platforms.includes(p)
  );
  const recommendedAdditions = [];

  for (const candidate of inactivePlatforms) {
    const candidateCaps = PLATFORM_CAPABILITIES[candidate];
    const wouldCover = [];
    let estimatedBenefit = 0;

    for (const gap of dedupedGaps) {
      const candidateScore = candidateCaps[gap.area] || 0;
      if (candidateScore >= STRENGTH_THRESHOLD) {
        wouldCover.push({
          area: gap.area,
          label: gap.label,
          score: candidateScore,
        });
        estimatedBenefit += candidateScore;
      }
    }

    if (wouldCover.length > 0) {
      recommendedAdditions.push({
        platform: candidate,
        wouldCover,
        estimatedBenefit,
      });
    }
  }

  recommendedAdditions.sort((a, b) => b.estimatedBenefit - a.estimatedBenefit);

  return {
    compensations,
    uncoveredGaps: dedupedGaps,
    recommendedAdditions,
  };
}

/**
 * Get areas not well covered by any active platform.
 *
 * @param {string[]} activePlatforms - Currently active platforms
 * @returns {Object[]} Uncovered gap areas
 */
function getUncoveredGaps(activePlatforms) {
  const result = analyzeCompensation(activePlatforms);
  return result.uncoveredGaps;
}

module.exports = { analyzeCompensation, getUncoveredGaps };
