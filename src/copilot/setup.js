/**
 * Copilot Setup Module
 *
 * 8 setup families:
 * 1. copilot-instructions.md
 * 2. *.instructions.md (scoped)
 * 3. *.prompt.md (prompt templates)
 * 4. .vscode/settings.json
 * 5. .vscode/mcp.json
 * 6. copilot-setup-steps.yml
 * 7. .github/workflows/copilot-review.yml
 * 8. Content exclusions guide
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { version } = require('../../package.json');
const { STACKS } = require('../techniques');
const { writeActivityArtifact, writeRollbackArtifact } = require('../activity');
const { CopilotProjectContext } = require('./context');
const { recommendCopilotMcpPacks, packToJson } = require('./mcp-packs');

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
  if (hasStack(stacks, 'react') || hasStack(stacks, 'nextjs')) lines.push('- Prefer small, reviewable component changes and document risky UI state assumptions before refactors.');
  if (hasStack(stacks, 'python') || hasStack(stacks, 'fastapi') || hasStack(stacks, 'django')) lines.push('- Prefer explicit validation, typed schemas, and focused service functions over large route handlers.');
  if (hasStack(stacks, 'go')) lines.push('- Keep packages small, avoid cross-package cycles, and prefer table-driven tests.');
  if (hasStack(stacks, 'rust')) lines.push('- Prefer explicit ownership-safe refactors and small module-scoped changes over broad rewrites.');
  if (hasStack(stacks, 'terraform') || hasStack(stacks, 'kubernetes')) lines.push('- Treat infrastructure changes as high-risk: prefer diffs that are easy to plan, review, and roll back.');
  if (lines.length === 0) lines.push('- Prefer small, reviewable diffs and explicit reasoning over broad rewrites.');
  return lines;
}

function buildSecurityNotes(stacks) {
  const lines = [
    '- Never commit secrets, tokens, or `.env` values into tracked files.',
    '- Prefer the repo verification commands before handoff, and explain any command you could not run.',
  ];
  if (hasStack(stacks, 'python') || hasStack(stacks, 'fastapi') || hasStack(stacks, 'django')) {
    lines.push('- Validate auth, permissions, and data-handling changes carefully before touching production-sensitive paths.');
  }
  if (hasStack(stacks, 'terraform') || hasStack(stacks, 'kubernetes')) {
    lines.push('- Review blast radius before changing infra, deployment, or cluster configuration.');
  }
  return lines;
}

function buildCopilotInstructionsMd(ctx, stacks) {
  const stackLabels = stacks.map((item) => item.label).join(', ') || 'General repo';
  const verificationCommands = buildVerificationCommands(ctx);
  const codingConventions = buildCodingConventions(stacks);
  const securityNotes = buildSecurityNotes(stacks);

  return [
    `# ${detectProjectName(ctx)}`,
    '',
    '## Scope',
    '- Primary platform: GitHub Copilot',
    `- Detected stack: ${stackLabels}`,
    '- Keep this file focused on Copilot-specific guidance when the repo also uses Claude or other agents.',
    '',
    '## Architecture',
    buildMermaid(stacks),
    '- Replace the default diagram and bullets with the real entry points, boundaries, and high-risk subsystems for this repo.',
    '',
    '## Verification',
    ...verificationCommands,
    '',
    '## Coding Conventions',
    ...codingConventions,
    '',
    '## Code Review Instructions',
    '- When reviewing code, focus on security vulnerabilities, performance regressions, and test coverage gaps.',
    '- Keep review instructions within the 4,000 character limit for code review.',
    '',
    '## Security',
    ...securityNotes,
    '',
    '## Platform Awareness',
    '- **VS Code agent**: Terminal sandbox is macOS/Linux/WSL2 only. Not available on native Windows.',
    '- **Cloud agent**: Content exclusions are NOT enforced. Review PRs carefully for sensitive file access.',
    '- **Cloud agent**: Cold-boot takes ~90 seconds. Optimize copilot-setup-steps.yml to minimize re-spins.',
    '',
    '## Notes',
    '- If this repo also uses Claude, keep Claude-specific instructions in `CLAUDE.md` and use this file for Copilot-specific behavior.',
    '- Use `.github/instructions/*.instructions.md` for path-scoped instructions with `applyTo` frontmatter.',
    '- Use `.github/prompts/*.prompt.md` for reusable prompt templates invocable via `/name` in Chat.',
    '',
    `_Generated by nerviq v${version} for GitHub Copilot. Customize this file before relying on it in production flows._`,
    '',
  ].join('\n');
}

function buildVscodeSettings() {
  return JSON.stringify({
    "github.copilot.chat.agent.enabled": true,
    "chat.tools.terminal.sandbox.enabled": true,
    "chat.agent.autoApproval.terminalCommands": [],
    "github.copilot.chat.reviewSelection.instructions": [
      { "text": "Focus on security vulnerabilities, performance issues, and test coverage gaps." }
    ],
    "github.copilot.chat.commitMessageGeneration.instructions": [
      { "text": "Use conventional commit format. Keep subject under 72 chars." }
    ],
  }, null, 2) + '\n';
}

function buildMcpJson() {
  return JSON.stringify({
    "servers": {},
  }, null, 2) + '\n';
}

function buildCloudSetupSteps(ctx) {
  const scripts = detectScripts(ctx);
  const installCmd = scripts.install ? 'npm ci' : 'npm install';
  return [
    'name: Copilot Setup Steps',
    '',
    'on:',
    '  workflow_dispatch:',
    '',
    'jobs:',
    '  setup:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 20',
    `      - run: ${installCmd}`,
    scripts.build ? '      - run: npm run build' : '',
    scripts.test ? '      - run: npm test' : '',
    '',
    '# Cloud agent environment configuration.',
    '# Dependencies installed here are available to the cloud agent.',
    '# Keep this workflow focused on setup — not CI/CD.',
    '',
    `# Generated by nerviq v${version} for GitHub Copilot cloud agent.`,
    '',
  ].filter(l => l !== undefined).join('\n');
}

function buildPromptStarter() {
  return [
    '---',
    'description: Review code changes for security and quality',
    'agent: copilot',
    'mode: agent',
    '---',
    '',
    'Review the following code changes for:',
    '- Security vulnerabilities',
    '- Performance regressions',
    '- Test coverage gaps',
    '- Naming consistency',
    '',
    'Provide specific, actionable feedback.',
    '',
    `# Generated by nerviq v${version}`,
    '',
  ].join('\n');
}

function buildScopedInstructionStarter() {
  return [
    '---',
    'applyTo: "**/*.ts"',
    '---',
    '',
    '# TypeScript Instructions',
    '',
    '- Use strict TypeScript mode',
    '- Prefer named exports over default exports',
    '- Use explicit return types on public functions',
    '- Avoid `any` — use `unknown` or proper types',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCiReviewWorkflow() {
  return [
    'name: Copilot Review',
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
    '  copilot-review:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Copilot Review',
    '        uses: github/copilot-code-review@v1',
    '        with:',
    '          review-mode: comments',
    '',
    `# Generated by nerviq v${version} for GitHub Copilot.`,
    '',
  ].join('\n');
}

