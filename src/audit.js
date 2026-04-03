/**
 * Audit engine - evaluates project against CLAUDEX technique database.
 */

const { TECHNIQUES, STACKS } = require('./techniques');
const { ProjectContext } = require('./context');
const { getBadgeMarkdown } = require('./badge');
const { sendInsights, getLocalInsights } = require('./insights');
const { getRecommendationOutcomeSummary, getRecommendationAdjustment } = require('./activity');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function progressBar(score, max = 100, width = 20) {
  const filled = Math.round((score / max) * width);
  const empty = width - filled;
  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  return colorize('█'.repeat(filled), color) + colorize('░'.repeat(empty), 'dim');
}

const IMPACT_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };
const CATEGORY_MODULES = {
  memory: 'CLAUDE.md',
  quality: 'verification',
  git: 'safety',
  workflow: 'commands-agents-skills',
  security: 'permissions',
  automation: 'hooks',
  design: 'design-rules',
  devops: 'ci-devops',
  hygiene: 'project-hygiene',
  performance: 'context-management',
  tools: 'mcp-tools',
  prompting: 'prompt-structure',
  features: 'modern-claude-features',
  'quality-deep': 'quality-deep',
};
const ACTION_RATIONALES = {
  noBypassPermissions: 'bypassPermissions skips the main safety layer. Explicit allow and deny rules create safer autonomy.',
  secretsProtection: 'Without secret protection, Claude can accidentally inspect sensitive files and leak them into outputs.',
  permissionDeny: 'Deny rules are the strongest way to prevent dangerous reads and destructive operations.',
  settingsPermissions: 'Explicit permission settings make the workflow safer, more governable, and easier to review.',
  testCommand: 'Without a test command, Claude cannot verify that its changes actually work before handoff.',
  lintCommand: 'Without a lint command, Claude will miss formatting and style regressions that teams expect to catch automatically.',
  buildCommand: 'Without a build command, compile and packaging failures stay invisible until later in the workflow.',
  ciPipeline: 'CI is what turns a local setup improvement into a repeatable team-wide standard.',
  securityReview: 'If you do not wire in security review guidance, high-risk changes are easier to ship without the right scrutiny.',
  skills: 'Skills package reusable expertise so Claude does not need the same context re-explained every session.',
  multipleAgents: 'Specialized agents unlock role-based work such as security review, implementation, and QA in parallel.',
  multipleMcpServers: 'A richer MCP surface gives Claude access to live tools and documentation instead of stale assumptions.',
  roleDefinition: 'A clear role definition calibrates how Claude thinks, explains, and validates work in this repo.',
  importSyntax: 'Imported modules keep CLAUDE.md maintainable as the workflow grows more sophisticated.',
  claudeMd: 'CLAUDE.md is the foundation of project-specific context. Without it, Claude starts every task half-blind.',
  hooks: 'Hooks enforce the rules programmatically, which is much more reliable than relying on instructions alone.',
  pathRules: 'Path-specific rules help Claude behave differently in different parts of the repo without global noise.',
  context7Mcp: 'Live documentation reduces version drift and cuts down on confident but outdated answers.',
};

function riskFromImpact(impact) {
  if (impact === 'critical') return 'high';
  if (impact === 'high') return 'medium';
  return 'low';
}

function confidenceFromImpact(impact) {
  return impact === 'critical' || impact === 'high' ? 'high' : 'medium';
}

function getPrioritizedFailed(failed) {
  const prioritized = failed.filter(r => !(r.category === 'hygiene' && r.impact === 'low'));
  return prioritized.length > 0 ? prioritized : failed;
}

function getQuickWins(failed) {
  const pool = getPrioritizedFailed(failed);

  // QuickWins prioritize short fixes (easy to implement) first, then impact
  return [...pool]
    .sort((a, b) => {
      const fixLenA = (a.fix || '').length;
      const fixLenB = (b.fix || '').length;
      if (fixLenA !== fixLenB) return fixLenA - fixLenB;
      const impactA = IMPACT_ORDER[a.impact] ?? 0;
      const impactB = IMPACT_ORDER[b.impact] ?? 0;
      return impactB - impactA;
    })
    .slice(0, 3);
}

