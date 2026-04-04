/**
 * Gemini CLI Interactive Wizard
 *
 * 10-stage guided setup for Gemini CLI projects.
 * Uses Node.js readline (zero dependencies), same pattern as the Claude/Codex wizard.
 *
 * Stages:
 *   1.  Project detection (stacks, existing .gemini/)
 *   2.  Trust & approval (normal/auto_edit/yolo)
 *   3.  Sandbox selection (OS-aware: Seatbelt for macOS, Docker for Linux, etc.)
 *   4.  Agent structure
 *   5.  Domain pack selection
 *   6.  MCP pack selection
 *   7.  Policy tier config (Gemini-unique!)
 *   8.  Hook configuration (BeforeTool/AfterTool)
 *   9.  CI integration
 *   10. Review & generate
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { STACKS } = require('../techniques');
const { GeminiProjectContext } = require('./context');
const { GEMINI_TECHNIQUES } = require('./techniques');
const { GEMINI_DOMAIN_PACKS, detectGeminiDomainPacks } = require('./domain-packs');
const { recommendGeminiMcpPacks, GEMINI_MCP_PACKS } = require('./mcp-packs');

// ---------------------------------------------------------------------------
// Colors & helpers (matches Claude/Codex interactive.js)
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
  'Trust & Approval',
  'Sandbox Selection',
  'Agent Structure',
  'Domain Pack Selection',
  'MCP Pack Selection',
  'Policy Tier Config',
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
  const hasGeminiDir = fs.existsSync(path.join(ctx.dir, '.gemini'));
  const hasGeminiMd = Boolean(ctx.geminiMdContent());
  const settingsResult = ctx.settingsJson();
  const hasSettings = settingsResult.ok;

  // Quick audit
  const auditResults = [];
  for (const [key, technique] of Object.entries(GEMINI_TECHNIQUES)) {
    auditResults.push({ key, ...technique, passed: technique.check(ctx) });
  }
  const passed = auditResults.filter(r => r.passed === true);
  const failed = auditResults.filter(r => r.passed === false);

  return { stacks, hasGeminiDir, hasGeminiMd, hasSettings, auditResults, passed, failed };
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
  console.log(`  ${c(`${det.passed.length}/${det.auditResults.length}`, 'bold')} Gemini checks passing.`);
  console.log(`  ${c(String(det.failed.length), 'yellow')} improvements available.`);

  if (det.hasGeminiDir || det.hasGeminiMd) {
    console.log('');
    console.log(c('  Existing Gemini configuration detected:', 'yellow'));
    if (det.hasGeminiDir) console.log(c('    .gemini/ directory found', 'dim'));
    if (det.hasGeminiMd) console.log(c('    GEMINI.md found', 'dim'));
    if (det.hasSettings) console.log(c('    .gemini/settings.json found', 'dim'));
    console.log('');

    const migrationAnswer = await ask(rl, c('  Merge with existing config or replace? (merge/replace/quit) ', 'magenta'));
    const choice = migrationAnswer.trim().toLowerCase();
    if (choice === 'quit' || choice === 'q') return 'quit';
    state.migrationMode = choice === 'replace' ? 'replace' : 'merge';
    console.log(c(`  → ${state.migrationMode === 'replace' ? 'Will replace existing files' : 'Will merge with existing config'}`, 'green'));
  } else {
    state.migrationMode = 'create';
    console.log('');
    console.log(c('  No existing Gemini config — will create fresh setup.', 'dim'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 2 — Trust & Approval
// ---------------------------------------------------------------------------

const TRUST_POLICIES = [
  { key: 'normal', label: 'Normal (safest)', desc: 'Gemini asks approval for all tool calls and edits.' },
  { key: 'auto_edit', label: 'Auto-Edit (balanced)', desc: 'Gemini can edit files but asks before running commands.' },
  { key: 'yolo', label: 'YOLO (maximum autonomy)', desc: 'Gemini runs everything automatically. Use only in trusted sandboxes.' },
];

async function stageTrustApproval(rl, _ctx, state) {
  printStageHeader(1);

  console.log('  Select a trust level for Gemini CLI:');
  console.log('');
  TRUST_POLICIES.forEach((p, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(p.label, 'blue')} — ${p.desc}`);
  });
  console.log('');

  const answer = await ask(rl, c('  Choice (1-3, or b=back, q=quit) [1]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const index = parseInt(trimmed, 10);
  const selected = TRUST_POLICIES[(index >= 1 && index <= 3) ? index - 1 : 0];
  state.trustLevel = selected.key;
  console.log(c(`  → Trust level: ${selected.label}`, 'green'));

  if (selected.key === 'yolo') {
    console.log('');
    console.log(c('  ⚠ YOLO mode grants full autonomy. Ensure a sandbox is configured in the next stage.', 'yellow'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 3 — Sandbox Selection (OS-aware)
// ---------------------------------------------------------------------------

function detectOS() {
  const platform = os.platform();
  if (platform === 'darwin') return 'macOS';
  if (platform === 'linux') return 'Linux';
  if (platform === 'win32') return 'Windows';
  return platform;
}

const SANDBOX_OPTIONS = {
  macOS: [
    { key: 'seatbelt', label: 'Seatbelt (recommended)', desc: 'macOS sandboxing via sandbox-exec. Blocks network/disk outside project.' },
    { key: 'docker', label: 'Docker', desc: 'Full container isolation. Requires Docker Desktop.' },
    { key: 'none', label: 'None', desc: 'No sandbox. Only use for fully trusted repos.' },
  ],
  Linux: [
    { key: 'docker', label: 'Docker (recommended)', desc: 'Full container isolation with volume mounts.' },
    { key: 'firejail', label: 'Firejail', desc: 'Lightweight Linux sandbox. Good for quick isolation.' },
    { key: 'none', label: 'None', desc: 'No sandbox. Only use for fully trusted repos.' },
  ],
  Windows: [
    { key: 'docker', label: 'Docker (recommended)', desc: 'Full container isolation via Docker Desktop / WSL2.' },
    { key: 'wsl', label: 'WSL2 Isolation', desc: 'Run Gemini inside a WSL2 distro for basic isolation.' },
    { key: 'none', label: 'None', desc: 'No sandbox. Only use for fully trusted repos.' },
  ],
};

async function stageSandboxSelection(rl, _ctx, state) {
  printStageHeader(2);

  const detectedOS = detectOS();
  const options = SANDBOX_OPTIONS[detectedOS] || SANDBOX_OPTIONS.Linux;

  console.log(c(`  Detected OS: ${detectedOS}`, 'blue'));
  console.log('');
  console.log('  Select a sandbox mode:');
  console.log('');
  options.forEach((opt, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(opt.label, 'blue')} — ${opt.desc}`);
  });
  console.log('');

  const answer = await ask(rl, c(`  Choice (1-${options.length}, or b=back, q=quit) [1]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const index = parseInt(trimmed, 10);
  const selected = options[(index >= 1 && index <= options.length) ? index - 1 : 0];
  state.sandboxMode = selected.key;
  state.detectedOS = detectedOS;
  console.log(c(`  → Sandbox: ${selected.label}`, 'green'));

  if (selected.key === 'none' && state.trustLevel === 'yolo') {
    console.log('');
    console.log(c('  ⚠ WARNING: YOLO mode without sandbox is extremely risky!', 'red'));
    console.log(c('    Consider adding at least Docker or OS-level sandboxing.', 'yellow'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 4 — Agent Structure
// ---------------------------------------------------------------------------

async function stageAgentStructure(rl, _ctx, state) {
  printStageHeader(3);

  console.log('  How should Gemini operate in this project?');
  console.log('');
  console.log(`    ${c('1', 'bold')}. ${c('Single agent', 'blue')} — One Gemini agent handles everything (simpler, good for small repos).`);
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
    console.log(c('  Will generate .gemini/agents/ with sub-agent markdown starters.', 'dim'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 5 — Domain Pack Selection
// ---------------------------------------------------------------------------

async function stageDomainPacks(rl, ctx, state) {
  printStageHeader(4);

  const detected = detectGeminiDomainPacks(ctx, state.stacks || []);
  const detectedKeys = new Set(detected.map(p => p.key));

  console.log('  Available domain packs:');
  console.log('');

  const allPacks = GEMINI_DOMAIN_PACKS.map(pack => {
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
// Stage 6 — MCP Pack Selection
// ---------------------------------------------------------------------------

async function stageMcpPacks(rl, ctx, state) {
  printStageHeader(5);

  const recommended = recommendGeminiMcpPacks(state.stacks || [], state.domainPacks || [], { ctx });
  const recommendedKeys = new Set(recommended.map(p => p.key));

  console.log('  Available MCP packs:');
  console.log('');

  GEMINI_MCP_PACKS.forEach((pack, i) => {
    const isRec = recommendedKeys.has(pack.key);
    const marker = isRec ? c(' (recommended)', 'green') : '';
    const authNote = pack.requiredAuth.length > 0
      ? c(` [requires: ${pack.requiredAuth.join(', ')}]`, 'yellow')
      : '';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(pack.label, 'blue')}${marker}${authNote}`);
    console.log(c(`       ${pack.description}`, 'dim'));
  });
  console.log('');

  const defaultSelection = GEMINI_MCP_PACKS
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
    const indices = trimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < GEMINI_MCP_PACKS.length);
    selectedPacks = indices.map(i => GEMINI_MCP_PACKS[i]);
  }

  state.mcpPacks = selectedPacks;
  console.log(c(`  → Selected: ${selectedPacks.map(p => p.label).join(', ') || 'none'}`, 'green'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 7 — Policy Tier Config (Gemini-unique!)
// ---------------------------------------------------------------------------

const POLICY_TIERS = [
  { key: 'none', label: 'No Policy Engine', desc: 'Trust is managed entirely via settings.json and sandbox.' },
  { key: 'basic', label: 'Basic Policies', desc: 'File-type restrictions and read-only directories.' },
  { key: 'standard', label: 'Standard Policies', desc: 'File-type + tool restrictions + sensitive path protection.' },
  { key: 'strict', label: 'Strict Governance', desc: 'Full policy engine with audit trail, approval escalation, and deny-lists.' },
];

async function stagePolicyTier(rl, _ctx, state) {
  printStageHeader(6);

  console.log('  Gemini CLI supports a policy engine for fine-grained control.');
  console.log(c('  Policies live in .gemini/policy/*.toml and complement settings.json.', 'dim'));
  console.log('');

  POLICY_TIERS.forEach((tier, i) => {
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(tier.label, 'blue')} — ${tier.desc}`);
  });
  console.log('');

  // Recommend tier based on trust level
  let recommended = 1;
  if (state.trustLevel === 'yolo') recommended = 3;
  else if (state.trustLevel === 'auto_edit') recommended = 2;

  const answer = await ask(rl, c(`  Choice (1-4, or b=back, q=quit) [${recommended}]: `, 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  const index = parseInt(trimmed, 10);
  const selected = POLICY_TIERS[(index >= 1 && index <= 4) ? index - 1 : recommended - 1];
  state.policyTier = selected.key;
  console.log(c(`  → Policy tier: ${selected.label}`, 'green'));

  if (selected.key === 'strict') {
    console.log('');
    console.log(c('  Will generate .gemini/policy/ with governance TOML files.', 'dim'));
    console.log(c('  Includes: file-restrictions, tool-deny-list, audit-escalation.', 'dim'));
  } else if (selected.key === 'standard') {
    console.log('');
    console.log(c('  Will generate .gemini/policy/ with standard restriction rules.', 'dim'));
  } else if (selected.key === 'basic') {
    console.log('');
    console.log(c('  Will generate .gemini/policy/ with basic file-type restrictions.', 'dim'));
  }

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 8 — Hook Configuration (BeforeTool/AfterTool)
// ---------------------------------------------------------------------------

const COMMON_HOOKS = [
  { key: 'before-scrub-secrets', event: 'BeforeTool', label: 'Scrub secrets from tool inputs', command: "grep -rn 'sk-\\|AKIA\\|ghp_\\|xox[baprs]-' . && echo 'BLOCKED: secret detected' && exit 1 || true" },
  { key: 'before-lint', event: 'BeforeTool', label: 'Lint check before edits', command: 'npm run lint --silent 2>/dev/null || true' },
  { key: 'after-redact', event: 'AfterTool', label: 'Redact sensitive output', command: "sed 's/sk-[A-Za-z0-9_-]\\{20,\\}/[REDACTED]/g'" },
  { key: 'after-test', event: 'AfterTool', label: 'Run tests after changes', command: 'npm test --silent 2>/dev/null || true' },
  { key: 'before-block-dangerous', event: 'BeforeTool', label: 'Block dangerous commands (rm -rf, chmod 777)', command: "echo \"$TOOL_INPUT\" | grep -qE 'rm -rf /|chmod 777|curl.*\\| bash' && echo 'BLOCKED: dangerous command' && exit 1 || true" },
  { key: 'after-size-check', event: 'AfterTool', label: 'Check output size limits', command: "wc -c < /dev/stdin | awk '{if ($1 > 100000) {print \"WARNING: large output\"; exit 1}}' || true" },
];

async function stageHooks(rl, _ctx, state) {
  printStageHeader(7);

  console.log('  Configure Gemini hooks (BeforeTool and AfterTool lifecycle events):');
  console.log(c('  BeforeTool: runs before each tool call (validate, scrub, block)', 'dim'));
  console.log(c('  AfterTool: runs after each tool call (redact, test, audit)', 'dim'));
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
  console.log('  Available hook patterns:');
  console.log('');

  COMMON_HOOKS.forEach((hook, i) => {
    const eventColor = hook.event === 'BeforeTool' ? 'yellow' : 'blue';
    console.log(`    ${c(`${i + 1}`, 'bold')}. ${c(hook.label, 'blue')} (${c(hook.event, eventColor)})`);
    console.log(c(`       ${hook.command.slice(0, 80)}${hook.command.length > 80 ? '...' : ''}`, 'dim'));
  });
  console.log('');

  const hookAnswer = await ask(rl, c('  Select hooks (comma-separated numbers, a=all, n=none) [1,3]: ', 'magenta'));
  const hookTrimmed = hookAnswer.trim().toLowerCase();

  let selectedHooks;
  if (hookTrimmed === 'n' || hookTrimmed === 'none') {
    selectedHooks = [];
  } else if (hookTrimmed === 'a' || hookTrimmed === 'all') {
    selectedHooks = [...COMMON_HOOKS];
  } else if (hookTrimmed === '') {
    selectedHooks = [COMMON_HOOKS[0], COMMON_HOOKS[2]]; // default: scrub + redact
  } else {
    const indices = hookTrimmed.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < COMMON_HOOKS.length);
    selectedHooks = indices.map(i => COMMON_HOOKS[i]);
  }

  state.hooks = selectedHooks;
  console.log(c(`  → Selected ${selectedHooks.length} hook(s): ${selectedHooks.map(h => h.label).join(', ') || 'none'}`, 'green'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 9 — CI Integration
// ---------------------------------------------------------------------------

async function stageCi(rl, _ctx, state) {
  printStageHeader(8);

  console.log('  Optionally generate GitHub Actions workflows for Gemini CLI automation.');
  console.log(c('  Uses the run-gemini-cli action for CI integration.', 'dim'));
  console.log('');

  const answer = await ask(rl, c('  Generate CI workflows? (y/n, b=back, q=quit) [n]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'q') return 'quit';

  state.enableCi = trimmed === 'y' || trimmed === 'yes';
  console.log(c(`  → CI workflows: ${state.enableCi ? 'will be generated' : 'skipped'}`, state.enableCi ? 'green' : 'dim'));

  return 'next';
}

// ---------------------------------------------------------------------------
// Stage 10 — Review & Generate
// ---------------------------------------------------------------------------

async function stageReviewAndGenerate(rl, ctx, state, options) {
  printStageHeader(9);

  console.log(c('  Setup Summary:', 'bold'));
  console.log('');
  console.log(`  ${c('Directory:', 'dim')}        ${ctx.dir}`);
  console.log(`  ${c('Stacks:', 'dim')}          ${(state.stacks || []).map(s => s.label).join(', ') || 'none detected'}`);
  console.log(`  ${c('Migration:', 'dim')}        ${state.migrationMode || 'create'}`);
  console.log(`  ${c('Trust level:', 'dim')}      ${state.trustLevel || 'normal'}`);
  console.log(`  ${c('Sandbox:', 'dim')}          ${state.sandboxMode || 'none'} (${state.detectedOS || detectOS()})`);
  console.log(`  ${c('Agent mode:', 'dim')}       ${state.agentMode === 'multi' ? 'Multi-agent' : 'Single agent'}`);
  console.log(`  ${c('Domain packs:', 'dim')}     ${(state.domainPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`  ${c('MCP packs:', 'dim')}        ${(state.mcpPacks || []).map(p => p.label).join(', ') || 'none'}`);
  console.log(`  ${c('Policy tier:', 'dim')}      ${state.policyTier || 'none'}`);
  console.log(`  ${c('Hooks:', 'dim')}            ${state.hooksEnabled ? `${(state.hooks || []).length} hook(s)` : 'disabled'}`);
  console.log(`  ${c('CI workflows:', 'dim')}     ${state.enableCi ? 'yes' : 'no'}`);
  console.log('');

  // List artifacts that will be generated
  const artifacts = ['GEMINI.md', '.gemini/settings.json'];
  if (state.agentMode === 'multi') artifacts.push('.gemini/agents/ (sub-agent starters)');
  if ((state.domainPacks || []).length > 0) artifacts.push('.gemini/settings.json (domain config)');
  if ((state.mcpPacks || []).length > 0) artifacts.push('.gemini/settings.json (MCP sections)');
  if (state.policyTier && state.policyTier !== 'none') artifacts.push('.gemini/policy/ (policy TOML files)');
  if (state.hooksEnabled && (state.hooks || []).length > 0) artifacts.push('.gemini/settings.json (hooks section)');
  if (state.enableCi) artifacts.push('.github/workflows/ (Gemini CI workflows)');

  console.log(c('  Artifacts to generate:', 'bold'));
  for (const a of artifacts) {
    console.log(c(`    + ${a}`, 'green'));
  }
  console.log('');

  const answer = await ask(rl, c('  Proceed with generation? (y/n, b=back) [y]: ', 'magenta'));
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'b') return 'back';
  if (trimmed === 'n' || trimmed === 'q') return 'quit';

  console.log('');
  console.log(c('  Generating artifacts...', 'bold'));
  console.log('');

  const writtenFiles = [];
  const preservedFiles = [];
  const geminiDir = path.join(ctx.dir, '.gemini');

  // Ensure .gemini/ directory exists
  fs.mkdirSync(geminiDir, { recursive: true });

  // Generate GEMINI.md
  const geminiMdPath = path.join(ctx.dir, 'GEMINI.md');
  if (state.migrationMode !== 'merge' || !fs.existsSync(geminiMdPath)) {
    const stackNames = (state.stacks || []).map(s => s.label).join(', ') || 'general';
    const geminiMdContent = `# Project Instructions for Gemini CLI

## Role
You are an AI assistant working on this ${stackNames} project.

## Constraints
- Follow existing code conventions and patterns
- Run tests before suggesting changes are complete
- Never commit secrets, API keys, or credentials
- Ask for clarification when requirements are ambiguous

## Verification
- Always verify changes compile/build successfully
- Run the test suite after modifications
- Check for lint errors before marking work as done
`;
    fs.writeFileSync(geminiMdPath, geminiMdContent, 'utf8');
    writtenFiles.push('GEMINI.md');
    console.log(c('  + Created GEMINI.md', 'green'));
  } else {
    preservedFiles.push('GEMINI.md');
    console.log(c('  ~ GEMINI.md (preserved, merge mode)', 'dim'));
  }

  // Generate settings.json
  const settingsPath = path.join(geminiDir, 'settings.json');
  const settings = {};

  // Trust level
  if (state.trustLevel === 'yolo') {
    settings.toolPolicy = 'yolo';
    settings.autoApprove = true;
  } else if (state.trustLevel === 'auto_edit') {
    settings.toolPolicy = 'auto-edit';
    settings.autoApprove = false;
  } else {
    settings.toolPolicy = 'normal';
    settings.autoApprove = false;
  }

  // Sandbox
  if (state.sandboxMode && state.sandboxMode !== 'none') {
    settings.sandbox = state.sandboxMode;
  }

  // Hooks
  if (state.hooksEnabled && (state.hooks || []).length > 0) {
    settings.hooks = {};
    const beforeHooks = (state.hooks || []).filter(h => h.event === 'BeforeTool');
    const afterHooks = (state.hooks || []).filter(h => h.event === 'AfterTool');
    if (beforeHooks.length > 0) {
      settings.hooks.BeforeTool = beforeHooks.map(h => ({
        description: h.label,
        command: h.command,
        timeout_ms: 10000,
      }));
    }
    if (afterHooks.length > 0) {
      settings.hooks.AfterTool = afterHooks.map(h => ({
        description: h.label,
        command: h.command,
        timeout_ms: 10000,
      }));
    }
  }

  // MCP servers
  if ((state.mcpPacks || []).length > 0) {
    settings.mcpServers = {};
    for (const pack of state.mcpPacks) {
      if (pack.serverName && pack.jsonProjection) {
        settings.mcpServers[pack.serverName] = pack.jsonProjection;
      }
    }
  }

  if (state.migrationMode !== 'merge' || !fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    writtenFiles.push('.gemini/settings.json');
    console.log(c('  + Created .gemini/settings.json', 'green'));
  } else {
    preservedFiles.push('.gemini/settings.json');
    console.log(c('  ~ .gemini/settings.json (preserved, merge mode)', 'dim'));
  }

  // Generate policy files
  if (state.policyTier && state.policyTier !== 'none') {
    const policyDir = path.join(geminiDir, 'policy');
    fs.mkdirSync(policyDir, { recursive: true });

    if (state.policyTier === 'basic' || state.policyTier === 'standard' || state.policyTier === 'strict') {
      const fileRestrictions = `# File type restrictions — generated by nerviq
# Protect sensitive files from unreviewed edits.

[file-restrictions]
deny_edit = [".env", ".env.*", "*.pem", "*.key", "credentials.*"]
deny_delete = [".env", ".env.*", "*.pem", "*.key", "*.lock"]
read_only_dirs = [".git", "node_modules", ".gemini/policy"]
`;
      const frPath = path.join(policyDir, 'file-restrictions.toml');
      fs.writeFileSync(frPath, fileRestrictions, 'utf8');
      writtenFiles.push('.gemini/policy/file-restrictions.toml');
      console.log(c('  + Created .gemini/policy/file-restrictions.toml', 'green'));
    }

    if (state.policyTier === 'standard' || state.policyTier === 'strict') {
      const toolRestrictions = `# Tool restrictions — generated by nerviq
# Limit which tools the agent can invoke without approval.

[tool-restrictions]
deny_tools = ["shell_exec_unsafe", "network_raw"]
require_approval = ["file_delete", "git_push", "deploy"]
`;
      const trPath = path.join(policyDir, 'tool-restrictions.toml');
      fs.writeFileSync(trPath, toolRestrictions, 'utf8');
      writtenFiles.push('.gemini/policy/tool-restrictions.toml');
      console.log(c('  + Created .gemini/policy/tool-restrictions.toml', 'green'));
    }

    if (state.policyTier === 'strict') {
      const governance = `# Governance rules — generated by nerviq
# Strict audit and escalation policies.

[governance]
audit_trail = true
escalation_on_deny = true
max_auto_edits_per_session = 50
require_justification_for = ["security-override", "policy-bypass"]

[governance.approval-escalation]
# Edits to these paths require explicit human approval
paths = [".gemini/", ".github/workflows/", "deploy/", "infra/"]
`;
      const govPath = path.join(policyDir, 'governance.toml');
      fs.writeFileSync(govPath, governance, 'utf8');
      writtenFiles.push('.gemini/policy/governance.toml');
      console.log(c('  + Created .gemini/policy/governance.toml', 'green'));
    }
  }

  // Generate sub-agent starters
  if (state.agentMode === 'multi') {
    const agentsDir = path.join(geminiDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const orchestrator = `# Orchestrator Agent
You coordinate work across specialized sub-agents.
Delegate tasks to the appropriate sub-agent and synthesize results.
`;
    fs.writeFileSync(path.join(agentsDir, 'orchestrator.md'), orchestrator, 'utf8');
    writtenFiles.push('.gemini/agents/orchestrator.md');

    const reviewer = `# Code Reviewer Agent
You specialize in reviewing code changes for quality, security, and correctness.
Focus on actionable feedback with specific line references.
`;
    fs.writeFileSync(path.join(agentsDir, 'reviewer.md'), reviewer, 'utf8');
    writtenFiles.push('.gemini/agents/reviewer.md');

    console.log(c('  + Created .gemini/agents/ (2 sub-agent starters)', 'green'));
  }

  // Generate CI workflows
  if (state.enableCi) {
    const workflowDir = path.join(ctx.dir, '.github', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });

    const ciContent = `# Gemini PR Review — generated by nerviq
name: Gemini PR Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  gemini-review:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gemini CLI Review
        uses: google/run-gemini-cli@v1
        with:
          approval-policy: suggest
          format: github-pr-comment
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
`;
    const ciPath = path.join(workflowDir, 'gemini-review.yml');
    fs.writeFileSync(ciPath, ciContent, 'utf8');
    writtenFiles.push('.github/workflows/gemini-review.yml');
    console.log(c('  + Created .github/workflows/gemini-review.yml', 'green'));
  }

  // Report results
  console.log('');
  console.log(`  ${c(String(writtenFiles.length), 'bold')} files created.`);
  if (preservedFiles.length > 0) {
    console.log(`  ${c(String(preservedFiles.length), 'dim')} existing files preserved.`);
  }

  return 'done';
}

// ---------------------------------------------------------------------------
// Main wizard loop with back-navigation
// ---------------------------------------------------------------------------

const STAGES = [
  stageProjectDetection,
  stageTrustApproval,
  stageSandboxSelection,
  stageAgentStructure,
  stageDomainPacks,
  stageMcpPacks,
  stagePolicyTier,
  stageHooks,
  stageCi,
  stageReviewAndGenerate,
];

async function geminiInteractive(options = {}) {
  const dir = options.dir || process.cwd();

  // Non-interactive fallback: if no TTY, skip wizard
  if (!isTTY()) {
    console.log(c('  No interactive terminal detected — cannot run wizard.', 'dim'));
    console.log(c('  Use `npx nerviq --platform gemini` for non-interactive setup.', 'dim'));
    return { cancelled: true };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ctx = new GeminiProjectContext(dir);
  const state = {};

  console.log('');
  console.log(c('  +----------------------------------------------+', 'magenta'));
  console.log(c('  |   nerviq: Gemini Interactive Wizard    |', 'magenta'));
  console.log(c('  +----------------------------------------------+', 'magenta'));
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
  console.log(c('  Done! Run `npx nerviq --platform gemini` to audit your setup.', 'green'));
  console.log('');

  return { cancelled: false, state };
}

module.exports = { geminiInteractive };
