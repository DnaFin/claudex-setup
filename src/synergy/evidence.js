/**
 * S3. Compound Evidence System
 *
 * Combines audit findings from multiple platforms for stronger insights.
 * Cross-validates findings and calculates compound amplification scores.
 */

/**
 * Normalize a finding key across platforms.
 * Different platforms may name the same concept differently.
 */
function normalizeFindingKey(finding) {
  // Use the technique key or a composite of category+name
  return finding.key || `${finding.category || 'unknown'}:${finding.name || 'unnamed'}`;
}

/**
 * Group findings by their normalized concept.
 */
function groupByConcept(platformAudits) {
  const concepts = {};

  for (const [platform, auditResult] of Object.entries(platformAudits)) {
    if (!auditResult || !auditResult.results) continue;

    for (const finding of auditResult.results) {
      const key = normalizeFindingKey(finding);
      if (!concepts[key]) {
        concepts[key] = {
          key,
          name: finding.name,
          category: finding.category,
          impact: finding.impact,
          platforms: {},
        };
      }
      concepts[key].platforms[platform] = {
        passed: finding.passed,
        fix: finding.fix,
      };
    }
  }

  return concepts;
}

/**
 * Combine audit findings from multiple platforms for stronger insights.
 *
 * @param {Object} platformAudits - { claude: auditResult, codex: auditResult, ... }
 * @returns {Object} Compound audit result with cross-validation and amplification
 */
function compoundAudit(platformAudits) {
  const platforms = Object.keys(platformAudits).filter(
    p => platformAudits[p] && platformAudits[p].results
  );

  if (platforms.length === 0) {
    return {
      compoundScore: 0,
      bestSingleScore: 0,
      amplification: 0,
      totalFindings: 0,
      crossValidated: [],
      platformUnique: {},
      coverageMap: {},
    };
  }

  const concepts = groupByConcept(platformAudits);
  const crossValidated = [];
  const platformUnique = {};
  const coverageMap = {};

  for (const platform of platforms) {
    platformUnique[platform] = [];
    coverageMap[platform] = { found: 0, unique: 0, shared: 0 };
  }

  // Analyze each concept across platforms
  for (const [key, concept] of Object.entries(concepts)) {
    const involvedPlatforms = Object.keys(concept.platforms);
    const failedOn = involvedPlatforms.filter(p => concept.platforms[p].passed === false);
    const passedOn = involvedPlatforms.filter(p => concept.platforms[p].passed === true);

    // Track coverage
    for (const p of involvedPlatforms) {
      coverageMap[p].found++;
    }

    if (involvedPlatforms.length >= 2) {
      // Cross-validated finding
      for (const p of involvedPlatforms) {
        coverageMap[p].shared++;
      }

      if (failedOn.length >= 2) {
        crossValidated.push({
          key,
          name: concept.name,
          category: concept.category,
          impact: concept.impact,
          failedOn,
          passedOn,
          confidence: Math.min(1, 0.5 + (failedOn.length * 0.15)),
          verdict: failedOn.length === involvedPlatforms.length
            ? 'universal-gap'
            : 'partial-gap',
        });
      } else if (passedOn.length >= 2) {
        crossValidated.push({
          key,
          name: concept.name,
          category: concept.category,
          impact: concept.impact,
          failedOn,
          passedOn,
          confidence: Math.min(1, 0.5 + (passedOn.length * 0.15)),
          verdict: 'cross-validated-pass',
        });
      }
    } else {
      // Platform-unique finding
      const platform = involvedPlatforms[0];
      coverageMap[platform].unique++;
      platformUnique[platform].push({
        key,
        name: concept.name,
        category: concept.category,
        impact: concept.impact,
        passed: concept.platforms[platform].passed,
        fix: concept.platforms[platform].fix,
      });
    }
  }

  // Calculate scores
  const singleScores = platforms.map(p => platformAudits[p].score || 0);
  const bestSingleScore = Math.max(...singleScores);

  // Compound score = best single + bonus from cross-validation + bonus from unique coverage
  const crossValidationBonus = crossValidated
    .filter(cv => cv.verdict === 'cross-validated-pass')
    .length * 0.5;
  const uniqueCoverageBonus = Object.values(platformUnique)
    .reduce((sum, findings) => sum + findings.filter(f => f.passed).length, 0) * 0.3;
  const totalUniqueFindings = Object.keys(concepts).length;

  const compoundScore = Math.round(
    Math.min(150, bestSingleScore + crossValidationBonus + uniqueCoverageBonus)
  );

  return {
    compoundScore,
    bestSingleScore,
    amplification: compoundScore - bestSingleScore,
    totalFindings: totalUniqueFindings,
    crossValidated,
    platformUnique,
    coverageMap,
  };
}

/**
 * Calculate the amplification factor from combining multiple platforms.
 *
 * @param {Object} platformAudits - Per-platform audit results
 * @returns {Object} Amplification metrics
 */
function calculateAmplification(platformAudits) {
  const result = compoundAudit(platformAudits);
  const platformCount = Object.keys(platformAudits).filter(
    p => platformAudits[p] && platformAudits[p].results
  ).length;

  return {
    amplification: result.amplification,
    amplificationPercent: result.bestSingleScore > 0
      ? Math.round((result.amplification / result.bestSingleScore) * 100)
      : 0,
    platformCount,
    crossValidatedCount: result.crossValidated.length,
    uniqueFindingsPerPlatform: Object.fromEntries(
      Object.entries(result.platformUnique).map(([p, findings]) => [p, findings.length])
    ),
    verdict: result.amplification > 10 ? 'strong-synergy'
      : result.amplification > 5 ? 'moderate-synergy'
      : result.amplification > 0 ? 'mild-synergy'
      : 'no-synergy',
  };
}

module.exports = { compoundAudit, calculateAmplification };
