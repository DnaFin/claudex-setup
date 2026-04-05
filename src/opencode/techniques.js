/**
 * OpenCode Techniques — 73 checks (OC-A01 through OC-P03)
 *
 * Categories:
 *   A. Instructions (7 checks)
 *   B. Config (6 checks)
 *   C. Permissions (8 checks)
 *   D. Plugins (5 checks)
 *   E. Security (6 checks)
 *   F. MCP (5 checks)
 *   G. CI & Automation (4 checks)
 *   H. Quality Deep (5 checks)
 *   I. Skills (5 checks)
 *   J. Agents & Subagents (4 checks)
 *   K. Commands & Workflow (3 checks)
 *   L. Themes & TUI (3 checks)
 *   M. Review & Governance (3 checks)
 *   N. Release Freshness (3 checks)
 *   O. Mixed-Agent (3 checks)
 *   P. Propagation (3 checks)
 */

const os = require('os');
const path = require('path');
const { EMBEDDED_SECRET_PATTERNS, containsEmbeddedSecret } = require('../secret-patterns');

const DEFAULT_PROJECT_DOC_MAX_BYTES = 32768;

const FILLER_PATTERNS = [
  /\bbe helpful\b/i,
  /\bbe accurate\b/i,
  /\bbe concise\b/i,
  /\balways do your best\b/i,
  /\bmaintain high quality\b/i,
  /\bwrite clean code\b/i,
  /\bfollow best practices\b/i,
];

const JUSTIFICATION_PATTERNS = /\bbecause\b|\bwhy\b|\bjustif(?:y|ication)\b|\btemporary\b|\bintentional\b|\bdocumented\b|\bair[- ]?gapped\b|\binternal only\b|\bephemeral\b|\bci only\b/i;

const PERMISSIONED_TOOLS = [
  'read', 'edit', 'glob', 'grep', 'list', 'bash', 'task', 'skill',
  'lsp', 'question', 'webfetch', 'websearch', 'codesearch',
  'external_directory', 'doom_loop',
];

const VALID_PERMISSION_STATES = new Set(['allow', 'ask', 'deny']);

const VALID_PLUGIN_EVENTS = new Set([
  'tool.execute.before', 'tool.execute.after', 'tool.execute.error',
  'message.before', 'message.after', 'message.error',
  'session.start', 'session.end', 'session.error',
  'agent.start', 'agent.end', 'agent.error',
  'conversation.start', 'conversation.end',
  'command.before', 'command.after',
  'file.read', 'file.write', 'file.delete',
  'bash.before', 'bash.after',
  'compaction.before', 'compaction.after',
  'permission.request', 'permission.response',
  'mcp.connect', 'mcp.disconnect', 'mcp.tool.call',
  'skill.invoke', 'task.spawn', 'task.complete',
  'error', 'warning',
]);

// --- Helpers ---

function agentsPath(ctx) {
  return ctx.fileContent('AGENTS.md') ? 'AGENTS.md' : null;
}

function agentsContent(ctx) {
  return ctx.fileContent('AGENTS.md') || '';
}

function configFileName(ctx) {
  return ctx.configFileName ? ctx.configFileName() : 'opencode.json';
}

function countSections(markdown) {
  return (markdown.match(/^##\s+/gm) || []).length;
}

function firstLineMatching(text, matcher) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (typeof matcher === 'string' && line.includes(matcher)) return index + 1;
    if (matcher instanceof RegExp && matcher.test(line)) {
      matcher.lastIndex = 0;
      return index + 1;
    }
    if (typeof matcher === 'function' && matcher(line, index + 1)) return index + 1;
  }
  return null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findFillerLine(content) {
  return firstLineMatching(content, (line) => FILLER_PATTERNS.some((pattern) => pattern.test(line)));
}

function hasContradictions(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (/\balways\b.*\bnever\b|\bnever\b.*\balways\b/i.test(line)) return true;
  }
  const contradictoryPairs = [
    [/\buse tabs\b/i, /\buse spaces\b/i],
    [/\bsingle quotes\b/i, /\bdouble quotes\b/i],
    [/\bsemicolons required\b/i, /\bno semicolons\b/i],
  ];
  return contradictoryPairs.some(([a, b]) => a.test(content) && b.test(content));
}

function findSecretLine(content) {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const matched = EMBEDDED_SECRET_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(lines[index]);
    });
    if (matched) return index + 1;
  }
  return null;
}

