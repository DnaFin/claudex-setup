/**
 * OpenCode Interactive Wizard
 *
 * 8-stage guided setup for OpenCode CLI projects.
 * Uses Node.js readline (zero dependencies).
 *
 * Stages:
 *   1. Project detection
 *   2. Permission posture
 *   3. Agent structure
 *   4. Domain pack selection
 *   5. MCP pack selection
 *   6. Plugin configuration
 *   7. CI integration
 *   8. Review & generate
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { OpenCodeProjectContext } = require('./context');
const { OPENCODE_TECHNIQUES } = require('./techniques');
const { OPENCODE_DOMAIN_PACKS, detectOpenCodeDomainPacks } = require('./domain-packs');
const { recommendOpenCodeMcpPacks, OPENCODE_MCP_PACKS } = require('./mcp-packs');
const { setupOpenCode } = require('./setup');

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
  'Permission Posture',
  'Agent Structure',
  'Domain Pack Selection',
  'MCP Pack Selection',
  'Plugin Configuration',
  'CI Integration',
  'Review & Generate',
];

function printStageHeader(index) {
  const num = index + 1;
  const total = STAGE_NAMES.length;
  console.log('');
  console.log(c(`  ── Stage ${num}/${total}: ${STAGE_NAMES[index]} ──`, 'magenta'));
  console.log('');
}

// Stage 1 — Project Detection
function runProjectDetection(ctx) {
  const stacks = ctx.detectStacks(STACKS);
  const hasOpenCodeDir = fs.existsSync(path.join(ctx.dir, '.opencode'));
  const hasAgentsMd = Boolean(ctx.fileContent('AGENTS.md'));
  const hasConfig = Boolean(ctx.configContent());

  const auditResults = [];
  for (const [key, technique] of Object.entries(OPENCODE_TECHNIQUES)) {
    auditResults.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const passed = auditResults.filter(r => r.passed === true);
  const failed = auditResults.filter(r => r.passed === false);

  return { stacks, hasOpenCodeDir, hasAgentsMd, hasConfig, auditResults, passed, failed };
}

async function stageProjectDetection(rl, ctx, state) {
  printStageHeader(0);
  const det = runProjectDetection(ctx);
  Object.assign(state, det);

  if (det.stacks.length > 0) {
    console.log(c(`  Detected stacks: ${det.stacks.map(s => s.label).join(', ')}`, 'blue'));
  } else {
    console.log(c('  No specific stack detected — will use baseline defaults.', 'dim'));
  }

  console.log(c(`  Working directory: ${ctx.dir}`, 'dim'));
  console.log('');
  console.log(`  ${c(`${det.passed.length}/${det.auditResults.length}`, 'bold')} OpenCode checks passing.`);
  console.log(`  ${c(String(det.failed.length), 'yellow')} improvements available.`);

  if (det.hasOpenCodeDir || det.hasAgentsMd || det.hasConfig) {
    console.log('');
    console.log(c('  Existing OpenCode configuration detected:', 'yellow'));
    if (det.hasOpenCodeDir) console.log(c('    .opencode/ directory found', 'dim'));
    if (det.hasAgentsMd) console.log(c('    AGENTS.md found', 'dim'));
    if (det.hasConfig) console.log(c('    opencode.json found', 'dim'));
    console.log('');

    const answer = await ask(rl, c('  Merge with existing config or replace? (merge/replace/quit) ', 'magenta'));
    const choice = answer.trim().toLowerCase();
    if (choice === 'quit' || choice === 'q') return 'quit';
    state.migrationMode = choice === 'replace' ? 'replace' : 'merge';
  } else {
    state.migrationMode = 'create';
    console.log('');
    console.log(c('  No existing OpenCode config — will create fresh setup.', 'dim'));
  }

  return 'next';
}

// Stage 2 — Permission Posture
const PERMISSION_PRESETS = [
  { key: 'locked-down', label: 'Locked Down (safest)', desc: 'Read-only access. No bash, no edits without approval.' },
  { key: 'standard', label: 'Standard (balanced)', desc: 'Ask before bash and edits. Allow reads and searches.' },
  { key: 'power-user', label: 'Power User (maximum autonomy)', desc: 'Allow most tools. Only ask for external directories.' },
];

async function stagePermissionPosture(rl, _ctx, state) {
  printStageHeader(1);

  console.log('  Select a permission posture for OpenCode:');
  console.log('');
  PERMISSION_PRESETS.forEach((p, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(p.label, 'blue')} — ${p.desc}`);
  });
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [2]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const idx = parseInt(trimmed, 10);
  const selected = PERMISSION_PRESETS[(idx >= 1 && idx <= 3) ? idx - 1 : 1];
  state.permissionPreset = selected.key;
  console.log(c(`  → Permission posture: ${selected.label}`, 'green'));

  return 'next';
}

// Stage 3 — Agent Structure
async function stageAgentStructure(rl, _ctx, state) {
  printStageHeader(2);

  console.log('  How should OpenCode operate in this project?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Single agent', 'blue')} — One agent handles everything.`);
  console.log(`    ${c('2', 'bold')}. ${c('Multi-agent', 'blue')} — Primary + specialized sub-agents.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-2, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.agentMode = trimmed === '2' ? 'multi' : 'single';
  console.log(c(`  → Agent mode: ${state.agentMode === 'multi' ? 'Multi-agent' : 'Single agent'}`, 'green'));

  return 'next';
}

// Stage 4 — Domain Pack Selection
async function stageDomainPacks(rl, ctx, state) {
  printStageHeader(3);

  const detected = detectOpenCodeDomainPacks(ctx, state.stacks || []);
  const detectedKeys = new Set(detected.map(p => p.key));

  console.log('  Available domain packs:');
  console.log('');

  const allPacks = OPENCODE_DOMAIN_PACKS.map(pack => ({ ...pack, isDetected: detectedKeys.has(pack.key) }));
  allPacks.forEach((pack, i) => {
    const marker = pack.isDetected ? c(' (detected)', 'green') : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${marker}`);
    console.log(c(`       ${pack.useWhen}`, 'dim'));
  });
  console.log('');

  const defaultSelection = allPacks.map((p, i) => p.isDetected ? String(i + 1) : null).filter(Boolean).join(',');
  const answer = await ask(rl, c(`  Select packs (comma-separated, b=back, q=quit) [${defaultSelection || 'detected'}]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  let selectedPacks;
  if (trimmed === '' || trimmed === 'all') selectedPacks = detected;
  else {
    const indices = trimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < allPacks.length);
    selectedPacks = indices.map(i => allPacks[i]);
  }

  state.domainPacks = selectedPacks;
  console.log(c(`  → Selected: ${selectedPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));
  return 'next';
}

// Stage 5 — MCP Pack Selection
async function stageMcpPacks(rl, ctx, state) {
  printStageHeader(4);

  const recommended = recommendOpenCodeMcpPacks(state.stacks || [], state.domainPacks || [], { ctx });
  const recommendedKeys = new Set(recommended.map(p => p.key));

  console.log('  Available MCP packs:');
  console.log('');
  OPENCODE_MCP_PACKS.forEach((pack, i) => {
    const isRec = recommendedKeys.has(pack.key);
    const marker = isRec ? c(' (recommended)', 'green') : '';
    const authNote = pack.requiredAuth.length > 0 ? c(` [requires: ${pack.requiredAuth.join(', ')}]`, 'yellow') : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${marker}${authNote}`);
    console.log(c(`       ${pack.description}`, 'dim'));
  });
  console.log('');

  const defaultSelection = OPENCODE_MCP_PACKS.map((p, i) => recommendedKeys.has(p.key) ? String(i + 1) : null).filter(Boolean).join(',');
  const answer = await ask(rl, c(`  Select packs (comma-separated, n=none, b=back, q=quit) [${defaultSelection || 'none'}]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  let selectedPacks;
  if (trimmed === 'n' || trimmed === 'none') selectedPacks = [];
  else if (trimmed === '') selectedPacks = recommended;
  else {
    const indices = trimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < OPENCODE_MCP_PACKS.length);
    selectedPacks = indices.map(i => OPENCODE_MCP_PACKS[i]);
  }

  state.mcpPacks = selectedPacks;
  console.log(c(`  → Selected: ${selectedPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));
  return 'next';
}

// Stage 6 — Plugin Configuration
async function stagePlugins(rl, _ctx, state) {
  printStageHeader(5);

  console.log('  OpenCode plugins run in-process and can intercept tool calls.');
  console.log(c('  Note: tool.execute.before does not cover subagent/MCP calls (#5894, #2319).', 'yellow'));
  console.log('');

  const answer = await ask(rl, c('  Create plugins starter directory? (y/n, b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.enablePlugins = trimmed === 'y' || trimmed === 'yes';
  console.log(c(`  → Plugins starter: ${state.enablePlugins ? 'will be created' : 'skipped'}`, state.enablePlugins ? 'green' : 'dim'));

  return 'next';
}

// Stage 7 — CI Integration
async function stageCi(rl, _ctx, state) {
  printStageHeader(6);

  console.log('  Optionally generate a GitHub Actions workflow for OpenCode-based PR review.');
  console.log(c('  Includes OPENCODE_DISABLE_AUTOUPDATE and pre-configured permissions.', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Generate CI workflow? (y/n, b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.enableCi = trimmed === 'y' || trimmed === 'yes';
  console.log(c(`  → CI workflow: ${state.enableCi ? 'will be generated' : 'skipped'}`, state.enableCi ? 'green' : 'dim'));

  return 'next';
}

// Stage 8 — Review & Generate
async function stageReviewAndGenerate(rl, ctx, state, options) {
  printStageHeader(7);

  console.log(c('  Setup Summary:', 'bold'));
  console.log('');
  console.log(`  ${c('Directory:', 'dim')}        ${ctx.dir}`);
  console.log(`  ${c('Stacks:', 'dim')}          ${(state.stacks || []).map(s => s.label).join(', ') || 'none detected'}`);
  console.log(`  ${c('Migration:', 'dim')}        ${state.migrationMode || 'create'}`);
  console.log(`  ${c('Permissions:', 'dim')}      ${state.permissionPreset || 'standard'}`);
  console.log(`  ${c('Agent mode:', 'dim')}       ${state.agentMode === 'multi' ? 'Multi-agent' : 'Single agent'}`);
  console.log(`  ${c('Domain packs:', 'dim')}     ${(state.domainPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`  ${c('MCP packs:', 'dim')}        ${(state.mcpPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`  ${c('Plugins:', 'dim')}          ${state.enablePlugins ? 'yes' : 'no'}`);
  console.log(`  ${c('CI workflow:', 'dim')}       ${state.enableCi ? 'yes' : 'no'}`);
  console.log('');

  const answer = await ask(rl, c('  Proceed with generation? (y/n, b=back) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'n' || trimmed === 'q') return 'quit';

  const modules = ['skills'];
  if (state.enablePlugins) modules.push('plugins');
  if ((state.mcpPacks || []).length > 0) modules.push('mcp');
  if (state.enableCi) modules.push('ci');

  console.log('');
  console.log(c('  Generating artifacts...', 'bold'));
  console.log('');

  const result = await setupOpenCode({
    ...options,
    dir: ctx.dir,
    modules,
    domainPacks: state.domainPacks || [],
    silent: true,
  });

  for (const file of result.writtenFiles || []) console.log(c(`  + ${file}`, 'green'));
  for (const file of result.preservedFiles || []) console.log(c(`  ~ ${file} (preserved)`, 'dim'));

  console.log('');
  console.log(`  ${c(String(result.created || 0), 'bold')} files created.`);
  if (result.skipped > 0) console.log(`  ${c(String(result.skipped), 'dim')} existing files preserved.`);
  if (result.rollbackArtifact) console.log(`  Rollback: ${c(result.rollbackArtifact, 'dim')}`);

  return 'done';
}

// Main wizard loop
const STAGES = [
  stageProjectDetection,
  stagePermissionPosture,
  stageAgentStructure,
  stageDomainPacks,
  stageMcpPacks,
  stagePlugins,
  stageCi,
  stageReviewAndGenerate,
];

async function opencodeInteractive(options = {}) {
  const dir = options.dir || process.cwd();

  if (!isTTY()) {
    console.log(c('  No interactive terminal detected — running direct setup.', 'dim'));
    return setupOpenCode({ ...options, dir, silent: false });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new OpenCodeProjectContext(dir);
  const state = {};

  console.log('');
  console.log(c('  +-------------------------------------------+', 'magenta'));
  console.log(c('  |   nerviq: OpenCode Interactive Wizard     |', 'magenta'));
  console.log(c('  +-------------------------------------------+', 'magenta'));
  console.log('');
  console.log(c(`  Working directory: ${dir}`, 'dim'));

  let stageIndex = 0;
  while (stageIndex < STAGES.length) {
    let result;
    try {
      result = await STAGES[stageIndex](rl, ctx, state, options);
    } catch (err) {
      console.log(c(`  Error in stage: ${err.message}`, 'red'));
      rl.close();
      throw err;
    }

    if (result === 'quit') {
      console.log(c('  Wizard cancelled. No changes were made.', 'dim'));
      rl.close();
      return { cancelled: true };
    }
    if (result === 'back') {
      if (stageIndex > 0) stageIndex--;
      else console.log(c('  Already at the first stage.', 'dim'));
      continue;
    }
    if (result === 'done') break;
    stageIndex++;
  }

  rl.close();
  console.log('');
  console.log(c('  Done! Run `npx nerviq --platform opencode` to audit your setup.', 'green'));
  console.log('');

  return { cancelled: false, state };
}

module.exports = { opencodeInteractive };
