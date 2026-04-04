/**
 * Windsurf Interactive Wizard — 10-stage guided setup.
 *
 * Adapted for Windsurf's architecture (foreground Cascade, memories, workflows).
 *
 * Stages:
 *   1.  Project detection (stacks, existing .windsurf/, .windsurfrules)
 *   2.  Rule type selection (Always, Auto, Agent-Requested, Manual)
 *   3.  Legacy migration (.windsurfrules -> .windsurf/rules/)
 *   4.  Cascadeignore setup
 *   5.  Domain pack selection
 *   6.  MCP pack selection
 *   7.  Workflow config
 *   8.  Memories config
 *   9.  Team & security
 *   10. Review & generate
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { WindsurfProjectContext } = require('./context');
const { WINDSURF_TECHNIQUES } = require('./techniques');
const { WINDSURF_DOMAIN_PACKS, detectWindsurfDomainPacks } = require('./domain-packs');
const { recommendWindsurfMcpPacks, WINDSURF_MCP_PACKS } = require('./mcp-packs');

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
  'Cascadeignore Setup',
  'Domain Pack Selection',
  'MCP Pack Selection',
  'Workflow Config',
  'Memories Config',
  'Team & Security',
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
  const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
  const hasLegacy = ctx.hasLegacyRules ? ctx.hasLegacyRules() : false;
  const hasMcpJson = ctx.mcpConfig().ok;
  const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
  const memories = ctx.memoryFiles ? ctx.memoryFiles() : [];
  const hasCascadeignore = ctx.hasCascadeignore ? ctx.hasCascadeignore() : false;
  const surfaces = ctx.detectSurfaces();

  const auditResults = [];
  for (const [key, technique] of Object.entries(WINDSURF_TECHNIQUES)) {
    auditResults.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const passed = auditResults.filter(r => r.passed === true);
  const failed = auditResults.filter(r => r.passed === false);

  return { stacks, rules, hasLegacy, hasMcpJson, workflows, memories, hasCascadeignore, surfaces, auditResults, passed, failed };
}

async function stageProjectDetection(rl, ctx, state) {
  printStageHeader(0);
  const det = runProjectDetection(ctx);
  Object.assign(state, det);

  if (det.stacks.length > 0) console.log(c(`  Detected stacks: ${det.stacks.map(s => s.label).join(', ')}`, 'blue'));
  else console.log(c('  No specific stack detected — will use baseline defaults.', 'dim'));

  console.log(c(`  Working directory: ${ctx.dir}`, 'dim'));
  console.log('');
  console.log(`  ${c(`${det.passed.length}/${det.auditResults.length}`, 'bold')} Windsurf checks passing.`);
  console.log(`  ${c(String(det.failed.length), 'yellow')} improvements available.`);
  console.log('');
  console.log(`  Surfaces: FG ${det.surfaces.foreground ? c('Y', 'green') : c('N', 'red')} | WF ${det.surfaces.workflows ? c('Y', 'green') : c('N', 'red')} | Mem ${det.surfaces.memories ? c('Y', 'green') : c('N', 'red')} | CI ${det.hasCascadeignore ? c('Y', 'green') : c('N', 'red')}`);
  console.log(`  Rules: ${det.rules.length} .md files${det.hasLegacy ? c(' + .windsurfrules (legacy!)', 'red') : ''}`);

  if (det.rules.length > 0 || det.hasLegacy) {
    console.log('');
    if (det.hasLegacy) console.log(c('  WARNING: .windsurfrules found — this is the legacy format!', 'red'));
    if (det.rules.length > 0) console.log(c(`    ${det.rules.length} .md rule files in .windsurf/rules/`, 'dim'));
    if (det.hasMcpJson) console.log(c('    .windsurf/mcp.json found', 'dim'));
    console.log('');

    const answer = await ask(rl, c('  Merge with existing config or replace? (merge/replace/quit) ', 'magenta'));
    const choice = answer.trim().toLowerCase();
    if (choice === 'quit' || choice === 'q') return 'quit';
    state.migrationMode = choice === 'replace' ? 'replace' : 'merge';
  } else {
    state.migrationMode = 'create';
    console.log('');
    console.log(c('  No existing Windsurf rules — will create fresh setup.', 'dim'));
  }

  return 'next';
}

// --- Stage 2: Rule Type Selection ---

async function stageRuleTypeSelection(rl, _ctx, state) {
  printStageHeader(1);

  console.log('  Windsurf supports 4 rule activation modes. Which do you want to generate?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Always only', 'blue')} — Core rules for every Cascade interaction.`);
  console.log(`    ${c('2', 'bold')}. ${c('Always + Auto', 'blue')} — Core + file-type-specific rules.`);
  console.log(`    ${c('3', 'bold')}. ${c('Full set', 'blue')} — Always + Auto + Agent-Requested.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [2]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const choice = parseInt(trimmed, 10);
  state.ruleTypes = ['always'];
  if (choice >= 2 || trimmed === '') state.ruleTypes.push('auto');
  if (choice >= 3) state.ruleTypes.push('agent-requested');

  console.log(c(`  → Rule types: ${state.ruleTypes.join(', ')}`, 'green'));
  return 'next';
}

// --- Stage 3: Legacy Migration ---

async function stageLegacyMigration(rl, ctx, state) {
  if (!state.hasLegacy) return 'next';

  printStageHeader(2);

  console.log(c('  WARNING: .windsurfrules file detected!', 'red'));
  console.log('');
  console.log('  The .windsurfrules file is the legacy format.');
  console.log('  Migrate to .windsurf/rules/*.md with YAML frontmatter for best results.');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Auto-migrate', 'blue')} — Convert .windsurfrules content to .md format.`);
  console.log(`    ${c('2', 'bold')}. ${c('Keep both', 'yellow')} — Generate new .md rules alongside .windsurfrules.`);
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

// --- Stage 4: Cascadeignore Setup ---

async function stageCascadeignore(rl, _ctx, state) {
  printStageHeader(3);

  console.log('  Configure .cascadeignore for sensitive file exclusion?');
  console.log('');
  console.log(c('  .cascadeignore uses gitignore syntax to prevent Cascade from accessing files.', 'dim'));
  console.log(c('  Recommended patterns: .env, secrets/, credentials/, .aws/, .ssh/', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Generate .cascadeignore? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateCascadeignore = trimmed !== 'n';
  console.log(c(`  → Cascadeignore: ${state.generateCascadeignore ? 'will configure' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 5: Domain Pack Selection ---

async function stageDomainPacks(rl, ctx, state) {
  printStageHeader(4);

  const detected = detectWindsurfDomainPacks(ctx, state.stacks || []);
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

  const recommended = recommendWindsurfMcpPacks(state.stacks || [], state.domainPacks || [], { ctx });
  state.mcpPacks = recommended;

  console.log(`  Recommended ${recommended.length} MCP pack(s):`);
  console.log('');
  recommended.forEach((pack, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')} — ${pack.description}`);
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

// --- Stage 7: Workflow Config ---

async function stageWorkflowConfig(rl, _ctx, state) {
  printStageHeader(6);

  console.log('  Configure Windsurf workflows (slash commands)?');
  console.log('');
  console.log(c('  Workflows define reusable slash commands for Cascade.', 'dim'));
  console.log(c('  Stored in .windsurf/workflows/*.md', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Set up starter workflows? (y/n, or b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateWorkflows = trimmed === 'y';
  console.log(c(`  → Workflows: ${state.generateWorkflows ? 'will configure' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 8: Memories Config ---

async function stageMemoriesConfig(rl, _ctx, state) {
  printStageHeader(7);

  console.log('  Configure Windsurf memories (persistent context)?');
  console.log('');
  console.log(c('  Memories provide persistent context that syncs across team members.', 'dim'));
  console.log(c('  IMPORTANT: Never put secrets or PII in memories — they sync to all team members!', 'yellow'));
  console.log('');

  const answer = await ask(rl, c('  Generate starter memories? (y/n, or b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateMemories = trimmed === 'y';
  console.log(c(`  → Memories: ${state.generateMemories ? 'will configure' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 9: Team & Security ---

async function stageTeamSecurity(rl, _ctx, state) {
  printStageHeader(8);

  console.log('  Review team and security considerations:');
  console.log('');
  console.log(c('  1. Memories sync across team — check for secrets/PII', 'yellow'));
  console.log(c('  2. MCP servers can be whitelisted at team level', 'dim'));
  console.log(c('  3. .cascadeignore protects sensitive files from Cascade', 'dim'));
  console.log(c('  4. Each rule file has a 10K character limit', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Acknowledge team/security considerations? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';
  if (trimmed === 'n') return 'quit';

  state.securityAcknowledged = true;
  console.log(c('  → Team/security considerations acknowledged.', 'yellow'));
  return 'next';
}

// --- Stage 10: Review & Generate ---

async function stageReviewGenerate(rl, _ctx, state) {
  printStageHeader(9);

  console.log('  Summary of your Windsurf setup:');
  console.log('');
  console.log(`    Rule types: ${(state.ruleTypes || []).join(', ')}`);
  console.log(`    Legacy migration: ${state.legacyMigration || 'N/A'}`);
  console.log(`    Cascadeignore: ${state.generateCascadeignore ? 'yes' : 'no'}`);
  console.log(`    Domain packs: ${(state.domainPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`    MCP packs: ${(state.mcpPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`    Workflows: ${state.generateWorkflows ? 'yes' : 'no'}`);
  console.log(`    Memories: ${state.generateMemories ? 'yes' : 'no'}`);
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
  stageCascadeignore,
  stageDomainPacks,
  stageMcpPacks,
  stageWorkflowConfig,
  stageMemoriesConfig,
  stageTeamSecurity,
  stageReviewGenerate,
];

async function runWindsurfWizard(options) {
  if (!isTTY()) {
    console.log('Interactive wizard requires a TTY. Use --non-interactive or pipe mode instead.');
    return null;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new WindsurfProjectContext(options.dir);
  const state = {};

  console.log('');
  console.log(c('  nerviq windsurf interactive wizard', 'bold'));
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
  runWindsurfWizard,
  runProjectDetection,
};
