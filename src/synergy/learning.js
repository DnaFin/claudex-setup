/**
 * S1. Cross-Platform Learning Engine
 *
 * When a recommendation succeeds on one platform, propagate to others.
 * Translates recommendations into each platform's native semantics
 * rather than blindly copying.
 */

const fs = require('fs');
const path = require('path');

const PLATFORM_SEMANTICS = {
  claude: { configFile: 'CLAUDE.md', format: 'markdown', instructionStyle: 'prose' },
  codex: { configFile: 'AGENTS.md', format: 'markdown', instructionStyle: 'directive' },
  gemini: { configFile: 'GEMINI.md', format: 'markdown', instructionStyle: 'structured' },
  copilot: { configFile: '.github/copilot-instructions.md', format: 'markdown', instructionStyle: 'concise' },
  cursor: { configFile: '.cursor/rules', format: 'mdc', instructionStyle: 'rule-based' },
  windsurf: { configFile: '.windsurf/rules', format: 'markdown', instructionStyle: 'rule-based' },
  aider: { configFile: '.aider.conf.yml', format: 'yaml', instructionStyle: 'convention-based' },
  opencode: { configFile: 'opencode.json', format: 'jsonc', instructionStyle: 'directive' },
};

const TRANSLATION_MAP = {
  'verification-command': {
    claude: (rec) => `Add to CLAUDE.md: \`## Verification\` section with \`${rec.command}\``,
    codex: (rec) => `Add to AGENTS.md verification block: \`${rec.command}\``,
    gemini: (rec) => `Add to GEMINI.md: verification command \`${rec.command}\``,
    copilot: (rec) => `Document in copilot-instructions.md: always run \`${rec.command}\` before completing`,
    cursor: (rec) => `Add rule: "Always run \`${rec.command}\` before completing tasks"`,
    windsurf: (rec) => `Add a .windsurf/rules verification rule that runs \`${rec.command}\` before task completion`,
    aider: (rec) => `Document in CONVENTIONS.md or .aider.conf.yml workflow notes: run \`${rec.command}\` before final response`,
    opencode: (rec) => `Add to AGENTS.md or opencode.json workflow guidance: run \`${rec.command}\` before completing`,
  },
  'architecture-doc': {
    claude: () => `Add Mermaid architecture diagram to CLAUDE.md`,
    codex: () => `Add architecture overview to AGENTS.md`,
    gemini: () => `Add architecture context to GEMINI.md`,
    copilot: () => `Add architecture reference in copilot-instructions.md`,
    cursor: () => `Add architecture context rule in .cursor/rules`,
    windsurf: () => `Add architecture guidance to a .windsurf/rules/*.md file or shared workflow`,
    aider: () => `Add architecture overview to CONVENTIONS.md for Aider sessions`,
    opencode: () => `Add architecture context to AGENTS.md and reference it from opencode.json`,
  },
  'permission-rule': {
    claude: (rec) => `Configure in settings.json permissions: ${rec.description}`,
    codex: (rec) => `Set sandbox policy in codex config: ${rec.description}`,
    gemini: (rec) => `Configure Gemini sandbox settings: ${rec.description}`,
    copilot: (rec) => `Note in instructions: ${rec.description}`,
    cursor: (rec) => `Add safety rule: ${rec.description}`,
    windsurf: (rec) => `Translate into .cascadeignore, MCP whitelist, or rule guidance: ${rec.description}`,
    aider: (rec) => `Translate into git workflow guardrails or config defaults: ${rec.description}`,
    opencode: (rec) => `Encode in opencode.json permissions: ${rec.description}`,
  },
  'hook': {
    claude: (rec) => `Add hook in settings.json: ${rec.description}`,
    codex: (rec) => `Add pre/post task check: ${rec.description}`,
    gemini: (rec) => `Add automated check: ${rec.description}`,
    copilot: (rec) => `Add workflow step: ${rec.description}`,
    cursor: (rec) => `Add background task rule: ${rec.description}`,
    windsurf: (rec) => `Implement as a workflow, Steps sequence, or auto rule: ${rec.description}`,
    aider: (rec) => `Implement via git hooks, auto-test, or documented Aider workflow: ${rec.description}`,
    opencode: (rec) => `Implement via plugin, workflow, or task automation: ${rec.description}`,
  },
};

/**
 * Adapt a recommendation from one platform's semantics to another.
 */
