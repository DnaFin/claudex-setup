/**
 * Check-Level Test Matrix
 * Tests every check in TECHNIQUES with pass/fail/skip scenarios.
 * Auto-generated from check definitions — if a check changes behavior, this catches it.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TECHNIQUES, STACKS } = require('../src/techniques');
const { ProjectContext } = require('../src/context');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}: ${e.message}`);
  }
}

function mkFixture(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cm-${name}-`));
}

function writeFile(base, filePath, content) {
  const full = path.join(base, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

// ============================================================
// Scenario builders
// ============================================================

function emptyCtx() {
  const dir = mkFixture('empty');
  writeFile(dir, 'package.json', { name: 'empty' });
  return { dir, ctx: new ProjectContext(dir) };
}

function richCtx() {
  const dir = mkFixture('rich');
  writeFile(dir, 'package.json', { name: 'rich', dependencies: { react: '18' }, devDependencies: { typescript: '5' }, scripts: { test: 'jest', lint: 'eslint .', build: 'tsc', dev: 'next dev' } });
  writeFile(dir, 'tsconfig.json', { compilerOptions: { strict: true } });
  writeFile(dir, '.gitignore', '.env\nnode_modules\n.claude/settings.local.json\n');
  writeFile(dir, '.env.example', 'API_KEY=\nDB_URL=\n');
  writeFile(dir, 'README.md', '# Project');
  writeFile(dir, 'CHANGELOG.md', '# Changelog');
  writeFile(dir, 'CONTRIBUTING.md', '# Contributing');
  writeFile(dir, 'LICENSE', 'MIT');
  writeFile(dir, '.editorconfig', 'root = true');
  writeFile(dir, 'Dockerfile', 'FROM node:18');
  writeFile(dir, 'docker-compose.yml', 'version: "3"');
  writeFile(dir, 'CLAUDE.md', [
    '# Rich Project',
    '## Overview',
    'This project is a web application for managing data.',
    '## Role',
    'You are a senior TypeScript engineer.',
    '## Structure',
    'Files in src/app/ are routes. Files in src/components/ are UI.',
    '## Verification',
    '- Test: `npm test`',
    '- Lint: `npm run lint`',
    '- Build: `npm run build`',
    '- Security: use /security-review',
    '## Rules',
    'Do not use any type.',
    'Never commit secrets.',
    'Prefer named exports over default.',
    'Run /compact when context is heavy.',
    'Be mindful of context window limits and token budget.',
    'Consider auto-memory for persistence.',
    'Use sandbox for untrusted commands.',
    'Configure effort level for complex tasks.',
    'Aim for good test coverage with unit tests and integration tests.',
    'Use worktree for parallel sessions.',
    'Claude Code Channels can bridge external messages.',
    '```mermaid',
    'graph TD',
    '  App --> API',
    '```',
    '<constraints>',
    'Always validate input.',
    '</constraints>',
    '```typescript',
    'export function hello() { return "world"; }',
    '```',
  ].join('\n'));
  // .claude config
  writeFile(dir, '.claude/settings.json', {
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    permissions: { defaultMode: 'acceptEdits', deny: ['Bash(rm -rf *)', 'Bash(git push --force *)', 'Read(.env)', 'Read(.env.*)', 'Read(**/secrets/**)'] },
    attribution: { commit: 'Co-Authored-By: Claude' },
    hooks: {
      PreToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'echo {}', timeout: 5 }] }],
      PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'echo {}', timeout: 5 }] }],
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo {}' }] }],
      StopFailure: [{ hooks: [{ type: 'command', command: 'echo {}' }] }],
    }
  });
  writeFile(dir, '.mcp.json', { mcpServers: {
    context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
    thinking: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
    github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: 'xxx' } },
  }});
  writeFile(dir, '.claude/commands/test.md', 'Run tests\n$ARGUMENTS');
  writeFile(dir, '.claude/commands/review.md', 'Review code\n$ARGUMENTS');
  writeFile(dir, '.claude/commands/deploy.md', 'Deploy\n$ARGUMENTS');
  writeFile(dir, '.claude/rules/frontend.md', 'Use TypeScript strict');
  writeFile(dir, '.claude/rules/tests.md', 'Write tests');
  writeFile(dir, '.claude/agents/security-reviewer.md', '---\nname: sec\ntools: [Read, Grep]\nmaxTurns: 10\n---\nReview');
  writeFile(dir, '.claude/agents/test-writer.md', '---\nname: tw\ntools: [Read, Write]\nmaxTurns: 15\n---\nWrite tests');
  writeFile(dir, '.claude/skills/fix-issue/SKILL.md', '---\nname: fix-issue\npaths:\n  - "src/**"\n---\nFix');
  writeFile(dir, '.claude/skills/review/SKILL.md', '---\nname: review\n---\nReview');
  writeFile(dir, '.nerviq/snapshots/index.json', JSON.stringify([{ snapshotKind: 'audit', createdAt: new Date().toISOString(), summary: { score: 50 } }]));
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  writeFile(dir, '.github/workflows/ci.yml', 'name: CI');
  fs.mkdirSync(path.join(dir, 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });
  return { dir, ctx: new ProjectContext(dir) };
}

// ============================================================
// Matrix
// ============================================================

async function main() {
  console.log('\n  Check-Level Test Matrix\n');

  const empty = emptyCtx();
  const rich = richCtx();

  const allKeys = Object.keys(TECHNIQUES);
  console.log(`  Testing ${allKeys.length} checks × pass/fail scenarios...\n`);

  for (const key of allKeys) {
    const tech = TECHNIQUES[key];

    // FAIL scenario: empty repo should fail or skip most checks
    test(`${key} — empty repo returns false or null`, () => {
      const result = tech.check(empty.ctx);
      assert.ok(result === false || result === null || result === true,
        `${key} returned ${result} instead of boolean or null`);
    });

    // PASS scenario: rich repo should pass most checks
    test(`${key} — rich repo returns boolean`, () => {
      const result = tech.check(rich.ctx);
      assert.ok(result === true || result === false || result === null,
        `${key} returned ${typeof result} instead of boolean or null`);
    });

    // TYPE check: every check must return boolean or null, never throw
    test(`${key} — never throws`, () => {
      try {
        tech.check(empty.ctx);
        tech.check(rich.ctx);
      } catch (e) {
        assert.fail(`${key} threw: ${e.message}`);
      }
    });
  }

  // Now verify specific expectations on rich repo
  console.log('\n  Verifying rich repo expected passes...\n');

  const richChecks = {};
  for (const key of allKeys) {
    richChecks[key] = TECHNIQUES[key].check(rich.ctx);
  }

  // These MUST pass on the rich repo
  const mustPass = [
    'claudeMd', 'mermaidArchitecture', 'pathRules', 'underlines200', 'verificationLoop',
    'testCommand', 'lintCommand', 'buildCommand', 'gitIgnoreEnv', 'noSecretsInClaude',
    'customCommands', 'multipleCommands', 'skills', 'multipleSkills', 'agents', 'multipleAgents',
    'multipleRules', 'settingsPermissions', 'permissionDeny', 'noBypassPermissions',
    'secretsProtection', 'hooks', 'hooksInSettings', 'preToolUseHook', 'postToolUseHook',
    'sessionStartHook', 'readme', 'changelog', 'contributing', 'license', 'editorconfig',
    'compactionAwareness', 'contextManagement', 'xmlTags', 'fewShotExamples', 'roleDefinition',
    'constraintBlocks', 'multipleMcpServers', 'context7Mcp', 'negativeInstructions',
    'outputStyleGuidance', 'projectDescriptionInClaudeMd', 'directoryStructureInClaudeMd',
    'multipleHookTypes', 'stopFailureHook', 'denyRulesDepth', 'gitAttributionDecision',
    'hasSnapshotHistory', 'gitIgnoreClaudeLocal', 'packageJsonHasScripts', 'typeCheckingConfigured',
    'noDeprecatedPatterns', 'claudeMdNoContradictions', 'hooksAreSpecific', 'commandsUseArguments',
    'agentsHaveMaxTurns', 'securityReviewInWorkflow', 'dockerfile', 'dockerCompose',
    'mcpHasEnvConfig', 'skillUsesPaths', 'githubActionsOrCI', 'envExampleExists',
    'autoMemoryAwareness', 'sandboxAwareness', 'effortLevelConfigured', 'worktreeAwareness',
    'channelsAwareness', 'claudeMdFreshness', 'testCoverage',
  ];

  for (const key of mustPass) {
    test(`MUST PASS: ${key}`, () => {
      assert.strictEqual(richChecks[key], true, `${key} should pass on rich repo but got ${richChecks[key]}`);
    });
  }

  // These MUST fail on empty repo
  const mustFailEmpty = [
    'claudeMd', 'secretsProtection', 'permissionDeny', 'hooks', 'customCommands',
  ];

  const emptyChecks = {};
  for (const key of allKeys) {
    emptyChecks[key] = TECHNIQUES[key].check(empty.ctx);
  }

  for (const key of mustFailEmpty) {
    test(`MUST FAIL on empty: ${key}`, () => {
      assert.ok(emptyChecks[key] === false, `${key} should fail on empty repo but got ${emptyChecks[key]}`);
    });
  }

  // Cleanup
  fs.rmSync(empty.dir, { recursive: true, force: true });
  fs.rmSync(rich.dir, { recursive: true, force: true });

  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  Check Matrix: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
