const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
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
