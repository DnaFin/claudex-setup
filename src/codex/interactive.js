/**
 * Codex Interactive Wizard — CP-14
 *
 * 8-stage guided setup for Codex CLI projects.
 * Uses Node.js readline (zero dependencies), same pattern as the Claude wizard.
 *
 * Stages:
 *   1. Project detection
 *   2. Trust & approval posture
 *   3. Agent structure
 *   4. Domain pack selection
 *   5. MCP pack selection
 *   6. Hook configuration
 *   7. CI integration
 *   8. Review & generate
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { CodexProjectContext } = require('./context');
const { CODEX_TECHNIQUES } = require('./techniques');
const { CODEX_DOMAIN_PACKS, detectCodexDomainPacks } = require('./domain-packs');
const { recommendCodexMcpPacks, CODEX_MCP_PACKS } = require('./mcp-packs');
const { setupCodex } = require('./setup');

// ---------------------------------------------------------------------------
// Colors & helpers (matches Claude interactive.js)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const STAGE_NAMES = [
  'Project Detection',
  'Trust & Approval Posture',
  'Agent Structure',
  'Domain Pack Selection',
  'MCP Pack Selection',
  'Hook Configuration',
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

// ---------------------------------------------------------------------------
// Stage 1 — Project Detection
// ---------------------------------------------------------------------------

function runProjectDetection(ctx) {
  const stacks = ctx.detectStacks(STACKS);
  const hasCodexDir = fs.existsSync(path.join(ctx.dir, '.codex'));
  const hasAgentsMd = Boolean(ctx.fileContent('AGENTS.md'));
  const configContent = ctx.configContent ? ctx.configContent() : null;

  // Quick audit
  const auditResults = [];
  for (const [key, technique] of Object.entries(CODEX_TECHNIQUES)) {
    auditResults.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const passed = auditResults.filter(r => r.passed === true);
  const failed = auditResults.filter(r => r.passed === false);

  return { stacks, hasCodexDir, hasAgentsMd, configContent, auditResults, passed, failed };
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
  console.log(`  ${c(`${det.passed.length}/${det.auditResults.length}`, 'bold')} Codex checks passing.`);
  console.log(`  ${c(String(det.failed.length), 'yellow')} improvements available.`);

  if (det.hasCodexDir || det.hasAgentsMd) {
    console.log('');
    console.log(c('  Existing Codex configuration detected:', 'yellow'));
    if (det.hasCodexDir) console.log(c('    .codex/ directory found', 'dim'));
    if (det.hasAgentsMd) console.log(c('    AGENTS.md found', 'dim'));
    console.log('');

    const migrationAnswer = await ask(rl, c('  Merge with existing config or replace? (merge/replace/quit) ', 'magenta'));
    const choice = migrationAnswer.trim().toLowerCase();
    if (choice === 'quit' || choice === 'q') return 'quit';
    state.migrationMode = choice === 'replace' ? 'replace' : 'merge';
    console.log(c(`  → ${state.migrationMode === 'replace' ? 'Will replace existing files' : 'Will merge with existing config'}`, 'green'));
  } else {
    state.migrationMode = 'create';
    console.log('');
    console.log(c('  No existing Codex config — will create fresh setup.', 'dim'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 2 — Trust & Approval Posture
// ---------------------------------------------------------------------------

const APPROVAL_POLICIES = [
  { key: 'suggest', label: 'Suggest (safest)', desc: 'Codex suggests changes but never writes without approval.' },
  { key: 'auto-edit', label: 'Auto-Edit (balanced)', desc: 'Codex can edit files but asks before running commands.' },
  { key: 'full-auto', label: 'Full-Auto (maximum autonomy)', desc: 'Codex runs everything automatically. Use only in trusted sandboxes.' },
];

const SANDBOX_MODES = [
  { key: 'workspace-write', label: 'Workspace Write (default)', desc: 'Write only within the project directory.' },
  { key: 'workspace-read', label: 'Workspace Read', desc: 'Read-only access to the project directory.' },
  { key: 'full-write', label: 'Full Write', desc: 'Write anywhere on disk. Use with extreme caution.' },
];

async function stageTrustPosture(rl, _ctx, state) {
  printStageHeader(1);

  console.log('  Select an approval policy for Codex:');
  console.log('');
  APPROVAL_POLICIES.forEach((p, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(p.label, 'blue')} — ${p.desc}`);
  });
  console.log('');

  const policyAnswer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = policyAnswer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const policyIndex = parseInt(trimmed, 10);
  const selectedPolicy = APPROVAL_POLICIES[(policyIndex >= 1 && policyIndex <= 3) ? policyIndex - 1 : 0];
  state.approvalPolicy = selectedPolicy.key;
  console.log(c(`  → Approval policy: ${selectedPolicy.label}`, 'green'));

  console.log('');
  console.log('  Select a sandbox mode:');
  console.log('');
  SANDBOX_MODES.forEach((m, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(m.label, 'blue')} — ${m.desc}`);
  });
  console.log('');

  const sandboxAnswer = await ask(rl, c('  Choice (1-3) [1]: ', 'magenta'));
  const sandboxIndex = parseInt(sandboxAnswer.trim(), 10);
  const selectedSandbox = SANDBOX_MODES[(sandboxIndex >= 1 && sandboxIndex <= 3) ? sandboxIndex - 1 : 0];
  state.sandboxMode = selectedSandbox.key;
  console.log(c(`  → Sandbox mode: ${selectedSandbox.label}`, 'green'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 3 — Agent Structure
// ---------------------------------------------------------------------------

async function stageAgentStructure(rl, _ctx, state) {
  printStageHeader(2);

  console.log('  How should Codex operate in this project?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Single agent', 'blue')} — One Codex agent handles everything (simpler, good for small repos).`);
  console.log(`    ${c('2', 'bold')}. ${c('Multi-agent', 'blue')} — Orchestrator + specialized sub-agents (better for large repos).`);
  console.log('');

  const answer = await ask(rl, c('  Choice (1-2, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.agentMode = trimmed === '2' ? 'multi' : 'single';
  console.log(c(`  → Agent mode: ${state.agentMode === 'multi' ? 'Multi-agent' : 'Single agent'}`, 'green'));

  if (state.agentMode === 'multi') {
    console.log('');
    console.log(c('  Will generate .codex/agents/ with sub-agent TOML starters.', 'dim'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 4 — Domain Pack Selection
// ---------------------------------------------------------------------------

async function stageDomainPacks(rl, ctx, state) {
  printStageHeader(3);

  const detected = detectCodexDomainPacks(ctx, state.stacks || []);
  const detectedKeys = new Set(detected.map(p => p.key));

  console.log('  Available domain packs:');
  console.log('');

  const allPacks = CODEX_DOMAIN_PACKS.map(pack => {
    const isDetected = detectedKeys.has(pack.key);
    return { ...pack, isDetected };
  });

  allPacks.forEach((pack, i) => {
    const marker = pack.isDetected ? c(' (detected)', 'green') : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${marker}`);
    console.log(c(`       ${pack.useWhen}`, 'dim'));
  });
  console.log('');

  const defaultSelection = allPacks
    .map((p, i) => p.isDetected ? String(i + 1) : null)
    .filter(Boolean)
    .join(',');

  const answer = await ask(rl, c(`  Select packs (comma-separated numbers, or b=back, q=quit) [${defaultSelection || 'all detected'}]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  let selectedPacks;
  if (trimmed === '' || trimmed === 'all') {
    selectedPacks = detected;
  } else {
    const indices = trimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < allPacks.length);
    selectedPacks = indices.map(i => allPacks[i]);
  }

  state.domainPacks = selectedPacks;
  console.log(c(`  → Selected: ${selectedPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 5 — MCP Pack Selection
// ---------------------------------------------------------------------------

async function stageMcpPacks(rl, ctx, state) {
  printStageHeader(4);

  const recommended = recommendCodexMcpPacks(state.stacks || [], state.domainPacks || [], { ctx });
  const recommendedKeys = new Set(recommended.map(p => p.key));

  console.log('  Available MCP packs:');
  console.log('');

  CODEX_MCP_PACKS.forEach((pack, i) => {
    const isRec = recommendedKeys.has(pack.key);
    const marker = isRec ? c(' (recommended)', 'green') : '';
    const authNote = pack.requiredAuth.length > 0
      ? c(` [requires: ${pack.requiredAuth.join(', ')}]`, 'yellow')
      : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${marker}${authNote}`);
    console.log(c(`       ${pack.description}`, 'dim'));
  });
  console.log('');

  const defaultSelection = CODEX_MCP_PACKS
    .map((p, i) => recommendedKeys.has(p.key) ? String(i + 1) : null)
    .filter(Boolean)
    .join(',');

  const answer = await ask(rl, c(`  Select packs (comma-separated numbers, n=none, b=back, q=quit) [${defaultSelection || 'none'}]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  let selectedPacks;
  if (trimmed === 'n' || trimmed === 'none') {
    selectedPacks = [];
  } else if (trimmed === '') {
    selectedPacks = recommended;
  } else {
    const indices = trimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < CODEX_MCP_PACKS.length);
    selectedPacks = indices.map(i => CODEX_MCP_PACKS[i]);
  }

  state.mcpPacks = selectedPacks;
  console.log(c(`  → Selected: ${selectedPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 6 — Hook Configuration
// ---------------------------------------------------------------------------

const COMMON_HOOKS = [
  { key: 'session-start', event: 'SessionStart', label: 'Session Start greeting', command: "echo 'Codex session started'" },
  { key: 'pre-commit-lint', event: 'PreToolUse', label: 'Pre-commit lint check', command: 'npm run lint --silent' },
  { key: 'post-test', event: 'PostToolUse', label: 'Post-tool test runner', command: 'npm test --silent' },
  { key: 'security-scan', event: 'PreToolUse', label: 'Security pattern scan', command: "grep -rn 'TODO:SECURITY' . || true" },
];

async function stageHooks(rl, _ctx, state) {
  printStageHeader(5);

  console.log('  Configure Codex hooks (event-driven scripts that run during sessions):');
  console.log('');

  const answer = await ask(rl, c('  Enable hooks? (y/n, b=back, q=quit) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  if (trimmed === 'n') {
    state.hooks = [];
    state.hooksEnabled = false;
    console.log(c('  → Hooks disabled.', 'dim'));
    return 'next';
  }

  state.hooksEnabled = true;
  console.log('');
  console.log('  Common hook patterns:');
  console.log('');

  COMMON_HOOKS.forEach((hook, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(hook.label, 'blue')} (${hook.event})`);
    console.log(c(`       ${hook.command}`, 'dim'));
  });
  console.log('');

  const hookAnswer = await ask(rl, c('  Select hooks (comma-separated numbers, a=all, n=none) [1]: ', 'magenta'));
  const hookTrimmed = hookAnswer.trim().toLowerCase();

  let selectedHooks;
  if (hookTrimmed === 'n' || hookTrimmed === 'none') {
    selectedHooks = [];
  } else if (hookTrimmed === 'a' || hookTrimmed === 'all') {
    selectedHooks = [...COMMON_HOOKS];
  } else if (hookTrimmed === '') {
    selectedHooks = [COMMON_HOOKS[0]];
  } else {
    const indices = hookTrimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < COMMON_HOOKS.length);
    selectedHooks = indices.map(i => COMMON_HOOKS[i]);
  }

  state.hooks = selectedHooks;
  console.log(c(`  → Selected ${selectedHooks.length} hook(s): ${selectedHooks.map(h => h.label).join(', ') || 'none'}`, 'green'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 7 — CI Integration
// ---------------------------------------------------------------------------

async function stageCi(rl, _ctx, state) {
  printStageHeader(6);

  console.log('  Optionally generate a GitHub Actions workflow for Codex-based PR review.');
  console.log(c('  This creates .github/workflows/codex-review.yml', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Generate CI workflow? (y/n, b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.enableCi = trimmed === 'y' || trimmed === 'yes';
  console.log(c(`  → CI workflow: ${state.enableCi ? 'will be generated' : 'skipped'}`, state.enableCi ? 'green' : 'dim'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 8 — Review & Generate
// ---------------------------------------------------------------------------

async function stageReviewAndGenerate(rl, ctx, state, options) {
  printStageHeader(7);

  console.log(c('  Setup Summary:', 'bold'));
  console.log('');
  console.log(`  ${c('Directory:', 'dim')}        ${ctx.dir}`);
  console.log(`  ${c('Stacks:', 'dim')}          ${(state.stacks || []).map(s => s.label).join(', ') || 'none detected'}`);
  console.log(`  ${c('Migration:', 'dim')}        ${state.migrationMode || 'create'}`);
  console.log(`  ${c('Approval:', 'dim')}         ${state.approvalPolicy || 'suggest'}`);
  console.log(`  ${c('Sandbox:', 'dim')}          ${state.sandboxMode || 'workspace-write'}`);
  console.log(`  ${c('Agent mode:', 'dim')}       ${state.agentMode === 'multi' ? 'Multi-agent' : 'Single agent'}`);
  console.log(`  ${c('Domain packs:', 'dim')}     ${(state.domainPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`  ${c('MCP packs:', 'dim')}        ${(state.mcpPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`  ${c('Hooks:', 'dim')}            ${state.hooksEnabled ? `${(state.hooks || []).length} hook(s)` : 'disabled'}`);
  console.log(`  ${c('CI workflow:', 'dim')}       ${state.enableCi ? 'yes' : 'no'}`);
  console.log('');

  // List artifacts that will be generated
  const artifacts = ['AGENTS.md', '.codex/config.toml'];
  if (state.agentMode === 'multi') artifacts.push('.codex/agents/ (sub-agent starters)');
  if ((state.domainPacks || []).length > 0) artifacts.push('.codex/rules/ (domain rules)');
  if ((state.mcpPacks || []).length > 0) artifacts.push('.codex/config.toml (MCP sections)');
  if (state.hooksEnabled && (state.hooks || []).length > 0) artifacts.push('.codex/hooks.json');
  if (state.enableCi) artifacts.push('.github/workflows/codex-review.yml');
  artifacts.push('.agents/skills/ (skill starter)');

  console.log(c('  Artifacts to generate:', 'bold'));
  for (const a of artifacts) {
    console.log(c(`    + ${a}`, 'green'));
  }
  console.log('');

  const answer = await ask(rl, c('  Proceed with generation? (y/n, b=back) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'n' || trimmed === 'q') return 'quit';

  // Build module list from wizard selections
  const modules = ['rules', 'skills'];
  if (state.agentMode === 'multi') modules.push('subagents');
  if ((state.mcpPacks || []).length > 0) modules.push('mcp');
  if (state.hooksEnabled && (state.hooks || []).length > 0) modules.push('hooks');
  if (state.enableCi) modules.push('ci');

  console.log('');
  console.log(c('  Generating artifacts...', 'bold'));
  console.log('');

  // Write custom hooks.json if hooks were selected
  if (state.hooksEnabled && (state.hooks || []).length > 0) {
    const hooksPayload = {
      "$schema": "https://docs.codex.ai/hooks-schema.json",
      hooks: state.hooks.map(h => ({
        event: h.event,
        command: h.command,
        description: h.label,
        timeout_ms: 10000,
      })),
    };
    const hooksDir = path.join(ctx.dir, '.codex');
    fs.mkdirSync(hooksDir, { recursive: true });
    const hooksPath = path.join(hooksDir, 'hooks.json');
    if (state.migrationMode !== 'merge' || !fs.existsSync(hooksPath)) {
      fs.writeFileSync(hooksPath, JSON.stringify(hooksPayload, null, 2) + '\n', 'utf8');
      console.log(c('  + Created .codex/hooks.json', 'green'));
    } else {
      console.log(c('  ~ Skipped .codex/hooks.json (exists, merge mode)', 'dim'));
    }
  }

  // Write custom config overrides before running setupCodex
  // (setupCodex creates the base config; we patch approval/sandbox after)
  const result = await setupCodex({
    ...options,
    dir: ctx.dir,
    modules,
    domainPacks: state.domainPacks || [],
    silent: true,
  });

  // Patch config.toml with wizard-selected trust settings
  const configPath = path.join(ctx.dir, '.codex', 'config.toml');
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, 'utf8');

    const approvalPolicy = state.approvalPolicy || 'suggest';
    const sandboxMode = state.sandboxMode || 'workspace-write';

    // Map wizard approval keys to Codex config values
    const approvalMap = {
      'suggest': 'on-request',
      'auto-edit': 'unless-allow-listed',
      'full-auto': 'never',
    };
    const configApproval = approvalMap[approvalPolicy] || 'on-request';

    configContent = configContent.replace(
      /^approval_policy\s*=\s*"[^"]*"/m,
      `approval_policy = "${configApproval}"`
    );
    configContent = configContent.replace(
      /^sandbox_mode\s*=\s*"[^"]*"/m,
      `sandbox_mode = "${sandboxMode}"`
    );

    // Also patch the [profiles.safe] section
    configContent = configContent.replace(
      /(\[profiles\.safe\]\s*\n)approval_policy\s*=\s*"[^"]*"/m,
      `$1approval_policy = "${configApproval}"`
    );
    configContent = configContent.replace(
      /(\[profiles\.safe\]\s*\n[^\[]*?)sandbox_mode\s*=\s*"[^"]*"/m,
      `$1sandbox_mode = "${sandboxMode}"`
    );

    fs.writeFileSync(configPath, configContent, 'utf8');
  }

  // Report results
  console.log('');
  for (const file of result.writtenFiles || []) {
    console.log(c(`  + ${file}`, 'green'));
  }
  for (const file of result.preservedFiles || []) {
    console.log(c(`  ~ ${file} (preserved)`, 'dim'));
  }

  console.log('');
  console.log(`  ${c(String(result.created || 0), 'bold')} files created.`);
  if (result.skipped > 0) {
    console.log(`  ${c(String(result.skipped), 'dim')} existing files preserved.`);
  }
  if (result.rollbackArtifact) {
    console.log(`  Rollback: ${c(result.rollbackArtifact, 'dim')}`);
  }

  return 'done';
}

// ---------------------------------------------------------------------------
// Main wizard loop with back-navigation
// ---------------------------------------------------------------------------

const STAGES = [
  stageProjectDetection,
  stageTrustPosture,
  stageAgentStructure,
  stageDomainPacks,
  stageMcpPacks,
  stageHooks,
  stageCi,
  stageReviewAndGenerate,
];

async function codexInteractive(options = {}) {
  const dir = options.dir || process.cwd();

  // Non-interactive fallback: if no TTY, run direct setup
  if (!isTTY()) {
    console.log(c('  No interactive terminal detected — running direct setup.', 'dim'));
    return setupCodex({ ...options, dir, silent: false });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new CodexProjectContext(dir);
  const state = {};

  console.log('');
  console.log(c('  +-------------------------------------------+', 'magenta'));
  console.log(c('  |   nerviq: Codex Interactive Wizard  |', 'magenta'));
  console.log(c('  +-------------------------------------------+', 'magenta'));
  console.log('');
  console.log(c(`  Working directory: ${dir}`, 'dim'));

  let stageIndex = 0;

  while (stageIndex < STAGES.length) {
    const stageFn = STAGES[stageIndex];
    let result;

    try {
      result = await stageFn(rl, ctx, state, options);
    } catch (err) {
      console.log('');
      console.log(c(`  Error in stage: ${err.message}`, 'red'));
      rl.close();
      throw err;
    }

    if (result === 'quit') {
      console.log('');
      console.log(c('  Wizard cancelled. No changes were made.', 'dim'));
      rl.close();
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

    // 'next' — advance
    stageIndex++;
  }

  rl.close();

  console.log('');
  console.log(c('  Done! Run `npx nerviq --platform codex` to audit your setup.', 'green'));
  console.log('');

  return { cancelled: false, state };
}

module.exports = { codexInteractive };
