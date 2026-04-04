/**
 * Windsurf techniques module — CHECK CATALOG
 *
 * 82 checks across 16 categories:
 *   v0.1 (40): A. Rules(9), B. Config(7), C. Trust & Safety(9), D. Cascade Agent(5), E. MCP(5), F. Instructions Quality(5)
 *   v0.5 (55): G. Workflows & Steps(5), H. Memories(5), I. Enterprise(5)
 *   v1.0 (70): J. Cascadeignore & Review(4), K. Cross-Surface(4), L. Quality Deep(7)
 *   CP-08 (82): M. Advisory(4), N. Pack(4), O. Repeat(3), P. Freshness(3)
 *
 * Each check: { id, name, check(ctx), impact, rating, category, fix, template, file(), line() }
 *
 * Windsurf key differences from Cursor:
 * - Instructions: .windsurf/rules/*.md (Markdown + YAML frontmatter, NOT MDC)
 * - Legacy: .windsurfrules (like .cursorrules)
 * - 4 activation modes: Always, Auto, Agent-Requested, Manual
 * - Agent: Cascade (autonomous agent)
 * - Memories system (team-syncable)
 * - Workflows -> Slash commands
 * - 10K char rule limit
 * - MCP with team whitelist
 * - cascadeignore (gitignore for Cascade)
 * - No background agents
 * - Check ID prefix: WS-
 */

const os = require('os');
const path = require('path');
const { WindsurfProjectContext } = require('./context');
const { EMBEDDED_SECRET_PATTERNS, containsEmbeddedSecret } = require('../secret-patterns');
const { validateWindsurfFrontmatter, validateMcpEnvVars } = require('./config-parser');

// ─── Shared helpers ─────────────────────────────────────────────────────────

const FILLER_PATTERNS = [
  /\bbe helpful\b/i,
  /\bbe accurate\b/i,
  /\bbe concise\b/i,
  /\balways do your best\b/i,
  /\bmaintain high quality\b/i,
  /\bwrite clean code\b/i,
  /\bfollow best practices\b/i,
];

