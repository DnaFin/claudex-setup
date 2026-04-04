/**
 * S5. Cross-Platform Pattern Discovery
 *
 * Finds patterns only visible from a cross-platform perspective:
 * recurring failures, platform-specific successes, sequence effects,
 * and diminishing returns.
 */

const { PLATFORM_CAPABILITIES } = require('./routing');

/**
 * Detect recurring failures across platforms (root cause is project, not platform).
 */
function detectRecurringFailures(harmonyHistory) {
  const patterns = [];
  const failureCounts = {};

  for (const entry of harmonyHistory) {
    if (!entry.findings) continue;
    for (const finding of entry.findings) {
      if (finding.passed === false) {
        const key = finding.key || finding.name;
        if (!failureCounts[key]) {
          failureCounts[key] = { key, name: finding.name, category: finding.category, platforms: new Set() };
        }
        failureCounts[key].platforms.add(entry.platform);
      }
    }
  }

  for (const [key, data] of Object.entries(failureCounts)) {
    if (data.platforms.size >= 3) {
      patterns.push({
        type: 'recurring-failure',
        description: `"${data.name || key}" fails on ${data.platforms.size} platforms — root cause is project-level, not platform-specific`,
        key: data.key,
        affectedPlatforms: [...data.platforms],
        severity: data.platforms.size >= 4 ? 'high' : 'medium',
      });
    }
  }

  return patterns;
}

/**
 * Detect platform-specific successes (recommendation only works on one platform).
 */
function detectPlatformSpecificSuccess(harmonyHistory) {
  const patterns = [];
  const outcomesByKey = {};

  for (const entry of harmonyHistory) {
    if (!entry.findings) continue;
    for (const finding of entry.findings) {
      const key = finding.key || finding.name;
      if (!outcomesByKey[key]) outcomesByKey[key] = {};
      outcomesByKey[key][entry.platform] = finding.passed;
    }
  }

  for (const [key, platforms] of Object.entries(outcomesByKey)) {
    const entries = Object.entries(platforms);
    if (entries.length < 2) continue;

    const passed = entries.filter(([, v]) => v === true);
    const failed = entries.filter(([, v]) => v === false);

    if (passed.length === 1 && failed.length >= 2) {
      patterns.push({
        type: 'platform-specific-success',
        description: `"${key}" only passes on ${passed[0][0]} — fails on ${failed.map(f => f[0]).join(', ')}`,
        key,
        successPlatform: passed[0][0],
        failPlatforms: failed.map(f => f[0]),
      });
    }
  }

  return patterns;
}

/**
 * Analyze sequence effects (order of platform setup matters).
 */
function analyzeSequenceEffects(harmonyHistory) {
  const patterns = [];
  const sequenceScores = {};

  // Group history entries by timestamp to detect sequences
  const sorted = [...harmonyHistory].sort((a, b) =>
    new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  // Look at consecutive pairs
  for (let i = 0; i < sorted.length - 1; i++) {
    const first = sorted[i];
    const second = sorted[i + 1];
    if (!first.platform || !second.platform || first.platform === second.platform) continue;

    const seqKey = `${first.platform}→${second.platform}`;
    if (!sequenceScores[seqKey]) {
      sequenceScores[seqKey] = { scores: [], firstScores: [], secondScores: [] };
    }

    if (second.score !== undefined) {
      sequenceScores[seqKey].secondScores.push(second.score);
    }
    if (first.score !== undefined) {
      sequenceScores[seqKey].firstScores.push(first.score);
    }
  }

  for (const [seq, data] of Object.entries(sequenceScores)) {
    if (data.secondScores.length < 2) continue;
    const avgSecond = data.secondScores.reduce((a, b) => a + b, 0) / data.secondScores.length;

    // Check if reverse sequence exists and compare
    const [first, second] = seq.split('→');
    const reverseKey = `${second}→${first}`;
    const reverseData = sequenceScores[reverseKey];

    if (reverseData && reverseData.secondScores.length >= 2) {
      const avgReverse = reverseData.secondScores.reduce((a, b) => a + b, 0) / reverseData.secondScores.length;
      if (Math.abs(avgSecond - avgReverse) > 5) {
        const better = avgSecond > avgReverse ? seq : reverseKey;
        patterns.push({
          type: 'sequence-effect',
          description: `Setup order "${better}" produces better results (${Math.round(Math.max(avgSecond, avgReverse))} vs ${Math.round(Math.min(avgSecond, avgReverse))})`,
          bestSequence: better,
          scoreDifference: Math.round(Math.abs(avgSecond - avgReverse)),
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect diminishing returns from adding more platforms.
 */
function detectDiminishingReturns(harmonyHistory) {
  const patterns = [];

  // Group by project (dir) and count platforms vs score improvement
  const byProject = {};
  for (const entry of harmonyHistory) {
    const dir = entry.dir || 'unknown';
    if (!byProject[dir]) byProject[dir] = [];
    byProject[dir].push(entry);
  }

  for (const [dir, entries] of Object.entries(byProject)) {
    const platformScores = {};
    for (const entry of entries) {
      if (entry.platform && entry.score !== undefined) {
        platformScores[entry.platform] = entry.score;
      }
    }

    const platforms = Object.keys(platformScores);
    if (platforms.length < 3) continue;

    // Sort by score descending to see marginal value of each addition
    const sorted = Object.entries(platformScores).sort((a, b) => b[1] - a[1]);
    const marginals = [];
    let cumulative = 0;

    for (let i = 0; i < sorted.length; i++) {
      const marginal = i === 0 ? sorted[i][1] : Math.max(0, sorted[i][1] - cumulative / i);
      marginals.push({ platform: sorted[i][0], score: sorted[i][1], marginalValue: Math.round(marginal) });
      cumulative += sorted[i][1];
    }

    // Check if last platforms add significantly less
    if (marginals.length >= 3) {
      const firstMarginal = marginals[0].marginalValue;
      const lastMarginal = marginals[marginals.length - 1].marginalValue;

      if (firstMarginal > 0 && lastMarginal < firstMarginal * 0.3) {
        patterns.push({
          type: 'diminishing-returns',
          description: `Platform #${marginals.length} (${marginals[marginals.length - 1].platform}) adds ${lastMarginal} marginal value vs ${firstMarginal} from #1 (${marginals[0].platform})`,
          marginals,
          dir,
        });
      }
    }
  }

  return patterns;
}

/**
 * Discover all cross-platform patterns from harmony history.
 *
 * @param {Object[]} harmonyHistory - Array of audit/harmony run entries
 * @returns {Object} Discovered patterns by type
 */
function discoverPatterns(harmonyHistory) {
  if (!Array.isArray(harmonyHistory) || harmonyHistory.length === 0) {
    return { patterns: [] };
  }

  const patterns = [
    ...detectRecurringFailures(harmonyHistory),
    ...detectPlatformSpecificSuccess(harmonyHistory),
    ...analyzeSequenceEffects(harmonyHistory),
    ...detectDiminishingReturns(harmonyHistory),
  ];

  return { patterns };
}

/**
 * Focused analysis of sequence effects only.
 *
 * @param {Object[]} harmonyHistory - Array of audit/harmony run entries
 * @returns {Object[]} Sequence effect patterns
 */
function analyzeSequenceEffectsOnly(harmonyHistory) {
  if (!Array.isArray(harmonyHistory)) return [];
  return analyzeSequenceEffects(harmonyHistory);
}

module.exports = { discoverPatterns, analyzeSequenceEffects: analyzeSequenceEffectsOnly };