function getRecommendationPriorityScore(item, outcomeSummaryByKey = {}) {
  const impactScore = (IMPACT_ORDER[item.impact] ?? 0) * 100;
  const feedbackAdjustment = getRecommendationAdjustment(outcomeSummaryByKey, item.key);
  const brevityPenalty = Math.min((item.fix || '').length, 240) / 20;
  return impactScore + (feedbackAdjustment * 10) - brevityPenalty;
}

function buildTopNextActions(failed, limit = 5, outcomeSummaryByKey = {}) {
  const pool = getPrioritizedFailed(failed);

  return [...pool]
    .sort((a, b) => {
      return getRecommendationPriorityScore(b, outcomeSummaryByKey) - getRecommendationPriorityScore(a, outcomeSummaryByKey);
    })
    .slice(0, limit)
    .map(({ key, name, impact, fix, category }) => {
      const feedback = outcomeSummaryByKey[key] || null;
      const rankingAdjustment = getRecommendationAdjustment(outcomeSummaryByKey, key);
      const signals = [
        `failed-check:${key}`,
        `impact:${impact}`,
        `category:${category}`,
      ];
      if (feedback) {
        signals.push(`feedback:${feedback.total}`);
        signals.push(`ranking-adjustment:${rankingAdjustment >= 0 ? '+' : ''}${rankingAdjustment}`);
      }

      return ({
      key,
      name,
      impact,
      category,
      module: CATEGORY_MODULES[category] || category,
      fix,
      why: ACTION_RATIONALES[key] || fix,
      risk: riskFromImpact(impact),
      confidence: confidenceFromImpact(impact),
      signals,
      evidenceClass: feedback ? 'measured' : 'estimated',
      rankingAdjustment,
      feedback: feedback ? {
        total: feedback.total,
        accepted: feedback.accepted,
        rejected: feedback.rejected,
        deferred: feedback.deferred,
        positive: feedback.positive,
        negative: feedback.negative,
        avgScoreDelta: feedback.avgScoreDelta,
      } : null,
    });
    });
}

function inferSuggestedNextCommand(result) {
  const actionKeys = new Set((result.topNextActions || []).map(item => item.key));

  if (result.failed === 0) {
    return 'npx claudex-setup augment';
  }

  if (
    result.score < 50 ||
    actionKeys.has('claudeMd') ||
    actionKeys.has('hooks') ||
    actionKeys.has('settingsPermissions') ||
    actionKeys.has('permissionDeny')
  ) {
    return 'npx claudex-setup setup';
  }

  if (result.score < 80) {
    return 'npx claudex-setup suggest-only';
  }

  return 'npx claudex-setup augment';
}

function printLiteAudit(result, dir) {
  console.log('');
  console.log(colorize('  claudex-setup quick scan', 'bold'));
  console.log(colorize('  ═══════════════════════════════════════', 'dim'));
  console.log(colorize(`  Scanning: ${dir}`, 'dim'));
  console.log('');
  console.log(`  Score: ${colorize(`${result.score}/100`, 'bold')}`);
  console.log('');

  if (result.failed === 0) {
    console.log(colorize('  Your Claude setup looks solid.', 'green'));
    console.log(`  Next: ${colorize(result.suggestedNextCommand, 'bold')}`);
    console.log('');
    return;
  }

  console.log(colorize('  Top 3 things to fix right now:', 'magenta'));
  console.log('');
  result.liteSummary.topNextActions.forEach((item, index) => {
    console.log(`  ${index + 1}. ${colorize(item.name, 'bold')}`);
    console.log(colorize(`     Why: ${item.why}`, 'dim'));
    console.log(colorize(`     Fix: ${item.fix}`, 'dim'));
  });
  console.log('');
  console.log(`  Ready? Run: ${colorize(result.suggestedNextCommand, 'bold')}`);
  console.log('');
}

/**
 * Run a full audit of a project's Claude Code setup against the CLAUDEX technique database.
 * @param {Object} options - Audit options.
 * @param {string} options.dir - Project directory to audit.
 * @param {boolean} [options.silent] - Skip all console output, return result only.
 * @param {boolean} [options.json] - Output result as JSON.
 * @param {boolean} [options.lite] - Show short top-3 quick scan.
 * @param {boolean} [options.verbose] - Show all recommendations including medium-impact.
 * @returns {Promise<Object>} Audit result with score, passed/failed counts, quickWins, and topNextActions.
 */