function adaptRecommendation(recommendation, sourcePlatform, targetPlatform) {
  const translator = TRANSLATION_MAP[recommendation.type];
  if (translator && translator[targetPlatform]) {
    return translator[targetPlatform](recommendation);
  }
  // Generic fallback: describe the recommendation in platform-neutral terms
  const semantics = PLATFORM_SEMANTICS[targetPlatform];
  if (!semantics) return recommendation.description || recommendation.recommendation;
  return `[${semantics.configFile}] ${recommendation.description || recommendation.recommendation}`;
}

/**
 * Calculate confidence for a propagated insight based on similarity
 * between source and target platforms.
 */
function calculatePropagationConfidence(insight, sourcePlatform, targetPlatform) {
  // Base confidence from the original outcome
  let confidence = Math.min(1, Math.max(0, (insight.score_delta || 0) / 20));

  // Same instruction style = higher confidence
  const sourceStyle = (PLATFORM_SEMANTICS[sourcePlatform] || {}).instructionStyle;
  const targetStyle = (PLATFORM_SEMANTICS[targetPlatform] || {}).instructionStyle;
  if (sourceStyle === targetStyle) confidence *= 1.2;

  // Same format = slightly higher confidence
  const sourceFormat = (PLATFORM_SEMANTICS[sourcePlatform] || {}).format;
  const targetFormat = (PLATFORM_SEMANTICS[targetPlatform] || {}).format;
  if (sourceFormat === targetFormat) confidence *= 1.1;

  return Math.min(1, Math.round(confidence * 100) / 100);
}

/**
 * Propagate an insight from one platform to others.
 *
 * @param {Object} insight - { type, recommendation, outcome, score_delta }
 * @param {string} sourcePlatform - Platform where the insight originated
 * @param {string[]} targetPlatforms - Platforms to propagate to
 * @returns {Object[]} Adapted recommendations per target platform
 */
function propagateInsight(insight, sourcePlatform, targetPlatforms) {
  return targetPlatforms
    .filter(p => p !== sourcePlatform)
    .map(platform => ({
      platform,
      adaptedRecommendation: adaptRecommendation(insight, sourcePlatform, platform),
      confidence: calculatePropagationConfidence(insight, sourcePlatform, platform),
      sourceEvidence: {
        platform: sourcePlatform,
        outcome: insight.outcome,
        score_delta: insight.score_delta,
      },
    }));
}

/**
 * Read recommendation outcomes from all platforms and find cross-learning opportunities.
 *
 * @param {string} dir - Project directory
 * @returns {Object[]} Cross-learning opportunities
 */
function getCrossLearnings(dir) {
  const learningsFile = path.join(dir, '.claude', 'synergy-learnings.json');
  let learnings = [];
  try {
    learnings = JSON.parse(fs.readFileSync(learningsFile, 'utf8'));
  } catch {
    // No learnings file yet
  }

  // Group by recommendation type
  const byType = {};
  for (const learning of learnings) {
    if (!byType[learning.type]) byType[learning.type] = [];
    byType[learning.type].push(learning);
  }

  const opportunities = [];
  for (const [type, items] of Object.entries(byType)) {
    // Find successful outcomes
    const successes = items.filter(i => i.outcome === 'applied' || i.outcome === 'helpful');
    if (successes.length === 0) continue;

    // Find platforms that haven't tried this yet
    const triedPlatforms = new Set(items.map(i => i.platform));
    const allPlatforms = Object.keys(PLATFORM_SEMANTICS);
    const untried = allPlatforms.filter(p => !triedPlatforms.has(p));

    if (untried.length > 0) {
      const bestSuccess = successes.reduce((a, b) =>
        (b.score_delta || 0) > (a.score_delta || 0) ? b : a
      );
      opportunities.push({
        type,
        successfulOn: successes.map(s => s.platform),
        untestedOn: untried,
        bestEvidence: bestSuccess,
        propagations: propagateInsight(bestSuccess, bestSuccess.platform, untried),
      });
    }
  }

  return opportunities;
}

/**
 * Record a learning outcome for later cross-platform propagation.
 *
 * @param {string} dir - Project directory
 * @param {Object} outcome - { platform, type, recommendation, outcome, score_delta }
 */
function recordLearningOutcome(dir, outcome) {
  const learningsFile = path.join(dir, '.claude', 'synergy-learnings.json');
  let learnings = [];
  try {
    learnings = JSON.parse(fs.readFileSync(learningsFile, 'utf8'));
  } catch {
    // Start fresh
  }

  learnings.push({
    ...outcome,
    timestamp: new Date().toISOString(),
  });

  const claudeDir = path.join(dir, '.claude');
  if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(learningsFile, JSON.stringify(learnings, null, 2));
}

module.exports = { propagateInsight, getCrossLearnings, recordLearningOutcome };
