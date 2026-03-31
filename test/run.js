const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
const { analyzeProject } = require('../src/analyze');
const { buildProposalBundle, applyProposalBundle } = require('../src/plans');
const { getGovernanceSummary } = require('../src/governance');
const { runBenchmark } = require('../src/benchmark');
const { TECHNIQUES, STACKS } = require('../src/techniques');
const { ProjectContext } = require('../src/context');
const { getBadgeUrl, getBadgeMarkdown } = require('../src/badge');
const { shouldCollect } = require('../src/insights');

function writeJson(dir, file, value) {
  fs.writeFileSync(path.join(dir, file), JSON.stringify(value, null, 2));
}

function mkFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `claudex-test-${name}-`));
  return dir;
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'cli.js'), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}: ${e.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}: ${e.message}`);
  }
}

async function main() {
  console.log('\n  claudex-setup test suite\n');

  // ============================================================
  // Unit tests: techniques
  // ============================================================
  console.log('  --- Techniques ---');

  test('All techniques have required fields', () => {
    for (const [key, t] of Object.entries(TECHNIQUES)) {
      assert.ok(t.id, `${key} missing id`);
      assert.ok(t.name, `${key} missing name`);
      assert.ok(typeof t.check === 'function', `${key} check not a function`);
      assert.ok(t.impact, `${key} missing impact`);
      assert.ok(['critical', 'high', 'medium', 'low'].includes(t.impact), `${key} invalid impact: ${t.impact}`);
      assert.ok(t.category, `${key} missing category`);
    }
  });

  test('No duplicate technique IDs', () => {
    const ids = Object.values(TECHNIQUES).map(t => t.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `Duplicate IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });

  test('No duplicate technique names', () => {
    const names = Object.values(TECHNIQUES).map(t => t.name);
    const unique = new Set(names);
    assert.equal(names.length, unique.size, 'Duplicate names found');
  });

  // ============================================================
  // Unit tests: empty project
  // ============================================================
  console.log('\n  --- Empty project ---');

  await testAsync('Empty project gets low score', async () => {
    const dir = mkFixture('empty');
    try {
      const result = await audit({ dir, silent: true });
      assert.ok(result.score < 20, `Empty project scored ${result.score}, expected < 20`);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Empty project has no vacuous passes for hooks/commands/agents', async () => {
    const dir = mkFixture('empty-vacuous');
    try {
      const result = await audit({ dir, silent: true });
      const passedKeys = result.results.filter(r => r.passed === true).map(r => r.key);
      assert.ok(!passedKeys.includes('hooksAreSpecific'), 'hooksAreSpecific should not pass on empty project');
      assert.ok(!passedKeys.includes('commandsUseArguments'), 'commandsUseArguments should not pass on empty project');
      assert.ok(!passedKeys.includes('agentsHaveMaxTurns'), 'agentsHaveMaxTurns should not pass on empty project');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Python project skips node_modules hygiene check', async () => {
    const dir = mkFixture('python-node-modules');
    try {
      fs.writeFileSync(path.join(dir, 'requirements.txt'), 'fastapi\npytest\n');
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\n');
      const result = await audit({ dir, silent: true });
      const nodeModulesCheck = result.results.find(r => r.key === 'gitIgnoreNodeModules');
      assert.equal(nodeModulesCheck.passed, null, 'node_modules check should be skipped for non-Node projects');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Unit tests: Next.js project
  // ============================================================
  console.log('\n  --- Next.js project ---');

  await testAsync('Next.js project detects React + TypeScript + Node', async () => {
    const dir = mkFixture('nextjs');
    try {
      writeJson(dir, 'package.json', { name: 'app', dependencies: { next: '16', react: '19' } });
      fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
      const ctx = new ProjectContext(dir);
      const stacks = ctx.detectStacks(STACKS);
      const labels = stacks.map(s => s.label);
      assert.ok(labels.includes('React'), 'Should detect React');
      assert.ok(labels.includes('TypeScript'), 'Should detect TypeScript');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Setup generates dependency guidelines', async () => {
    const dir = mkFixture('nextjs-deps');
    try {
      writeJson(dir, 'package.json', {
        name: 'app',
        scripts: { test: 'vitest', build: 'next build' },
        dependencies: { next: '16', react: '19', zod: '3', '@tanstack/react-query': '5', '@prisma/client': '6' },
        devDependencies: { vitest: '3', prisma: '6' }
      });
      fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      await setup({ dir, auto: true });
      const md = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
      assert.ok(md.includes('Zod'), 'Should mention Zod');
      assert.ok(md.includes('React Query') || md.includes('TanStack'), 'Should mention React Query');
      assert.ok(md.includes('Prisma'), 'Should mention Prisma');
      assert.ok(md.includes('Vitest'), 'Should mention Vitest');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Setup generates stack-specific commands', async () => {
    const dir = mkFixture('nextjs-cmds');
    try {
      writeJson(dir, 'package.json', { name: 'app', dependencies: { next: '16', react: '19' } });
      fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
      // next.config.js triggers Next.js stack detection
      fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}');
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      await setup({ dir, auto: true });
      const deploy = fs.readFileSync(path.join(dir, '.claude/commands/deploy.md'), 'utf8');
      assert.ok(deploy.includes('Next.js') || deploy.includes('Vercel') || deploy.includes('next'), 'Deploy should be Next.js-specific');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Setup uses pyproject.toml metadata when package.json is absent', async () => {
    const dir = mkFixture('pyproject-meta');
    try {
      fs.writeFileSync(path.join(dir, 'pyproject.toml'), [
        '[project]',
        'name = "ai-copilot"',
        'description = "Python workflow assistant"',
        ''
      ].join('\n'));
      fs.writeFileSync(path.join(dir, 'requirements.txt'), 'fastapi\npytest\n');
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      await setup({ dir, auto: true });
      const md = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
      assert.ok(md.startsWith('# ai-copilot — Python workflow assistant'), 'Should use pyproject metadata for heading');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Next.js App Router Mermaid diagram does not contain undefined edges', async () => {
    const dir = mkFixture('next-mermaid');
    try {
      writeJson(dir, 'package.json', { name: 'app', dependencies: { next: '16', react: '19' } });
      fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}');
      fs.mkdirSync(path.join(dir, 'app', 'api'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
      await setup({ dir, auto: true });
      const md = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
      assert.ok(!md.includes('undefined'), 'Mermaid diagram should not contain undefined node references');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Unit tests: hooks registration
  // ============================================================
  console.log('\n  --- Hooks ---');

  await testAsync('Setup creates settings.json with hooks', async () => {
    const dir = mkFixture('hooks');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      await setup({ dir, auto: true });
      assert.ok(fs.existsSync(path.join(dir, '.claude/settings.json')), 'settings.json should exist');
      const settings = JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'));
      assert.ok(settings.hooks, 'Should have hooks');
      assert.ok(settings.hooks.PostToolUse, 'Should have PostToolUse');
      assert.ok(settings.hooks.PreToolUse, 'Should have PreToolUse');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Unit tests: no overwrite
  // ============================================================
  console.log('\n  --- No overwrite ---');

  await testAsync('Setup does not overwrite existing CLAUDE.md', async () => {
    const dir = mkFixture('no-overwrite');
    try {
      const original = '# My custom CLAUDE.md\nDo not touch this.';
      fs.writeFileSync(path.join(dir, 'CLAUDE.md'), original);
      writeJson(dir, 'package.json', { name: 'app' });
      await setup({ dir, auto: true });
      const after = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
      assert.equal(after, original, 'CLAUDE.md should not be modified');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Unit tests: badge
  // ============================================================
  console.log('\n  --- Badge ---');

  test('Badge URL has correct format', () => {
    const url = getBadgeUrl(75);
    assert.ok(url.includes('shields.io'), 'Should use shields.io');
    assert.ok(url.includes('75'), 'Should include score');
    assert.ok(url.includes('yellow'), 'Score 75 should be yellow (>=60 <80)');
  });

  test('Badge color thresholds', () => {
    assert.ok(getBadgeUrl(85).includes('brightgreen'));
    assert.ok(getBadgeUrl(65).includes('yellow'));
    assert.ok(getBadgeUrl(45).includes('orange'));
    assert.ok(getBadgeUrl(20).includes('red'));
  });

  // ============================================================
  // Unit tests: insights
  // ============================================================
  console.log('\n  --- Insights ---');

  test('Insights is opt-in by default', () => {
    assert.equal(shouldCollect(), false, 'Should not collect by default');
  });

  // ============================================================
  // Unit tests: version stamp
  // ============================================================
  console.log('\n  --- Version stamp ---');

  await testAsync('Generated CLAUDE.md has version stamp', async () => {
    const dir = mkFixture('stamp');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      await setup({ dir, auto: true });
      const md = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
      assert.ok(md.includes('claudex-setup'), 'Should reference claudex-setup');
      assert.ok(md.includes('hand-crafted') || md.includes('Customize'), 'Should have honesty disclaimer');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Audit result includes organic score and quick wins', async () => {
    const dir = mkFixture('audit-shape');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const result = await audit({ dir, silent: true });
      assert.equal(typeof result.organicScore, 'number', 'organicScore should be included');
      assert.ok(Array.isArray(result.quickWins), 'quickWins should be included');
      assert.equal(typeof result.checkCount, 'number', 'checkCount should be included');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Analysis / mode tests
  // ============================================================
  console.log('\n  --- Analysis ---');

  await testAsync('Augment analysis returns structured report', async () => {
    const dir = mkFixture('augment-report');
    try {
      writeJson(dir, 'package.json', { name: 'app', scripts: { test: 'jest' }, dependencies: { next: '16', react: '19' } });
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\nnode_modules\n');
      fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}');
      fs.mkdirSync(path.join(dir, 'app', 'api'), { recursive: true });
      const report = await analyzeProject({ dir, mode: 'augment' });
      assert.equal(report.mode, 'augment');
      assert.equal(report.writeBehavior, 'No files are written in this mode.');
      assert.ok(report.projectSummary);
      assert.ok(Array.isArray(report.topNextActions));
      assert.ok(Array.isArray(report.recommendedImprovements));
      assert.ok(Array.isArray(report.suggestedRolloutOrder));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Proposal bundle includes templated changes with file previews', async () => {
    const dir = mkFixture('plan-bundle');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const bundle = await buildProposalBundle({ dir });
      assert.ok(bundle.proposals.length > 0, 'Expected at least one proposal bundle');
      const claudeMdProposal = bundle.proposals.find(item => item.id === 'claude-md');
      assert.ok(claudeMdProposal, 'Expected a CLAUDE.md proposal');
      assert.ok(claudeMdProposal.files.some(file => file.path === 'CLAUDE.md'), 'CLAUDE.md proposal should preview the generated file');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await testAsync('Apply proposal bundle creates rollback and activity artifacts', async () => {
    const dir = mkFixture('apply-bundle');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const result = await applyProposalBundle({ dir, only: ['claude-md', 'hooks'], dryRun: false });
      assert.ok(result.createdFiles.includes('CLAUDE.md'), 'Should create CLAUDE.md');
      assert.ok(result.rollbackArtifact, 'Should emit rollback artifact');
      assert.ok(result.activityArtifact, 'Should emit activity artifact');
      assert.ok(fs.existsSync(path.join(dir, result.rollbackArtifact)), 'Rollback artifact should exist on disk');
      assert.ok(fs.existsSync(path.join(dir, result.activityArtifact)), 'Activity artifact should exist on disk');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('Governance summary exposes profiles and hook registry', () => {
    const summary = getGovernanceSummary();
    assert.ok(Array.isArray(summary.permissionProfiles), 'permissionProfiles should be an array');
    assert.ok(summary.permissionProfiles.some(item => item.key === 'safe-write'), 'Should include safe-write profile');
    assert.ok(Array.isArray(summary.hookRegistry), 'hookRegistry should be an array');
    assert.ok(summary.hookRegistry.some(item => item.key === 'protect-secrets'), 'Should include protect-secrets hook');
  });

  await testAsync('Benchmark runs on isolated copy without modifying original repo', async () => {
    const dir = mkFixture('benchmark');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const report = await runBenchmark({ dir });
      assert.equal(typeof report.delta.score, 'number', 'Benchmark should report score delta');
      assert.ok(report.after.score >= report.before.score, 'Benchmark should not regress readiness on starter apply');
      assert.ok(!fs.existsSync(path.join(dir, '.claude')), 'Original repo should remain untouched');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // CLI tests
  // ============================================================
  console.log('\n  --- CLI ---');

  test('CLI rejects unknown commands with suggestion', () => {
    const result = runCli(['setpu'], path.join(__dirname, '..'));
    assert.notEqual(result.status, 0, 'Unknown command should fail');
    assert.ok(result.stderr.includes("Unknown command 'setpu'"), 'Should explain the unknown command');
    assert.ok(result.stderr.includes("Did you mean 'setup'?"), 'Should suggest the closest command');
  });

  test('CLI threshold fails when score is too low', () => {
    const dir = mkFixture('cli-threshold-low');
    try {
      const result = runCli(['--threshold', '50'], dir);
      assert.equal(result.status, 1, 'Threshold failure should exit with code 1');
      assert.ok(result.stderr.includes('Threshold failed'), 'Should report threshold failure');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI threshold passes after setup improves score', () => {
    const dir = mkFixture('cli-threshold-pass');
    try {
      writeJson(dir, 'package.json', { name: 'app', scripts: { test: 'jest', lint: 'eslint .' } });
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\nnode_modules\n');
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      const setupResult = runCli(['setup', '--auto'], dir);
      assert.equal(setupResult.status, 0, 'Setup should succeed');
      const auditResult = runCli(['--threshold', '40'], dir);
      assert.equal(auditResult.status, 0, 'Threshold should pass after setup');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI suggest-only returns JSON report', () => {
    const dir = mkFixture('cli-suggest-json');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const result = runCli(['suggest-only', '--json'], dir);
      assert.equal(result.status, 0, 'suggest-only --json should succeed');
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.mode, 'suggest-only');
      assert.ok(payload.projectSummary, 'JSON report should include projectSummary');
      assert.ok(Array.isArray(payload.topNextActions), 'JSON report should include topNextActions');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI discover alias still works', () => {
    const dir = mkFixture('cli-discover');
    try {
      const result = runCli(['discover', '--json'], dir);
      assert.equal(result.status, 0, 'discover should behave like audit');
      const payload = JSON.parse(result.stdout);
      assert.equal(typeof payload.score, 'number');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI plan exports file and activity artifact', () => {
    const dir = mkFixture('cli-plan');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const outFile = path.join(dir, 'claudex-plan.json');
      const result = runCli(['plan', '--out', outFile], dir);
      assert.equal(result.status, 0, 'plan should succeed');
      assert.ok(fs.existsSync(outFile), 'Plan file should be created');
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'claudex-setup', 'activity')), 'Plan export should create an activity artifact');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI governance returns JSON summary', () => {
    const dir = mkFixture('cli-governance');
    try {
      const result = runCli(['governance', '--json'], dir);
      assert.equal(result.status, 0, 'governance --json should succeed');
      const payload = JSON.parse(result.stdout);
      assert.ok(Array.isArray(payload.permissionProfiles), 'JSON should include permissionProfiles');
      assert.ok(Array.isArray(payload.hookRegistry), 'JSON should include hookRegistry');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI benchmark can export markdown report', () => {
    const dir = mkFixture('cli-benchmark');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const outFile = path.join(dir, 'benchmark.md');
      const result = runCli(['benchmark', '--out', outFile], dir);
      assert.equal(result.status, 0, 'benchmark should succeed');
      assert.ok(fs.existsSync(outFile), 'benchmark should write the markdown report');
      const content = fs.readFileSync(outFile, 'utf8');
      assert.ok(content.includes('Benchmark Report'), 'markdown report should be readable');
      assert.ok(!fs.existsSync(path.join(dir, '.claude')), 'benchmark should not modify the source repo');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('CLI apply can consume an exported plan file', () => {
    const dir = mkFixture('cli-apply-plan');
    try {
      writeJson(dir, 'package.json', { name: 'app' });
      const planFile = path.join(dir, 'claudex-plan.json');
      const exportResult = runCli(['plan', '--out', planFile], dir);
      assert.equal(exportResult.status, 0, 'plan export should succeed');
      const applyResult = runCli(['apply', '--plan', planFile, '--only', 'claude-md,hooks'], dir);
      assert.equal(applyResult.status, 0, 'apply should succeed with exported plan');
      assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')), 'apply should create CLAUDE.md from plan file');
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'claudex-setup', 'rollbacks')), 'apply should create rollback artifacts');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Integration test
  // ============================================================
  console.log('\n  --- Integration ---');

  await testAsync('Full audit → setup → audit cycle', async () => {
    const dir = mkFixture('integration');
    try {
      writeJson(dir, 'package.json', { name: 'app', scripts: { test: 'jest', lint: 'eslint .' } });
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\nnode_modules\n');
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

      const before = await audit({ dir, silent: true });
      await setup({ dir, auto: true });
      const after = await audit({ dir, silent: true });

      assert.ok(after.score > before.score, `Score should improve: ${before.score} → ${after.score}`);
      assert.ok(after.passed > before.passed, 'More checks should pass after setup');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // ============================================================
  // Summary
  // ============================================================
  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('');

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