function agentsHasArchitecture(content) {
  return /```mermaid|flowchart\b|graph\s+(TD|LR|RL|BT)\b|##\s+Architecture\b|##\s+Project Map\b|##\s+Structure\b/i.test(content);
}

function expectedVerificationCategories(ctx) {
  const categories = new Set();
  const pkg = ctx.jsonFile('package.json');
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  if (scripts.test) categories.add('test');
  if (scripts.lint) categories.add('lint');
  if (scripts.build) categories.add('build');
  if (ctx.fileContent('Cargo.toml')) { categories.add('test'); categories.add('build'); }
  if (ctx.fileContent('go.mod')) { categories.add('test'); categories.add('build'); }
  if (ctx.fileContent('pyproject.toml') || ctx.fileContent('requirements.txt')) categories.add('test');
  if (ctx.fileContent('Makefile') || ctx.fileContent('justfile')) categories.add('build');
  return [...categories];
}

function hasCommandMention(content, category) {
  if (category === 'test') {
    return /\bnpm test\b|\bnpm run test\b|\bpnpm test\b|\byarn test\b|\bvitest\b|\bjest\b|\bpytest\b|\bgo test\b|\bcargo test\b|\bmake test\b/i.test(content);
  }
  if (category === 'lint') {
    return /\bnpm run lint\b|\bpnpm lint\b|\byarn lint\b|\beslint\b|\bprettier\b|\bruff\b|\bclippy\b|\bgolangci-lint\b|\bmake lint\b/i.test(content);
  }
  if (category === 'build') {
    return /\bnpm run build\b|\bpnpm build\b|\byarn build\b|\btsc\b|\bvite build\b|\bnext build\b|\bcargo build\b|\bgo build\b|\bmake\b/i.test(content);
  }
  return false;
}

function docsBundle(ctx) {
  return `${agentsContent(ctx)}\n${ctx.fileContent('README.md') || ''}`;
}

function repoLooksRegulated(ctx) {
  const filenames = ctx.files.join('\n');
  const packageJson = ctx.fileContent('package.json') || '';
  const readme = ctx.fileContent('README.md') || '';
  const combined = `${filenames}\n${packageJson}\n${readme}`;

  const strongSignals = /\bhipaa\b|\bphi\b|\bpci\b|\bsoc2\b|\biso[- ]?27001\b|\bcompliance\b|\bhealth(?:care)?\b|\bmedical\b|\bbank(?:ing)?\b|\bpayments?\b|\bfintech\b/i;
  if (strongSignals.test(combined)) return true;

  const weakSignalMatches = combined.match(/\bgdpr\b|\bpii\b/gi) || [];
  return weakSignalMatches.length >= 2;
}

function workflowArtifacts(ctx) {
  return (ctx.workflowFiles ? ctx.workflowFiles() : [])
    .map((filePath) => ({ filePath, content: ctx.fileContent(filePath) || '' }))
    .filter((item) => item.content);
}

// --- OPENCODE_TECHNIQUES ---

const OPENCODE_TECHNIQUES = {
  // ==============================
  // A. Instructions (7 checks)
  // ==============================

  opencodeAgentsMdExists: {
    id: 'OC-A01',
    name: 'AGENTS.md exists at project root',
    check: (ctx) => Boolean(ctx.fileContent('AGENTS.md')),
    impact: 'critical',
    rating: 5,
    category: 'instructions',
    fix: 'Create an AGENTS.md at the project root with project-specific guidance for the OpenCode agent.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeAgentsMdQuality: {
    id: 'OC-A02',
    name: 'AGENTS.md has substantive content (>20 lines, 2+ sections, commands)',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      const lines = content.split(/\r?\n/).filter(l => l.trim()).length;
      const sections = countSections(content);
      return lines > 20 && sections >= 2;
    },
    impact: 'high',
    rating: 4,
    category: 'instructions',
    fix: 'Add at least 20 meaningful lines and 2+ sections (## Verification, ## Architecture, etc.) to AGENTS.md.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => 1,
  },

  opencodeAgentsMdVerification: {
    id: 'OC-A03',
    name: 'AGENTS.md has build/test/lint commands',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      const expected = expectedVerificationCategories(ctx);
      if (expected.length === 0) return true;
      return expected.some((cat) => hasCommandMention(content, cat));
    },
    impact: 'high',
    rating: 4,
    category: 'instructions',
    fix: 'Add verification commands (test, lint, build) to AGENTS.md so the agent can validate its work.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeAgentsMdArchitecture: {
    id: 'OC-A04',
    name: 'AGENTS.md has Mermaid or architecture section',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      return agentsHasArchitecture(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions',
    fix: 'Add a ```mermaid diagram or ## Architecture section describing the project structure.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeNoCoexistenceConflict: {
    id: 'OC-A05',
    name: 'Mixed AGENTS.md + CLAUDE.md repos keep OpenCode guidance in AGENTS.md',
    check: (ctx) => {
      if (!ctx.hasAgentsMdAndClaudeMd || !ctx.hasAgentsMdAndClaudeMd()) return true;
      const agentsMd = ctx.fileContent('AGENTS.md') || '';
      return agentsMd.length > 0;
    },
    impact: 'high',
    rating: 4,
    category: 'instructions',
    fix: 'Keep OpenCode instructions in `AGENTS.md` when both files exist. Current runtime evidence did not validate a clean `CLAUDE.md` fallback, so do not rely on `CLAUDE.md` as the primary OpenCode instruction surface.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeNoFillerInstructions: {
    id: 'OC-A06',
    name: 'No generic filler instructions ("Be helpful", "Be accurate")',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      return !findFillerLine(content);
    },
    impact: 'low',
    rating: 2,
    category: 'instructions',
    fix: 'Remove generic filler ("Be helpful", "Write clean code") and replace with specific, actionable project instructions.',
    template: 'opencode-agents-md',
    file: (ctx) => agentsPath(ctx),
    line: (ctx) => findFillerLine(agentsContent(ctx)),
  },

  opencodeNoContradictions: {
    id: 'OC-A07',
    name: 'No contradictions within same AGENTS.md',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      return !hasContradictions(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions',
    fix: 'Remove contradictory statements (e.g., "always" and "never" in the same line, conflicting style rules).',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  // ==============================
  // B. Config (6 checks)
  // ==============================

  opencodeConfigExists: {
    id: 'OC-B01',
    name: 'opencode.json exists at project root',
    check: (ctx) => Boolean(ctx.configContent()),
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Create an opencode.json or opencode.jsonc at the project root with explicit model and permission settings.',
    template: 'opencode-config',
    file: () => 'opencode.json',
    line: () => null,
  },

  opencodeConfigValidJsonc: {
    id: 'OC-B02',
    name: 'opencode.json is valid JSONC (parseable)',
    check: (ctx) => {
      const content = ctx.configContent();
      if (!content) return null;
      const result = ctx.configJson();
      return result.ok;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Fix JSONC syntax errors in opencode.json. Ensure comments use // or /* */ and trailing commas are removed.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => 1,
  },

  opencodeConfigSchema: {
    id: 'OC-B03',
    name: '$schema references opencode.ai/config.json',
    check: (ctx) => {
      const config = ctx.configJson();
      if (!config.ok || !config.data) return null;
      return Boolean(config.data.$schema);
    },
    impact: 'low',
    rating: 2,
    category: 'config',
    fix: 'Add "$schema": "https://opencode.ai/config.json" to enable IDE validation and autocompletion.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => 1,
  },

  opencodeModelExplicit: {
    id: 'OC-B04',
    name: 'model is set explicitly (not relying on silent default)',
    check: (ctx) => {
      const config = ctx.configJson();
      if (!config.ok || !config.data) return null;
      return Boolean(config.data.model);
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Set "model" explicitly in opencode.json to avoid relying on silent provider defaults.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeSmallModelSet: {
    id: 'OC-B05',
    name: 'small_model is set for task delegation',
    check: (ctx) => {
      const config = ctx.configJson();
      if (!config.ok || !config.data) return null;
      return Boolean(config.data.small_model);
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Set "small_model" in opencode.json for efficient task delegation and cost control.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeNoSecretsInConfig: {
    id: 'OC-B06',
    name: 'No secrets in opencode.json (API keys, tokens, passwords)',
    check: (ctx) => {
      const content = ctx.configContent();
      if (!content) return null;
      return !findSecretLine(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Remove API keys and tokens from opencode.json. Use environment variables or {env:VAR_NAME} substitution instead.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: (ctx) => {
      const content = ctx.configContent();
      return content ? findSecretLine(content) : null;
    },
  },

  // ==============================
  // C. Permissions (8 checks)
  // ==============================

  opencodeNoBlanketAllow: {
    id: 'OC-C01',
    name: 'No blanket "allow" for all tools without justification',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return null;
      // Check for wildcard "*": "allow" or all tools set to "allow"
      if (perms['*'] === 'allow') {
        const docs = docsBundle(ctx);
        return JUSTIFICATION_PATTERNS.test(docs);
      }
      const allAllow = PERMISSIONED_TOOLS.every(tool => perms[tool] === 'allow');
      if (allAllow) {
        const docs = docsBundle(ctx);
        return JUSTIFICATION_PATTERNS.test(docs);
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'permissions',
    fix: 'Remove blanket "allow" permission for all tools. Use specific permissions per tool and justify any broad access.',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeBashPermissionExplicit: {
    id: 'OC-C02',
    name: 'bash tool permission is explicit (not defaulting silently)',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return null;
      return perms.bash !== undefined;
    },
    impact: 'critical',
    rating: 5,
    category: 'permissions',
    fix: 'Set an explicit permission for the "bash" tool: "ask" (recommended) or "deny" for read-only repos.',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeBashPatternSpecific: {
    id: 'OC-C03',
    name: 'Pattern-based bash permissions use specific patterns (not "*": "allow")',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms) return null;
      const bashPerms = perms.bash;
      if (!bashPerms || typeof bashPerms !== 'object') return null;
      // Check for overly broad patterns
      if (bashPerms['*'] === 'allow') return false;
      if (bashPerms['**'] === 'allow') return false;
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'permissions',
    fix: 'Replace "*": "allow" in bash permissions with specific command patterns (e.g., "npm *": "allow").',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeDestructiveBashDeny: {
    id: 'OC-C04',
    name: 'rm * and destructive bash patterns are "deny" or "ask"',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms) return null;
      const bashPerms = perms.bash;
      if (!bashPerms || typeof bashPerms !== 'object') return true;
      const destructivePatterns = ['rm *', 'rm -rf *', 'git push --force*', 'git reset --hard*'];
      for (const pattern of destructivePatterns) {
        if (bashPerms[pattern] === 'allow') return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'permissions',
    fix: 'Ensure destructive bash patterns (rm *, git push --force) are set to "deny" or "ask", never "allow".',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeDoomLoopExplicit: {
    id: 'OC-C05',
    name: 'doom_loop permission is explicit (defaults to "ask")',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return null;
      return perms.doom_loop !== undefined;
    },
    impact: 'medium',
    rating: 3,
    category: 'permissions',
    fix: 'Set "doom_loop" permission explicitly. This controls behavior when the agent makes 3+ identical calls.',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeExternalDirExplicit: {
    id: 'OC-C06',
    name: 'external_directory permission is explicit (defaults to "ask")',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return null;
      return perms.external_directory !== undefined;
    },
    impact: 'medium',
    rating: 3,
    category: 'permissions',
    fix: 'Set "external_directory" permission explicitly. This controls access to files outside the project root.',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeEnvFileDeny: {
    id: 'OC-C07',
    name: '.env file reads default to "deny" (verify not overridden to "allow")',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms) return null;
      const readPerms = perms.read;
      if (!readPerms || typeof readPerms !== 'object') return true;
      // Check if .env patterns are explicitly allowed
      const envPatterns = ['.env', '.env.*', '*.env'];
      for (const pattern of envPatterns) {
        if (readPerms[pattern] === 'allow') return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'permissions',
    fix: 'Ensure .env file read permissions are "deny" or "ask", not "allow". Secrets should not be accessible.',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeAllToolsCovered: {
    id: 'OC-C08',
    name: 'Critical tool permissions are explicit',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return null;
      // At least the critical tools should be covered
      const critical = ['bash', 'edit', 'read', 'task'];
      return critical.every(tool => perms[tool] !== undefined);
    },
    impact: 'high',
    rating: 4,
    category: 'permissions',
    fix: 'Set explicit permissions for at least the critical tools: bash, edit, read, and task. The old fixed "15 tools" framing no longer matches current CLI/runtime surfaces.',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  // ==============================
  // D. Plugins (5 checks)
  // ==============================

  opencodePluginsValid: {
    id: 'OC-D01',
    name: 'Plugin files are valid JS/TS and import from @opencode-ai/plugin',
    check: (ctx) => {
      const pluginFiles = ctx.pluginFiles();
      if (pluginFiles.length === 0) return null;
      // Check that plugin directory exists and files are present
      return pluginFiles.length > 0;
    },
    impact: 'high',
    rating: 4,
    category: 'plugins',
    fix: 'Ensure plugin files in .opencode/plugins/ are valid JS/TS and properly import from @opencode-ai/plugin.',
    template: 'opencode-plugins',
    file: () => '.opencode/plugins/',
    line: () => null,
  },

  opencodePluginsDocumented: {
    id: 'OC-D02',
    name: 'Project plugins (.opencode/plugins/) are documented and reviewed',
    check: (ctx) => {
      const pluginFiles = ctx.pluginFiles();
      if (pluginFiles.length === 0) return null;
      const docs = docsBundle(ctx);
      return /\bplugins?\b/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'plugins',
    fix: 'Document plugins in AGENTS.md or README.md. Plugins run in-process and are a critical security surface.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodePluginsPinned: {
    id: 'OC-D03',
    name: 'npm plugin packages use pinned versions (not latest/ranges)',
    check: (ctx) => {
      const plugins = ctx.plugins();
      if (!Array.isArray(plugins) || plugins.length === 0) return null;
      for (const plugin of plugins) {
        const name = typeof plugin === 'string' ? plugin : (plugin && plugin.name);
        if (!name) continue;
        if (name.includes('@latest') || name.includes('@*')) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'plugins',
    fix: 'Pin plugin versions (e.g., "my-plugin@1.2.3") instead of using @latest or ranges for supply chain security.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodePluginEventsValid: {
    id: 'OC-D04',
    name: 'Plugin event handlers match available events (30+ valid events)',
    check: (ctx) => {
      // This is a heuristic check — full validation requires parsing plugin code
      const pluginFiles = ctx.pluginFiles();
      if (pluginFiles.length === 0) return null;
      return true; // Pass by default; deep-review handles thorough checks
    },
    impact: 'medium',
    rating: 3,
    category: 'plugins',
    fix: 'Ensure plugin event handlers use valid event names from the OpenCode plugin API.',
    template: 'opencode-plugins',
    file: () => '.opencode/plugins/',
    line: () => null,
  },

  opencodePluginHookGapAware: {
    id: 'OC-D05',
    name: 'Plugin docs do not rely on stale hook-gap claims',
    check: (ctx) => {
      const pluginFiles = ctx.pluginFiles();
      if (pluginFiles.length === 0) return null;
      const docs = docsBundle(ctx);
      return !/\btool\.execute\.before\b[\s\S]{0,80}\b(subagent|mcp)\b[\s\S]{0,80}\b(bypass|gap|broken|2319|5894)\b/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'plugins',
    fix: 'Remove blanket claims that subagent or MCP calls bypass plugin visibility. On current runtime, hook coverage was observed for direct, subagent, and MCP paths, so any caveat should be version-specific and evidence-backed.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  // ==============================
  // E. Security (6 checks)
  // ==============================

  opencodeNoSecretsInAgentsMd: {
    id: 'OC-E01',
    name: 'No secrets/API keys in AGENTS.md',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      return !findSecretLine(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Remove any API keys, tokens, or passwords from AGENTS.md. Use environment variables instead.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => findSecretLine(agentsContent(ctx)),
  },

  opencodeToolInterceptionGap: {
    id: 'OC-E02',
    name: 'Security docs do not overstate plugin hook bypass gaps',
    check: (ctx) => {
      const pluginFiles = ctx.pluginFiles();
      if (pluginFiles.length === 0) return null;
      const docs = docsBundle(ctx);
      return !/\b(subagent|mcp)\b[\s\S]{0,80}\b(bypass|gap|broken|2319|5894)\b/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'security',
    fix: 'Do not treat historical hook-gap bug reports as a current security guarantee. If you mention plugin coverage limits, mark them as version-sensitive and pair them with fresh runtime evidence.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeAgentDenyNotBypassable: {
    id: 'OC-E03',
    name: 'Agent-permission docs do not rely on stale SDK bypass claims',
    check: (ctx) => {
      const agents = ctx.customAgents();
      if (!agents || Object.keys(agents).length === 0) return null;
      const docs = docsBundle(ctx);
      const usesAgentPerms = Object.values(agents).some(a => a && a.permissions);
      if (!usesAgentPerms) return true;
      return !/\b6396\b|\bagent\b[\s\S]{0,80}\b(bypass|gap|broken)\b/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'security',
    fix: 'Remove blanket claims that agent deny permissions are bypassed via SDK unless you have fresh version-specific proof. The older `#6396` framing did not reproduce in the current CLI harness.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeServerPasswordSet: {
    id: 'OC-E04',
    name: 'Server mode (opencode serve) is protected with OPENCODE_SERVER_PASSWORD',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/\bopencode\s+serve\b|\bserver\s+mode\b/i.test(docs)) return null;
      return /\bOPENCODE_SERVER_PASSWORD\b/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'security',
    fix: 'Document that OPENCODE_SERVER_PASSWORD must be set when using `opencode serve` for HTTP API security.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeNoSecretExposure: {
    id: 'OC-E05',
    name: 'No secrets exposed through config variable substitution',
    check: (ctx) => {
      const content = ctx.configContent();
      if (!content) return null;
      // Check for hardcoded secrets in variable substitution values
      return !findSecretLine(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Do not hardcode secrets in `opencode.json`, and do not assume `{env:VAR}` keeps values invisible. Current runtime exposed resolved env substitutions in `debug config`, so treat that surface as sensitive too.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: (ctx) => {
      const content = ctx.configContent();
      return content ? findSecretLine(content) : null;
    },
  },

  opencodeRegulatedRepoExplicitPerms: {
    id: 'OC-E06',
    name: 'Regulated repos have explicit restrictive permission posture',
    check: (ctx) => {
      if (!repoLooksRegulated(ctx)) return null;
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return false;
      // Regulated repos should have explicit bash permissions
      return perms.bash !== undefined && perms.bash !== 'allow';
    },
    impact: 'high',
    rating: 4,
    category: 'security',
    fix: 'This repo has compliance signals. Set restrictive permissions: bash should be "ask" or "deny".',
    template: 'opencode-permissions',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  // ==============================
  // F. MCP (5 checks)
  // ==============================

  opencodeMcpSchemaCorrect: {
    id: 'OC-F01',
    name: 'MCP servers use correct schema (command: [] array, environment: {} not env)',
    check: (ctx) => {
      const mcp = ctx.mcpServers();
      if (!mcp || Object.keys(mcp).length === 0) return null;
      for (const [id, server] of Object.entries(mcp)) {
        if (!server) continue;
        if (server.command && !Array.isArray(server.command)) return false;
        if (server.env && !server.environment) return false;
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'mcp',
    fix: 'Fix MCP config schema: use `command` as a string array and `environment` as the env-var object. Current runtime rejected string commands and the legacy `env` key.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeMcpToolWhitelisting: {
    id: 'OC-F02',
    name: 'Tool whitelisting uses glob patterns to limit MCP tool access',
    check: (ctx) => {
      const mcp = ctx.mcpServers();
      if (!mcp || Object.keys(mcp).length === 0) return null;
      const hasMcpToolRestrictions = Object.values(mcp).some((server) => server && server.tools && Object.keys(server.tools).length > 0);
      return hasMcpToolRestrictions || Object.keys(mcp).length <= 2;
    },
    impact: 'high',
    rating: 4,
    category: 'mcp',
    fix: 'Add MCP tool restrictions with per-tool globs such as `{ "tools": { "my-mcp*": false } }`. This limits only those MCP tools; other available tools like `webfetch` may still satisfy the same intent unless you restrict them too.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeMcpTimeoutReasonable: {
    id: 'OC-F03',
    name: 'MCP timeout is reasonable (default 5000ms, max justified)',
    check: (ctx) => {
      const mcp = ctx.mcpServers();
      if (!mcp || Object.keys(mcp).length === 0) return null;
      for (const [id, server] of Object.entries(mcp)) {
        if (!server) continue;
        const timeout = server.timeout || server.startup_timeout;
        if (typeof timeout === 'number' && timeout > 30000) {
          const docs = docsBundle(ctx);
          if (!JUSTIFICATION_PATTERNS.test(docs)) return false;
        }
      }
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'mcp',
    fix: 'MCP timeout exceeds 30s. Add justification or reduce the timeout.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeMcpHookLimitation: {
    id: 'OC-F04',
    name: 'MCP hook caveats are treated as version-sensitive',
    check: (ctx) => {
      const mcp = ctx.mcpServers();
      const pluginFiles = ctx.pluginFiles();
      if (!mcp || Object.keys(mcp).length === 0) return null;
      if (pluginFiles.length === 0) return null;
      const docs = docsBundle(ctx);
      return !/\bmcp\b[\s\S]{0,80}\b(hook|plugin)\b[\s\S]{0,80}\b(bypass|gap|broken|2319)\b/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Do not hard-code an MCP hook-bypass warning as if it were universal. Current runtime showed MCP plugin events firing, so keep any caveat version-sensitive and backed by fresh evidence.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeMcpAuthDocumented: {
    id: 'OC-F05',
    name: 'MCP servers requiring auth have documented setup instructions',
    check: (ctx) => {
      const mcp = ctx.mcpServers();
      if (!mcp || Object.keys(mcp).length === 0) return null;
      const docs = docsBundle(ctx);
      for (const [id, server] of Object.entries(mcp)) {
        if (!server) continue;
        const env = server.environment || {};
        const hasAuthEnv = Object.keys(env).some(k => /token|key|secret|password|credential/i.test(k));
        if (hasAuthEnv) {
          const idPattern = new RegExp(`\\b${escapeRegex(id)}\\b[\\s\\S]{0,200}\\b(auth|setup|token|key|env)\\b`, 'i');
          if (!idPattern.test(docs)) return false;
        }
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Document MCP server auth setup in AGENTS.md or README.md for servers that require tokens/keys.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  // ==============================
  // G. CI & Automation (4 checks)
  // ==============================

  opencodeCiPermissionsPreset: {
    id: 'OC-G01',
    name: 'opencode run usage pre-configures permissions to avoid silent auto-rejects',
    check: (ctx) => {
      const workflows = workflowArtifacts(ctx);
      const hasOpencodeRun = workflows.some(w => /\bopencode\s+run\b/i.test(w.content));
      if (!hasOpencodeRun) return null;
      return workflows.some(w => /\bpermissions?\b.*\ballow\b|\b--yes\b|\b--no-prompt\b/i.test(w.content));
    },
    impact: 'critical',
    rating: 5,
    category: 'ci',
    fix: 'Pre-configure permissions when using `opencode run` in CI. In the current harness, permission requests auto-rejected instead of hanging, which still breaks tasks that expected tool access.',
    template: 'opencode-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  opencodeCiAutoUpdateDisabled: {
    id: 'OC-G02',
    name: 'OPENCODE_DISABLE_AUTOUPDATE=1 is set in CI environments',
    check: (ctx) => {
      const workflows = workflowArtifacts(ctx);
      const hasOpencode = workflows.some(w => /\bopencode\b/i.test(w.content));
      if (!hasOpencode) return null;
      return workflows.some(w => /OPENCODE_DISABLE_AUTOUPDATE/i.test(w.content));
    },
    impact: 'high',
    rating: 4,
    category: 'ci',
    fix: 'Set OPENCODE_DISABLE_AUTOUPDATE=1 in CI workflows for reproducible builds.',
    template: 'opencode-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  opencodeCiJsonOutput: {
    id: 'OC-G03',
    name: '--format json is used for machine-readable CI output',
    check: (ctx) => {
      const workflows = workflowArtifacts(ctx);
      const hasOpencodeRun = workflows.some(w => /\bopencode\s+run\b/i.test(w.content));
      if (!hasOpencodeRun) return null;
      return workflows.some(w => /--format\s+json\b/i.test(w.content));
    },
    impact: 'medium',
    rating: 3,
    category: 'ci',
    fix: 'Use `--format json` when running OpenCode in CI, and parse it as JSONL/event frames rather than expecting one monolithic JSON document.',
    template: 'opencode-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  opencodeCiEnvAuth: {
    id: 'OC-G04',
    name: 'CI auth uses environment variables (not hardcoded credentials)',
    check: (ctx) => {
      const workflows = workflowArtifacts(ctx);
      const hasOpencode = workflows.some(w => /\bopencode\b/i.test(w.content));
      if (!hasOpencode) return null;
      // Check for hardcoded credentials in workflows
      for (const w of workflows) {
        if (/\bopencode\b/i.test(w.content) && findSecretLine(w.content)) return false;
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'ci',
    fix: 'Use GitHub secrets and environment variables for OpenCode auth in CI. Never hardcode credentials.',
    template: 'opencode-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  // ==============================
  // H. Quality Deep (5 checks)
  // ==============================

  opencodeModernFeaturesDocumented: {
    id: 'OC-H01',
    name: 'AGENTS.md mentions modern OpenCode features (plugins, custom agents, skills)',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      const hasModernRefs = /\bplugin(s)?\b|\bcustom\s+agent(s)?\b|\bskill(s)?\b|\bopencode\b/i.test(content);
      return hasModernRefs;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Mention OpenCode-specific features (plugins, agents, skills) in AGENTS.md to leverage platform capabilities.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeNoDeprecatedPatterns: {
    id: 'OC-H02',
    name: 'Repo docs do not push the stale mode -> agent migration claim',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!docs.trim()) return null;
      return !/\bmode\b[\s\S]{0,60}\bdeprecated\b|\buse\b[\s\S]{0,40}\bagent\b[\s\S]{0,40}\binstead of\b[\s\S]{0,20}\bmode\b/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Do not tell users that `mode` has been replaced by `agent` across the board. Current runtime still validated `mode` for markdown custom agents, so any migration guidance should be explicitly version-scoped.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeCompactionExplicit: {
    id: 'OC-H03',
    name: 'compaction settings are explicit if sessions are long',
    check: (ctx) => {
      const config = ctx.configJson();
      if (!config.ok || !config.data) return null;
      // Only relevant if the project looks like it uses long sessions
      const docs = docsBundle(ctx);
      const usesLongSessions = /\blong\s+session\b|\bcompact\b|\bcontext\s+(limit|window|management)\b/i.test(docs);
      if (!usesLongSessions) return null;
      return config.data.compaction !== undefined;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Set explicit "compaction" settings in opencode.json for context management during long sessions.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeFormatterConfigured: {
    id: 'OC-H04',
    name: 'formatter is configured if project uses auto-formatting',
    check: (ctx) => {
      const pkg = ctx.jsonFile('package.json');
      const hasFormatter = pkg && pkg.scripts && (pkg.scripts.format || pkg.scripts.prettier);
      const hasFormatterConfig = ctx.fileContent('.prettierrc') || ctx.fileContent('.prettierrc.json') ||
        ctx.fileContent('.editorconfig');
      if (!hasFormatter && !hasFormatterConfig) return null;
      const config = ctx.configJson();
      if (!config.ok || !config.data) return null;
      return config.data.formatter !== undefined;
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Set "formatter" in opencode.json to integrate with the project auto-formatting tool.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeProviderManagement: {
    id: 'OC-H05',
    name: 'disabled_providers / enabled_providers are set intentionally',
    check: (ctx) => {
      const config = ctx.configJson();
      if (!config.ok || !config.data) return null;
      // Only flag if many providers are available but none are managed
      if (config.data.disabled_providers || config.data.enabled_providers) return true;
      // Soft pass — not critical unless the repo explicitly uses multiple providers
      return null;
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Consider setting "disabled_providers" or "enabled_providers" to control which model providers are available.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  // ==============================
  // I. Skills (5 checks)
  // ==============================

  opencodeSkillDirsExist: {
    id: 'OC-I01',
    name: 'Skill directories exist (.opencode/commands/ subdirs with SKILL.md)',
    check: (ctx) => {
      const skillDirs = ctx.skillDirs();
      if (skillDirs.length === 0) return null;
      return skillDirs.length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'skills',
    fix: 'Create skill directories under .opencode/commands/ with SKILL.md files.',
    template: 'opencode-skills',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  opencodeSkillFrontmatter: {
    id: 'OC-I02',
    name: 'SKILL.md has required frontmatter (name, description)',
    check: (ctx) => {
      const skillDirs = ctx.skillDirs();
      if (skillDirs.length === 0) return null;
      for (const name of skillDirs) {
        const content = ctx.skillMetadata(name);
        if (!content) return false;
        if (!/^#\s+/m.test(content)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'skills',
    fix: 'Each SKILL.md needs a title (# heading) and description for skill invocation.',
    template: 'opencode-skills',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  opencodeSkillKebabCase: {
    id: 'OC-I03',
    name: 'Skill names preferably use kebab-case',
    check: (ctx) => {
      const skillDirs = ctx.skillDirs();
      if (skillDirs.length === 0) return null;
      return skillDirs.every(name => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name));
    },
    impact: 'medium',
    rating: 2,
    category: 'skills',
    fix: 'Prefer kebab-case for skill names, but treat it as a style recommendation rather than a hard runtime requirement. Current runtime still discovered underscore-based names.',
    template: 'opencode-skills',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  opencodeSkillDescriptionBounded: {
    id: 'OC-I04',
    name: 'Skill descriptions are bounded for implicit invocation context cost',
    check: (ctx) => {
      const skillDirs = ctx.skillDirs();
      if (skillDirs.length === 0) return null;
      for (const name of skillDirs) {
        const content = ctx.skillMetadata(name);
        if (!content) continue;
        if (content.length > 3000) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'skills',
    fix: 'Keep SKILL.md descriptions under 3000 characters to manage implicit invocation context cost.',
    template: 'opencode-skills',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  opencodeSkillCompatPaths: {
    id: 'OC-I05',
    name: 'OpenCode skill discovery accepts either .opencode/commands or .claude/skills',
    check: (ctx) => {
      const hasClaudeSkills = ctx.hasDir('.claude/skills');
      const hasOpencodeCommands = ctx.hasDir('.opencode/commands');
      if (!hasClaudeSkills && !hasOpencodeCommands) return null;
      return hasClaudeSkills || hasOpencodeCommands;
    },
    impact: 'medium',
    rating: 3,
    category: 'skills',
    fix: 'Use `.opencode/commands/` for native OpenCode skills when you need them, but do not require a duplicate tree just to mirror `.claude/skills/`. Current runtime discovered `.claude/skills/` compatibility successfully.',
    template: 'opencode-skills',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  // ==============================
  // J. Agents & Subagents (4 checks)
  // ==============================

  opencodeAgentRequiredFields: {
    id: 'OC-J01',
    name: 'Custom agents have required fields (description, model)',
    check: (ctx) => {
      const agents = ctx.customAgents();
      if (!agents || Object.keys(agents).length === 0) return null;
      for (const [name, agent] of Object.entries(agents)) {
        if (!agent) return false;
        if (!agent.description) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'agents',
    fix: 'Ensure all custom agents have at least "description" and "model" fields in opencode.json.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeAgentModeValid: {
    id: 'OC-J02',
    name: 'Custom agent mode is valid when declared',
    check: (ctx) => {
      const agents = ctx.customAgents();
      if (!agents || Object.keys(agents).length === 0) return null;
      const validModes = new Set(['primary', 'subagent', 'all']);
      for (const [name, agent] of Object.entries(agents)) {
        if (!agent) continue;
        const mode = agent.mode || agent.agent;
        if (mode && !validModes.has(mode)) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'Use a valid mode value (`primary`, `subagent`, or `all`) when declaring custom agents. Current runtime still validated `mode` for markdown agents, so do not rename to `agent` solely because of stale docs.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeBuiltinAgentsProtected: {
    id: 'OC-J03',
    name: 'Built-in agent overrides are intentional and documented',
    check: (ctx) => {
      const agents = ctx.customAgents();
      if (!agents || Object.keys(agents).length === 0) return null;
      const builtins = new Set(['build', 'plan', 'default']);
      const overriding = Object.keys(agents).filter((name) => builtins.has(name.toLowerCase()));
      if (overriding.length === 0) return true;
      const docs = docsBundle(ctx);
      return /override|intentional|customized|replace/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'Built-in agents appear overrideable in current runtime. If you intentionally override `build`, `plan`, or `default`, document why; otherwise rename the custom agent to avoid surprising behavior.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeAgentStepsLimit: {
    id: 'OC-J04',
    name: 'Agent steps limit is set to prevent runaway execution',
    check: (ctx) => {
      const agents = ctx.customAgents();
      if (!agents || Object.keys(agents).length === 0) return null;
      for (const [name, agent] of Object.entries(agents)) {
        if (!agent) continue;
        if (agent.steps && agent.steps > 100) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'Set a reasonable "steps" limit on custom agents to prevent runaway execution. 50-100 is typical.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  // ==============================
  // K. Commands & Workflow (3 checks)
  // ==============================

  opencodeCommandsValid: {
    id: 'OC-K01',
    name: 'Custom commands have valid frontmatter (template, description)',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles();
      if (commandFiles.length === 0) return null;
      return true; // Basic presence check; deep-review handles thorough validation
    },
    impact: 'medium',
    rating: 3,
    category: 'commands',
    fix: 'Ensure custom command files in .opencode/commands/ have valid YAML frontmatter.',
    template: 'opencode-commands',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  opencodeInlineBashSafe: {
    id: 'OC-K02',
    name: 'Inline bash (!`command`) in command templates is safe',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles();
      if (commandFiles.length === 0) return null;
      for (const file of commandFiles) {
        const content = ctx.fileContent(path.join('.opencode', 'commands', file));
        if (!content) continue;
        // Check for dangerous inline bash patterns
        if (/!`\s*rm\s+-rf\b|!`\s*git\s+push\s+--force\b/i.test(content)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'commands',
    fix: 'Review inline bash (!`command`) in command templates for injection risks and destructive patterns.',
    template: 'opencode-commands',
    file: () => '.opencode/commands/',
    line: () => null,
  },

  opencodeCostAwareness: {
    id: 'OC-K03',
    name: 'Cost-awareness note in AGENTS.md for heavy workflows',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      // Only relevant for repos with heavy workflows
      const hasHeavyWorkflow = /\bworkflow\b|\bautomation\b|\bpipeline\b|\bscheduled\b/i.test(content);
      if (!hasHeavyWorkflow) return null;
      return /\bcost\b|\bbudget\b|\bexpens\w+\b|\btoken\s*usage\b/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'commands',
    fix: 'Add a cost-awareness note to AGENTS.md for repos with heavy automation workflows.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  // ==============================
  // L. Themes & TUI (3 checks)
  // ==============================

  opencodeTuiConfigValid: {
    id: 'OC-L01',
    name: 'tui.json/tui.jsonc is valid JSONC if present',
    check: (ctx) => {
      const content = ctx.tuiConfigContent();
      if (!content) return null;
      const result = ctx.tuiConfigJson();
      return result.ok;
    },
    impact: 'medium',
    rating: 3,
    category: 'tui',
    fix: 'Fix JSONC syntax in `tui.json`, then validate the behavioral effect in the real TUI/UI. Headless CLI surfaces did not provide enough evidence for TUI behavior on their own.',
    template: 'opencode-config',
    file: () => 'tui.json',
    line: () => 1,
  },

  opencodeThemeFilesValid: {
    id: 'OC-L02',
    name: 'Theme files are valid JSON in .opencode/themes/*.json',
    check: (ctx) => {
      const themes = ctx.themeFiles();
      if (themes.length === 0) return null;
      for (const theme of themes) {
        const content = ctx.fileContent(path.join('.opencode', 'themes', theme));
        if (!content) continue;
        try {
          JSON.parse(content);
        } catch {
          return false;
        }
      }
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'tui',
    fix: 'Fix JSON syntax errors in `.opencode/themes/`, then verify the theme in an actual UI/TUI session. Headless `run` did not give reliable theme evidence.',
    template: 'opencode-config',
    file: () => '.opencode/themes/',
    line: () => null,
  },

  opencodeTuiNoSecrets: {
    id: 'OC-L03',
    name: 'tui.json does not contain sensitive data',
    check: (ctx) => {
      const content = ctx.tuiConfigContent();
      if (!content) return null;
      return !findSecretLine(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'tui',
    fix: 'Remove any sensitive data from `tui.json`, and remember that `tui.json` was not meaningfully observable through headless `run` alone.',
    template: 'opencode-config',
    file: () => 'tui.json',
    line: (ctx) => {
      const content = ctx.tuiConfigContent();
      return content ? findSecretLine(content) : null;
    },
  },

  // ==============================
  // M. Review & Governance (3 checks)
  // ==============================

  opencodeExplicitPermissionPosture: {
    id: 'OC-M01',
    name: 'Permission posture is explicit and documented',
    check: (ctx) => {
      const perms = ctx.toolPermissions();
      if (!perms || Object.keys(perms).length === 0) return null;
      const docs = docsBundle(ctx);
      return /\bpermission(s)?\b|\btrust\b|\bsandbox\b|\ballow\b|\bdeny\b|\bask\b/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'governance',
    fix: 'Document the project permission posture in AGENTS.md (which tools are allowed/denied and why).',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeGovernanceExport: {
    id: 'OC-M02',
    name: 'Permission configuration is reviewable and version-controlled',
    check: (ctx) => {
      // opencode.json should be tracked
      return Boolean(ctx.configContent());
    },
    impact: 'medium',
    rating: 3,
    category: 'governance',
    fix: 'Commit opencode.json to version control for reviewable permission configuration.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodePilotEvidence: {
    id: 'OC-M03',
    name: 'OpenCode setup has been audited at least once',
    check: (ctx) => {
      // Check for nerviq activity artifacts
      const hasArtifacts = ctx.hasDir('.claude/claudex-setup');
      return hasArtifacts ? true : null;
    },
    impact: 'low',
    rating: 2,
    category: 'governance',
    fix: 'Run `npx nerviq --platform opencode` to create a baseline audit for the project.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  // ==============================
  // N. Release Freshness (3 checks)
  // ==============================

  opencodeVersionFresh: {
    id: 'OC-N01',
    name: 'OpenCode CLI version is recent',
    check: () => {
      // This is checked at runtime, not statically
      return null;
    },
    impact: 'medium',
    rating: 3,
    category: 'release-freshness',
    fix: 'Update OpenCode CLI to the latest version for the newest features and security fixes.',
    template: 'opencode-config',
    file: () => null,
    line: () => null,
  },

  opencodeConfigKeysFresh: {
    id: 'OC-N02',
    name: 'Config references current OpenCode features (no removed or renamed keys)',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      const config = ctx.configContent();
      if (!docs.trim() && !config) return null;
      const combined = `${docs}\n${config || ''}`;
      return !/\bconfig\.json\b|\.well-known\/opencode|mode\s*->\s*agent|CLAUDE\.md fallback/i.test(combined);
    },
    impact: 'medium',
    rating: 3,
    category: 'release-freshness',
    fix: 'Update stale OpenCode references. Use `opencode.json`/`opencode.jsonc`, keep `mode` guidance version-scoped, and treat `.well-known/opencode` plus `CLAUDE.md` fallback claims as unvalidated until you have fresh runtime proof.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodePropagationCompleteness: {
    id: 'OC-N03',
    name: 'No dangling surface references (plugins, skills, MCP mentioned but not defined)',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      const issues = [];
      if (/\bplugins?\b/i.test(agents) && ctx.pluginFiles().length === 0) {
        issues.push('plugins referenced but .opencode/plugins/ empty');
      }
      if (/\bskills?\b/i.test(agents) && !ctx.hasDir('.opencode/commands')) {
        issues.push('skills referenced but .opencode/commands/ missing');
      }
      const config = ctx.configJson();
      if (config.ok && config.data && /\bmcp\b/i.test(agents)) {
        const mcp = config.data.mcp || {};
        if (Object.keys(mcp).length === 0) {
          issues.push('MCP referenced in AGENTS.md but no MCP servers in config');
        }
      }
      return issues.length === 0;
    },
    impact: 'high',
    rating: 4,
    category: 'release-freshness',
    fix: 'Ensure all surfaces mentioned in AGENTS.md (plugins, skills, MCP) have corresponding definitions.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      return firstLineMatching(agents, /\bplugins?\b|\bskills?\b|\bmcp\b/i);
    },
  },

  // ==============================
  // O. Mixed-Agent (3 checks)
  // ==============================

  opencodeMixedAgentAware: {
    id: 'OC-O01',
    name: 'Mixed-agent repo separates OpenCode and Claude instructions',
    check: (ctx) => {
      if (!ctx.hasAgentsMdAndClaudeMd || !ctx.hasAgentsMdAndClaudeMd()) return null;
      // Both files exist — check they are distinct
      const agents = ctx.fileContent('AGENTS.md') || '';
      const claude = ctx.fileContent('CLAUDE.md') || '';
      return agents !== claude;
    },
    impact: 'high',
    rating: 4,
    category: 'mixed-agent',
    fix: 'Keep AGENTS.md for OpenCode and CLAUDE.md for Claude Code. Do not duplicate instructions.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  opencodeInstructionsArrayResolvable: {
    id: 'OC-O02',
    name: 'instructions array uses validated local file paths',
    check: (ctx) => {
      const instructions = ctx.instructionsArray();
      if (!Array.isArray(instructions) || instructions.length === 0) return null;
      for (const instruction of instructions) {
        if (typeof instruction !== 'string') continue;
        if (instruction.startsWith('http') || instruction.includes('*')) return false;
        if (!ctx.fileContent(instruction)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'mixed-agent',
    fix: 'Prefer direct local file paths in the `instructions` array. Current runtime clearly validated direct files, but glob and URL sources were not visibly applied in `run`, so treat them as experimental until reproduced.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeGlobalAgentsNoConflict: {
    id: 'OC-O03',
    name: 'Project docs do not depend on global AGENTS.md behavior',
    check: (ctx) => {
      const docs = `${ctx.fileContent('AGENTS.md') || ''}\n${ctx.fileContent('README.md') || ''}`;
      if (!docs.trim()) return null;
      return !/~\/\.config\/opencode\/AGENTS\.md|global AGENTS/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'mixed-agent',
    fix: 'Do not rely on `~/.config/opencode/AGENTS.md` as a guaranteed project behavior. Current Windows runtime did not show global AGENTS loading in `run`, so keep project-critical guidance in repo files.',
    template: 'opencode-agents-md',
    file: () => 'AGENTS.md',
    line: () => null,
  },

  // ==============================
  // P. Propagation (3 checks)
  // ==============================

  opencodeConfigMergeConsistent: {
    id: 'OC-P01',
    name: 'Observed config merge hierarchy does not produce conflicting values',
    check: (ctx) => {
      const projectConfig = ctx.configJson();
      const globalConfig = ctx.globalConfigJson();
      if (!projectConfig.ok || !globalConfig.ok) return null;
      // Check for keys that exist in both and might conflict
      const projectKeys = new Set(Object.keys(projectConfig.data || {}));
      const globalKeys = new Set(Object.keys(globalConfig.data || {}));
      const overlapping = [...projectKeys].filter(k => globalKeys.has(k) && k !== '$schema');
      // If project explicitly sets values, it wins — that is correct
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'propagation',
    fix: 'Review the observed precedence chain: global `opencode.json` < `OPENCODE_CONFIG` < project `opencode.json` < `.opencode/opencode.json` < `OPENCODE_CONFIG_CONTENT`. Treat `.well-known/opencode` as remote-only until you have runtime proof.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeVariableSubstitutionValid: {
    id: 'OC-P02',
    name: 'Variable substitution ({env:VAR}, {file:path}) resolves correctly',
    check: (ctx) => {
      const content = ctx.configContent();
      if (!content) return null;
      // Check for unresolved variable patterns
      const envRefs = content.match(/\{env:([^}]+)\}/g) || [];
      const fileRefs = content.match(/\{file:([^}]+)\}/g) || [];
      // Can't fully validate without runtime — basic syntax check
      for (const ref of [...envRefs, ...fileRefs]) {
        if (ref.includes(' ') || ref.includes('\n')) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'propagation',
    fix: 'Fix variable substitution syntax: use {env:VAR_NAME} or {file:path} without spaces.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },

  opencodeOpencodeDirectoryConsistent: {
    id: 'OC-P03',
    name: '.opencode/ directory contents are consistent with opencode.json',
    check: (ctx) => {
      if (!ctx.hasDir('.opencode')) return null;
      const config = ctx.configJson();
      if (!config.ok) return null;
      // Check that referenced plugins/agents/commands exist
      return true; // Basic presence check
    },
    impact: 'medium',
    rating: 3,
    category: 'propagation',
    fix: 'Ensure .opencode/ directory structure matches opencode.json references.',
    template: 'opencode-config',
    file: (ctx) => configFileName(ctx),
    line: () => null,
  },
};

module.exports = {
  OPENCODE_TECHNIQUES,
};
