/**
 * S6. Unified Recommendation Ranking
 *
 * Ranks recommendations by cross-platform impact, boosting those that
 * apply broadly, have evidence from other platforms, or fill gaps.
 */

/**
 * Calculate synergy score for a single recommendation.
 *
 * @param {Object} recommendation - A recommendation object
 * @param {string[]} activePlatforms - Currently active platforms
 * @param {Object} [context] - Optional context with evidence and compensation data
 * @returns {number} Synergy score
 */
function calculateSynergyScore(recommendation, activePlatforms, context) {
  let score = recommendation.baseScore || recommendation.score || 1;
  const ctx = context || {};

  // Cross-platform boost: applies to N platforms → x1.2 per additional
  const applicablePlatforms = (recommendation.applicablePlatforms || [])
    .filter(p => activePlatforms.includes(p));
  if (applicablePlatforms.length > 1) {
    score *= Math.pow(1.2, applicablePlatforms.length - 1);
  }

  // Evidence boost: validated on another platform → x1.3
  if (recommendation.validatedOn && recommendation.validatedOn.length > 0) {
    const externalValidations = recommendation.validatedOn.filter(
      p => p !== recommendation.sourcePlatform
    );
    if (externalValidations.length > 0) {
      score *= 1.3;
    }
  }

  // Compensation boost: fills a gap → x1.5
  if (recommendation.fillsGap || recommendation.isCompensation) {
    score *= 1.5;
  }

  // Cross-learning boost: learned from another platform → x1.2
  if (recommendation.crossLearningSource) {
    score *= 1.2;
  }

  // Impact multiplier
  const impactMultipliers = { critical: 2.0, high: 1.5, medium: 1.0, low: 0.7 };
  const impactMult = impactMultipliers[recommendation.impact] || 1.0;
  score *= impactMult;

  // Historical success boost from context
  if (ctx.successRate !== undefined && ctx.successRate > 0) {
    score *= (1 + ctx.successRate * 0.3);
  }

  return Math.round(score * 100) / 100;
}

/**
 * Rank recommendations by cross-platform synergy impact.
 *
 * @param {Object[]} recommendations - Array of recommendation objects
 * @param {string[]} activePlatforms - Currently active platforms
 * @param {Object} [context] - Optional context with evidence and compensation data
 * @returns {Object[]} Sorted recommendations with synergyScore attached
 */
function rankRecommendations(recommendations, activePlatforms, context) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return [];
  }

  const platforms = activePlatforms || [];

  return recommendations
    .map(rec => ({
      ...rec,
      synergyScore: calculateSynergyScore(rec, platforms, context),
    }))
    .sort((a, b) => b.synergyScore - a.synergyScore);
}

module.exports = { rankRecommendations, calculateSynergyScore };
