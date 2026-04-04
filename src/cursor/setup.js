/**
 * Cursor Setup Module
 *
 * 8 setup families:
 * 1. .cursor/rules/*.mdc (core + stack-specific)
 * 2. Legacy migration (.cursorrules -> .cursor/rules/)
 * 3. .cursor/mcp.json
 * 4. .cursor/environment.json
 * 5. .cursor/automations/ config
 * 6. BugBot config guide
 * 7. CI workflow (GitHub Actions)
 * 8. Design Mode guide
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { version } = require('../../package.json');
const { STACKS } = require('../techniques');
const { writeActivityArtifact, writeRollbackArtifact } = require('../activity');
const { CursorProjectContext } = require('./context');
const { recommendCursorMcpPacks, packToJson } = require('./mcp-packs');

function detectScripts(ctx) {
  const pkg = ctx.jsonFile('package.json');
  if (!pkg || !pkg.scripts) return {};
  return pkg.scripts;
}

function detectProjectName(ctx) {
  const pkg = ctx.jsonFile('package.json');
  if (pkg && pkg.name) return pkg.name;
  return path.basename(ctx.dir);
}

function hasStack(stacks, key) {
  return stacks.some((item) => item.key === key);
}

function buildMermaid(stacks) {
  if (hasStack(stacks, 'nextjs')) {
    return ['```mermaid', 'graph TD', '    UI[App Router / Pages] --> Logic[Server Actions or API Routes]', '    Logic --> Data[Data Layer]', '    Data --> External[External Services / DB]', '```'].join('\n');
  }
  if (hasStack(stacks, 'fastapi') || hasStack(stacks, 'django') || hasStack(stacks, 'python')) {
    return ['```mermaid', 'graph TD', '    API[API / CLI Entry] --> Services[Service Layer]', '    Services --> Models[Models / Schemas]', '    Models --> Data[Database or External APIs]', '```'].join('\n');
  }
  if (hasStack(stacks, 'go')) {
    return ['```mermaid', 'graph TD', '    Cmd[cmd/ or main package] --> Internal[internal/ packages]', '    Internal --> Data[Storage / APIs]', '```'].join('\n');
  }
  if (hasStack(stacks, 'rust')) {
    return ['```mermaid', 'graph TD', '    Bin[src/main.rs] --> Core[src/lib.rs]', '    Core --> Modules[domain / adapters / services]', '```'].join('\n');
  }
  return ['```mermaid', 'graph TD', '    Entry[Entry Point] --> Core[Core Logic]', '    Core --> Data[Data / External Services]', '```'].join('\n');
}

function buildVerificationCommands(ctx) {
  const scripts = detectScripts(ctx);
  const commands = [];
  if (scripts.test) commands.push('- Test: `npm test`');
  if (scripts.lint) commands.push('- Lint: `npm run lint`');
  if (scripts.build) commands.push('- Build: `npm run build`');
  if (commands.length === 0 && ctx.fileContent('pyproject.toml')) commands.push('- Test: `python -m pytest`');
  if (commands.length === 0 && ctx.fileContent('requirements.txt')) commands.push('- Test: `python -m pytest`');
  if (commands.length === 0 && ctx.fileContent('go.mod')) { commands.push('- Test: `go test ./...`'); commands.push('- Build: `go build ./...`'); }
  if (commands.length === 0 && ctx.fileContent('Cargo.toml')) { commands.push('- Test: `cargo test`'); commands.push('- Build: `cargo build`'); }
  if (commands.length === 0) { commands.push('- Test: add the repo test command'); commands.push('- Lint: add the repo lint command'); commands.push('- Build: add the repo build command'); }
  return commands;
}

function buildCodingConventions(stacks) {
  const lines = [];
  if (hasStack(stacks, 'typescript')) lines.push('- Keep TypeScript strict and prefer typed boundaries over implicit `any`.');
  if (hasStack(stacks, 'react') || hasStack(stacks, 'nextjs')) lines.push('- Prefer small, reviewable component changes and document risky UI state assumptions.');
  if (hasStack(stacks, 'python') || hasStack(stacks, 'fastapi') || hasStack(stacks, 'django')) lines.push('- Prefer explicit validation, typed schemas, and focused service functions.');
  if (hasStack(stacks, 'go')) lines.push('- Keep packages small, avoid cross-package cycles, and prefer table-driven tests.');
  if (hasStack(stacks, 'rust')) lines.push('- Prefer explicit ownership-safe refactors and small module-scoped changes.');
  if (hasStack(stacks, 'terraform') || hasStack(stacks, 'kubernetes')) lines.push('- Treat infrastructure changes as high-risk: prefer diffs that are easy to plan and roll back.');
  if (lines.length === 0) lines.push('- Prefer small, reviewable diffs and explicit reasoning over broad rewrites.');
  return lines;
}

function buildCoreRuleMdc(ctx, stacks) {
  const stackLabels = stacks.map((item) => item.label).join(', ') || 'General repo';
  const verificationCommands = buildVerificationCommands(ctx);
  const codingConventions = buildCodingConventions(stacks);

  return [
    '---',
    'description: "Core project rules — always active for all agents"',
    'alwaysApply: true',
    '---',
    '',
    `# ${detectProjectName(ctx)} — Core Rules`,
    '',
    '## Scope',
    '- Primary platform: Cursor',
    `- Detected stack: ${stackLabels}`,
    '',
    '## Architecture',
    buildMermaid(stacks),
    '- Replace the default diagram with the real entry points and boundaries for this repo.',
    '',
    '## Verification',
    ...verificationCommands,
    '',
    'Before completing any task:',
    '1. Run tests — all must pass',
    '2. Run lint — no errors',
    '3. Verify build succeeds',
    '',
    '## Coding Conventions',
    ...codingConventions,
    '',
    '## Security',
    '- Never commit secrets, tokens, or `.env` values into tracked files.',
    '- Prefer the repo verification commands before handoff.',
    '',
    '## Platform Awareness',
    '- **Privacy Mode**: Verify it is enabled in Cursor Settings for zero data retention.',
    '- **Background agents**: Create branches and PRs, never push directly to main.',
    '- **MCP tool limit**: Stay under ~40 tools across all servers.',
    '- **Session drift**: Sessions >2h may lose context — start fresh if instructions are forgotten.',
    '',
    `_Generated by nerviq v${version} for Cursor. Customize before production use._`,
    '',
  ].join('\n');
}

function buildStackRuleMdc(stacks) {
  if (hasStack(stacks, 'typescript')) {
    return [
      '---',
      'description: "TypeScript-specific conventions"',
      'globs:',
      '  - "**/*.ts"',
      '  - "**/*.tsx"',
      'alwaysApply: false',
      '---',
      '',
      '# TypeScript Rules',
      '',
      '- Use strict mode',
      '- Prefer named exports over default exports',
      '- Use explicit return types on public functions',
      '- Avoid `any` — use `unknown` or proper types',
      '- Prefer interfaces over types for public APIs',
      '',
      `_Generated by nerviq v${version}_`,
      '',
    ].join('\n');
  }
  return null;
}