function countSections(markdown) {
  return (markdown.match(/^##\s+/gm) || []).length;
}

function firstLineMatching(text, matcher) {
  if (!text) return null;
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

function findFillerLine(content) {
  return firstLineMatching(content, (line) => FILLER_PATTERNS.some((p) => p.test(line)));
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

function allRulesContent(ctx) {
  const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
  return rules.map(r => r.body || '').join('\n');
}

function coreRulesContent(ctx) {
  const always = ctx.alwaysRules ? ctx.alwaysRules() : [];
  return always.map(r => r.body || '').join('\n');
}

function mcpJsonRaw(ctx) {
  return ctx.fileContent('.windsurf/mcp.json') || '';
}

function mcpJsonData(ctx) {
  const result = ctx.mcpConfig();
  return result && result.ok ? result.data : null;
}

function docsBundle(ctx) {
  const rules = allRulesContent(ctx) || '';
  const readme = ctx.fileContent('README.md') || '';
  const legacy = ctx.legacyWindsurfrules ? (ctx.legacyWindsurfrules() || '') : '';
  return `${rules}\n${readme}\n${legacy}`;
}

function expectedVerificationCategories(ctx) {
  const categories = new Set();
  const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
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

function hasArchitecture(content) {
  return /```mermaid|flowchart\b|graph\s+(TD|LR|RL|BT)\b|##\s+Architecture\b|##\s+Project Map\b|##\s+Structure\b/i.test(content);
}

function repoLooksRegulated(ctx) {
  const filenames = (ctx.files || []).join('\n');
  const pkg = ctx.fileContent('package.json') || '';
  const readme = ctx.fileContent('README.md') || '';
  const combined = `${filenames}\n${pkg}\n${readme}`;
  const strong = /\bhipaa\b|\bphi\b|\bpci\b|\bsoc2\b|\biso[- ]?27001\b|\bcompliance\b|\bhealth(?:care)?\b|\bmedical\b|\bbank(?:ing)?\b|\bpayments?\b|\bfintech\b/i;
  if (strong.test(combined)) return true;
  const weakMatches = combined.match(/\bgdpr\b|\bpii\b/gi) || [];
  return weakMatches.length >= 2;
}

function memoryContents(ctx) {
  const memories = ctx.memoryContents ? ctx.memoryContents() : [];
  return memories.map(m => m.content || '').join('\n');
}

function workflowContents(ctx) {
  const files = ctx.workflowFiles ? ctx.workflowFiles() : [];
  return files.map(f => ctx.fileContent(f) || '').join('\n');
}

function wordCount(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

// ─── WINDSURF_TECHNIQUES ──────────────────────────────────────────────────────

const WINDSURF_TECHNIQUES = {

  // =============================================
  // A. Rules (9 checks) — WS-A01..WS-A09
  // =============================================

  windsurfRulesExist: {
    id: 'WS-A01',
    name: '.windsurf/rules/ directory exists with .md files',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      return rules.length > 0;
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Create .windsurf/rules/ directory with at least one .md rule file with YAML frontmatter.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfNoLegacyWindsurfrules: {
    id: 'WS-A02',
    name: 'No .windsurfrules without migration to .windsurf/rules/',
    check: (ctx) => {
      const hasLegacy = ctx.hasLegacyRules ? ctx.hasLegacyRules() : Boolean(ctx.fileContent('.windsurfrules'));
      return !hasLegacy;
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Migrate .windsurfrules to .windsurf/rules/*.md with proper YAML frontmatter.',
    template: 'windsurf-legacy-migration',
    file: () => '.windsurfrules',
    line: () => 1,
  },

  windsurfAlwaysRuleExists: {
    id: 'WS-A03',
    name: 'At least one rule has trigger: always for Cascade',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      return rules.some(r => r.ruleType === 'always');
    },
    impact: 'high',
    rating: 5,
    category: 'rules',
    fix: 'Add trigger: always to your core rule file so Cascade always sees instructions.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesValidFrontmatter: {
    id: 'WS-A04',
    name: 'Rules have valid YAML frontmatter',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      return rules.every(r => {
        if (!r.frontmatter) return false;
        const validation = validateWindsurfFrontmatter(r.frontmatter);
        return validation.valid;
      });
    },
    impact: 'high',
    rating: 4,
    category: 'rules',
    fix: 'Fix YAML frontmatter in rule .md files. Use: trigger, description, globs, name fields.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => 1,
  },

  windsurfRulesUnder10kChars: {
    id: 'WS-A05',
    name: 'Rules under 10K character limit per file',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      return rules.every(r => !r.overLimit);
    },
    impact: 'high',
    rating: 4,
    category: 'rules',
    fix: 'Split rules over 10K characters into multiple focused files. Windsurf enforces a 10K char limit per rule.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesUnder500Words: {
    id: 'WS-A06',
    name: 'Rules are under ~500 words each (longer = less reliably followed)',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      return rules.every(r => wordCount(r.body) <= 500);
    },
    impact: 'medium',
    rating: 3,
    category: 'rules',
    fix: 'Split long rules into focused, shorter files. Rules over ~500 words are less reliably followed.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesNoFiller: {
    id: 'WS-A07',
    name: 'No generic filler instructions in rules',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return !FILLER_PATTERNS.some(p => p.test(content));
    },
    impact: 'low',
    rating: 3,
    category: 'rules',
    fix: 'Replace generic filler like "be helpful" with concrete, repo-specific guidance.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => {
      const content = allRulesContent({ windsurfRules: () => [] });
      return content ? findFillerLine(content) : null;
    },
  },

  windsurfRulesNoSecrets: {
    id: 'WS-A08',
    name: 'No secrets/API keys in rule files',
    check: (ctx) => {
      const rulesContent = allRulesContent(ctx);
      const workflowContent = (ctx.workflowFiles ? ctx.workflowFiles() : [])
        .map(f => ctx.fileContent(f) || '').join('\n');
      const combined = `${rulesContent}\n${workflowContent}`;
      if (!combined.trim()) return null;
      return !containsEmbeddedSecret(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Remove API keys and secrets from rule and workflow files. Use environment variables instead.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfAgentRequestedDescriptions: {
    id: 'WS-A09',
    name: 'Agent-Requested rules have precise descriptions',
    check: (ctx) => {
      const agentRules = ctx.agentRequestedRules ? ctx.agentRequestedRules() : [];
      if (agentRules.length === 0) return null;
      return agentRules.every(r => {
        const desc = r.frontmatter && r.frontmatter.description;
        return desc && String(desc).trim().length >= 15;
      });
    },
    impact: 'medium',
    rating: 3,
    category: 'rules',
    fix: 'Add clear, specific descriptions (15+ chars) to Agent-Requested rules so Cascade can judge relevance.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  // =============================================
  // B. Config (7 checks) — WS-B01..WS-B07
  // =============================================

  windsurfMcpJsonExists: {
    id: 'WS-B01',
    name: '.windsurf/mcp.json exists if MCP is used',
    check: (ctx) => {
      const result = ctx.mcpConfig();
      if (result.ok) return true;
      const globalResult = ctx.globalMcpConfig ? ctx.globalMcpConfig() : { ok: false };
      if (!globalResult.ok) return null;
      return false;
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Create .windsurf/mcp.json with project-level MCP server configuration.',
    template: 'windsurf-mcp',
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMcpTeamWhitelist: {
    id: 'WS-B02',
    name: 'MCP servers on team whitelist (if team)',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const count = Object.keys(servers).length;
      if (count === 0) return null;
      // Check if rules mention team whitelist / approved servers
      const docs = docsBundle(ctx);
      if (!/team|org|enterprise/i.test(docs)) return null;
      return /whitelist|allowlist|approved.*server|mcp.*approv/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Document MCP server team whitelist. Windsurf supports team-level MCP whitelisting.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfWorkflowsExist: {
    id: 'WS-B03',
    name: 'Workflow slash commands exist in .windsurf/workflows/',
    check: (ctx) => {
      const files = ctx.workflowFiles ? ctx.workflowFiles() : [];
      return files.length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Create .windsurf/workflows/*.md files for reusable slash command workflows.',
    template: 'windsurf-workflows',
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  windsurfCascadeignoreExists: {
    id: 'WS-B04',
    name: '.cascadeignore exists for sensitive file exclusion',
    check: (ctx) => {
      const hasCascadeignore = ctx.hasCascadeignore ? ctx.hasCascadeignore() : Boolean(ctx.fileContent('.cascadeignore'));
      if (hasCascadeignore) return true;
      // N/A if no sensitive file signals
      const hasSecrets = ctx.fileContent('.env') || ctx.fileContent('.env.local') || ctx.hasDir('secrets');
      if (!hasSecrets) return null;
      return false;
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Create .cascadeignore to exclude sensitive files from Cascade agent access (similar to .gitignore syntax).',
    template: 'windsurf-cascadeignore',
    file: () => '.cascadeignore',
    line: () => null,
  },

  windsurfMemoriesConfigured: {
    id: 'WS-B05',
    name: 'Memories configured for persistent context',
    check: (ctx) => {
      const memories = ctx.memoryFiles ? ctx.memoryFiles() : [];
      return memories.length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Create .windsurf/memories/ files for team-syncable persistent context.',
    template: 'windsurf-memories',
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfMcpValidJson: {
    id: 'WS-B06',
    name: 'MCP config is valid JSON',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      const result = ctx.mcpConfig();
      return result && result.ok;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Fix malformed JSON in .windsurf/mcp.json.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: (ctx) => {
      const result = ctx.mcpConfig();
      if (result && result.ok) return null;
      if (result && result.error) {
        const match = result.error.match(/position (\d+)/i);
        if (match) {
          const raw = mcpJsonRaw(ctx);
          return raw ? raw.slice(0, Number(match[1])).split('\n').length : 1;
        }
      }
      return 1;
    },
  },

  windsurfWorkflowsClear: {
    id: 'WS-B07',
    name: 'Workflow .md files have clear prompts',
    check: (ctx) => {
      const files = ctx.workflowFiles ? ctx.workflowFiles() : [];
      if (files.length === 0) return null;
      return files.every(f => {
        const content = ctx.fileContent(f);
        return content && content.trim().length >= 20;
      });
    },
    impact: 'low',
    rating: 2,
    category: 'config',
    fix: 'Ensure workflow files have clear, actionable prompt content (20+ chars).',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  // =============================================
  // C. Trust & Safety (9 checks) — WS-C01..WS-C09
  // =============================================

  windsurfCascadeignoreSensitive: {
    id: 'WS-C01',
    name: 'Cascadeignore covers sensitive directories and files',
    check: (ctx) => {
      const content = ctx.cascadeignoreContent ? ctx.cascadeignoreContent() : ctx.fileContent('.cascadeignore');
      if (!content) return null;
      // Check for common sensitive patterns
      return /\.env|secrets|credentials|\.aws|\.ssh|private/i.test(content);
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Add sensitive file patterns (.env, secrets/, credentials, .aws/, .ssh/) to .cascadeignore.',
    template: null,
    file: () => '.cascadeignore',
    line: () => null,
  },

  windsurfNoSecretsInConfig: {
    id: 'WS-C02',
    name: 'No secrets in any Windsurf config files',
    check: (ctx) => {
      const rulesContent = allRulesContent(ctx);
      const mcpContent = mcpJsonRaw(ctx);
      const memContent = memoryContents(ctx);
      const combined = `${rulesContent}\n${mcpContent}\n${memContent}`;
      if (!combined.trim()) return null;
      return !containsEmbeddedSecret(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove secrets from all Windsurf config files. Use environment variables instead.',
    template: null,
    file: () => '.windsurf/',
    line: () => null,
  },

  windsurfMcpTrustedSources: {
    id: 'WS-C03',
    name: 'MCP servers from trusted sources',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      const knownVulnerable = /mcp-poisoned|cve-2025/i.test(raw);
      const hasUntrusted = /curl.*\|.*sh|wget.*\|.*sh/i.test(raw);
      return !knownVulnerable && !hasUntrusted;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Verify MCP servers are from trusted sources. Check for known MCP CVEs.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMcpEnvVarSyntax: {
    id: 'WS-C04',
    name: 'MCP env vars use proper syntax (not hardcoded)',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      const data = mcpJsonData(ctx);
      if (!data) return null;
      const validation = validateMcpEnvVars(data);
      return validation.valid;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Use ${env:VAR_NAME} syntax for MCP environment variables instead of hardcoded values.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfNoDirectPushMain: {
    id: 'WS-C05',
    name: 'Rules discourage direct push to main',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      const hasPushToMain = /push.*main|commit.*main.*direct|direct.*push/i.test(rules);
      return !hasPushToMain;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Ensure rules guide Cascade to create branches and PRs, not push directly to main.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfMemoriesNoSecrets: {
    id: 'WS-C06',
    name: 'No secrets in memory files (team-synced!)',
    check: (ctx) => {
      const content = memoryContents(ctx);
      if (!content.trim()) return null;
      return !containsEmbeddedSecret(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove secrets from .windsurf/memories/ — these files sync across team members!',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfCodeReversionRisk: {
    id: 'WS-C07',
    name: 'Code reversion risk mitigated',
    check: (ctx) => {
      const vscodeRaw = ctx.fileContent('.vscode/settings.json') || '';
      const hasFormatOnSave = /formatOnSave.*true/i.test(vscodeRaw);
      if (!hasFormatOnSave) return null;
      const rules = allRulesContent(ctx);
      return /code reversion|format.*save.*conflict|revert|format.*save.*warning/i.test(rules);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Document code reversion risk: format-on-save + agent edits can cause silent code loss.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfTeamSyncAware: {
    id: 'WS-C08',
    name: 'Team sync implications documented',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/team|org/i.test(docs)) return null;
      return /team.*sync|shared.*memor|team.*whitelist|sync.*across/i.test(docs);
    },
    impact: 'medium',
    rating: 4,
    category: 'trust',
    fix: 'Document team sync implications for memories and MCP whitelist.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfNoWildcardWorkflows: {
    id: 'WS-C09',
    name: 'No overly broad workflow triggers',
    check: (ctx) => {
      const content = workflowContents(ctx);
      if (!content.trim()) return null;
      const hasBroad = /trigger:.*\*|on:.*\*|all.*files/i.test(content);
      return !hasBroad;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Scope workflow triggers to specific patterns. Avoid wildcards.',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  // =============================================
  // D. Cascade Agent (5 checks) — WS-D01..WS-D05
  // =============================================

  windsurfRulesReachCascade: {
    id: 'WS-D01',
    name: 'Rules properly reach Cascade (not just .windsurfrules)',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      const hasLegacy = ctx.hasLegacyRules ? ctx.hasLegacyRules() : false;
      if (rules.length === 0 && !hasLegacy) return null;
      return rules.length > 0;
    },
    impact: 'critical',
    rating: 5,
    category: 'cascade-agent',
    fix: 'Create .windsurf/rules/*.md files with proper frontmatter. .windsurfrules may be deprecated.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfCascadeMultiFile: {
    id: 'WS-D02',
    name: 'Cascade multi-file editing awareness documented',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /multi.?file|cross.?file|cascade.*edit|multiple.*file/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'cascade-agent',
    fix: 'Document Cascade multi-file editing capabilities and any project-specific constraints.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfCascadeStepsAwareness: {
    id: 'WS-D03',
    name: 'Steps automation awareness documented',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /steps|automation|step.?by.?step|cascade.*step/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'cascade-agent',
    fix: 'Document Cascade Steps automation capabilities for complex multi-step tasks.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfSessionLengthAwareness: {
    id: 'WS-D04',
    name: 'Agent session length awareness',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /session.*length|session.*limit|context.*drift|long.*session/i.test(rules);
    },
    impact: 'low',
    rating: 2,
    category: 'cascade-agent',
    fix: 'Document session length recommendations. Long sessions may lose Cascade context.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfSkillsConfigured: {
    id: 'WS-D05',
    name: 'Cascade skills configured for project needs',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /skill|capability|tool.*use|cascade.*skill/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'cascade-agent',
    fix: 'Configure Cascade skills relevant to the project (web search, file editing, terminal, etc.).',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  // =============================================
  // E. MCP (5 checks) — WS-E01..WS-E05
  // =============================================

  windsurfMcpPerSurface: {
    id: 'WS-E01',
    name: 'MCP servers configured per surface (project + global)',
    check: (ctx) => {
      const project = ctx.mcpConfig();
      if (!project.ok) return null;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Configure project-level MCP in .windsurf/mcp.json. Global config at ~/.windsurf/mcp.json.',
    template: 'windsurf-mcp',
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMcpProjectOverride: {
    id: 'WS-E02',
    name: 'Project mcp.json overrides global correctly',
    check: (ctx) => {
      const project = ctx.mcpConfig();
      const global = ctx.globalMcpConfig ? ctx.globalMcpConfig() : { ok: false };
      if (!project.ok || !global.ok) return null;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Ensure project .windsurf/mcp.json and global ~/.windsurf/mcp.json are both valid JSON.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMcpEnvVarFormat: {
    id: 'WS-E03',
    name: 'MCP env vars use ${env:VAR} syntax',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      const data = mcpJsonData(ctx);
      if (!data) return null;
      const validation = validateMcpEnvVars(data);
      return validation.valid;
    },
    impact: 'high',
    rating: 5,
    category: 'mcp',
    fix: 'Use ${env:VAR_NAME} syntax for MCP environment variables instead of hardcoded values.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMcpCurrentVersion: {
    id: 'WS-E04',
    name: 'MCP servers are current version',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      const hasStale = /\b\d+\.\d+\.\d+\b/.test(raw) && !/@latest\b/.test(raw);
      return !hasStale;
    },
    impact: 'low',
    rating: 2,
    category: 'mcp',
    fix: 'Use @latest for MCP packages or regularly update pinned versions.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMcpTeamWhitelistActive: {
    id: 'WS-E05',
    name: 'Team MCP whitelist active for controlled environments',
    check: (ctx) => {
      const mcp = mcpJsonData(ctx);
      if (!mcp) return null;
      const docs = docsBundle(ctx);
      if (!/team|enterprise/i.test(docs)) return null;
      return /whitelist|allowlist|approved/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Enable MCP team whitelist for controlled environments.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  // =============================================
  // F. Instructions Quality (5 checks) — WS-F01..WS-F05
  // =============================================

  windsurfRulesIncludeCommands: {
    id: 'WS-F01',
    name: 'Rules include build/test/lint commands',
    check: (ctx) => {
      const content = coreRulesContent(ctx) || allRulesContent(ctx);
      if (!content.trim()) return null;
      const expected = expectedVerificationCategories(ctx);
      if (expected.length === 0) return /\bverify\b|\btest\b|\blint\b|\bbuild\b/i.test(content);
      return expected.every(cat => hasCommandMention(content, cat));
    },
    impact: 'high',
    rating: 5,
    category: 'instructions-quality',
    fix: 'Add actual build/test/lint commands to your core rules so Cascade can verify changes.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesArchitecture: {
    id: 'WS-F02',
    name: 'Rules include architecture section or Mermaid diagram',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return hasArchitecture(content);
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions-quality',
    fix: 'Add an architecture section or Mermaid diagram to your core rule to orient Cascade.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesVerification: {
    id: 'WS-F03',
    name: 'Rules mention verification/testing expectations',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /\bverif|\btest.*before|\bbefore.*commit|\brun test|\bensure test/i.test(content);
    },
    impact: 'high',
    rating: 5,
    category: 'instructions-quality',
    fix: 'Add verification expectations: Cascade should run tests before declaring a task complete.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesNoContradictions: {
    id: 'WS-F04',
    name: 'No contradictions between rules',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length < 2) return null;
      const combined = rules.map(r => r.body || '').join('\n');
      const hasContradiction = /\bnever use.*\balways use|\balways.*\bnever/i.test(combined);
      return !hasContradiction;
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions-quality',
    fix: 'Review rules for contradictions. Windsurf concatenates all matching rules.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRulesProjectSpecific: {
    id: 'WS-F05',
    name: 'Rules reference project-specific patterns (not generic)',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      const projectName = (pkg && pkg.name) || path.basename(ctx.dir);
      const hasSpecific = content.includes(projectName) ||
        /src\/|app\/|api\/|routes\/|services\/|components\/|lib\/|cmd\//i.test(content);
      return hasSpecific;
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions-quality',
    fix: 'Reference actual project directories and patterns in rules instead of generic instructions.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  // =============================================
  // G. Workflows & Steps (5 checks) — WS-G01..WS-G05
  // =============================================

  windsurfWorkflowsDocumented: {
    id: 'WS-G01',
    name: 'Workflows have clear documentation',
    check: (ctx) => {
      const files = ctx.workflowFiles ? ctx.workflowFiles() : [];
      if (files.length === 0) return null;
      return files.every(f => {
        const content = ctx.fileContent(f) || '';
        return /name:|description:|##\s+/i.test(content);
      });
    },
    impact: 'high',
    rating: 4,
    category: 'workflows',
    fix: 'Document each workflow with name, description, and clear instructions.',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  windsurfWorkflowsNoOverlap: {
    id: 'WS-G02',
    name: 'Workflows do not overlap in scope',
    check: (ctx) => {
      const files = ctx.workflowFiles ? ctx.workflowFiles() : [];
      if (files.length < 2) return null;
      // Basic check: workflow files have distinct names
      const names = files.map(f => f.split('/').pop().replace('.md', '').toLowerCase());
      return new Set(names).size === names.length;
    },
    impact: 'medium',
    rating: 3,
    category: 'workflows',
    fix: 'Ensure workflow files have distinct names and non-overlapping responsibilities.',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  windsurfStepsIntegrated: {
    id: 'WS-G03',
    name: 'Steps automation integrated with rules',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /step|workflow|slash.*command|automat/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'workflows',
    fix: 'Reference Steps automation in rules to guide Cascade on when to use automated workflows.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfWorkflowsScopedActions: {
    id: 'WS-G04',
    name: 'Workflows have scoped, safe actions',
    check: (ctx) => {
      const content = workflowContents(ctx);
      if (!content.trim()) return null;
      const hasDangerous = /rm -rf|drop table|force push|--force|delete.*all/i.test(content);
      return !hasDangerous;
    },
    impact: 'high',
    rating: 5,
    category: 'workflows',
    fix: 'Remove dangerous commands from workflows. Workflows should be safe and reversible.',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  windsurfWorkflowsVersioned: {
    id: 'WS-G05',
    name: 'Workflow files are version-controlled',
    check: (ctx) => {
      const files = ctx.workflowFiles ? ctx.workflowFiles() : [];
      if (files.length === 0) return null;
      // Assume if in .windsurf/workflows/ they should be committed
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'workflows',
    fix: 'Ensure .windsurf/workflows/ files are committed to version control.',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  // =============================================
  // H. Memories (5 checks) — WS-H01..WS-H05
  // =============================================

  windsurfMemoriesDocumented: {
    id: 'WS-H01',
    name: 'Memories have clear structure and purpose',
    check: (ctx) => {
      const memories = ctx.memoryContents ? ctx.memoryContents() : [];
      if (memories.length === 0) return null;
      return memories.every(m => {
        const content = m.content || '';
        return content.trim().length >= 20 && /##\s+|\btitle\b|\bpurpose\b|\bcontext\b/i.test(content);
      });
    },
    impact: 'medium',
    rating: 3,
    category: 'memories',
    fix: 'Structure memory files with clear titles and purpose sections.',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfMemoriesTeamSafe: {
    id: 'WS-H02',
    name: 'Memories are safe for team sync (no personal data)',
    check: (ctx) => {
      const content = memoryContents(ctx);
      if (!content.trim()) return null;
      const hasPersonal = /\bpassword\b|\btoken\b|\bapi.?key\b|\bsecret\b|\bprivate.?key\b/i.test(content);
      return !hasPersonal;
    },
    impact: 'high',
    rating: 5,
    category: 'memories',
    fix: 'Remove personal data and secrets from memories. These sync across team members.',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfMemoriesFocused: {
    id: 'WS-H03',
    name: 'Memory files are focused (not catch-all)',
    check: (ctx) => {
      const memories = ctx.memoryContents ? ctx.memoryContents() : [];
      if (memories.length === 0) return null;
      return memories.every(m => wordCount(m.content) <= 1000);
    },
    impact: 'low',
    rating: 2,
    category: 'memories',
    fix: 'Keep memory files focused. Split large memories into topic-specific files.',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfMemoriesNotStale: {
    id: 'WS-H04',
    name: 'Memory content is current (not stale)',
    check: (ctx) => {
      const content = memoryContents(ctx);
      if (!content.trim()) return null;
      // Check for date references that are old
      const hasDate = /\b20\d{2}-\d{2}-\d{2}\b/.test(content);
      if (!hasDate) return null; // Can't determine staleness without dates
      return true; // Pass if dates exist (manual review needed)
    },
    impact: 'low',
    rating: 2,
    category: 'memories',
    fix: 'Review memory files for stale content. Update or remove outdated memories.',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfMemoriesConsistentWithRules: {
    id: 'WS-H05',
    name: 'Memories are consistent with rules (no contradictions)',
    check: (ctx) => {
      const memories = memoryContents(ctx);
      const rules = allRulesContent(ctx);
      if (!memories.trim() || !rules.trim()) return null;
      // Simple check: no opposing always/never patterns
      const combined = `${memories}\n${rules}`;
      const hasContradiction = /\bnever use.*\balways use|\balways.*\bnever/i.test(combined);
      return !hasContradiction;
    },
    impact: 'medium',
    rating: 3,
    category: 'memories',
    fix: 'Ensure memories and rules are consistent. Contradictions confuse Cascade.',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  // =============================================
  // I. Enterprise (5 checks) — WS-I01..WS-I05
  // =============================================

  windsurfEnterpriseMcpWhitelist: {
    id: 'WS-I01',
    name: 'MCP team whitelist configured for Enterprise',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /mcp.*whitelist|whitelist.*mcp|approved.*server|team.*mcp/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'enterprise',
    fix: 'Configure MCP team whitelist for Enterprise deployments.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfEnterpriseTeamSync: {
    id: 'WS-I02',
    name: 'Team sync policies configured',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /team.*sync|sync.*policy|shared.*config|team.*memor/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Configure team sync policies for memories and MCP whitelist.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfEnterpriseAuditLogs: {
    id: 'WS-I03',
    name: 'Audit logs enabled',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /audit log|audit trail|tracking/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Enable audit logs for Enterprise tier to track AI code generation.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfEnterpriseSecurityPolicy: {
    id: 'WS-I04',
    name: 'Security policy documented',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /security.*policy|data.*retention|compliance|privacy/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'enterprise',
    fix: 'Document security and data retention policies for Enterprise deployments.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfEnterpriseModelPolicy: {
    id: 'WS-I05',
    name: 'Model access policy defined',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /model.*policy|model.*access|allowed.*model|model.*restriction/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Define model access policy for Enterprise — which models are available to team members.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  // =============================================
  // J. Cascadeignore & Review (4 checks) — WS-J01..WS-J04
  // =============================================

  windsurfCascadeignoreConfigured: {
    id: 'WS-J01',
    name: '.cascadeignore configured for project',
    check: (ctx) => {
      const content = ctx.cascadeignoreContent ? ctx.cascadeignoreContent() : ctx.fileContent('.cascadeignore');
      if (!content) return null;
      return content.trim().split('\n').filter(l => l.trim() && !l.startsWith('#')).length >= 1;
    },
    impact: 'medium',
    rating: 3,
    category: 'cascadeignore',
    fix: 'Configure .cascadeignore with at least one exclusion pattern.',
    template: null,
    file: () => '.cascadeignore',
    line: () => null,
  },

  windsurfCascadeignoreNoOverBroad: {
    id: 'WS-J02',
    name: '.cascadeignore not overly broad (would block Cascade)',
    check: (ctx) => {
      const content = ctx.cascadeignoreContent ? ctx.cascadeignoreContent() : ctx.fileContent('.cascadeignore');
      if (!content) return null;
      const lines = content.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const overbroad = lines.some(l => l.trim() === '*' || l.trim() === '**' || l.trim() === '**/*');
      return !overbroad;
    },
    impact: 'high',
    rating: 4,
    category: 'cascadeignore',
    fix: 'Remove overly broad patterns from .cascadeignore that would block Cascade from all files.',
    template: null,
    file: () => '.cascadeignore',
    line: () => null,
  },

  windsurfReviewInstructionsLength: {
    id: 'WS-J03',
    name: 'Code review instructions within effective length',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      const reviewRules = rules.filter(r =>
        /review|code.*review/i.test(r.name || '') ||
        (r.frontmatter && r.frontmatter.description && /review/i.test(r.frontmatter.description))
      );
      if (reviewRules.length === 0) return null;
      return reviewRules.every(r => wordCount(r.body) <= 400);
    },
    impact: 'medium',
    rating: 3,
    category: 'cascadeignore',
    fix: 'Keep code review instruction rules under ~400 words for reliable Cascade adherence.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfReviewNoAutoMerge: {
    id: 'WS-J04',
    name: 'No auto-merge without human review',
    check: (ctx) => {
      const content = workflowContents(ctx);
      const rules = allRulesContent(ctx);
      const combined = `${content}\n${rules}`;
      if (!combined.trim()) return null;
      return !/auto.*merge|merge.*without.*review/i.test(combined);
    },
    impact: 'high',
    rating: 4,
    category: 'cascadeignore',
    fix: 'Ensure no workflow or rule enables auto-merge without human review.',
    template: null,
    file: () => '.windsurf/workflows/',
    line: () => null,
  },

  // =============================================
  // K. Cross-Surface Consistency (4 checks) — WS-K01..WS-K04
  // =============================================

  windsurfRulesConsistentSurfaces: {
    id: 'WS-K01',
    name: 'Rules consistent across all Windsurf surfaces',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
      if (rules.length === 0 && workflows.length === 0) return null;
      return rules.length > 0;
    },
    impact: 'high',
    rating: 4,
    category: 'cross-surface',
    fix: 'Ensure .windsurf/rules/ are consistent with workflow definitions.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfMcpConsistentSurfaces: {
    id: 'WS-K02',
    name: 'MCP config consistent across project and global',
    check: (ctx) => {
      const project = ctx.mcpConfig();
      if (!project.ok) return null;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'cross-surface',
    fix: 'Document which MCP servers are project-level vs global.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfMemoriesConsistentRules: {
    id: 'WS-K03',
    name: 'Memories consistent with rules',
    check: (ctx) => {
      const memories = ctx.memoryContents ? ctx.memoryContents() : [];
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (memories.length === 0 || rules.length === 0) return null;
      return true; // Detailed contradiction check in WS-H05
    },
    impact: 'high',
    rating: 4,
    category: 'cross-surface',
    fix: 'Ensure memories and rules provide consistent guidance to Cascade.',
    template: null,
    file: () => '.windsurf/memories/',
    line: () => null,
  },

  windsurfCascadeignoreMatchesGitignore: {
    id: 'WS-K04',
    name: '.cascadeignore includes .gitignore sensitive patterns',
    check: (ctx) => {
      const cascadeignore = ctx.cascadeignoreContent ? ctx.cascadeignoreContent() : '';
      const gitignore = ctx.fileContent('.gitignore') || '';
      if (!cascadeignore || !gitignore) return null;
      // Check if cascadeignore covers at least some gitignore patterns
      const gitPatterns = gitignore.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const cascadePatterns = cascadeignore.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      if (gitPatterns.length === 0 || cascadePatterns.length === 0) return null;
      // At least some overlap is expected
      return cascadePatterns.length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'cross-surface',
    fix: 'Ensure .cascadeignore covers sensitive patterns from .gitignore.',
    template: null,
    file: () => '.cascadeignore',
    line: () => null,
  },

  // =============================================
  // L. Quality Deep (7 checks) — WS-L01..WS-L07
  // =============================================

  windsurfModernFeatures: {
    id: 'WS-L01',
    name: 'Rules mention modern Windsurf features (Steps, Memories, Workflows)',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /steps|memories|workflow|cascade|skill|slash command/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Document awareness of modern Windsurf features: Steps, Memories, Workflows, Skills.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfNoDeprecatedPatterns: {
    id: 'WS-L02',
    name: 'No deprecated patterns (.windsurfrules for agent)',
    check: (ctx) => {
      const legacy = ctx.legacyWindsurfrules ? ctx.legacyWindsurfrules() : null;
      if (!legacy) return null;
      return false; // Legacy exists = deprecated pattern
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'Migrate .windsurfrules to .windsurf/rules/*.md with proper YAML frontmatter.',
    template: 'windsurf-legacy-migration',
    file: () => '.windsurfrules',
    line: () => null,
  },

  windsurfRuleCountManageable: {
    id: 'WS-L03',
    name: 'Rule file count is manageable (<20 files)',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      return rules.length < 20;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Keep rule files under 20. Consolidate related rules to avoid context bloat.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfAlwaysRulesMinimized: {
    id: 'WS-L04',
    name: 'Always rules minimized (token cost per message)',
    check: (ctx) => {
      const always = ctx.alwaysRules ? ctx.alwaysRules() : [];
      if (always.length === 0) return null;
      return always.length <= 3;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Minimize Always rules (keep to 1-3). Each adds token cost to every message.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfRuleCharLimitAware: {
    id: 'WS-L05',
    name: 'All rules within 10K char limit',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      return rules.every(r => r.charCount <= 10000);
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'Ensure all rule files are under 10,000 characters. Windsurf enforces this limit.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfCascadeContextAware: {
    id: 'WS-L06',
    name: 'Rules guide Cascade context usage (@-mentions, file refs)',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /@|file.*reference|context.*include|codebase|index/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Guide Cascade on context usage: @-mentions, file references, codebase indexing.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfSessionDriftAwareness: {
    id: 'WS-L07',
    name: 'Session drift awareness documented',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /session.*drift|context.*window|long.*session|session.*length|refresh.*context/i.test(content);
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Document session drift awareness. Long sessions may lose Cascade context.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  // =============================================
  // M. Advisory (4 checks) — WS-M01..WS-M04
  // =============================================

  windsurfAdvisoryInstructionQuality: {
    id: 'WS-M01',
    name: 'Instruction quality score meets advisory threshold',
    check: (ctx) => {
      const content = coreRulesContent(ctx) || allRulesContent(ctx);
      if (!content.trim()) return null;
      const lines = content.split(/\r?\n/).filter(l => l.trim()).length;
      const sections = countSections(content);
      const hasArch = hasArchitecture(content);
      const hasVerify = /\bverif|\btest|\blint|\bbuild/i.test(content);
      const score = (lines >= 30 ? 2 : lines >= 15 ? 1 : 0) +
                    (sections >= 4 ? 2 : sections >= 2 ? 1 : 0) +
                    (hasArch ? 1 : 0) +
                    (hasVerify ? 1 : 0);
      return score >= 4;
    },
    impact: 'medium',
    rating: 4,
    category: 'advisory',
    fix: 'Improve rule quality: add more sections, architecture diagram, and verification commands.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfAdvisorySecurityPosture: {
    id: 'WS-M02',
    name: 'Security posture meets advisory threshold',
    check: (ctx) => {
      let score = 0;
      const docs = docsBundle(ctx);
      if (ctx.hasCascadeignore && ctx.hasCascadeignore()) score++;
      if (!ctx.hasLegacyRules || !ctx.hasLegacyRules()) score++;
      const mcpResult = ctx.mcpConfig();
      if (mcpResult.ok) {
        const validation = validateMcpEnvVars(mcpResult.data);
        if (validation.valid) score++;
      } else {
        score++;
      }
      if (/security|secret|credential/i.test(docs)) score++;
      return score >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'advisory',
    fix: 'Improve security posture: add .cascadeignore, migrate .windsurfrules, secure MCP config.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfAdvisorySurfaceCoverage: {
    id: 'WS-M03',
    name: 'Surface coverage meets advisory threshold',
    check: (ctx) => {
      const surfaces = ctx.detectSurfaces ? ctx.detectSurfaces() : {};
      return surfaces.foreground === true;
    },
    impact: 'medium',
    rating: 4,
    category: 'advisory',
    fix: 'Configure at least the foreground surface with .windsurf/rules/*.md files.',
    template: 'windsurf-rules',
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfAdvisoryMcpHealth: {
    id: 'WS-M04',
    name: 'MCP configuration health meets advisory threshold',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const count = Object.keys(servers).length;
      if (count === 0) return null;
      const mcpResult = ctx.mcpConfig();
      return mcpResult && mcpResult.ok;
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Ensure MCP configuration is valid and servers are properly configured.',
    template: null,
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  // =============================================
  // N. Pack (4 checks) — WS-N01..WS-N04
  // =============================================

  windsurfPackDomainDetected: {
    id: 'WS-N01',
    name: 'Domain pack detection returns relevant results',
    check: (ctx) => {
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      return Boolean(pkg || ctx.fileContent('go.mod') || ctx.fileContent('Cargo.toml') || ctx.fileContent('pyproject.toml'));
    },
    impact: 'low',
    rating: 2,
    category: 'advisory',
    fix: 'Ensure project has identifiable stack markers for domain pack detection.',
    template: null,
    file: () => 'package.json',
    line: () => null,
  },

  windsurfPackMcpRecommended: {
    id: 'WS-N02',
    name: 'MCP packs recommended based on project signals',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      return Object.keys(servers).length > 0;
    },
    impact: 'low',
    rating: 2,
    category: 'advisory',
    fix: 'Add recommended MCP packs to .windsurf/mcp.json based on project domain.',
    template: 'windsurf-mcp',
    file: () => '.windsurf/mcp.json',
    line: () => null,
  },

  windsurfPackGovernanceApplied: {
    id: 'WS-N03',
    name: 'Governance pack applied if enterprise signals detected',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise|business/i.test(docs)) return null;
      return /governance|policy|audit/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Apply governance pack for enterprise repos.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  windsurfPackConsistency: {
    id: 'WS-N04',
    name: 'All applied packs are consistent with each other',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      const mcp = mcpJsonRaw(ctx);
      if (!rules && !mcp) return null;
      const rulesStrict = /\bstrict\b|\blocked.?down\b|\bno auto/i.test(rules);
      const configPermissive = /yolo|auto.*run.*all/i.test(rules);
      return !(rulesStrict && configPermissive);
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Resolve contradictions between rule guidance and configuration.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },

  // =============================================
  // O. Repeat (3 checks) — WS-O01..WS-O03
  // =============================================

  windsurfRepeatScoreImproved: {
    id: 'WS-O01',
    name: 'Audit score improved since last run',
    check: () => null, // Requires snapshot history
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Run audits regularly and track score improvement over time.',
    template: null,
    file: () => null,
    line: () => null,
  },

  windsurfRepeatNoRegressions: {
    id: 'WS-O02',
    name: 'No regressions since last audit',
    check: () => null, // Requires snapshot history
    impact: 'medium',
    rating: 3,
    category: 'freshness',
    fix: 'Review and fix any regressions detected since the last audit.',
    template: null,
    file: () => null,
    line: () => null,
  },

  windsurfRepeatFeedbackLoop: {
    id: 'WS-O03',
    name: 'Feedback loop active for recommendations',
    check: () => null, // Requires feedback data
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Use `npx nerviq --platform windsurf feedback` to rate recommendations.',
    template: null,
    file: () => null,
    line: () => null,
  },

  // =============================================
  // P. Freshness (3 checks) — WS-P01..WS-P03
  // =============================================

  windsurfFreshnessSourcesVerified: {
    id: 'WS-P01',
    name: 'P0 freshness sources verified within threshold',
    check: () => null, // Requires freshness verification data
    impact: 'medium',
    rating: 3,
    category: 'freshness',
    fix: 'Verify P0 Windsurf documentation sources are current before claiming freshness.',
    template: null,
    file: () => null,
    line: () => null,
  },

  windsurfFreshnessPropagation: {
    id: 'WS-P02',
    name: 'Freshness propagation checklist is current',
    check: () => null, // Requires propagation tracking
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Review propagation checklist when Windsurf releases new features or changes.',
    template: null,
    file: () => null,
    line: () => null,
  },

  windsurfFreshnessRuleFormat: {
    id: 'WS-P03',
    name: 'Rule format matches current Windsurf version expectations',
    check: (ctx) => {
      const rules = ctx.windsurfRules ? ctx.windsurfRules() : [];
      if (rules.length === 0) return null;
      // All rules should have YAML frontmatter
      return rules.every(r => r.frontmatter !== null);
    },
    impact: 'medium',
    rating: 3,
    category: 'freshness',
    fix: 'Ensure all rules use current Windsurf format with YAML frontmatter.',
    template: null,
    file: () => '.windsurf/rules/',
    line: () => null,
  },
};

module.exports = {
  WINDSURF_TECHNIQUES,
};
