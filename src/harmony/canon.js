/**
 * Harmony Canon — Canonical Project Intelligence Model
 *
 * Reads ALL platform config files from a single project and builds a unified
 * understanding of instructions, MCP servers, trust posture, and governance
 * across Claude, Codex, Gemini, Copilot, Cursor, Windsurf, Aider, and OpenCode.
 */

const fs = require('fs');
const path = require('path');
const { ProjectContext } = require('../context');
const { CodexProjectContext } = require('../codex/context');
const { GeminiProjectContext } = require('../gemini/context');
const { CopilotProjectContext } = require('../copilot/context');
const { CursorProjectContext } = require('../cursor/context');
const { WindsurfProjectContext } = require('../windsurf/context');
const { AiderProjectContext } = require('../aider/context');
const { OpenCodeProjectContext } = require('../opencode/context');
const { getCodexGovernanceSummary } = require('../codex/governance');
const { getGeminiGovernanceSummary } = require('../gemini/governance');
const { getCopilotGovernanceSummary } = require('../copilot/governance');
const { getCursorGovernanceSummary } = require('../cursor/governance');
const { getWindsurfGovernanceSummary } = require('../windsurf/governance');
const { getAiderGovernanceSummary } = require('../aider/governance');
const { getOpenCodeGovernanceSummary } = require('../opencode/governance');
const { tryParseJsonc } = require('../opencode/config-parser');

// ─── Platform detection signatures ──────────────────────────────────────────