function buildMcpJson(ctx, stacks, domainPacks) {
  const mcpRecs = recommendCursorMcpPacks(stacks, domainPacks || [], { ctx });
  const mcpServers = Object.assign({}, ...mcpRecs.map(p => packToJson(p)));
  return JSON.stringify({ mcpServers }, null, 2) + '\n';
}

function buildEnvironmentJson(ctx) {
  const scripts = detectScripts(ctx);
  const env = { baseImage: 'node:20', env: { NODE_ENV: 'test' }, persistedDirectories: ['node_modules'] };
  if (scripts.dev) {
    env.processes = { 'dev-server': { command: 'npm run dev', waitForPort: 3000 } };
  }
  return JSON.stringify(env, null, 2) + '\n';
}

function buildLegacyMigrationGuide() {
  return [
    '---',
    'description: "Legacy .cursorrules migration guide"',
    'alwaysApply: false',
    '---',
    '',
    '# Legacy Migration Guide',
    '',
    '## CRITICAL: .cursorrules is IGNORED by agent mode',
    '',
    'If you had a `.cursorrules` file, its contents are completely invisible to Cursor agents.',
    'Only `.cursor/rules/*.mdc` files with proper MDC frontmatter reach agents.',
    '',
    '## Migration steps',
    '',
    '1. Copy `.cursorrules` content to `.cursor/rules/core.mdc`',
    '2. Add MDC frontmatter with `alwaysApply: true`',
    '3. Delete `.cursorrules` (or rename to `.cursorrules.bak`)',
    '4. Verify agent mode sees the rules',
    '',
    '## Rule type reference',
    '',
    '| Type | alwaysApply | globs | description |',
    '|------|:-----------:|:-----:|:-----------:|',
    '| Always | true | any | any |',
    '| Auto Attached | false | set | optional |',
    '| Agent Requested | false | empty | set |',
    '| Manual | false | empty | empty |',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCiReviewWorkflow() {
  return [
    'name: Cursor Code Review',
    '',
    'on:',
    '  pull_request:',
    '    types: [opened, synchronize]',
    '',
    'permissions:',
    '  contents: read',
    '  pull-requests: write',
    '',
    'jobs:',
    '  cursor-review:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Run nerviq audit',
    '        run: npx nerviq --platform cursor --json > audit-report.json',
    '      - uses: actions/upload-artifact@v4',
    '        with:',
    '          name: cursor-audit-report',
    '          path: audit-report.json',
    '          retention-days: 30',
    '',
    `# Generated by nerviq v${version} for Cursor.`,
    '',
  ].join('\n');
}

function buildDesignModeGuide() {
  return [
    '---',
    'description: "Design Mode usage guide for UI annotation"',
    'alwaysApply: false',
    '---',
    '',
    '# Design Mode Guide',
    '',
    '## What is Design Mode?',
    'Cursor 3.0 Design Mode allows annotating browser UI elements directly.',
    'Click elements in the browser to create visual references for the agent.',
    '',
    '## When to use',
    '- UI bug reports with visual context',
    '- Component styling adjustments',
    '- Layout modifications',
    '',
    '## Tips',
    '- Use with @Files to reference the component source code',
    '- Combine with Auto Attached rules for CSS/styling conventions',
    '- Works best with running dev server',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildBugbotGuide() {
  return [
    '---',
    'description: "BugBot configuration guide for automated PR review"',
    'alwaysApply: false',
    '---',
    '',
    '# BugBot Configuration',
    '',
    '## Setup',
    '- Enable BugBot per-repo in Cursor settings',
    '- Configure autofix for auto-fixable issues',
    '- Set review scope (which files/patterns to review)',
    '',
    '## Best Practices',
    '- Use BugBot Rules for project-specific invariants',
    '- Review autofix PRs before merging',
    '- Combine with CI for comprehensive coverage',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCursorSetupFiles(options = {}) {
  const ctx = new CursorProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const files = [];

  // 1. Core rules (.cursor/rules/core.mdc)
  const coreRulePath = path.join(options.dir, '.cursor', 'rules', 'core.mdc');
  if (!fs.existsSync(coreRulePath)) {
    files.push({
      path: '.cursor/rules/core.mdc',
      action: 'create',
      family: 'cursor-rules',
      content: buildCoreRuleMdc(ctx, stacks),
      currentState: '.cursor/rules/core.mdc is missing',
      proposedState: 'create a core rules file with alwaysApply: true, verification, and architecture guidance',
    });
  }

  // Stack-specific rule
  const stackRule = buildStackRuleMdc(stacks);
  if (stackRule) {
    const stackRulePath = path.join(options.dir, '.cursor', 'rules', 'typescript.mdc');
    if (!fs.existsSync(stackRulePath)) {
      files.push({
        path: '.cursor/rules/typescript.mdc',
        action: 'create',
        family: 'cursor-rules',
        content: stackRule,
        currentState: '.cursor/rules/typescript.mdc is missing',
        proposedState: 'create Auto Attached TypeScript rules with glob pattern',
      });
    }
  }

  // 2. Legacy migration
  const legacyPath = path.join(options.dir, '.cursorrules');
  if (fs.existsSync(legacyPath)) {
    const migrationPath = path.join(options.dir, '.cursor', 'rules', 'migration-guide.mdc');
    if (!fs.existsSync(migrationPath)) {
      files.push({
        path: '.cursor/rules/migration-guide.mdc',
        action: 'create',
        family: 'cursor-legacy-migration',
        content: buildLegacyMigrationGuide(),
        currentState: '.cursorrules exists but is IGNORED by agent mode',
        proposedState: 'create migration guide to help move .cursorrules content to .mdc format',
      });
    }
  }

  const modules = options.modules || 'all';
  const wantModule = (name) => modules === 'all' || (Array.isArray(modules) && modules.includes(name));

  // 3. MCP config
  if (wantModule('mcp')) {
    const mcpPath = path.join(options.dir, '.cursor', 'mcp.json');
    if (!fs.existsSync(mcpPath)) {
      const domainPacks = options.domainPacks || [];
      files.push({
        path: '.cursor/mcp.json',
        action: 'create',
        family: 'cursor-mcp',
        content: buildMcpJson(ctx, stacks, domainPacks),
        currentState: '.cursor/mcp.json is missing',
        proposedState: 'create MCP config with recommended packs using ${env:VAR} syntax',
      });
    }
  }

  // 4. Environment config
  if (wantModule('environment')) {
    const envPath = path.join(options.dir, '.cursor', 'environment.json');
    if (!fs.existsSync(envPath)) {
      files.push({
        path: '.cursor/environment.json',
        action: 'create',
        family: 'cursor-environment',
        content: buildEnvironmentJson(ctx),
        currentState: '.cursor/environment.json is missing',
        proposedState: 'create background agent environment config with baseImage and persistedDirectories',
      });
    }
  }

  // 5. CI workflow
  if (wantModule('ci')) {
    const ciPath = path.join(options.dir, '.github', 'workflows', 'cursor-review.yml');
    if (!fs.existsSync(ciPath)) {
      files.push({
        path: '.github/workflows/cursor-review.yml',
        action: 'create',
        family: 'cursor-ci-review',
        content: buildCiReviewWorkflow(),
        currentState: 'No Cursor CI review workflow exists',
        proposedState: 'create a GitHub Actions workflow for Cursor-based audit on PRs',
      });
    }
  }

  // 6. BugBot guide
  if (wantModule('bugbot')) {
    const bugbotPath = path.join(options.dir, '.cursor', 'rules', 'bugbot-guide.mdc');
    if (!fs.existsSync(bugbotPath)) {
      files.push({
        path: '.cursor/rules/bugbot-guide.mdc',
        action: 'create',
        family: 'cursor-bugbot',
        content: buildBugbotGuide(),
        currentState: 'No BugBot configuration guide',
        proposedState: 'create BugBot configuration guide as an Agent Requested rule',
      });
    }
  }

  // 7. Design Mode guide
  if (wantModule('design-mode')) {
    const designPath = path.join(options.dir, '.cursor', 'rules', 'design-mode-guide.mdc');
    if (!fs.existsSync(designPath)) {
      files.push({
        path: '.cursor/rules/design-mode-guide.mdc',
        action: 'create',
        family: 'cursor-design-mode',
        content: buildDesignModeGuide(),
        currentState: 'No Design Mode guide',
        proposedState: 'create Design Mode usage guide as an Agent Requested rule',
      });
    }
  }

  return { ctx, stacks, files };
}

async function setupCursor(options) {
  const silent = options.silent === true;
  const { ctx, stacks, files } = buildCursorSetupFiles(options);
  const writtenFiles = [];
  const preservedFiles = [];

  function log(message = '') { if (!silent) console.log(message); }

  log('');
  log('\x1b[1m  nerviq cursor setup\x1b[0m');
  log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');
  if (stacks.length > 0) log(`\x1b[36m  Detected: ${stacks.map((s) => s.label).join(', ')}\x1b[0m`);
  log('');

  for (const file of files) {
    const fullPath = path.join(options.dir, file.path);
    if (fs.existsSync(fullPath)) {
      preservedFiles.push(file.path);
      log(`  \x1b[2m  Skipped ${file.path} (already exists)\x1b[0m`);
      continue;
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, 'utf8');
    writtenFiles.push(file.path);
    log(`  \x1b[32m  Created ${file.path}\x1b[0m`);
  }

  let rollbackArtifact = null;
  let activityArtifact = null;
  if (writtenFiles.length > 0) {
    rollbackArtifact = writeRollbackArtifact(options.dir, {
      sourcePlan: 'cursor-setup',
      createdFiles: writtenFiles,
      patchedFiles: [],
      rollbackInstructions: writtenFiles.map((file) => `Delete ${file}`),
    });
    activityArtifact = writeActivityArtifact(options.dir, 'cursor-setup', {
      platform: 'cursor',
      createdFiles: writtenFiles,
      preservedFiles,
      stackLabels: stacks.map((item) => item.label),
      rollbackArtifact: rollbackArtifact.relativePath,
    });
  }

  log('');
  log(`  \x1b[1m${writtenFiles.length} files created.\x1b[0m`);
  if (preservedFiles.length > 0) log(`  \x1b[2m${preservedFiles.length} existing files preserved.\x1b[0m`);
  if (rollbackArtifact) log(`  Rollback: \x1b[1m${rollbackArtifact.relativePath}\x1b[0m`);
  if (activityArtifact) log(`  Activity log: \x1b[1m${activityArtifact.relativePath}\x1b[0m`);
  log('');
  log('  Run \x1b[1mnpx nerviq --platform cursor\x1b[0m to audit your Cursor setup.');
  log('');

  return {
    created: writtenFiles.length,
    skipped: preservedFiles.length,
    writtenFiles,
    preservedFiles,
    stacks,
    rollbackArtifact: rollbackArtifact ? rollbackArtifact.relativePath : null,
    activityArtifact: activityArtifact ? activityArtifact.relativePath : null,
  };
}

module.exports = {
  buildCoreRuleMdc,
  buildCursorSetupFiles,
  setupCursor,
};