function buildContentExclusionsGuide() {
  return [
    '# Content Exclusions Guide',
    '',
    '## What are content exclusions?',
    'Content exclusions prevent GitHub Copilot from reading specific files or directories.',
    '',
    '## How to configure',
    'Content exclusions are configured at the **organization level** in GitHub.com admin settings,',
    'or at the **repository level** using glob patterns.',
    '',
    '## Recommended exclusions',
    '```',
    '.env',
    '.env.*',
    'secrets/',
    '*.pem',
    '*.key',
    'credentials.*',
    'config/production.*',
    '```',
    '',
    '## Important limitations',
    '- Content exclusions are **NOT enforced** on the cloud agent.',
    '- Changes can take up to **30 minutes** to propagate.',
    '- Exclusions apply to Copilot Chat and completions but not all surfaces equally.',
    '',
    `_Generated by nerviq v${version}_`,
    '',
  ].join('\n');
}

function buildCopilotSetupFiles(options = {}) {
  const ctx = new CopilotProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const files = [];

  // 1. copilot-instructions.md
  const instrPath = path.join(options.dir, '.github', 'copilot-instructions.md');
  if (!fs.existsSync(instrPath)) {
    files.push({
      path: '.github/copilot-instructions.md',
      action: 'create',
      content: buildCopilotInstructionsMd(ctx, stacks),
      currentState: '.github/copilot-instructions.md is missing',
      proposedState: 'create a Copilot-native copilot-instructions.md baseline with verification, architecture, and trust guidance',
    });
  }

  // 2. .vscode/settings.json (Copilot settings)
  const settingsPath = path.join(options.dir, '.vscode', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    files.push({
      path: '.vscode/settings.json',
      action: 'create',
      content: buildVscodeSettings(),
      currentState: '.vscode/settings.json is missing',
      proposedState: 'create a safe Copilot settings baseline with sandbox enabled, agent mode, and review instructions',
    });
  }

  const modules = options.modules || 'all';
  const wantModule = (name) => modules === 'all' || (Array.isArray(modules) && modules.includes(name));

  // 3. Scoped instructions starter
  if (wantModule('scoped-instructions')) {
    const instrDir = path.join(options.dir, '.github', 'instructions');
    if (!fs.existsSync(instrDir)) {
      files.push({
        path: '.github/instructions/typescript.instructions.md',
        action: 'create',
        family: 'copilot-scoped-instructions',
        content: buildScopedInstructionStarter(),
        currentState: '.github/instructions/ directory is missing',
        proposedState: 'create a scoped instruction starter with applyTo frontmatter',
      });
    }
  }

  // 4. Prompt templates starter
  if (wantModule('prompts')) {
    const promptsDir = path.join(options.dir, '.github', 'prompts');
    if (!fs.existsSync(promptsDir)) {
      files.push({
        path: '.github/prompts/review.prompt.md',
        action: 'create',
        family: 'copilot-prompts',
        content: buildPromptStarter(),
        currentState: '.github/prompts/ directory is missing',
        proposedState: 'create a prompt template starter for Copilot Chat',
      });
    }
  }

  // 5. .vscode/mcp.json
  if (wantModule('mcp')) {
    const mcpPath = path.join(options.dir, '.vscode', 'mcp.json');
    if (!fs.existsSync(mcpPath)) {
      const domainPacks = options.domainPacks || [];
      const mcpRecs = recommendCopilotMcpPacks(stacks, domainPacks, { ctx });
      const servers = Object.assign({}, ...mcpRecs.map(p => packToJson(p)));
      files.push({
        path: '.vscode/mcp.json',
        action: 'create',
        family: 'copilot-mcp',
        content: JSON.stringify({ servers }, null, 2) + '\n',
        currentState: '.vscode/mcp.json is missing',
        proposedState: `create MCP config with ${mcpRecs.length} recommended packs: ${mcpRecs.map(p => p.label).join(', ')}`,
      });
    }
  }

  // 6. copilot-setup-steps.yml
  if (wantModule('cloud-setup')) {
    const cloudPath = path.join(options.dir, '.github', 'workflows', 'copilot-setup-steps.yml');
    if (!fs.existsSync(cloudPath)) {
      files.push({
        path: '.github/workflows/copilot-setup-steps.yml',
        action: 'create',
        family: 'copilot-cloud-setup',
        content: buildCloudSetupSteps(ctx),
        currentState: 'copilot-setup-steps.yml is missing',
        proposedState: 'create cloud agent setup workflow with dependency install and test configuration',
      });
    }
  }

  // 7. CI review workflow
  if (wantModule('ci')) {
    const ciPath = path.join(options.dir, '.github', 'workflows', 'copilot-review.yml');
    if (!fs.existsSync(ciPath)) {
      files.push({
        path: '.github/workflows/copilot-review.yml',
        action: 'create',
        family: 'copilot-ci-review',
        content: buildCiReviewWorkflow(),
        currentState: 'No Copilot CI review workflow exists',
        proposedState: 'create a GitHub Actions workflow for Copilot-based PR review',
      });
    }
  }

  // 8. Content exclusions guide
  if (wantModule('content-exclusions')) {
    const guidePath = path.join(options.dir, '.github', 'COPILOT-CONTENT-EXCLUSIONS.md');
    if (!fs.existsSync(guidePath)) {
      files.push({
        path: '.github/COPILOT-CONTENT-EXCLUSIONS.md',
        action: 'create',
        family: 'copilot-content-exclusions',
        content: buildContentExclusionsGuide(),
        currentState: 'No content exclusions guide exists',
        proposedState: 'create a content exclusions setup guide documenting known limitations',
      });
    }
  }

  return { ctx, stacks, files };
}

async function setupCopilot(options) {
  const silent = options.silent === true;
  const { ctx, stacks, files } = buildCopilotSetupFiles(options);
  const writtenFiles = [];
  const preservedFiles = [];

  function log(message = '') { if (!silent) console.log(message); }

  log('');
  log('\x1b[1m  nerviq copilot setup\x1b[0m');
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
      sourcePlan: 'copilot-setup',
      createdFiles: writtenFiles,
      patchedFiles: [],
      rollbackInstructions: writtenFiles.map((file) => `Delete ${file}`),
    });
    activityArtifact = writeActivityArtifact(options.dir, 'copilot-setup', {
      platform: 'copilot',
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
  log('  Run \x1b[1mnpx nerviq --platform copilot\x1b[0m to audit your Copilot setup.');
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
  buildCopilotInstructionsMd,
  buildVscodeSettings,
  buildCopilotSetupFiles,
  setupCopilot,
};