const PLATFORM_SIGNATURES = {
  claude: {
    label: 'Claude',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, 'CLAUDE.md'))) return true;
        if (fs.existsSync(path.join(dir, '.claude'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['CLAUDE.md', '.claude/CLAUDE.md'],
    configFiles: ['.claude/settings.json', '.claude/settings.local.json'],
    mcpFiles: ['.claude/settings.json'],
    rulesDir: '.claude/rules',
    hooksDir: '.claude/hooks',
  },
  codex: {
    label: 'Codex',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, 'AGENTS.md'))) return true;
        if (fs.existsSync(path.join(dir, '.codex'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['AGENTS.md'],
    configFiles: ['.codex/config.toml'],
    mcpFiles: [],
    rulesDir: null,
    hooksDir: null,
  },
  gemini: {
    label: 'Gemini CLI',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, 'GEMINI.md'))) return true;
        if (fs.existsSync(path.join(dir, '.gemini'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['GEMINI.md', '.gemini/GEMINI.md'],
    configFiles: ['.gemini/settings.json'],
    mcpFiles: ['.gemini/settings.json'],
    rulesDir: null,
    hooksDir: null,
  },
  copilot: {
    label: 'GitHub Copilot',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, '.github', 'copilot-instructions.md'))) return true;
        if (fs.existsSync(path.join(dir, '.vscode', 'mcp.json'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['.github/copilot-instructions.md'],
    configFiles: ['.vscode/settings.json'],
    mcpFiles: ['.vscode/mcp.json'],
    rulesDir: '.github/instructions',
    hooksDir: null,
  },
  cursor: {
    label: 'Cursor',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, '.cursor'))) return true;
        if (fs.existsSync(path.join(dir, '.cursorrules'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['.cursorrules'],
    configFiles: ['.cursor/mcp.json', '.cursor/environment.json'],
    mcpFiles: ['.cursor/mcp.json'],
    rulesDir: '.cursor/rules',
    hooksDir: null,
  },
  windsurf: {
    label: 'Windsurf',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, '.windsurfrules'))) return true;
        if (fs.existsSync(path.join(dir, '.windsurf'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['.windsurfrules'],
    configFiles: ['.windsurfrules', '.windsurf/mcp.json', '.cascadeignore'],
    mcpFiles: ['.windsurf/mcp.json'],
    rulesDir: '.windsurf/rules',
    hooksDir: '.windsurf/workflows',
  },
  aider: {
    label: 'Aider',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, '.aider.conf.yml'))) return true;
        if (fs.existsSync(path.join(dir, '.aiderignore'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['CONVENTIONS.md', '.aider.conventions.md'],
    configFiles: ['.aider.conf.yml', '.aider.model.settings.yml', '.aiderignore'],
    mcpFiles: [],
    rulesDir: null,
    hooksDir: null,
  },
  opencode: {
    label: 'OpenCode',
    detect: (dir) => {
      try {
        if (fs.existsSync(path.join(dir, 'opencode.json'))) return true;
        if (fs.existsSync(path.join(dir, 'opencode.jsonc'))) return true;
        if (fs.existsSync(path.join(dir, '.opencode'))) return true;
        return false;
      } catch { return false; }
    },
    instructionFiles: ['AGENTS.md', 'CLAUDE.md'],
    configFiles: ['opencode.json', 'opencode.jsonc'],
    mcpFiles: ['opencode.json', 'opencode.jsonc'],
    rulesDir: null,
    hooksDir: null,
  },
};

// ─── Context builders per platform ──────────────────────────────────────────

const CONTEXT_BUILDERS = {
  claude: (dir) => new ProjectContext(dir),
  codex: (dir) => new CodexProjectContext(dir),
  gemini: (dir) => new GeminiProjectContext(dir),
  copilot: (dir) => new CopilotProjectContext(dir),
  cursor: (dir) => new CursorProjectContext(dir),
  windsurf: (dir) => new WindsurfProjectContext(dir),
  aider: (dir) => new AiderProjectContext(dir),
  opencode: (dir) => new OpenCodeProjectContext(dir),
};

const GOVERNANCE_GETTERS = {
  codex: getCodexGovernanceSummary,
  gemini: getGeminiGovernanceSummary,
  copilot: getCopilotGovernanceSummary,
  cursor: getCursorGovernanceSummary,
  windsurf: getWindsurfGovernanceSummary,
  aider: getAiderGovernanceSummary,
  opencode: getOpenCodeGovernanceSummary,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function safeParseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function safeParseJsonc(content) {
  const parsed = tryParseJsonc(content);
  return parsed.ok ? parsed.data : null;
}

/**
 * Extract instruction text from a platform's instruction files.
 * Returns array of { file, content } for each found file.
 */
function readInstructionFiles(dir, files) {
  const found = [];
  for (const file of files) {
    const content = safeReadFile(path.join(dir, file));
    if (content) {
      found.push({ file, content });
    }
  }
  return found;
}

/**
 * Extract MCP server names from Claude settings.json format.
 */
function extractMcpFromClaudeSettings(content) {
  const json = safeParseJson(content);
  if (!json) return [];
  // Claude stores MCP in mcpServers key
  const servers = json.mcpServers || {};
  return Object.keys(servers).map(name => ({
    name,
    command: servers[name].command || null,
    args: servers[name].args || [],
  }));
}

/**
 * Extract MCP server names from Cursor/Copilot mcp.json format.
 */
function extractMcpFromMcpJson(content) {
  const json = safeParseJson(content);
  if (!json) return [];
  const servers = json.mcpServers || json.servers || {};
  return Object.keys(servers).map(name => ({
    name,
    command: servers[name].command || null,
    args: servers[name].args || [],
  }));
}

function extractMcpFromOpenCodeConfig(content) {
  const json = safeParseJsonc(content);
  if (!json) return [];
  const servers = json.mcpServers || json.servers || {};
  return Object.keys(servers).map(name => ({
    name,
    command: servers[name].command || null,
    args: servers[name].args || [],
  }));
}

/**
 * Extract MCP server names from Gemini settings.json.
 */
function extractMcpFromGeminiSettings(content) {
  const json = safeParseJson(content);
  if (!json) return [];
  const servers = json.mcpServers || {};
  return Object.keys(servers).map(name => ({
    name,
    command: servers[name].command || null,
    args: servers[name].args || [],
  }));
}

/**
 * Read MCP servers for a platform from its MCP config files.
 */
function readMcpServers(dir, platform, mcpFiles) {
  const servers = [];
  for (const file of mcpFiles) {
    const content = safeReadFile(path.join(dir, file));
    if (!content) continue;

    let extracted = [];
    if (platform === 'claude') {
      extracted = extractMcpFromClaudeSettings(content);
    } else if (platform === 'gemini') {
      extracted = extractMcpFromGeminiSettings(content);
    } else if (platform === 'opencode') {
      extracted = extractMcpFromOpenCodeConfig(content);
    } else {
      extracted = extractMcpFromMcpJson(content);
    }

    for (const server of extracted) {
      servers.push({ ...server, sourceFile: file });
    }
  }
  return servers;
}

/**
 * Count rule files in a rules directory.
 */
function countRuleFiles(dir, rulesDir) {
  if (!rulesDir) return { count: 0, files: [] };
  const fullPath = path.join(dir, rulesDir);
  try {
    const entries = fs.readdirSync(fullPath).filter(f => !f.startsWith('.'));
    return { count: entries.length, files: entries };
  } catch {
    return { count: 0, files: [] };
  }
}

/**
 * Detect trust posture for a platform based on its context.
 */
function detectTrustPosture(platform, ctx) {
  if (platform === 'claude') {
    const settings = ctx.jsonFile('.claude/settings.json');
    if (!settings) return 'unknown';
    if (settings.bypassPermissions === true) return 'bypass';
    if (settings.permissions && settings.permissions.deny && settings.permissions.deny.length > 0) {
      return 'safe-write';
    }
    return 'default';
  }

  if (platform === 'codex') {
    const config = ctx.fileContent('.codex/config.toml') || '';
    if (config.includes('approval_policy') && config.includes('never')) return 'full-auto';
    if (config.includes('sandbox') && config.includes('read-only')) return 'locked-down';
    return 'standard';
  }

  if (platform === 'gemini') {
    const settings = ctx.jsonFile('.gemini/settings.json');
    if (!settings) return 'unknown';
    if (settings.sandboxMode === 'none') return 'unrestricted';
    return settings.sandboxMode || 'default';
  }

  if (platform === 'copilot') {
    // Copilot trust is primarily controlled by VS Code settings
    return 'default';
  }

  if (platform === 'cursor') {
    // Cursor has no sandbox equivalent
    return 'no-sandbox';
  }

  if (platform === 'windsurf') {
    if (ctx.fileContent('.cascadeignore')) return 'guarded';
    if (ctx.fileContent('.windsurf/mcp.json')) return 'team-managed';
    return 'foreground';
  }

  if (platform === 'aider') {
    const config = ctx.configContent ? (ctx.configContent() || '') : '';
    if (/^\s*(yes|yes-always)\s*:\s*true\b/m.test(config)) return 'full-auto';
    if (/^\s*auto-commits\s*:\s*true\b/m.test(config)) return 'git-guarded';
    return 'manual-review';
  }

  if (platform === 'opencode') {
    const config = ctx.configContent ? (ctx.configContent() || '') : '';
    if (/"\*"\s*:\s*"allow"/.test(config)) return 'unrestricted';
    if (/"(?:bash|edit|task|external_directory)"\s*:\s*"deny"/.test(config)) return 'locked-down';
    if (/"(?:bash|edit|task|external_directory)"\s*:\s*"ask"/.test(config)) return 'prompted';
    return 'standard';
  }

  return 'unknown';
}

// ─── Core functions ─────────────────────────────────────────────────────────

/**
 * Detect which AI coding platforms are active in the given directory.
 * Returns array of { platform, label, detected: true }.
 */
function detectActivePlatforms(dir) {
  const active = [];
  for (const [platform, sig] of Object.entries(PLATFORM_SIGNATURES)) {
    if (sig.detect(dir)) {
      active.push({
        platform,
        label: sig.label,
        detected: true,
      });
    }
  }
  return active;
}

/**
 * Build a canonical model of the project's AI platform configuration.
 *
 * Reads all platform config files from the given directory and produces a
 * unified view: active platforms, shared instructions, conflicting instructions,
 * MCP servers, trust posture, and governance summaries.
 *
 * @param {string} dir - Project root directory
 * @returns {object} Canonical model
 */
function buildCanonicalModel(dir) {
  const activePlatforms = detectActivePlatforms(dir);
  const platformKeys = activePlatforms.map(p => p.platform);

  // Build per-platform details
  const platformDetails = {};
  for (const { platform } of activePlatforms) {
    const sig = PLATFORM_SIGNATURES[platform];
    const ctx = CONTEXT_BUILDERS[platform](dir);
    const instructions = readInstructionFiles(dir, sig.instructionFiles);
    const mcpServers = readMcpServers(dir, platform, sig.mcpFiles);
    const rules = countRuleFiles(dir, sig.rulesDir);
    const trust = detectTrustPosture(platform, ctx);

    let governance = null;
    if (GOVERNANCE_GETTERS[platform]) {
      try {
        governance = GOVERNANCE_GETTERS[platform]();
      } catch {
        governance = null;
      }
    }

    platformDetails[platform] = {
      platform,
      label: sig.label,
      instructionFiles: instructions,
      instructionContent: instructions.map(i => i.content).join('\n'),
      configFiles: sig.configFiles.filter(f => safeReadFile(path.join(dir, f)) !== null),
      mcpServers,
      rules,
      trustPosture: trust,
      governance,
    };
  }

  // Detect project name and stacks via Claude context (shared base)
  const baseCtx = new ProjectContext(dir);
  const { STACKS } = require('../techniques');
  const stacks = baseCtx.detectStacks(STACKS);
  const pkg = baseCtx.jsonFile('package.json');
  const projectName = (pkg && pkg.name) || path.basename(dir);

  // Detect shared vs conflicting instructions
  const sharedInstructions = [];
  const conflictingInstructions = [];

  if (platformKeys.length >= 2) {
    // Extract instruction lines per platform (non-empty, trimmed)
    const instructionSets = {};
    for (const key of platformKeys) {
      const content = platformDetails[key].instructionContent || '';
      const lines = content
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('<!--'));
      instructionSets[key] = new Set(lines);
    }

    // Find lines shared across ALL platforms
    const allSets = Object.values(instructionSets);
    if (allSets.length >= 2) {
      const first = allSets[0];
      for (const line of first) {
        if (allSets.every(s => s.has(line))) {
          sharedInstructions.push(line);
        }
      }
    }

    // Detect known conflict patterns between instruction files
    const trustLevels = {};
    for (const key of platformKeys) {
      trustLevels[key] = platformDetails[key].trustPosture;
    }
    const uniqueTrust = new Set(Object.values(trustLevels));
    if (uniqueTrust.size > 1) {
      conflictingInstructions.push({
        type: 'trust-posture',
        description: 'Trust posture differs across platforms',
        details: trustLevels,
      });
    }
  }

  // Build unified MCP server list (union across all platforms)
  const mcpUnion = {};
  for (const key of platformKeys) {
    for (const server of platformDetails[key].mcpServers) {
      if (!mcpUnion[server.name]) {
        mcpUnion[server.name] = {
          name: server.name,
          command: server.command,
          args: server.args,
          platforms: [key],
        };
      } else {
        mcpUnion[server.name].platforms.push(key);
      }
    }
  }

  // Build trust posture summary
  const trustPosture = {};
  for (const key of platformKeys) {
    trustPosture[key] = platformDetails[key].trustPosture;
  }

  // Build governance summary
  const governanceSummary = {};
  for (const key of platformKeys) {
    governanceSummary[key] = platformDetails[key].governance;
  }

  // SD2: Adaptive project signals — infrastructure & tooling detection
  const projectSignals = {};
  const signalChecks = [
    { key: 'docker', label: 'Docker', files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore'] },
    { key: 'terraform', label: 'Terraform', files: ['main.tf', 'terraform.tf', '.terraform.lock.hcl'] },
    { key: 'kubernetes', label: 'Kubernetes', files: ['k8s/', 'kubernetes/', 'helm/', 'Chart.yaml'] },
    { key: 'ci-github', label: 'GitHub Actions', files: ['.github/workflows/'] },
    { key: 'ci-gitlab', label: 'GitLab CI', files: ['.gitlab-ci.yml'] },
    { key: 'pytest', label: 'pytest', files: ['pytest.ini', 'conftest.py', 'pyproject.toml'] },
    { key: 'jest', label: 'Jest', files: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'] },
    { key: 'migrations', label: 'DB Migrations', files: ['migrations/', 'alembic/', 'prisma/migrations/', 'db/migrate/'] },
    { key: 'monorepo', label: 'Monorepo', files: ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'] },
    { key: 'openapi', label: 'OpenAPI', files: ['openapi.yaml', 'openapi.json', 'swagger.yaml', 'swagger.json'] },
  ];
  for (const signal of signalChecks) {
    const detected = signal.files.some(f => {
      const full = path.join(dir, f);
      try { return fs.existsSync(full); } catch { return false; }
    });
    if (detected) projectSignals[signal.key] = signal.label;
  }

  return {
    projectName,
    dir,
    stacks: stacks.map(s => s.key),
    projectSignals,
    activePlatforms: platformKeys.map(key => ({
      platform: key,
      label: platformDetails[key].label,
      instructionFiles: platformDetails[key].instructionFiles.map(i => i.file),
      configFiles: platformDetails[key].configFiles,
      mcpServerCount: platformDetails[key].mcpServers.length,
      ruleCount: platformDetails[key].rules.count,
      trustPosture: platformDetails[key].trustPosture,
    })),
    platformDetails,
    sharedInstructions,
    conflictingInstructions,
    mcpServers: mcpUnion,
    trustPosture,
    governanceSummary,
  };
}

module.exports = {
  buildCanonicalModel,
  detectActivePlatforms,
  PLATFORM_SIGNATURES,
};