async function audit(options) {
  const silent = options.silent || false;
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const results = [];
  const outcomeSummary = getRecommendationOutcomeSummary(options.dir);

  // Run all technique checks
  for (const [key, technique] of Object.entries(TECHNIQUES)) {
    const passed = technique.check(ctx);
    results.push({
      key,
      ...technique,
      passed,
    });
  }

  // null = not applicable (skip), true = pass, false = fail
  const applicable = results.filter(r => r.passed !== null);
  const skipped = results.filter(r => r.passed === null);
  const passed = applicable.filter(r => r.passed);
  const failed = applicable.filter(r => !r.passed);
  const critical = failed.filter(r => r.impact === 'critical');
  const high = failed.filter(r => r.impact === 'high');
  const medium = failed.filter(r => r.impact === 'medium');

  // Calculate score only from applicable checks
  const weights = { critical: 15, high: 10, medium: 5, low: 2 };
  const maxScore = applicable.reduce((sum, r) => sum + (weights[r.impact] || 5), 0);
  const earnedScore = passed.reduce((sum, r) => sum + (weights[r.impact] || 5), 0);
  const score = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;

  // Detect scaffolded vs organic: if CLAUDE.md contains our version stamp, some checks
  // are passing because WE generated them, not the user
  const claudeMd = ctx.claudeMdContent() || '';
  const isScaffolded = claudeMd.includes('Generated by claudex-setup') ||
    claudeMd.includes('claudex-setup');
  // Scaffolded checks: things our setup creates (CLAUDE.md, hooks, commands, agents, rules, skills)
  const scaffoldedKeys = new Set(['claudeMd', 'mermaidArchitecture', 'verificationLoop',
    'hooks', 'customCommands', 'multipleCommands', 'agents', 'pathRules', 'multipleRules',
    'skills', 'hooksConfigured', 'preToolUseHook', 'postToolUseHook', 'fewShotExamples',
    'constraintBlocks', 'xmlTags']);
  const organicPassed = passed.filter(r => !scaffoldedKeys.has(r.key));
  const scaffoldedPassed = passed.filter(r => scaffoldedKeys.has(r.key));
  const organicEarned = organicPassed.reduce((sum, r) => sum + (weights[r.impact] || 5), 0);
  const organicScore = maxScore > 0 ? Math.round((organicEarned / maxScore) * 100) : 0;
  const quickWins = getQuickWins(failed);
  const topNextActions = buildTopNextActions(failed, 5, outcomeSummary.byKey);
  const result = {
    score,
    organicScore,
    isScaffolded,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    checkCount: applicable.length,
    stacks,
    results,
    quickWins: quickWins.map(({ key, name, impact, fix, category }) => ({ key, name, impact, category, fix })),
    topNextActions,
    recommendationOutcomes: {
      totalEntries: outcomeSummary.totalEntries,
      keysTracked: outcomeSummary.keys,
    },
  };
  result.suggestedNextCommand = inferSuggestedNextCommand(result);
  result.liteSummary = {
    topNextActions: topNextActions.slice(0, 3),
    nextCommand: result.suggestedNextCommand,
  };

  // Silent mode: skip all output, just return result
  if (silent) {
    return result;
  }

  if (options.json) {
    const { version } = require('../package.json');
    console.log(JSON.stringify({
      version,
      timestamp: new Date().toISOString(),
      ...result
    }, null, 2));
    return result;
  }

  if (options.lite) {
    printLiteAudit(result, options.dir);
    sendInsights(result);
    return result;
  }

  // Display results
  console.log('');
  console.log(colorize('  claudex-setup audit', 'bold'));
  console.log(colorize('  ═══════════════════════════════════════', 'dim'));
  console.log(colorize(`  Scanning: ${options.dir}`, 'dim'));

  if (stacks.length > 0) {
    console.log(colorize(`  Detected: ${stacks.map(s => s.label).join(', ')}`, 'blue'));
  }

  console.log('');

  // Score
  console.log(`  ${progressBar(score)} ${colorize(`${score}/100`, 'bold')}`);
  if (isScaffolded && scaffoldedPassed.length > 0) {
    console.log(colorize(`  Organic: ${organicScore}/100 (without claudex-setup generated files)`, 'dim'));
  }
  console.log('');

  // Passed
  if (passed.length > 0) {
    console.log(colorize('  ✅ Passing', 'green'));
    for (const r of passed) {
      console.log(colorize(`     ${r.name}`, 'dim'));
    }
    console.log('');
  }

  // Failed - by priority
  if (critical.length > 0) {
    console.log(colorize('  🔴 Critical (fix immediately)', 'red'));
    for (const r of critical) {
      console.log(`     ${colorize(r.name, 'bold')}`);
      console.log(colorize(`     → ${r.fix}`, 'dim'));
    }
    console.log('');
  }

  if (high.length > 0) {
    console.log(colorize('  🟡 High Impact', 'yellow'));
    for (const r of high) {
      console.log(`     ${colorize(r.name, 'bold')}`);
      console.log(colorize(`     → ${r.fix}`, 'dim'));
    }
    console.log('');
  }

  if (medium.length > 0 && options.verbose) {
    console.log(colorize('  🔵 Recommended', 'blue'));
    for (const r of medium) {
      console.log(`     ${colorize(r.name, 'bold')}`);
      console.log(colorize(`     → ${r.fix}`, 'dim'));
    }
    console.log('');
  } else if (medium.length > 0) {
    console.log(colorize(`  🔵 ${medium.length} more recommendations (use --verbose)`, 'blue'));
    console.log('');
  }

  // Top next actions
  if (topNextActions.length > 0) {
    console.log(colorize('  ⚡ Top 5 Next Actions', 'magenta'));
    for (let i = 0; i < topNextActions.length; i++) {
      const item = topNextActions[i];
      console.log(`     ${i + 1}. ${colorize(item.name, 'bold')}`);
      console.log(colorize(`        Why: ${item.why}`, 'dim'));
      console.log(colorize(`        Trace: ${item.signals.join(' | ')}`, 'dim'));
      console.log(colorize(`        Risk: ${item.risk} | Confidence: ${item.confidence}`, 'dim'));
      if (item.feedback) {
        const avgDelta = Number.isFinite(item.feedback.avgScoreDelta) ? ` | Avg score delta: ${item.feedback.avgScoreDelta >= 0 ? '+' : ''}${item.feedback.avgScoreDelta}` : '';
        console.log(colorize(`        Feedback: accepted ${item.feedback.accepted}, rejected ${item.feedback.rejected}, positive ${item.feedback.positive}, negative ${item.feedback.negative}${avgDelta}`, 'dim'));
      }
      console.log(colorize(`        Fix: ${item.fix}`, 'dim'));
    }
    console.log('');
  }

  // Summary
  console.log(colorize('  ─────────────────────────────────────', 'dim'));
  console.log(`  ${colorize(`${passed.length}/${applicable.length}`, 'bold')} checks passing${skipped.length > 0 ? colorize(` (${skipped.length} not applicable)`, 'dim') : ''}`);

  if (failed.length > 0) {
    console.log(`  Next command: ${colorize(result.suggestedNextCommand, 'bold')}`);
  }

  console.log('');
  console.log(`  Add to README: ${getBadgeMarkdown(score)}`);
  console.log('');

  // Weakest categories insight
  const insights = getLocalInsights({ score, results });
  if (insights.weakest.length > 0) {
    console.log(colorize('  Weakest areas:', 'dim'));
    for (const w of insights.weakest) {
      const bar = w.score === 0 ? colorize('none', 'red') : `${w.score}%`;
      console.log(colorize(`     ${w.name}: ${bar} (${w.passed}/${w.total})`, 'dim'));
    }
    console.log('');
  }

  console.log(colorize('  Backed by CLAUDEX research and evidence', 'dim'));
  console.log(colorize('  https://github.com/DnaFin/claudex-setup', 'dim'));
  console.log('');

  // Send anonymous insights (opt-in, privacy-first, fire-and-forget)
  sendInsights(result);

  return result;
}

module.exports = { audit, buildTopNextActions };
