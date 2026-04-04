/**
 * Cursor Interactive Wizard — 10-stage guided setup.
 *
 * Adapted for Cursor's 3-surface architecture (foreground, background, automations).
 *
 * Stages:
 *   1.  Project detection (stacks, existing .cursor/, .cursorrules)
 *   2.  Rule type selection (Always, Auto Attached, Agent Requested, Manual)
 *   3.  Legacy migration (.cursorrules → .cursor/rules/)
 *   4.  Background agent setup
 *   5.  Domain pack selection
 *   6.  MCP pack selection
 *   7.  Automation config
 *   8.  BugBot configuration
 *   9.  Privacy & security
 *   10. Review & generate
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { CursorProjectContext } = require('./context');
const { CURSOR_TECHNIQUES } = require('./techniques');
const { CURSOR_DOMAIN_PACKS, detectCursorDomainPacks } = require('./domain-packs');
const { recommendCursorMcpPacks, CURSOR_MCP_PACKS } = require('./mcp-packs');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[36m', magenta: '\x1b[35m',
};
const c = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function isTTY() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

const STAGE_NAMES = [
  'Project Detection',
  'Rule Type Selection',
  'Legacy Migration',
  'Background Agent Setup',
  'Domain Pack Selection',
  'MCP Pack Selection',
  'Automation Config',
  'BugBot Configuration',
  'Privacy & Security',
  'Review & Generate',
];

function printStageHeader(index) {
  console.log('');
  console.log(c(`  ── Stage ${index + 1}/${STAGE_NAMES.length}: ${STAGE_NAMES[index]} ──`, 'magenta'));
  console.log('');
}

// --- Stage 1: Project Detection ---

function runProjectDetection(ctx) {
  const stacks = ctx.detectStacks(STACKS);
  const rules = ctx.cursorRules ? ctx.cursorRules() : [];
  const hasLegacy = ctx.hasLegacyRules ? ctx.hasLegacyRules() : false;
  const hasMcpJson = ctx.mcpConfig().ok;
  const hasEnvJson = ctx.environmentJson().ok;
  const automations = ctx.automationsConfig ? ctx.automationsConfig() : [];
  const surfaces = ctx.detectSurfaces();

  const auditResults = [];
  for (const [key, technique] of Object.entries(CURSOR_TECHNIQUES)) {
    auditResults.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const passed = auditResults.filter(r => r.passed === true);
  const failed = auditResults.filter(r => r.passed === false);

  return { stacks, rules, hasLegacy, hasMcpJson, hasEnvJson, automations, surfaces, auditResults, passed, failed };
}

async function stageProjectDetection(rl, ctx, state) {
  printStageHeader(0);
  const det = runProjectDetection(ctx);
  Object.assign(state, det);

  if (det.stacks.length > 0) console.log(c(`  Detected stacks: ${det.stacks.map(s => s.label).join(', ')}`, 'blue'));
  else console.log(c('  No specific stack detected — will use baseline defaults.', 'dim'));

  console.log(c(`  Working directory: ${ctx.dir}`, 'dim'));
  console.log('');
  console.log(`  ${c(`${det.passed.length}/${det.auditResults.length}`, 'bold')} Cursor checks passing.`);
  console.log(`  ${c(String(det.failed.length), 'yellow')} improvements available.`);
  console.log('');
  console.log(`  Surfaces: FG ${det.surfaces.foreground ? c('Y', 'green') : c('N', 'red')} | BG ${det.surfaces.background ? c('Y', 'green') : c('N', 'red')} | Auto ${det.surfaces.automations ? c('Y', 'green') : c('N', 'red')}`);
  console.log(`  Rules: ${det.rules.length} .mdc files${det.hasLegacy ? c(' + .cursorrules (IGNORED by agents!)', 'red') : ''}`);

  if (det.rules.length > 0 || det.hasLegacy) {
    console.log('');
    if (det.hasLegacy) console.log(c('  CRITICAL: .cursorrules found — this file is IGNORED by agent mode!', 'red'));
    if (det.rules.length > 0) console.log(c(`    ${det.rules.length} .mdc rule files in .cursor/rules/`, 'dim'));
    if (det.hasMcpJson) console.log(c('    .cursor/mcp.json found', 'dim'));
    if (det.hasEnvJson) console.log(c('    .cursor/environment.json found', 'dim'));
    console.log('');

    const answer = await ask(rl, c('  Merge with existing config or replace? (merge/replace/quit) ', 'magenta'));
    const choice = answer.trim().toLowerCase();
    if (choice === 'quit' || choice === 'q') return 'quit';
    state.migrationMode = choice === 'replace' ? 'replace' : 'merge';
  } else {
    state.migrationMode = 'create';
    console.log('');
    console.log(c('  No existing Cursor rules — will create fresh setup.', 'dim'));
  }

  return 'next';
}

// --- Stage 2: Rule Type Selection ---

async function stageRuleTypeSelection(rl, _ctx, state) {
  printStageHeader(1);

  console.log('  Cursor supports 4 rule types. Which do you want to generate?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Always Apply only', 'blue')} — Core rules for every interaction.`);
  console.log(`    ${c('2', 'bold')}. ${c('Always + Auto Attached', 'blue')} — Core + file-type-specific rules.`);
  console.log(`    ${c('3', 'bold')}. ${c('Full set', 'blue')} — Always + Auto Attached + Agent Requested.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [2]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const choice = parseInt(trimmed, 10);
  state.ruleTypes = ['always'];
  if (choice >= 2 || trimmed === '') state.ruleTypes.push('auto-attached');
  if (choice >= 3) state.ruleTypes.push('agent-requested');

  console.log(c(`  → Rule types: ${state.ruleTypes.join(', ')}`, 'green'));
  return 'next';
}

// --- Stage 3: Legacy Migration ---

async function stageLegacyMigration(rl, ctx, state) {
  if (!state.hasLegacy) return 'next';

  printStageHeader(2);

  console.log(c('  CRITICAL: .cursorrules file detected!', 'red'));
  console.log('');
  console.log('  Agent mode COMPLETELY IGNORES .cursorrules.');
  console.log('  Only .cursor/rules/*.mdc files with MDC frontmatter reach agents.');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Auto-migrate', 'blue')} — Convert .cursorrules content to .mdc format.`);
  console.log(`    ${c('2', 'bold')}. ${c('Keep both', 'yellow')} — Generate new .mdc rules alongside .cursorrules.`);
  console.log(`    ${c('3', 'bold')}. ${c('Skip', 'dim')} — Handle migration manually later.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const choice = parseInt(trimmed, 10);
  state.legacyMigration = choice === 3 ? 'skip' : choice === 2 ? 'keep-both' : 'auto-migrate';
  console.log(c(`  → Legacy migration: ${state.legacyMigration}`, 'green'));
  return 'next';
}

// --- Stage 4: Background Agent Setup ---

async function stageBackgroundAgent(rl, _ctx, state) {
  printStageHeader(3);

  console.log('  Configure background agent environment?');
  console.log('');
  console.log(c('  Background agents run on ephemeral Ubuntu VMs.', 'dim'));
  console.log(c('  SECURITY: They have full home directory read access.', 'yellow'));
  console.log(c('  Privacy Mode must be DISABLED to use background agents.', 'yellow'));
  console.log('');

  const answer = await ask(rl, c('  Generate .cursor/environment.json? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateEnvironment = trimmed !== 'n';
  console.log(c(`  → Background agent: ${state.generateEnvironment ? 'will configure' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 5: Domain Pack Selection ---

async function stageDomainPacks(rl, ctx, state) {
  printStageHeader(4);

  const detected = detectCursorDomainPacks(ctx, state.stacks || []);
  state.domainPacks = detected;

  console.log(`  Detected ${detected.length} domain pack(s):`);
  console.log('');
  detected.forEach((pack, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')} — ${pack.matchReasons[0] || pack.useWhen}`);
  });
  console.log('');

  const answer = await ask(rl, c('  Accept detected packs? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';
  if (trimmed === 'n') state.domainPacks = [];

  console.log(c(`  → Domain packs: ${state.domainPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));
  return 'next';
}

// --- Stage 6: MCP Pack Selection ---

async function stageMcpPacks(rl, ctx, state) {
  printStageHeader(5);

  const backgroundOnly = state.generateEnvironment && !state.surfaces?.foreground;
  const recommended = recommendCursorMcpPacks(state.stacks || [], state.domainPacks || [], { ctx, backgroundOnly });
  state.mcpPacks = recommended;

  console.log(`  Recommended ${recommended.length} MCP pack(s):`);
  console.log(c(`  (Cursor hard limit: ~40 tools total — estimated: ~${recommended.length * 5} tools)`, 'yellow'));
  console.log('');
  recommended.forEach((pack, i) => {
    const bgIcon = pack.backgroundAgentCompatible === false ? c(' [FG only]', 'yellow') : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${bgIcon} — ${pack.description}`);
  });
  console.log('');

  const answer = await ask(rl, c('  Accept recommended packs? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';
  if (trimmed === 'n') state.mcpPacks = [];

  console.log(c(`  → MCP packs: ${state.mcpPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));
  return 'next';
}

// --- Stage 7: Automation Config ---

async function stageAutomationConfig(rl, _ctx, state) {
  printStageHeader(6);

  console.log('  Configure event-driven automations?');
  console.log('');
  console.log(c('  Automations run WITHOUT human approval.', 'red'));
  console.log(c('  Supported triggers: cron, GitHub events, Slack, Linear, webhook, etc.', 'dim'));
  console.log(c('  Each run has a 30-minute cap and fresh container.', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Set up automations? (y/n, or b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateAutomations = trimmed === 'y';
  console.log(c(`  → Automations: ${state.generateAutomations ? 'will configure' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 8: BugBot ---

async function stageBugbot(rl, _ctx, state) {
  printStageHeader(7);

  console.log('  Configure BugBot for automated PR review?');
  console.log('');
  console.log(c('  BugBot processes 2M+ PRs/month. Can auto-fix >70% of issues.', 'dim'));
  console.log(c('  Pricing: $40/user/month for up to 200 PRs/month.', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Generate BugBot configuration guide? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateBugbot = trimmed !== 'n';
  console.log(c(`  → BugBot: ${state.generateBugbot ? 'will configure' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 9: Privacy & Security ---

async function stagePrivacySecurity(rl, _ctx, state) {
  printStageHeader(8);

  console.log(c('  IMPORTANT: Privacy Mode is OFF by default in Cursor!', 'red'));
  console.log('');
  console.log('  When Privacy Mode is off, your code is sent to model providers.');
  console.log('  Enable in: Cursor Settings > General > Privacy Mode');
  console.log('');

  const answer = await ask(rl, c('  Acknowledge privacy risk and continue? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';
  if (trimmed === 'n') return 'quit';

  state.privacyAcknowledged = true;
  console.log(c('  → Privacy risk acknowledged. Remember to enable Privacy Mode for sensitive repos.', 'yellow'));
  return 'next';
}

// --- Stage 10: Review & Generate ---

async function stageReviewGenerate(rl, _ctx, state) {
  printStageHeader(9);

  console.log('  Summary of your Cursor setup:');
  console.log('');
  console.log(`    Rule types: ${(state.ruleTypes || []).join(', ')}`);
  console.log(`    Legacy migration: ${state.legacyMigration || 'N/A'}`);
  console.log(`    Background agent: ${state.generateEnvironment ? 'yes' : 'no'}`);
  console.log(`    Domain packs: ${(state.domainPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`    MCP packs: ${(state.mcpPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`    Automations: ${state.generateAutomations ? 'yes' : 'no'}`);
  console.log(`    BugBot: ${state.generateBugbot ? 'yes' : 'no'}`);
  console.log('');

  const answer = await ask(rl, c('  Generate files? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';
  if (trimmed === 'n') return 'quit';

  state.confirmed = true;
  return 'done';
}

// --- Main Wizard ---

const STAGES = [
  stageProjectDetection,
  stageRuleTypeSelection,
  stageLegacyMigration,
  stageBackgroundAgent,
  stageDomainPacks,
  stageMcpPacks,
  stageAutomationConfig,
  stageBugbot,
  stagePrivacySecurity,
  stageReviewGenerate,
];

async function runCursorWizard(options) {
  if (!isTTY()) {
    console.log('Interactive wizard requires a TTY. Use --non-interactive or pipe mode instead.');
    return null;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new CursorProjectContext(options.dir);
  const state = {};

  console.log('');
  console.log(c('  nerviq cursor interactive wizard', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));

  let stageIndex = 0;

  try {
    while (stageIndex < STAGES.length) {
      const result = await STAGES[stageIndex](rl, ctx, state);
      if (result === 'quit') { rl.close(); return null; }
      if (result === 'back') { stageIndex = Math.max(0, stageIndex - 1); continue; }
      if (result === 'done') break;
      stageIndex++;
    }
  } finally {
    rl.close();
  }

  if (!state.confirmed) return null;
  return state;
}

module.exports = {
  runCursorWizard,
  runProjectDetection,
};
