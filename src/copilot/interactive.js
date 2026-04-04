/**
 * Copilot Interactive Wizard — 10-stage guided setup.
 *
 * Adapted for Copilot's 3-surface architecture (VS Code, cloud, CLI).
 *
 * Stages:
 *   1.  Project detection (stacks, existing .github/, .vscode/)
 *   2.  Surface selection (VS Code / cloud agent / both)
 *   3.  Trust & sandbox (OS-aware, Windows warning)
 *   4.  Auto-approval configuration
 *   5.  Domain pack selection
 *   6.  MCP pack selection
 *   7.  Instruction structure (repo-wide + scoped + prompts)
 *   8.  Cloud agent configuration
 *   9.  Org policy awareness
 *   10. Review & generate
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { CopilotProjectContext } = require('./context');
const { COPILOT_TECHNIQUES } = require('./techniques');
const { COPILOT_DOMAIN_PACKS, detectCopilotDomainPacks } = require('./domain-packs');
const { recommendCopilotMcpPacks, COPILOT_MCP_PACKS } = require('./mcp-packs');

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
  'Surface Selection',
  'Trust & Sandbox',
  'Auto-Approval Config',
  'Domain Pack Selection',
  'MCP Pack Selection',
  'Instruction Structure',
  'Cloud Agent Config',
  'Org Policy Awareness',
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
  const hasCopilotInstructions = Boolean(ctx.copilotInstructionsContent());
  const hasVscodeSettings = Boolean(ctx.fileContent('.vscode/settings.json'));
  const hasMcpJson = Boolean(ctx.fileContent('.vscode/mcp.json'));
  const hasCloudSetup = Boolean(ctx.cloudAgentConfig());
  const surfaces = ctx.detectSurfaces();

  const auditResults = [];
  for (const [key, technique] of Object.entries(COPILOT_TECHNIQUES)) {
    auditResults.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const passed = auditResults.filter(r => r.passed === true);
  const failed = auditResults.filter(r => r.passed === false);

  return { stacks, hasCopilotInstructions, hasVscodeSettings, hasMcpJson, hasCloudSetup, surfaces, auditResults, passed, failed };
}

async function stageProjectDetection(rl, ctx, state) {
  printStageHeader(0);
  const det = runProjectDetection(ctx);
  Object.assign(state, det);

  if (det.stacks.length > 0) console.log(c(`  Detected stacks: ${det.stacks.map(s => s.label).join(', ')}`, 'blue'));
  else console.log(c('  No specific stack detected — will use baseline defaults.', 'dim'));

  console.log(c(`  Working directory: ${ctx.dir}`, 'dim'));
  console.log('');
  console.log(`  ${c(`${det.passed.length}/${det.auditResults.length}`, 'bold')} Copilot checks passing.`);
  console.log(`  ${c(String(det.failed.length), 'yellow')} improvements available.`);
  console.log('');
  console.log(`  Surfaces: VS Code ${det.surfaces.vscode ? c('Y', 'green') : c('N', 'red')} | Cloud ${det.surfaces.cloudAgent ? c('Y', 'green') : c('N', 'red')} | CLI ${det.surfaces.cli ? c('Y', 'green') : c('N', 'red')}`);

  if (det.hasCopilotInstructions || det.hasVscodeSettings) {
    console.log('');
    console.log(c('  Existing Copilot configuration detected:', 'yellow'));
    if (det.hasCopilotInstructions) console.log(c('    .github/copilot-instructions.md found', 'dim'));
    if (det.hasVscodeSettings) console.log(c('    .vscode/settings.json found', 'dim'));
    if (det.hasMcpJson) console.log(c('    .vscode/mcp.json found', 'dim'));
    if (det.hasCloudSetup) console.log(c('    copilot-setup-steps.yml found', 'dim'));
    console.log('');

    const answer = await ask(rl, c('  Merge with existing config or replace? (merge/replace/quit) ', 'magenta'));
    const choice = answer.trim().toLowerCase();
    if (choice === 'quit' || choice === 'q') return 'quit';
    state.migrationMode = choice === 'replace' ? 'replace' : 'merge';
  } else {
    state.migrationMode = 'create';
    console.log('');
    console.log(c('  No existing Copilot config — will create fresh setup.', 'dim'));
  }

  return 'next';
}

// --- Stage 2: Surface Selection ---

async function stageSurfaceSelection(rl, _ctx, state) {
  printStageHeader(1);

  console.log('  Which Copilot surfaces do you want to configure?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('VS Code only', 'blue')} — Local IDE agent mode.`);
  console.log(`    ${c('2', 'bold')}. ${c('VS Code + Cloud agent', 'blue')} — IDE + GitHub cloud agent for automated tasks.`);
  console.log(`    ${c('3', 'bold')}. ${c('All surfaces', 'blue')} — VS Code + Cloud + CLI.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [2]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const index = parseInt(trimmed, 10);
  const surfaceChoices = { 1: ['vscode'], 2: ['vscode', 'cloud'], 3: ['vscode', 'cloud', 'cli'] };
  state.selectedSurfaces = surfaceChoices[index] || surfaceChoices[2];
  console.log(c(`  → Surfaces: ${state.selectedSurfaces.join(', ')}`, 'green'));

  return 'next';
}

// --- Stage 3: Trust & Sandbox ---

async function stageTrustSandbox(rl, _ctx, state) {
  printStageHeader(2);

  const detectedOS = os.platform() === 'darwin' ? 'macOS' : os.platform() === 'linux' ? 'Linux' : os.platform() === 'win32' ? 'Windows' : os.platform();
  state.detectedOS = detectedOS;

  console.log(c(`  Detected OS: ${detectedOS}`, 'blue'));
  if (detectedOS === 'Windows') {
    console.log('');
    console.log(c('  WARNING: Terminal sandbox is NOT available on native Windows!', 'red'));
    console.log(c('  Consider using WSL2 or Docker for sandboxed Copilot agent execution.', 'yellow'));
  }
  console.log('');
  console.log('  Enable terminal sandbox? (Recommended for macOS/Linux/WSL2)');
  console.log('');

  const answer = await ask(rl, c(`  Enable sandbox? (y/n, or b=back, q=quit) [${detectedOS === 'Windows' ? 'n' : 'y'}]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.sandboxEnabled = trimmed === 'y' || (trimmed === '' && detectedOS !== 'Windows');
  console.log(c(`  → Sandbox: ${state.sandboxEnabled ? 'enabled' : 'disabled'}`, state.sandboxEnabled ? 'green' : 'yellow'));

  return 'next';
}

// --- Stage 4: Auto-Approval ---

async function stageAutoApproval(rl, _ctx, state) {
  printStageHeader(3);

  console.log('  Configure auto-approval for terminal commands?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('No auto-approval', 'blue')} — All commands require confirmation (safest).`);
  console.log(`    ${c('2', 'bold')}. ${c('Safe commands only', 'blue')} — Auto-approve test/lint/build patterns.`);
  console.log(`    ${c('3', 'bold')}. ${c('Custom patterns', 'blue')} — Enter your own auto-approval patterns.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const choice = parseInt(trimmed, 10);
  if (choice === 2) {
    state.autoApprovalPatterns = ['npm test', 'npm run lint', 'npm run build'];
  } else if (choice === 3) {
    const patterns = await ask(rl, c('  Enter patterns (comma-separated): ', 'magenta'));
    state.autoApprovalPatterns = patterns.split(',').map(p => p.trim()).filter(Boolean);
  } else {
    state.autoApprovalPatterns = [];
  }

  console.log(c(`  → Auto-approval: ${state.autoApprovalPatterns.length === 0 ? 'none' : state.autoApprovalPatterns.join(', ')}`, 'green'));
  return 'next';
}

// --- Stage 5: Domain Pack Selection ---

async function stageDomainPacks(rl, ctx, state) {
  printStageHeader(4);

  const detected = detectCopilotDomainPacks(ctx, state.stacks || []);
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

  const cloudOnly = state.selectedSurfaces && !state.selectedSurfaces.includes('vscode');
  const recommended = recommendCopilotMcpPacks(state.stacks || [], state.domainPacks || [], { ctx, cloudOnly });
  state.mcpPacks = recommended;

  console.log(`  Recommended ${recommended.length} MCP pack(s):`);
  console.log('');
  recommended.forEach((pack, i) => {
    const cloudIcon = pack.cloudAgentCompatible === false ? c(' [VS Code only]', 'yellow') : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${cloudIcon} — ${pack.description}`);
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

// --- Stage 7: Instruction Structure ---

async function stageInstructionStructure(rl, _ctx, state) {
  printStageHeader(6);

  console.log('  What instruction structure do you want?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Basic', 'blue')} — copilot-instructions.md only.`);
  console.log(`    ${c('2', 'bold')}. ${c('Scoped', 'blue')} — copilot-instructions.md + path-scoped .instructions.md files.`);
  console.log(`    ${c('3', 'bold')}. ${c('Full', 'blue')} — All of the above + prompt templates (.prompt.md).`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [3]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const choice = parseInt(trimmed, 10);
  state.instructionModules = ['copilot-instructions'];
  if (choice >= 2 || trimmed === '') state.instructionModules.push('scoped-instructions');
  if (choice >= 3 || trimmed === '') state.instructionModules.push('prompts');

  console.log(c(`  → Instructions: ${state.instructionModules.join(', ')}`, 'green'));
  return 'next';
}

// --- Stage 8: Cloud Agent Config ---

async function stageCloudAgent(rl, _ctx, state) {
  if (!state.selectedSurfaces || !state.selectedSurfaces.includes('cloud')) return 'next';

  printStageHeader(7);

  console.log('  Cloud agent configuration:');
  console.log('');
  console.log(c('  Important: Cloud agent cold-boot takes ~90 seconds.', 'yellow'));
  console.log(c('  Content exclusions are NOT enforced on the cloud agent.', 'red'));
  console.log('');

  const answer = await ask(rl, c('  Generate copilot-setup-steps.yml? (y/n, or b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.generateCloudSetup = trimmed !== 'n';
  console.log(c(`  → Cloud setup: ${state.generateCloudSetup ? 'will generate' : 'skip'}`, 'green'));
  return 'next';
}

// --- Stage 9: Org Policy Awareness ---

async function stageOrgPolicy(rl, _ctx, state) {
  printStageHeader(8);

  console.log('  Is this repo part of a GitHub Organization with Copilot policies?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('No / Unknown', 'blue')} — Individual or personal repo.`);
  console.log(`    ${c('2', 'bold')}. ${c('Yes (Business)', 'blue')} — Org with Business plan and policies.`);
  console.log(`    ${c('3', 'bold')}. ${c('Yes (Enterprise)', 'blue')} — Enterprise with audit logs, BYOK, full governance.`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const choice = parseInt(trimmed, 10);
  state.orgTier = choice === 3 ? 'enterprise' : choice === 2 ? 'business' : 'individual';
  console.log(c(`  → Org tier: ${state.orgTier}`, 'green'));
  return 'next';
}

// --- Stage 10: Review & Generate ---

async function stageReviewGenerate(rl, _ctx, state) {
  printStageHeader(9);

  console.log('  Summary of your Copilot setup:');
  console.log('');
  console.log(`    Surfaces: ${(state.selectedSurfaces || []).join(', ')}`);
  console.log(`    Sandbox: ${state.sandboxEnabled ? 'enabled' : 'disabled'}`);
  console.log(`    Auto-approval: ${(state.autoApprovalPatterns || []).length === 0 ? 'none' : (state.autoApprovalPatterns || []).join(', ')}`);
  console.log(`    Domain packs: ${(state.domainPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`    MCP packs: ${(state.mcpPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`    Instructions: ${(state.instructionModules || []).join(', ')}`);
  console.log(`    Cloud setup: ${state.generateCloudSetup ? 'yes' : 'no'}`);
  console.log(`    Org tier: ${state.orgTier || 'individual'}`);
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
  stageSurfaceSelection,
  stageTrustSandbox,
  stageAutoApproval,
  stageDomainPacks,
  stageMcpPacks,
  stageInstructionStructure,
  stageCloudAgent,
  stageOrgPolicy,
  stageReviewGenerate,
];

async function runCopilotWizard(options) {
  if (!isTTY()) {
    console.log('Interactive wizard requires a TTY. Use --non-interactive or pipe mode instead.');
    return null;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new CopilotProjectContext(options.dir);
  const state = {};

  console.log('');
  console.log(c('  nerviq copilot interactive wizard', 'bold'));
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
  runCopilotWizard,
  runProjectDetection,
};
