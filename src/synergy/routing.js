/**
 * S2. Intelligent Task Routing
 *
 * Routes tasks to the best platform based on capabilities,
 * project history, and active platform availability.
 */

const { PLATFORM_CAPABILITIES } = require('../shared/capabilities');

const TASK_TYPE_PATTERNS = [
  { type: 'bugfix', patterns: ['bug', 'fix', 'error', 'crash', 'broken', 'issue', 'regression', 'failing'] },
  { type: 'refactor', patterns: ['refactor', 'clean', 'restructure', 'reorganize', 'simplify', 'extract', 'dedup'] },
  { type: 'review', patterns: ['review', 'audit', 'check', 'inspect', 'evaluate', 'assess', 'analyze'] },
  { type: 'UI', patterns: ['ui', 'frontend', 'css', 'layout', 'design', 'component', 'style', 'responsive'] },
  { type: 'CI', patterns: ['ci', 'pipeline', 'deploy', 'workflow', 'github actions', 'build', 'release'] },
  { type: 'infrastructure', patterns: ['infra', 'terraform', 'docker', 'k8s', 'kubernetes', 'aws', 'cloud'] },
  { type: 'testing', patterns: ['test', 'spec', 'coverage', 'e2e', 'unit test', 'integration test'] },
  { type: 'architecture', patterns: ['architect', 'design', 'plan', 'structure', 'module', 'system design'] },
  { type: 'documentation', patterns: ['doc', 'readme', 'comment', 'explain', 'document', 'jsdoc'] },
  { type: 'feature', patterns: ['feature', 'implement', 'add', 'create', 'new', 'build', 'develop'] },
];

const TASK_CAPABILITY_MAP = {
  bugfix: ['debugging', 'reasoning', 'ide'],
  refactor: ['refactoring', 'reasoning', 'ide'],
  review: ['review', 'reasoning', 'context'],
  UI: ['ui', 'ide', 'inline'],
  CI: ['ci', 'cloudTasks', 'async'],
  infrastructure: ['ci', 'cloudTasks', 'sandbox'],
  testing: ['debugging', 'ci', 'sandbox'],
  architecture: ['architecture', 'reasoning', 'context'],
  documentation: ['reasoning', 'context', 'inline'],
  feature: ['reasoning', 'ide', 'refactoring'],
};

/**
 * Classify a task description into a task type.
 *
 * @param {string} taskDescription - Free-text task description
 * @returns {string} Task type
 */
function classifyTaskType(taskDescription) {
  const lower = taskDescription.toLowerCase();
  let bestMatch = { type: 'feature', score: 0 };

  for (const { type, patterns } of TASK_TYPE_PATTERNS) {
    const score = patterns.reduce((sum, pattern) => {
      return sum + (lower.includes(pattern) ? 1 : 0);
    }, 0);
    if (score > bestMatch.score) {
      bestMatch = { type, score };
    }
  }

  return bestMatch.type;
}

/**
 * Score a platform for a given task type.
 */
function scorePlatform(platform, taskType, projectHistory) {
  const capabilities = PLATFORM_CAPABILITIES[platform];
  if (!capabilities) return 0;

  const relevantCapabilities = TASK_CAPABILITY_MAP[taskType] || ['reasoning'];
  let score = 0;
  let count = 0;

  for (const cap of relevantCapabilities) {
    if (capabilities[cap] !== undefined) {
      score += capabilities[cap];
      count++;
    }
  }

  const baseScore = count > 0 ? score / count : 0;

  // Boost from project history
  let historyBoost = 0;
  if (projectHistory && projectHistory[platform]) {
    const history = projectHistory[platform];
    const taskHistory = history[taskType];
    if (taskHistory) {
      // Success rate boost: up to +1.0
      const successRate = taskHistory.successes / Math.max(1, taskHistory.total);
      historyBoost = successRate * 1.0;
    }
  }

  return Math.round((baseScore + historyBoost) * 100) / 100;
}

/**
 * Route a task to the best available platform.
 *
 * @param {string} taskDescription - Free-text task description
 * @param {string[]} activePlatforms - Currently available platforms
 * @param {Object} [projectHistory] - Historical task success data per platform
 * @returns {Object} Routing recommendation
 */
function routeTask(taskDescription, activePlatforms, projectHistory) {
  const taskType = classifyTaskType(taskDescription);
  const platforms = (activePlatforms || []).filter(p => PLATFORM_CAPABILITIES[p]);

  if (platforms.length === 0) {
    return {
      recommended: null,
      alternatives: [],
      taskType,
      reasoning: 'No active platforms with known capabilities',
    };
  }

  const scored = platforms.map(platform => ({
    platform,
    score: scorePlatform(platform, taskType, projectHistory),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const alternatives = scored.slice(1);

  // Build reasoning
  const relevantCaps = TASK_CAPABILITY_MAP[taskType] || ['reasoning'];
  const bestCaps = PLATFORM_CAPABILITIES[best.platform];
  const topStrengths = relevantCaps
    .filter(cap => (bestCaps[cap] || 0) >= 4)
    .join(', ');

  return {
    recommended: {
      platform: best.platform,
      confidence: Math.min(1, best.score / 5),
      reasoning: topStrengths
        ? `${best.platform} excels at ${topStrengths} (needed for ${taskType})`
        : `${best.platform} is the best available option for ${taskType}`,
    },
    alternatives: alternatives.map(a => ({
      platform: a.platform,
      confidence: Math.min(1, a.score / 5),
      reasoning: `Score: ${a.score}/5 for ${taskType}`,
    })),
    taskType,
  };
}

module.exports = { routeTask, classifyTaskType, PLATFORM_CAPABILITIES };
