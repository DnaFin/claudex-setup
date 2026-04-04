/**
 * Aider Interactive Wizard — 8-stage guided setup
 *
 * Simpler than IDE wizards — no hooks/MCP stages.
 * Uses Node.js readline (zero dependencies).
 *
 * Stages:
 *   1. Project Detection
 *   2. Git Safety Posture
 *   3. Model Configuration
 *   4. Convention File
 *   5. Domain Pack Selection
 *   6. Verification Loop
 *   7. CI Integration
 *   8. Review & Generate
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { AiderProjectContext } = require('./context');
const { AIDER_TECHNIQUES } = require('./techniques');
const { AIDER_DOMAIN_PACKS, detectAiderDomainPacks } = require('./domain-packs');
const { recommendAiderMcpPacks, AIDER_MCP_PACKS } = require('./mcp-packs');
const { setupAider } = require('./setup');

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
  'Git Safety Posture',
  'Model Configuration',
  'Convention File',
  'Domain Pack Selection',
  'Verification Loop',
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

// --- Stage 1: Project Detection ---

function runProjectDetection(ctx) {
  const stacks = ctx.detectStacks(STACKS);
  const hasGit = ctx.hasGitRepo();
  const hasConfYml = Boolean(ctx.configContent());
  const hasConventions = ctx.conventionFiles().length > 0;

  return {
    stacks,
    hasGit,
    hasConfYml,
    hasConventions,
    projectName: path.basename(ctx.dir),
  };
}

// --- Stage 2: Git Safety Posture ---

async function runGitSafety(rl, state) {
  console.log('  Aider uses git as its ONLY safety mechanism.');
  console.log('  Auto-commits create an undo trail for every change.');
  console.log('');

  const autoCommits = await ask(rl, c('  Enable auto-commits? (Y/n): ', 'blue'));
  state.autoCommits = autoCommits.trim().toLowerCase() !== 'n';

  const attribution = await ask(rl, c('  Enable commit attribution for AI traceability? (Y/n): ', 'blue'));
  state.attribution = attribution.trim().toLowerCase() !== 'n';

  const commitPrefix = await ask(rl, c('  Commit prefix for AI commits (default: "aider: "): ', 'blue'));
  state.commitPrefix = commitPrefix.trim() || 'aider: ';

  return 'next';
}

// --- Stage 3: Model Configuration ---

async function runModelConfig(rl, state) {
  console.log('  Aider has 3 model roles:');
  console.log('    - main: does the coding');
  console.log('    - editor: applies edits to files');
  console.log('    - weak: generates commit messages (cheapest)');
  console.log('');

  const mainModel = await ask(rl, c('  Main model (e.g., claude-sonnet-4-20250514, gpt-4o, leave blank for default): ', 'blue'));
  state.mainModel = mainModel.trim() || null;

  const architect = await ask(rl, c('  Enable architect mode (2-model planning + editing)? (y/N): ', 'blue'));
  state.architect = architect.trim().toLowerCase() === 'y';

  const cachePrompts = await ask(rl, c('  Enable prompt caching for cost savings? (Y/n): ', 'blue'));
  state.cachePrompts = cachePrompts.trim().toLowerCase() !== 'n';

  return 'next';
}

// --- Stage 4: Convention File ---

async function runConventions(rl, state, ctx) {
  const existing = ctx.conventionFiles();
  if (existing.length > 0) {
    console.log(`  Found existing convention files: ${existing.join(', ')}`);
    const keep = await ask(rl, c('  Keep existing convention files? (Y/n): ', 'blue'));
    if (keep.trim().toLowerCase() !== 'n') {
      state.generateConventions = false;
      return 'next';
    }
  }

  console.log('  Aider has NO auto-discovery — convention files must be explicitly passed via read:');
  const generate = await ask(rl, c('  Generate CONVENTIONS.md? (Y/n): ', 'blue'));
  state.generateConventions = generate.trim().toLowerCase() !== 'n';

  return 'next';
}

// --- Stage 5: Domain Pack Selection ---

async function runDomainPacks(rl, state, ctx) {
  const detected = detectAiderDomainPacks(ctx);
  console.log('  Detected domain packs:');
  for (const pack of detected) {
    console.log(`    - ${pack.label}: ${pack.matchReasons[0] || pack.useWhen}`);
  }
  console.log('');

  const accept = await ask(rl, c('  Accept detected domain packs? (Y/n): ', 'blue'));
  if (accept.trim().toLowerCase() !== 'n') {
    state.domainPacks = detected.map(p => p.key);
  } else {
    console.log('  Available packs:');
    AIDER_DOMAIN_PACKS.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.label} — ${p.useWhen.slice(0, 60)}`);
    });
    const choices = await ask(rl, c('  Enter pack numbers (comma-separated): ', 'blue'));
    const indices = choices.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < AIDER_DOMAIN_PACKS.length);
    state.domainPacks = indices.map(i => AIDER_DOMAIN_PACKS[i].key);
  }

  return 'next';
}

// --- Stage 6: Verification Loop ---

async function runVerificationLoop(rl, state) {
  console.log('  Aider can auto-fix lint and test failures after edits.');
  console.log('');

  const lintCmd = await ask(rl, c('  Lint command (leave blank to skip): ', 'blue'));
  state.lintCmd = lintCmd.trim() || null;

  if (state.lintCmd) {
    const autoLint = await ask(rl, c('  Enable auto-lint (auto-fix after edits)? (Y/n): ', 'blue'));
    state.autoLint = autoLint.trim().toLowerCase() !== 'n';
  }

  const testCmd = await ask(rl, c('  Test command (leave blank to skip): ', 'blue'));
  state.testCmd = testCmd.trim() || null;

  if (state.testCmd) {
    const autoTest = await ask(rl, c('  Enable auto-test (run tests after edits)? (Y/n): ', 'blue'));
    state.autoTest = autoTest.trim().toLowerCase() !== 'n';
  }

  return 'next';
}

// --- Stage 7: CI Integration ---

async function runCiIntegration(rl, state) {
  console.log('  CI integration ensures Aider-generated code passes quality gates.');
  console.log('');

  const wantCi = await ask(rl, c('  Set up CI workflow for Aider PRs? (y/N): ', 'blue'));
  state.wantCi = wantCi.trim().toLowerCase() === 'y';

  return 'next';
}

// --- Stage 8: Review & Generate ---

async function runReviewGenerate(rl, state, dir) {
  console.log('  Summary:');
  console.log(`    Auto-commits: ${state.autoCommits ? 'yes' : 'no'}`);
  console.log(`    Attribution: ${state.attribution ? 'yes' : 'no'}`);
  console.log(`    Commit prefix: "${state.commitPrefix}"`);
  console.log(`    Main model: ${state.mainModel || 'default'}`);
  console.log(`    Architect mode: ${state.architect ? 'yes' : 'no'}`);
  console.log(`    Prompt caching: ${state.cachePrompts ? 'yes' : 'no'}`);
  console.log(`    Generate conventions: ${state.generateConventions ? 'yes' : 'no'}`);
  console.log(`    Domain packs: ${(state.domainPacks || []).join(', ') || 'none'}`);
  console.log(`    Lint: ${state.lintCmd || 'none'} (auto: ${state.autoLint ? 'yes' : 'no'})`);
  console.log(`    Test: ${state.testCmd || 'none'} (auto: ${state.autoTest ? 'yes' : 'no'})`);
  console.log(`    CI workflow: ${state.wantCi ? 'yes' : 'no'}`);
  console.log('');

  const confirm = await ask(rl, c('  Generate files? (Y/n): ', 'blue'));
  if (confirm.trim().toLowerCase() === 'n') {
    return 'back';
  }

  setupAider({ dir, log: console.log });
  return 'done';
}

// --- Main wizard ---

async function aiderInteractive(dir) {
  if (!isTTY()) {
    console.log('Interactive mode requires a TTY. Use --setup instead.');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log(c('  ╔══════════════════════════════════════╗', 'magenta'));
  console.log(c('  ║       Aider Interactive Setup        ║', 'magenta'));
  console.log(c('  ║         powered by nerviq            ║', 'magenta'));
  console.log(c('  ╚══════════════════════════════════════╝', 'magenta'));

  const ctx = new AiderProjectContext(dir);
  const state = {
    autoCommits: true,
    attribution: true,
    commitPrefix: 'aider: ',
    mainModel: null,
    architect: false,
    cachePrompts: true,
    generateConventions: true,
    domainPacks: [],
    lintCmd: null,
    autoLint: false,
    testCmd: null,
    autoTest: false,
    wantCi: false,
  };

  const stages = [
    // Stage 1 — auto, no interaction
    async () => {
      printStageHeader(0);
      const detection = runProjectDetection(ctx);
      console.log(`  Project: ${detection.projectName}`);
      console.log(`  Git repo: ${detection.hasGit ? c('yes', 'green') : c('NO — required!', 'red')}`);
      console.log(`  .aider.conf.yml: ${detection.hasConfYml ? 'exists' : 'missing'}`);
      console.log(`  Convention files: ${detection.hasConventions ? 'found' : 'none'}`);
      console.log(`  Stacks: ${detection.stacks.map(s => s.key).join(', ') || 'none detected'}`);

      if (!detection.hasGit) {
        console.log('');
        console.log(c('  Warning: Aider requires a git repo. Run `git init` first.', 'red'));
      }

      return 'next';
    },
    // Stage 2
    async () => { printStageHeader(1); return runGitSafety(rl, state); },
    // Stage 3
    async () => { printStageHeader(2); return runModelConfig(rl, state); },
    // Stage 4
    async () => { printStageHeader(3); return runConventions(rl, state, ctx); },
    // Stage 5
    async () => { printStageHeader(4); return runDomainPacks(rl, state, ctx); },
    // Stage 6
    async () => { printStageHeader(5); return runVerificationLoop(rl, state); },
    // Stage 7
    async () => { printStageHeader(6); return runCiIntegration(rl, state); },
    // Stage 8
    async () => { printStageHeader(7); return runReviewGenerate(rl, state, dir); },
  ];

  let stageIndex = 0;

  while (stageIndex < stages.length) {
    const result = await stages[stageIndex]();

    if (result === 'quit' || result === 'exit') {
      rl.close();
      console.log(c('  Setup cancelled.', 'yellow'));
      return { cancelled: true };
    }

    if (result === 'back') {
      if (stageIndex > 0) {
        stageIndex--;
      } else {
        console.log(c('  Already at the first stage.', 'dim'));
      }
      continue;
    }

    if (result === 'done') {
      break;
    }

    stageIndex++;
  }

  rl.close();

  console.log('');
  console.log(c('  Done! Run `npx nerviq --platform aider` to audit your setup.', 'green'));
  console.log('');

  return { cancelled: false, state };
}

module.exports = { aiderInteractive };
