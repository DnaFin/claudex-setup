/**
 * OpenCode Setup — generates opencode.json, AGENTS.md, permissions, plugins scaffolds
 *
 * Families: opencode.json, AGENTS.md, permissions, plugins
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { version } = require('../../package.json');
const { STACKS } = require('../techniques');
const { writeActivityArtifact, writeRollbackArtifact } = require('../activity');
const { OpenCodeProjectContext } = require('./context');
const { recommendOpenCodeMcpPacks, packsToJsonc } = require('./mcp-packs');

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
  if (hasStack(stacks, 'terraform') || hasStack(stacks, 'kubernetes')) lines.push('- Treat infrastructure changes as high-risk: prefer diffs that are easy to plan, review, and roll back.');
  if (lines.length === 0) lines.push('- Prefer small, reviewable diffs and explicit reasoning over broad rewrites.');
  return lines;
}

function buildSecurityNotes(stacks) {
  const lines = [
    '- Never commit secrets, tokens, or `.env` values into tracked files.',
    '- Prefer the repo verification commands before handoff.',
  ];
  if (hasStack(stacks, 'python') || hasStack(stacks, 'fastapi') || hasStack(stacks, 'django')) {
    lines.push('- Validate auth, permissions, and data-handling changes carefully.');
  }
  if (hasStack(stacks, 'terraform') || hasStack(stacks, 'kubernetes')) {
    lines.push('- Review blast radius before changing infra, deployment, or cluster configuration.');
  }
  return lines;
}

function buildAgentsMd(ctx, stacks) {
  const stackLabels = stacks.map((item) => item.label).join(', ') || 'General repo';
  const verificationCommands = buildVerificationCommands(ctx);
  const codingConventions = buildCodingConventions(stacks);
  const securityNotes = buildSecurityNotes(stacks);

  return [
    `# ${detectProjectName(ctx)}`,
    '',
    '## Scope',
    '- Primary platform: OpenCode CLI',
    `- Detected stack: ${stackLabels}`,
    '- Keep this file focused on OpenCode-specific guidance. If the repo also uses Claude, keep Claude instructions in CLAUDE.md.',
    '',
    '## Architecture',
    buildMermaid(stacks),
    '- Replace the default diagram with the real entry points, boundaries, and high-risk subsystems.',
    '',
    '## Verification',
    ...verificationCommands,
    '',
    '## Coding Conventions',
    ...codingConventions,
    '',
    '## Review Workflow',
    '- Run verification commands before handoff on risky diffs or broad refactors.',
    '- Explain which verification commands ran successfully and which were skipped.',
    '',
    '## Security',
    ...securityNotes,
    '',
    '## Permissions',
    '- Review opencode.json permissions before enabling full automation.',
    '- Use "ask" (not "allow") for bash, task, and external_directory by default.',
    '',
    '## Cost & Automation',
    '- Reserve heavy reasoning or long automation chains for tasks that actually need them.',
    '- Set OPENCODE_DISABLE_AUTOUPDATE=1 in CI environments.',
    '',
    '## Notes',
    '- If this repo also uses Claude, keep Claude-specific instructions in `CLAUDE.md` and use AGENTS.md for OpenCode.',
    '- AGENTS.md takes precedence over CLAUDE.md when both exist in the same directory.',
    '- Plugins run in-process — review and pin versions before deploying.',
    '',
    `_Generated by nerviq v${version} for OpenCode. Customize this file before relying on it in production._`,
    '',
  ].join('\n');
}

function buildConfigJson() {
  return JSON.stringify({
    $schema: 'https://opencode.ai/config.json',
    model: 'anthropic/claude-sonnet-4-6',
    small_model: 'anthropic/claude-haiku-4',
    permissions: {
      tools: {
        read: 'allow',
        edit: 'ask',
        glob: 'allow',
        grep: 'allow',
        list: 'allow',
        bash: 'ask',
        task: 'ask',
        skill: 'allow',
        lsp: 'allow',
        question: 'allow',
        webfetch: 'ask',
        websearch: 'ask',
        codesearch: 'allow',
        external_directory: 'ask',
        doom_loop: 'ask',
      },
    },
  }, null, 2) + '\n';
}

function buildOpenCodeSetupFiles(options = {}) {
  const ctx = new OpenCodeProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const files = [];

  const agentsPath = path.join(options.dir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    files.push({
      path: 'AGENTS.md',
      action: 'create',
      content: buildAgentsMd(ctx, stacks),
      currentState: 'AGENTS.md is missing',
      proposedState: 'create an OpenCode-native AGENTS.md baseline with verification, architecture, review, and permission guidance',
    });
  }

  const configPath = path.join(options.dir, 'opencode.json');
  const configcPath = path.join(options.dir, 'opencode.jsonc');
  if (!fs.existsSync(configPath) && !fs.existsSync(configcPath)) {
    files.push({
      path: 'opencode.json',
      action: 'create',
      content: buildConfigJson(),
      currentState: 'opencode.json is missing',
      proposedState: 'create a safe OpenCode baseline config with explicit model, permissions, and tool settings',
    });
  }

  const modules = options.modules || 'all';
  const wantModule = (name) => modules === 'all' || (Array.isArray(modules) && modules.includes(name));

  // Plugins starter
  if (wantModule('plugins')) {
    const pluginsDir = path.join(options.dir, '.opencode', 'plugins');
    const pluginsReadme = path.join(pluginsDir, 'README.md');
    if (!fs.existsSync(pluginsReadme) && !fs.existsSync(pluginsDir)) {
      files.push({
        path: '.opencode/plugins/README.md',
        action: 'create',
        family: 'opencode-plugins',
        content: buildPluginsStarter(),
        currentState: '.opencode/plugins/ directory is missing',
        proposedState: 'create an OpenCode plugins starter with security guidance',
      });
    }
  }

  // Commands/skills starter
  if (wantModule('skills')) {
    const commandsDir = path.join(options.dir, '.opencode', 'commands');
    const commandsReadme = path.join(commandsDir, 'README.md');
    if (!fs.existsSync(commandsReadme) && !fs.existsSync(commandsDir)) {
      files.push({
        path: '.opencode/commands/README.md',
        action: 'create',
        family: 'opencode-skills',
        content: buildCommandsStarter(),
        currentState: '.opencode/commands/ directory is missing',
        proposedState: 'create an OpenCode commands/skills starter with naming and frontmatter guidance',
      });
    }
  }

  // MCP starter
  if (wantModule('mcp')) {
    const configContent = ctx.configContent ? ctx.configContent() : '';
    const hasMcpSection = configContent && /"mcp"\s*:/i.test(configContent);
    if (!hasMcpSection) {
      const domainPacks = options.domainPacks || [];
      const mcpRecs = recommendOpenCodeMcpPacks(stacks, domainPacks, { ctx });
      if (mcpRecs.length > 0) {
        const mcpJsonc = packsToJsonc(mcpRecs.map(p => p.key));
        files.push({
          path: 'opencode.json (MCP append)',
          action: 'append',
          family: 'opencode-mcp',
          content: mcpJsonc,
          currentState: 'No MCP servers configured in opencode.json',
          proposedState: `add ${mcpRecs.length} recommended MCP packs: ${mcpRecs.map(p => p.label).join(', ')}`,
        });
      }
    }
  }

  // CI workflow starter
  if (wantModule('ci')) {
    const workflowDir = path.join(options.dir, '.github', 'workflows');
    const opencodeWorkflow = path.join(workflowDir, 'opencode-review.yml');
    if (!fs.existsSync(opencodeWorkflow)) {
      files.push({
        path: '.github/workflows/opencode-review.yml',
        action: 'create',
        family: 'opencode-ci',
        content: buildCiReviewStarter(),
        currentState: 'No OpenCode CI review workflow exists',
        proposedState: 'create a GitHub Actions workflow for OpenCode-based PR review',
      });
    }
  }

  return { ctx, stacks, files };
}

function buildPluginsStarter() {
  return [
    '# OpenCode Plugins',
    '',
    'Place plugin files (.js, .ts, .mjs) in this directory.',
    '',
    '## Security Warning',
    '',
    'Plugins run **in-process** with the OpenCode agent. They can:',
    '- Intercept tool calls and responses',
    '- Modify agent behavior',
    '- Access the local filesystem',
    '',
    '## Plugin format',
    '',
    '```typescript',
    'import { definePlugin } from "@opencode-ai/plugin";',
    '',
    'export default definePlugin({',
    '  name: "my-plugin",',
    '  setup(api) {',
    '    api.on("tool.execute.before", (event) => {',
    '      // Pre-flight validation',
    '    });',
    '  },',
    '});',
    '```',
    '',
    '## Best practices',
    '',
    '- Pin npm plugin versions (never use @latest)',
    '- Document what each plugin does in AGENTS.md',
    '- Note: tool.execute.before does not intercept subagent/MCP calls (#5894, #2319)',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCommandsStarter() {
  return [
    '# OpenCode Commands & Skills',
    '',
    'Place command/skill directories here. Each needs a SKILL.md file.',
    '',
    '## Directory structure',
    '',
    '```',
    '.opencode/commands/',
    '  my-skill/',
    '    SKILL.md     # Required: name, description, instructions',
    '    helpers.js   # Optional: supporting files',
    '```',
    '',
    '## SKILL.md format',
    '',
    '```markdown',
    '---',
    'name: my-skill',
    'description: Short description for implicit invocation',
    '---',
    '',
    '# My Skill',
    '',
    'Instructions for OpenCode when this skill is invoked.',
    '```',
    '',
    '## Critical naming rules',
    '',
    '- Use **kebab-case** for skill directory names (e.g., `code-review`, not `CodeReview`)',
    '- PascalCase names have 0% implicit invocation success rate',
    '- Keep descriptions short for bounded context cost',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCiReviewStarter() {
  return [
    'name: OpenCode Review',
    '',
    'on:',
    '  pull_request:',
    '    types: [opened, synchronize]',
    '',
    'permissions:',
    '  contents: read',
    '  pull-requests: write',
    '',
    'env:',
    '  OPENCODE_DISABLE_AUTOUPDATE: "1"',
    '',
    'jobs:',
    '  opencode-review:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Install OpenCode',
    '        run: npm install -g opencode',
    '      - name: OpenCode Review',
    '        run: opencode run --format json "Review this PR diff"',
    '        env:',
    '          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}',
  ].join('\n') + '\n';
}

async function setupOpenCode(options) {
  const silent = options.silent === true;
  const { ctx, stacks, files } = buildOpenCodeSetupFiles(options);
  const writtenFiles = [];
  const preservedFiles = [];

  function log(message = '') {
    if (!silent) console.log(message);
  }

  log('');
  log('\x1b[1m  nerviq opencode setup\x1b[0m');
  log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');
  if (stacks.length > 0) {
    log(`\x1b[36m  Detected: ${stacks.map((s) => s.label).join(', ')}\x1b[0m`);
  }
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
      sourcePlan: 'opencode-setup',
      createdFiles: writtenFiles,
      patchedFiles: [],
      rollbackInstructions: writtenFiles.map((file) => `Delete ${file}`),
    });
    activityArtifact = writeActivityArtifact(options.dir, 'opencode-setup', {
      platform: 'opencode',
      createdFiles: writtenFiles,
      preservedFiles,
      stackLabels: stacks.map((item) => item.label),
      rollbackArtifact: rollbackArtifact.relativePath,
    });
  }

  log('');
  log(`  \x1b[1m${writtenFiles.length} files created.\x1b[0m`);
  if (preservedFiles.length > 0) {
    log(`  \x1b[2m${preservedFiles.length} existing files preserved.\x1b[0m`);
  }
  if (rollbackArtifact) log(`  Rollback: \x1b[1m${rollbackArtifact.relativePath}\x1b[0m`);
  if (activityArtifact) log(`  Activity log: \x1b[1m${activityArtifact.relativePath}\x1b[0m`);
  log('');
  log('  Run \x1b[1mnpx nerviq --platform opencode\x1b[0m to audit your OpenCode setup.');
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
  buildAgentsMd,
  buildConfigJson,
  buildOpenCodeSetupFiles,
  setupOpenCode,
};
