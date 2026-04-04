/**
 * Windsurf Setup Module
 *
 * 8 setup families:
 * 1. .windsurf/rules/*.md (core + stack-specific)
 * 2. Legacy migration (.windsurfrules -> .windsurf/rules/)
 * 3. .windsurf/mcp.json
 * 4. .windsurf/workflows/ (slash commands)
 * 5. .windsurf/memories/ (team-syncable)
 * 6. .cascadeignore
 * 7. CI workflow (GitHub Actions)
 * 8. Cascade guide
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { version } = require('../../package.json');
const { STACKS } = require('../techniques');
const { writeActivityArtifact, writeRollbackArtifact } = require('../activity');
const { WindsurfProjectContext } = require('./context');
const { recommendWindsurfMcpPacks, packToJson } = require('./mcp-packs');

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

function buildCoreRuleMd(ctx, stacks) {
  const stackLabels = stacks.map((item) => item.label).join(', ') || 'General repo';
  const verificationCommands = buildVerificationCommands(ctx);
  const codingConventions = buildCodingConventions(stacks);

  return [
    '---',
    'trigger: always',
    'description: "Core project rules — always active for Cascade"',
    '---',
    '',
    `# ${detectProjectName(ctx)} — Core Rules`,
    '',
    '## Scope',
    '- Primary platform: Windsurf (Cascade agent)',
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
    '- Use .cascadeignore to exclude sensitive files from Cascade access.',
    '- Prefer the repo verification commands before handoff.',
    '',
    '## Platform Awareness',
    '- **Cascade**: Autonomous agent with multi-file editing capabilities.',
    '- **Memories**: Team-syncable persistent context in .windsurf/memories/.',
    '- **Workflows**: Slash commands in .windsurf/workflows/.',
    '- **10K char limit**: Each rule file must be under 10,000 characters.',
    '- **Session drift**: Long sessions may lose context — start fresh if instructions are forgotten.',
    '',
    `_Generated by nerviq v${version} for Windsurf. Customize before production use._`,
    '',
  ].join('\n');
}

function buildStackRuleMd(stacks) {
  if (hasStack(stacks, 'typescript')) {
    return [
      '---',
      'trigger: auto',
      'description: "TypeScript-specific conventions"',
      'globs:',
      '  - "**/*.ts"',
      '  - "**/*.tsx"',
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
  const mcpRecs = recommendWindsurfMcpPacks(stacks, domainPacks || [], { ctx });
  const mcpServers = Object.assign({}, ...mcpRecs.map(p => packToJson(p)));
  return JSON.stringify({ mcpServers }, null, 2) + '\n';
}

