/**
 * H5. Strategic Project Advisor
 *
 * The strategic brain that understands a project holistically and recommends
 * which platform to use for which task type, configuration improvements,
 * and cross-platform update actions.
 *
 * Zero external dependencies - imports only from sibling/parent modules.
 */

// ─── Platform Strength Matrix (canonical source: shared/capabilities.js) ─────

const { PLATFORM_CAPABILITIES: PLATFORM_STRENGTHS } = require('../shared/capabilities');

// ─── Task-type to platform-strength mapping ───────────────────────────────────

const TASK_TYPE_PROFILES = {
  'bug-fix': {
    label: 'Bug Fixing',
    requiredStrengths: { reasoning: 0.5, refactoring: 0.3, context: 0.2 },
    description: 'Deep reasoning and code understanding for root cause analysis.',
  },
  'ci-review': {
    label: 'CI / Async Review',
    requiredStrengths: { ci: 0.4, cloudTasks: 0.3, async: 0.2, automation: 0.1 },
    description: 'Asynchronous code review and CI-integrated workflows.',
  },
  'ui-work': {
    label: 'UI Development',
    requiredStrengths: { ide: 0.4, ui: 0.3, inline: 0.3 },
    description: 'Interactive UI work with live preview and visual feedback.',
  },
  'quick-edit': {
    label: 'Quick Edits',
    requiredStrengths: { inline: 0.5, ide: 0.3, automation: 0.2 },
    description: 'Small, fast inline edits and completions.',
  },
  'infrastructure': {
    label: 'Infrastructure',
    requiredStrengths: { sandbox: 0.4, cloudTasks: 0.3, reasoning: 0.3 },
    description: 'Infrastructure, DevOps, and sandbox-heavy workflows.',
  },
  'refactoring': {
    label: 'Large Refactoring',
    requiredStrengths: { refactoring: 0.4, reasoning: 0.3, context: 0.3 },
    description: 'Cross-file refactoring with deep codebase understanding.',
  },
  'code-review': {
    label: 'Code Review',
    requiredStrengths: { reasoning: 0.4, governance: 0.3, ci: 0.3 },
    description: 'Thorough review with governance and standards enforcement.',
  },
  'greenfield': {
    label: 'Greenfield / Scaffolding',
    requiredStrengths: { reasoning: 0.3, automation: 0.3, ide: 0.2, refactoring: 0.2 },
    description: 'Starting new projects or major new features from scratch.',
  },
  'harness-optimization': {
    label: 'Config Optimization',
    requiredStrengths: { governance: 0.4, automation: 0.3, reasoning: 0.3 },
    description: 'Optimizing AI coding agent configuration and harness settings.',
  },
  'phased-migration': {
    label: 'Phased Migration',
    requiredStrengths: { reasoning: 0.4, refactoring: 0.3, architecture: 0.3 },
    description: 'Multi-phase migrations requiring sequential execution with validation gates.',
  },
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a platform against a task type profile.
 * Returns a 0-5 weighted score.
 */
function scorePlatformForTask(platformKey, taskProfile) {
  const strengths = PLATFORM_STRENGTHS[platformKey];
  if (!strengths) return 0;

  let score = 0;
  for (const [dimension, weight] of Object.entries(taskProfile.requiredStrengths)) {
    const platformScore = strengths[dimension] || 0;
    score += platformScore * weight;
  }
  return Math.round(score * 100) / 100;
}

/**
 * Rank all platforms for a given task type.
 */
function rankPlatformsForTask(taskType) {
  const profile = TASK_TYPE_PROFILES[taskType];
  if (!profile) return [];

  const rankings = Object.keys(PLATFORM_STRENGTHS).map(platformKey => ({
    platform: platformKey,
    label: PLATFORM_STRENGTHS[platformKey].label,
    score: scorePlatformForTask(platformKey, profile),
  }));

  rankings.sort((a, b) => b.score - a.score);
  return rankings;
}

/**
 * Compute a confidence level from the score gap between #1 and #2.
 */
function computeConfidence(rankings) {
  if (rankings.length < 2) return 'high';
  const gap = rankings[0].score - rankings[1].score;
  if (gap >= 1.0) return 'high';
  if (gap >= 0.4) return 'medium';
  return 'low';
}

// ─── Task Routing ─────────────────────────────────────────────────────────────

/**
 * Generate task routing recommendations for all known task types.
 * Optionally filter to only platforms present in platformAudits.
 */
function generateTaskRouting(platformAudits) {
  const availablePlatforms = platformAudits
    ? new Set(platformAudits.map(a => a.platform))
    : null;

  const routing = [];

  for (const [taskType, profile] of Object.entries(TASK_TYPE_PROFILES)) {
    let rankings = rankPlatformsForTask(taskType);

    if (availablePlatforms) {
      rankings = rankings.filter(r => availablePlatforms.has(r.platform));
    }

    if (rankings.length === 0) continue;

    const best = rankings[0];
    routing.push({
      taskType,
      taskLabel: profile.label,
      recommendedPlatform: best.platform,
      recommendedLabel: best.label,
      score: best.score,
      confidence: computeConfidence(rankings),
      reasoning: profile.description,
      alternatives: rankings.slice(1, 3).map(r => ({
        platform: r.platform,
        label: r.label,
        score: r.score,
      })),
    });
  }

  return routing;
}

// ─── Config Recommendations ───────────────────────────────────────────────────

/**
 * Detect configuration improvement opportunities from platform audits.
 */
function generateConfigRecommendations(canonicalModel, platformAudits) {
  const recommendations = [];

  if (!platformAudits || platformAudits.length === 0) return recommendations;

  for (const auditResult of platformAudits) {
    const platform = auditResult.platform;
    const score = auditResult.score || 0;

    // Low score platforms need attention
    if (score < 40) {
      recommendations.push({
        platform,
        recommendation: `Platform "${platform}" scores ${score}/100. Run setup to bootstrap baseline configuration.`,
        impact: 'high',
        category: 'bootstrap',
      });
    }

    // Missing canonical sections
    if (canonicalModel && canonicalModel.sections) {
      const auditSections = new Set((auditResult.sections || []).map(s => s.key || s));
      for (const section of canonicalModel.sections) {
        if (!auditSections.has(section.key)) {
          recommendations.push({
            platform,
            recommendation: `Missing canonical section "${section.key}" (${section.label || section.key}). Add to align with cross-platform standard.`,
            impact: 'medium',
            category: 'alignment',
          });
        }
      }
    }

    // Permission/governance gaps
    if (auditResult.governance) {
      const gov = auditResult.governance;
      if (!gov.hasPermissions) {
        recommendations.push({
          platform,
          recommendation: 'No explicit permission configuration detected. Add permission boundaries for safer operation.',
          impact: 'high',
          category: 'security',
        });
      }
      if (!gov.hasSecretProtection) {
        recommendations.push({
          platform,
          recommendation: 'No secret protection hook found. Add protection to prevent credential exposure.',
          impact: 'high',
          category: 'security',
        });
      }
    }
  }

  // Sort by impact
  const impactOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => (impactOrder[a.impact] || 2) - (impactOrder[b.impact] || 2));

  return recommendations;
}