function buildLegacyMigrationGuide() {
  return [
    '---',
    'trigger: agent_requested',
    'description: "Legacy .windsurfrules migration guide"',
    '---',
    '',
    '# Legacy Migration Guide',
    '',
    '## .windsurfrules Migration',
    '',
    'The `.windsurfrules` file is the legacy format.',
    'Migrate to `.windsurf/rules/*.md` files with proper YAML frontmatter.',
    '',
    '## Migration steps',
    '',
    '1. Copy `.windsurfrules` content to `.windsurf/rules/core.md`',
    '2. Add YAML frontmatter with `trigger: always`',
    '3. Delete `.windsurfrules` (or rename to `.windsurfrules.bak`)',
    '4. Verify Cascade sees the rules',
    '',
    '## Rule activation reference',
    '',
    '| Mode | trigger | globs | description |',
    '|------|:-------:|:-----:|:-----------:|',
    '| Always | always | any | any |',
    '| Auto | auto | set | optional |',
    '| Agent-Requested | agent_requested | empty | set |',
    '| Manual | manual | empty | empty |',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCascadeignore() {
  return [
    '# Cascade agent file exclusions (gitignore syntax)',
    '# Files listed here will not be accessible to Cascade',
    '',
    '# Environment and secrets',
    '.env',
    '.env.*',
    '*.key',
    '*.pem',
    '',
    '# Credentials',
    '.aws/',
    '.ssh/',
    'credentials/',
    'secrets/',
    '',
    '# Build artifacts',
    'node_modules/',
    'dist/',
    '.next/',
    '',
    `# Generated by nerviq v${version} for Windsurf`,
    '',
  ].join('\n');
}

function buildCiReviewWorkflow() {
  return [
    'name: Windsurf Code Review',
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
    '  windsurf-review:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Run nerviq audit',
    '        run: npx nerviq --platform windsurf --json > audit-report.json',
    '      - uses: actions/upload-artifact@v4',
    '        with:',
    '          name: windsurf-audit-report',
    '          path: audit-report.json',
    '          retention-days: 30',
    '',
    `# Generated by nerviq v${version} for Windsurf.`,
    '',
  ].join('\n');
}

function buildCascadeGuide() {
  return [
    '---',
    'trigger: agent_requested',
    'description: "Cascade agent usage guide and best practices"',
    '---',
    '',
    '# Cascade Agent Guide',
    '',
    '## What is Cascade?',
    'Cascade is Windsurf\'s autonomous AI agent with multi-file editing capabilities.',
    'It can perform complex, multi-step tasks across your entire codebase.',
    '',
    '## Key Features',
    '- **Multi-file editing**: Cascade can edit multiple files in a single action.',
    '- **Steps**: Automated multi-step workflows for complex tasks.',
    '- **Skills**: Configurable capabilities (web search, terminal, etc.).',
    '- **Memories**: Persistent context that syncs across team members.',
    '',
    '## Best Practices',
    '- Use @-mentions to reference specific files or context.',
    '- Keep sessions focused — start fresh for unrelated tasks.',
    '- Review Cascade\'s multi-file changes before committing.',
    '- Use .cascadeignore to protect sensitive files.',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildWindsurfSetupFiles(options = {}) {
  const ctx = new WindsurfProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const files = [];

  // 1. Core rules (.windsurf/rules/core.md)
  const coreRulePath = path.join(options.dir, '.windsurf', 'rules', 'core.md');
  if (!fs.existsSync(coreRulePath)) {
    files.push({
      path: '.windsurf/rules/core.md',
      action: 'create',
      family: 'windsurf-rules',
      content: buildCoreRuleMd(ctx, stacks),
      currentState: '.windsurf/rules/core.md is missing',
      proposedState: 'create a core rules file with trigger: always, verification, and architecture guidance',
    });
  }

  // Stack-specific rule
  const stackRule = buildStackRuleMd(stacks);
  if (stackRule) {
    const stackRulePath = path.join(options.dir, '.windsurf', 'rules', 'typescript.md');
    if (!fs.existsSync(stackRulePath)) {
      files.push({
        path: '.windsurf/rules/typescript.md',
        action: 'create',
        family: 'windsurf-rules',
        content: stackRule,
        currentState: '.windsurf/rules/typescript.md is missing',
        proposedState: 'create Auto TypeScript rules with glob pattern',
      });
    }
  }

  // 2. Legacy migration
  const legacyPath = path.join(options.dir, '.windsurfrules');
  if (fs.existsSync(legacyPath)) {
    const migrationPath = path.join(options.dir, '.windsurf', 'rules', 'migration-guide.md');
    if (!fs.existsSync(migrationPath)) {
      files.push({
        path: '.windsurf/rules/migration-guide.md',
        action: 'create',
        family: 'windsurf-legacy-migration',
        content: buildLegacyMigrationGuide(),
        currentState: '.windsurfrules exists — legacy format',
        proposedState: 'create migration guide to help move .windsurfrules content to .windsurf/rules/*.md',
      });
    }
  }

  const modules = options.modules || 'all';
  const wantModule = (name) => modules === 'all' || (Array.isArray(modules) && modules.includes(name));

  // 3. MCP config
  if (wantModule('mcp')) {
    const mcpPath = path.join(options.dir, '.windsurf', 'mcp.json');
    if (!fs.existsSync(mcpPath)) {
      const domainPacks = options.domainPacks || [];
      files.push({
        path: '.windsurf/mcp.json',
        action: 'create',
        family: 'windsurf-mcp',
        content: buildMcpJson(ctx, stacks, domainPacks),
        currentState: '.windsurf/mcp.json is missing',
        proposedState: 'create MCP config with recommended packs',
      });
    }
  }

  // 4. Cascadeignore
  if (wantModule('cascadeignore')) {
    const ignorePath = path.join(options.dir, '.cascadeignore');
    if (!fs.existsSync(ignorePath)) {
      files.push({
        path: '.cascadeignore',
        action: 'create',
        family: 'windsurf-cascadeignore',
        content: buildCascadeignore(),
        currentState: '.cascadeignore is missing',
        proposedState: 'create .cascadeignore for sensitive file exclusion from Cascade',
      });
    }
  }

  // 5. CI workflow
  if (wantModule('ci')) {
    const ciPath = path.join(options.dir, '.github', 'workflows', 'windsurf-review.yml');
    if (!fs.existsSync(ciPath)) {
      files.push({
        path: '.github/workflows/windsurf-review.yml',
        action: 'create',
        family: 'windsurf-ci-review',
        content: buildCiReviewWorkflow(),
        currentState: 'No Windsurf CI review workflow exists',
        proposedState: 'create a GitHub Actions workflow for Windsurf-based audit on PRs',
      });
    }
  }

  // 6. Cascade guide
  if (wantModule('cascade-guide')) {
    const guidePath = path.join(options.dir, '.windsurf', 'rules', 'cascade-guide.md');
    if (!fs.existsSync(guidePath)) {
      files.push({
        path: '.windsurf/rules/cascade-guide.md',
        action: 'create',
        family: 'windsurf-cascade-guide',
        content: buildCascadeGuide(),
        currentState: 'No Cascade guide',
        proposedState: 'create Cascade agent usage guide as an Agent-Requested rule',
      });
    }
  }

  return { ctx, stacks, files };
}

async function setupWindsurf(options) {
  const silent = options.silent === true;
  const { ctx, stacks, files } = buildWindsurfSetupFiles(options);
  const writtenFiles = [];
  const preservedFiles = [];

  function log(message = '') { if (!silent) console.log(message); }

  log('');
  log('\x1b[1m  nerviq windsurf setup\x1b[0m');
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
      sourcePlan: 'windsurf-setup',
      createdFiles: writtenFiles,
      patchedFiles: [],
      rollbackInstructions: writtenFiles.map((file) => `Delete ${file}`),
    });
    activityArtifact = writeActivityArtifact(options.dir, 'windsurf-setup', {
      platform: 'windsurf',
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
  log('  Run \x1b[1mnpx nerviq --platform windsurf\x1b[0m to audit your Windsurf setup.');
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
  buildCoreRuleMd,
  buildWindsurfSetupFiles,
  setupWindsurf,
};