// ─── Cross-Platform Actions ───────────────────────────────────────────────────

/**
 * Detect when project changes need cross-platform updates.
 * Prioritize by how many platforms are affected.
 */
function generateCrossPlatformActions(canonicalModel, platformAudits) {
  const actions = [];

  if (!platformAudits || platformAudits.length < 2) return actions;

  const platforms = platformAudits.map(a => a.platform);

  // Detect instruction drift: if one platform has instructions another lacks
  if (canonicalModel && canonicalModel.sections) {
    const sectionCoverage = {};
    for (const section of canonicalModel.sections) {
      sectionCoverage[section.key] = [];
    }

    for (const auditResult of platformAudits) {
      for (const section of (auditResult.sections || [])) {
        const key = section.key || section;
        if (sectionCoverage[key]) {
          sectionCoverage[key].push(auditResult.platform);
        }
      }
    }

    for (const [sectionKey, coveredPlatforms] of Object.entries(sectionCoverage)) {
      if (coveredPlatforms.length > 0 && coveredPlatforms.length < platforms.length) {
        const missing = platforms.filter(p => !coveredPlatforms.includes(p));
        actions.push({
          action: `Sync section "${sectionKey}" to missing platforms`,
          affectedPlatforms: missing,
          sourcePlatforms: coveredPlatforms,
          priority: missing.length >= platforms.length / 2 ? 'high' : 'medium',
          type: 'instruction-sync',
        });
      }
    }
  }

  // Detect MCP server alignment gaps
  const mcpByPlatform = {};
  for (const auditResult of platformAudits) {
    mcpByPlatform[auditResult.platform] = new Set(auditResult.mcpServers || []);
  }

  const allMcpServers = new Set();
  for (const servers of Object.values(mcpByPlatform)) {
    for (const s of servers) allMcpServers.add(s);
  }

  for (const server of allMcpServers) {
    const hasPlatforms = platforms.filter(p => mcpByPlatform[p] && mcpByPlatform[p].has(server));
    const missingPlatforms = platforms.filter(p => !mcpByPlatform[p] || !mcpByPlatform[p].has(server));

    if (hasPlatforms.length > 0 && missingPlatforms.length > 0) {
      actions.push({
        action: `Add MCP server "${server}" to platforms that lack it`,
        affectedPlatforms: missingPlatforms,
        sourcePlatforms: hasPlatforms,
        priority: missingPlatforms.length > hasPlatforms.length ? 'medium' : 'low',
        type: 'mcp-sync',
      });
    }
  }

  // Sort by priority then by affected platform count
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (pDiff !== 0) return pDiff;
    return b.affectedPlatforms.length - a.affectedPlatforms.length;
  });

  return actions;
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

/**
 * Generate a complete strategic advice package.
 *
 * @param {Object|null} canonicalModel - The canonical model from canon.js
 * @param {Array} platformAudits - Array of per-platform audit results
 * @returns {Object} { taskRouting, configRecommendations, crossPlatformActions }
 */
function generateStrategicAdvice(canonicalModel, platformAudits) {
  return {
    taskRouting: generateTaskRouting(platformAudits),
    configRecommendations: generateConfigRecommendations(canonicalModel, platformAudits),
    crossPlatformActions: generateCrossPlatformActions(canonicalModel, platformAudits),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateStrategicAdvice,
  PLATFORM_STRENGTHS,
  TASK_TYPE_PROFILES,
  scorePlatformForTask,
  rankPlatformsForTask,
  generateTaskRouting,
  generateConfigRecommendations,
  generateCrossPlatformActions,
};
