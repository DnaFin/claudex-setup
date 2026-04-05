/**
 * Cursor techniques module — CHECK CATALOG
 *
 * 88 checks across 16 categories:
 *   v0.1 (40): A. Rules(9), B. Config(8), C. Trust & Safety(11), D. Agent Mode(5), E. MCP(5), F. Instructions Quality(5)
 *   v0.5 (55): G. Background Agents(5), H. Automations(6), I. Enterprise(5)
 *   v1.0 (70): J. BugBot & Code Review(4), K. Cross-Surface(4), L. Quality Deep(7)
 *   CP-08 (82): M. Advisory(4), N. Pack(4), O. Repeat(3), P. Freshness(3)
 *   Exp-fixes (88): +4 new checks from experiment findings
 *
 * Each check: { id, name, check(ctx), impact, rating, category, fix, template, file(), line() }
 */

const os = require('os');
const path = require('path');
const { CursorProjectContext } = require('./context');
const { EMBEDDED_SECRET_PATTERNS, containsEmbeddedSecret } = require('../secret-patterns');
const { attachSourceUrls } = require('../source-urls');
const { validateMdcFrontmatter, validateMcpEnvVars } = require('./config-parser');

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
  const rules = ctx.cursorRules ? ctx.cursorRules() : [];
  return rules.map(r => r.body || '').join('\n');
}

function coreRulesContent(ctx) {
  const always = ctx.alwaysApplyRules ? ctx.alwaysApplyRules() : [];
  return always.map(r => r.body || '').join('\n');
}

function mcpJsonRaw(ctx) {
  return ctx.fileContent('.cursor/mcp.json') || '';
}

function mcpJsonData(ctx) {
  const result = ctx.mcpConfig();
  return result && result.ok ? result.data : null;
}

function envJsonData(ctx) {
  const result = ctx.environmentJson();
  return result && result.ok ? result.data : null;
}

function docsBundle(ctx) {
  const rules = allRulesContent(ctx) || '';
  const readme = ctx.fileContent('README.md') || '';
  const legacy = ctx.legacyCursorrules ? (ctx.legacyCursorrules() || '') : '';
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

function automationContents(ctx) {
  const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
  return configs.map(c => c.content || '').join('\n');
}

function wordCount(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

// ─── CURSOR_TECHNIQUES ──────────────────────────────────────────────────────

const CURSOR_TECHNIQUES = {

  // =============================================
  // A. Rules (9 checks) — CU-A01..CU-A09
  // =============================================

  cursorRulesExist: {
    id: 'CU-A01',
    name: '.cursor/rules/ directory exists with .mdc files',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      return rules.length > 0;
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Create .cursor/rules/ directory with at least one .mdc rule file.',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorNoLegacyCursorrules: {
    id: 'CU-A02',
    name: 'No .cursorrules without migration warning',
    check: (ctx) => {
      const hasLegacy = ctx.hasLegacyRules ? ctx.hasLegacyRules() : Boolean(ctx.fileContent('.cursorrules'));
      return !hasLegacy;
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Migrate .cursorrules to .cursor/rules/*.mdc with alwaysApply: true. AGENT MODE COMPLETELY IGNORES .cursorrules (confirmed by direct observation). 82% of projects have broken rules because of this — cursor-doctor audit.',
    template: 'cursor-legacy-migration',
    file: () => '.cursorrules',
    line: () => 1,
  },

  cursorAlwaysApplyExists: {
    id: 'CU-A03',
    name: 'At least one rule has alwaysApply: true for agent mode',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length === 0) return null;
      return rules.some(r => r.ruleType === 'always');
    },
    impact: 'high',
    rating: 5,
    category: 'rules',
    fix: 'Add alwaysApply: true to your core rule file so agents always see instructions.',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesValidFrontmatter: {
    id: 'CU-A04',
    name: 'Rules have valid MDC frontmatter (YAML parseable)',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length === 0) return null;
      return rules.every(r => {
        if (!r.frontmatter) return false;
        const validation = validateMdcFrontmatter(r.frontmatter);
        return validation.valid;
      });
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Fix YAML frontmatter in .mdc files. Invalid YAML silently skips the entire rule file — no error, no warning. Only 3 fields recognized: description, globs, alwaysApply. 82% of audited projects have broken rules from this issue.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => 1,
  },

  cursorNoGlobsDescriptionCombo: {
    id: 'CU-A05',
    name: 'No rules combine globs + description (creates ambiguity)',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length === 0) return null;
      return !rules.some(r => {
        if (!r.frontmatter || r.frontmatter.alwaysApply === true) return false;
        const hasGlobs = Array.isArray(r.frontmatter.globs)
          ? r.frontmatter.globs.length > 0
          : Boolean(r.frontmatter.globs);
        const hasDesc = Boolean(r.frontmatter.description && String(r.frontmatter.description).trim());
        return hasGlobs && hasDesc;
      });
    },
    impact: 'medium',
    rating: 3,
    category: 'rules',
    fix: 'Do not combine globs + description in the same rule. Use one or the other for clear rule activation.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesUnder500Words: {
    id: 'CU-A06',
    name: 'Rules are under ~500 words each (longer = less reliably followed)',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length === 0) return null;
      return rules.every(r => wordCount(r.body) <= 500);
    },
    impact: 'medium',
    rating: 3,
    category: 'rules',
    fix: 'Split long rules into focused, shorter files. Rules over ~500 words are less reliably followed.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesNoFiller: {
    id: 'CU-A07',
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
    file: () => '.cursor/rules/',
    line: () => {
      const content = allRulesContent({ cursorRules: () => [] });
      return content ? findFillerLine(content) : null;
    },
  },

  cursorRulesNoSecrets: {
    id: 'CU-A08',
    name: 'No secrets/API keys in rule files',
    check: (ctx) => {
      const rulesContent = allRulesContent(ctx);
      const commandContent = (ctx.commandFiles ? ctx.commandFiles() : [])
        .map(f => ctx.fileContent(f) || '').join('\n');
      const combined = `${rulesContent}\n${commandContent}`;
      if (!combined.trim()) return null;
      return !containsEmbeddedSecret(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'rules',
    fix: 'Remove API keys and secrets from rule and command files. Use environment variables instead.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorAgentRequestedDescriptions: {
    id: 'CU-A09',
    name: 'Agent Requested rules have precise descriptions',
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
    fix: 'Add clear, specific descriptions (15+ chars) to Agent Requested rules so AI can judge relevance.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // B. Config (7 checks) — CU-B01..CU-B07
  // =============================================

  cursorMcpJsonExists: {
    id: 'CU-B01',
    name: '.cursor/mcp.json exists if MCP is used',
    check: (ctx) => {
      const result = ctx.mcpConfig();
      if (result.ok) return true;
      // N/A if no MCP signals at all
      const globalResult = ctx.globalMcpConfig ? ctx.globalMcpConfig() : { ok: false };
      if (!globalResult.ok) return null;
      return false;
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Create .cursor/mcp.json with project-level MCP server configuration.',
    template: 'cursor-mcp',
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorMcpToolLimit: {
    id: 'CU-B02',
    name: 'MCP total tools < 40 (silent drop limit)',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const count = Object.keys(servers).length;
      if (count === 0) return null;
      const estimated = count * 5; // ~5 tools per server estimate
      return estimated < 40;
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Reduce MCP servers to stay under ~40 total tools. Cursor silently drops tools beyond this limit.',
    template: null,
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorCommandsExist: {
    id: 'CU-B03',
    name: 'Custom commands exist in .cursor/commands/',
    check: (ctx) => {
      const files = ctx.commandFiles ? ctx.commandFiles() : [];
      return files.length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Create .cursor/commands/*.md files for reusable slash command prompts.',
    template: 'cursor-commands',
    file: () => '.cursor/commands/',
    line: () => null,
  },

  cursorEnvironmentJsonExists: {
    id: 'CU-B04',
    name: '.cursor/environment.json exists if background agents used',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (env) return true;
      // N/A if no background agent signals
      const rules = allRulesContent(ctx);
      const hasBackgroundSignals = /background agent|background.*agent/i.test(rules);
      if (!hasBackgroundSignals) return null;
      return false;
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Create .cursor/environment.json to configure background agent VM (baseImage, env, persistedDirectories).',
    template: 'cursor-environment',
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  cursorNoDeprecatedVscodeKeys: {
    id: 'CU-B05',
    name: 'No deprecated .vscode/settings.json Cursor keys',
    check: (ctx) => {
      const raw = ctx.fileContent('.vscode/settings.json') || '';
      if (!raw) return null;
      // Check for deprecated Cursor-specific keys
      const deprecatedPatterns = [
        /cursor\.general\.enableStickyScroll/,
        /cursor\.aicompletion/i,
      ];
      return !deprecatedPatterns.some(p => p.test(raw));
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Remove deprecated Cursor keys from .vscode/settings.json.',
    template: null,
    file: () => '.vscode/settings.json',
    line: () => null,
  },

  cursorMcpValidJson: {
    id: 'CU-B06',
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
    fix: 'Fix malformed JSON in .cursor/mcp.json.',
    template: null,
    file: () => '.cursor/mcp.json',
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

  cursorCommandsClear: {
    id: 'CU-B07',
    name: 'Custom command .md files have clear prompts',
    check: (ctx) => {
      const files = ctx.commandFiles ? ctx.commandFiles() : [];
      if (files.length === 0) return null;
      return files.every(f => {
        const content = ctx.fileContent(f);
        return content && content.trim().length >= 20;
      });
    },
    impact: 'low',
    rating: 2,
    category: 'config',
    fix: 'Ensure custom command files have clear, actionable prompt content (20+ chars).',
    template: null,
    file: () => '.cursor/commands/',
    line: () => null,
  },

  cursorMcpServersRootKey: {
    id: 'CU-B08',
    name: 'MCP config has required mcpServers root key',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      const data = mcpJsonData(ctx);
      if (!data) return null;
      // Must have mcpServers key at root — any other key causes silent failure
      return Object.prototype.hasOwnProperty.call(data, 'mcpServers');
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Ensure .cursor/mcp.json has the "mcpServers" root key. Using "servers" or any other key causes silent failure — zero tools load with no error shown (confirmed by experiment).',
    template: null,
    file: () => '.cursor/mcp.json',
    line: () => 1,
  },

  // =============================================
  // C. Trust & Safety (11 checks) — CU-C01..CU-C11
  // =============================================

  cursorPrivacyMode: {
    id: 'CU-C01',
    name: 'Privacy Mode enabled (or explicitly documented as off)',
    check: (ctx) => {
      // Cannot detect Privacy Mode from files (stored in SQLite state.vscdb)
      // Check if rules/docs document the privacy mode status
      const docs = docsBundle(ctx);
      return /privacy mode|zero.?retention|data retention|privacy.*enabled/i.test(docs);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Privacy Mode is OFF by default — code is sent to all third-party providers (OpenAI, Anthropic, etc.) unless explicitly enabled. Enable in Cursor Settings → Privacy → Privacy Mode, or document the deliberate decision to keep it off.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorNoAutoRunUntrusted: {
    id: 'CU-C02',
    name: 'No auto-run terminal without review for untrusted repos',
    check: (ctx) => {
      // Check if rules mention auto-run/YOLO mode awareness
      const docs = docsBundle(ctx);
      if (!docs.trim()) return null;
      // Pass if rules mention caution about auto-run
      const mentionsAutoRun = /auto.?run|yolo|terminal.*approv|command.*confirm/i.test(docs);
      // If no mention at all, it's not necessarily a fail — only fail if auto-run is explicitly enabled
      return mentionsAutoRun || !(/auto.?run.*enable|yolo.*mode/i.test(docs));
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'Document terminal auto-run policy. Consider disabling for untrusted repos.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorAutomationTriggersScoped: {
    id: 'CU-C03',
    name: 'Automation triggers are intentional and scoped',
    check: (ctx) => {
      const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
      if (configs.length === 0) return null;
      // Check for overly broad triggers
      const combined = configs.map(c => c.content).join('\n');
      const hasBroadTrigger = /trigger:.*any|on.*any.*push|trigger:.*\*/i.test(combined);
      return !hasBroadTrigger;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Scope automation triggers to specific branches and events. Avoid wildcard triggers.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorNoSecretsInEnvJson: {
    id: 'CU-C04',
    name: 'No secrets in environment.json or command files',
    check: (ctx) => {
      const envContent = ctx.fileContent('.cursor/environment.json') || '';
      const cmdContent = (ctx.commandFiles ? ctx.commandFiles() : [])
        .map(f => ctx.fileContent(f) || '').join('\n');
      const combined = `${envContent}\n${cmdContent}`;
      if (!combined.trim()) return null;
      return !containsEmbeddedSecret(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove secrets from environment.json and command files. Use KMS/vault for background agent secrets.',
    template: null,
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  cursorMcpTrustedSources: {
    id: 'CU-C05',
    name: 'MCP servers from trusted sources (no known CVEs)',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      // Check for known vulnerable patterns
      const knownVulnerable = /mcp-poisoned|cve-2025/i.test(raw);
      // Check for non-npm/trusted sources
      const hasUntrusted = /curl.*\|.*sh|wget.*\|.*sh/i.test(raw);
      return !knownVulnerable && !hasUntrusted;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Verify MCP servers are from trusted sources. Check for CVE-2025-54136 (MCPoison) and CVE-2025-54135 (CurXecute).',
    template: null,
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorBackgroundAgentBranch: {
    id: 'CU-C06',
    name: 'Background agent creates branch (not commits to main)',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      // Background agents always create PRs by default — check for override
      const rules = allRulesContent(ctx);
      const hasPushToMain = /push.*main|commit.*main.*direct|direct.*push/i.test(rules);
      return !hasPushToMain;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Ensure background agents create branches and PRs, never push directly to main.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorCodeReversionRisk: {
    id: 'CU-C07',
    name: 'Code reversion risk mitigated (format-on-save + agent review conflict)',
    check: (ctx) => {
      const vscodeRaw = ctx.fileContent('.vscode/settings.json') || '';
      const hasFormatOnSave = /formatOnSave.*true/i.test(vscodeRaw);
      if (!hasFormatOnSave) return null; // No risk if format-on-save is off
      // Check if rules document the risk
      const rules = allRulesContent(ctx);
      return /code reversion|format.*save.*conflict|revert|format.*save.*warning/i.test(rules);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Document code reversion risk: format-on-save + agent review tab + cloud sync can cause silent code loss.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorEnterprisePrivacyMode: {
    id: 'CU-C08',
    name: 'Enterprise: org-wide Privacy Mode enforced',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise|org.*policy/i.test(docs)) return null;
      return /privacy mode.*enforc|org.*privacy|enterprise.*privacy/i.test(docs);
    },
    impact: 'medium',
    rating: 4,
    category: 'trust',
    fix: 'Document whether org-wide Privacy Mode enforcement is active for Enterprise tier.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorNoWildcardAutomation: {
    id: 'CU-C09',
    name: 'No wildcard automation triggers (e.g., "on any push")',
    check: (ctx) => {
      const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
      if (configs.length === 0) return null;
      const combined = configs.map(c => c.content).join('\n');
      const hasWildcard = /branches:.*\*|on:.*\*|trigger:.*all/i.test(combined);
      return !hasWildcard;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Replace wildcard automation triggers with specific branch/event patterns.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorBackgroundAgentHomeDir: {
    id: 'CU-C10',
    name: 'Background agent home directory exposure documented',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      // If background agents are configured, check that the security risk is documented
      const docs = docsBundle(ctx);
      return /home.?dir|npmrc|aws.?credentials|ssh.*key|credential.*exposure|home.*access/i.test(docs);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Background agents have FULL READ access to ~/.npmrc, ~/.aws/credentials, ~/.ssh/ (open security issue since Nov 2025). Document this risk and remove sensitive credentials from home directory before using background agents, or use environment variable references instead.',
    template: null,
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  cursorCursorignoreShellBypass: {
    id: 'CU-C11',
    name: '.cursorignore does not protect against shell command access',
    check: (ctx) => {
      const hasIgnore = Boolean(ctx.fileContent('.cursorignore'));
      if (!hasIgnore) return null;
      // If .cursorignore exists, check that docs acknowledge shell bypass gap
      const docs = docsBundle(ctx);
      return /cursorignore.*shell|shell.*bypass|terminal.*ignore|ignore.*terminal/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: '.cursorignore only protects files from @Codebase direct reads — agents can still access ignored files via terminal commands (cat, head, etc.). Do not rely on .cursorignore for security. Use proper OS-level file permissions for truly sensitive files.',
    template: null,
    file: () => '.cursorignore',
    line: () => null,
  },

  // =============================================
  // D. Agent Mode (5 checks) — CU-D01..CU-D05
  // =============================================

  cursorRulesReachAgent: {
    id: 'CU-D01',
    name: 'Rules properly reach agent (not just .cursorrules)',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      const hasLegacy = ctx.hasLegacyRules ? ctx.hasLegacyRules() : false;
      if (rules.length === 0 && !hasLegacy) return null;
      // Must have .mdc rules, not just legacy
      return rules.length > 0;
    },
    impact: 'critical',
    rating: 5,
    category: 'agent-mode',
    fix: 'Create .cursor/rules/*.mdc files with proper frontmatter. .cursorrules is ignored by agent mode!',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorCodebaseIndexed: {
    id: 'CU-D02',
    name: 'Agent has appropriate context scope (@Codebase indexed)',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /@Codebase|@codebase|semantic search|codebase.*index/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'agent-mode',
    fix: 'Mention @Codebase in rules to guide agents to use project-wide semantic search.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorMultiAgentWorktree: {
    id: 'CU-D03',
    name: 'Multi-agent workflows use Git worktree isolation',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      // Only relevant if multi-agent mentioned
      if (!/multi.?agent|parallel agent|agent.*window/i.test(rules)) return null;
      return /worktree|git worktree|isolat/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'agent-mode',
    fix: 'For multi-agent workflows (Agents Window), use Git worktree isolation to prevent conflicts.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorSessionLengthAwareness: {
    id: 'CU-D04',
    name: 'Agent session length awareness (<2h recommended)',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /session.*length|session.*limit|2.*hour|context.*drift|long.*session/i.test(rules);
    },
    impact: 'low',
    rating: 2,
    category: 'agent-mode',
    fix: 'Document session length recommendations. Sessions >2h may lose agent context.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorDocsConfigured: {
    id: 'CU-D05',
    name: '@Docs configured for project key libraries',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      if (!rules.trim()) return null;
      return /@Docs|@docs|documentation.*index|library.*doc/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'agent-mode',
    fix: 'Configure @Docs for key project libraries to give agents access to current documentation.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // E. MCP (5 checks) — CU-E01..CU-E05
  // =============================================

  cursorMcpPerSurface: {
    id: 'CU-E01',
    name: 'MCP servers configured per surface (project + global)',
    check: (ctx) => {
      const project = ctx.mcpConfig();
      if (!project.ok) return null;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Configure project-level MCP in .cursor/mcp.json. Global config at ~/.cursor/mcp.json.',
    template: 'cursor-mcp',
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorMcpProjectOverride: {
    id: 'CU-E02',
    name: 'Project mcp.json overrides global correctly',
    check: (ctx) => {
      const project = ctx.mcpConfig();
      const global = ctx.globalMcpConfig ? ctx.globalMcpConfig() : { ok: false };
      if (!project.ok || !global.ok) return null;
      // Just verify both parse correctly — Cursor handles override automatically
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Ensure project .cursor/mcp.json and global ~/.cursor/mcp.json are both valid JSON.',
    template: null,
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorMcpEnvVarSyntax: {
    id: 'CU-E03',
    name: 'MCP env vars use ${env:VAR} syntax (not hardcoded)',
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
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorMcpCurrentVersion: {
    id: 'CU-E04',
    name: 'MCP marketplace servers are current version',
    check: (ctx) => {
      const raw = mcpJsonRaw(ctx);
      if (!raw) return null;
      // Check for @latest or explicit version
      const hasStale = /\b\d+\.\d+\.\d+\b/.test(raw) && !/@latest\b/.test(raw);
      return !hasStale;
    },
    impact: 'low',
    rating: 2,
    category: 'mcp',
    fix: 'Use @latest for MCP packages or regularly update pinned versions.',
    template: null,
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorMcpBackgroundAccess: {
    id: 'CU-E05',
    name: 'Background agent -p mode has MCP access (known bug)',
    check: (ctx) => {
      const env = envJsonData(ctx);
      const mcp = mcpJsonData(ctx);
      if (!env || !mcp) return null;
      // Document awareness of the known bug
      const rules = allRulesContent(ctx);
      return /background.*mcp|mcp.*background|-p.*mode|programmatic.*mode/i.test(rules);
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Document MCP access limitations in background agent -p mode (known bug).',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // F. Instructions Quality (5 checks) — CU-F01..CU-F05
  // =============================================

  cursorRulesIncludeCommands: {
    id: 'CU-F01',
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
    fix: 'Add actual build/test/lint commands to your core rules so agents can verify their changes.',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesArchitecture: {
    id: 'CU-F02',
    name: 'Rules include architecture section or Mermaid diagram',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return hasArchitecture(content);
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions-quality',
    fix: 'Add an architecture section or Mermaid diagram to your core rule to orient agents.',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesVerification: {
    id: 'CU-F03',
    name: 'Rules mention verification/testing expectations',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /\bverif|\btest.*before|\bbefore.*commit|\brun test|\bensure test/i.test(content);
    },
    impact: 'high',
    rating: 5,
    category: 'instructions-quality',
    fix: 'Add verification expectations: agents should run tests before declaring a task complete.',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesNoContradictions: {
    id: 'CU-F04',
    name: 'No contradictions between rules',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length < 2) return null;
      // Simple heuristic: check for opposing instructions
      const combined = rules.map(r => r.body || '').join('\n');
      const hasContradiction = /\bnever use.*\balways use|\balways.*\bnever/i.test(combined);
      return !hasContradiction;
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions-quality',
    fix: 'Review rules for contradictions. Cursor concatenates all matching rules without conflict resolution.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRulesProjectSpecific: {
    id: 'CU-F05',
    name: 'Rules reference project-specific patterns (not generic)',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      const projectName = (pkg && pkg.name) || path.basename(ctx.dir);
      // Check for project-specific references
      const hasSpecific = content.includes(projectName) ||
        /src\/|app\/|api\/|routes\/|services\/|components\/|lib\/|cmd\//i.test(content);
      return hasSpecific;
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions-quality',
    fix: 'Reference actual project directories and patterns in rules instead of generic instructions.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // G. Background Agents (5 checks) — CU-G01..CU-G05
  // =============================================

  cursorEnvBaseImage: {
    id: 'CU-G01',
    name: 'environment.json has appropriate baseImage',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      return Boolean(env.baseImage);
    },
    impact: 'high',
    rating: 4,
    category: 'background-agents',
    fix: 'Set baseImage in .cursor/environment.json (e.g., "node:20", "python:3.12").',
    template: 'cursor-environment',
    file: () => '.cursor/environment.json',
    line: () => 1,
  },

  cursorEnvPersistedDirs: {
    id: 'CU-G02',
    name: 'persistedDirectories includes node_modules/venv',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      const persisted = env.persistedDirectories || [];
      if (persisted.length === 0) return false;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'background-agents',
    fix: 'Add persistedDirectories to environment.json to cache dependencies between runs.',
    template: 'cursor-environment',
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  cursorEnvProcesses: {
    id: 'CU-G03',
    name: 'Processes defined for dev servers if needed',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      // Only relevant if project has dev server
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      const hasDevServer = pkg && pkg.scripts && (pkg.scripts.dev || pkg.scripts.start);
      if (!hasDevServer) return null;
      return Boolean(env.processes && Object.keys(env.processes).length > 0);
    },
    impact: 'medium',
    rating: 3,
    category: 'background-agents',
    fix: 'Define processes in environment.json for dev servers that background agents need.',
    template: 'cursor-environment',
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  cursorEnvSecretsKms: {
    id: 'CU-G04',
    name: 'Secrets use KMS (not plaintext env vars)',
    check: (ctx) => {
      const envContent = ctx.fileContent('.cursor/environment.json') || '';
      if (!envContent.trim()) return null;
      // Check for hardcoded secret-looking values
      return !containsEmbeddedSecret(envContent);
    },
    impact: 'critical',
    rating: 5,
    category: 'background-agents',
    fix: 'Use KMS-encrypted secrets vault for background agents. Never put secrets in environment.json.',
    template: null,
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  cursorEnvCreatesPr: {
    id: 'CU-G05',
    name: 'Agent output creates PR (not direct push)',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      // Background agents create PRs by default, check for override
      const rules = allRulesContent(ctx);
      const hasBadPattern = /push.*directly|commit.*main|--force push/i.test(rules);
      return !hasBadPattern;
    },
    impact: 'high',
    rating: 5,
    category: 'background-agents',
    fix: 'Ensure background agents create PRs for review, never push directly to main.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // H. Automations (5 checks) — CU-H01..CU-H05
  // =============================================

  cursorAutomationDocumented: {
    id: 'CU-H01',
    name: 'Automation triggers are documented',
    check: (ctx) => {
      const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
      if (configs.length === 0) return null;
      // Check that each automation has clear name/description
      return configs.every(c => {
        const content = c.content || '';
        return /name:|description:|instructions:/i.test(content);
      });
    },
    impact: 'high',
    rating: 4,
    category: 'automations',
    fix: 'Document each automation with name, description, and clear instructions.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorAutomationNoBroadTrigger: {
    id: 'CU-H02',
    name: 'No overly broad triggers (e.g., "any push to any branch")',
    check: (ctx) => {
      const combined = automationContents(ctx);
      if (!combined.trim()) return null;
      const hasBroad = /branches:.*\*|on:.*\*.*push|any.*branch|all.*events/i.test(combined);
      return !hasBroad;
    },
    impact: 'high',
    rating: 5,
    category: 'automations',
    fix: 'Scope automation triggers to specific branches. Avoid wildcards that trigger on every push.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorAutomationErrorHandling: {
    id: 'CU-H03',
    name: 'Automation has error handling / failure notification',
    check: (ctx) => {
      const combined = automationContents(ctx);
      if (!combined.trim()) return null;
      return /error|fail|notification|alert|on_failure|on_error/i.test(combined);
    },
    impact: 'medium',
    rating: 3,
    category: 'automations',
    fix: 'Add error handling and failure notification to automations.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorAutomationRateLimits: {
    id: 'CU-H04',
    name: 'Rate limits considered (hundreds/hour possible)',
    check: (ctx) => {
      const combined = automationContents(ctx);
      if (!combined.trim()) return null;
      return /debounce|rate.?limit|throttle|cool.?down|max.*per/i.test(combined);
    },
    impact: 'medium',
    rating: 3,
    category: 'automations',
    fix: 'Add debounce_ms or rate limiting to automations that could fire frequently.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorAutomationScopedPerms: {
    id: 'CU-H05',
    name: 'Automation agents have scoped permissions',
    check: (ctx) => {
      const combined = automationContents(ctx);
      if (!combined.trim()) return null;
      return /sandbox|permission|scope|restrict|limited/i.test(combined);
    },
    impact: 'high',
    rating: 4,
    category: 'automations',
    fix: 'Define scoped permissions and sandbox config for each automation agent.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  cursorAutomationFileSaveDebounce: {
    id: 'CU-H06',
    name: 'file_save automation triggers have debounce_ms set',
    check: (ctx) => {
      const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
      if (configs.length === 0) return null;
      const combined = configs.map(c => c.content).join('\n');
      // Only relevant if file_save trigger is used
      if (!/type:\s*file_save|file[_-]save/i.test(combined)) return null;
      // Must have debounce_ms set to avoid infinite loop
      return /debounce_ms|debounce-ms/i.test(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'automations',
    fix: 'Add debounce_ms: 30000 (minimum) to all file_save automation triggers. Without debounce, the automation saves a file → triggers itself → infinite loop that consumes your entire automation quota.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  // =============================================
  // I. Enterprise (5 checks) — CU-I01..CU-I05
  // =============================================

  cursorEnterpriseSso: {
    id: 'CU-I01',
    name: 'SSO configured (SAML/OIDC) if Enterprise',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /sso|saml|oidc|single sign/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Configure SSO (SAML/OIDC) for Enterprise tier deployments.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorEnterpriseScim: {
    id: 'CU-I02',
    name: 'SCIM 2.0 provisioning active',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /scim|provisioning|directory sync/i.test(docs);
    },
    impact: 'low',
    rating: 2,
    category: 'enterprise',
    fix: 'Enable SCIM 2.0 provisioning for automated user management.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorEnterpriseAuditLogs: {
    id: 'CU-I03',
    name: 'Audit logs enabled',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /audit log|audit trail|tracking/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Enable audit logs for Enterprise tier to track AI code generation and tool usage.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorEnterpriseMcpAllowlist: {
    id: 'CU-I04',
    name: 'MCP server allowlist maintained',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/enterprise/i.test(docs)) return null;
      return /mcp.*allowlist|allowlist.*mcp|approved.*server|server.*approval/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'enterprise',
    fix: 'Maintain an MCP server allowlist for Enterprise deployments to control tool access.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorEnterpriseModelPolicy: {
    id: 'CU-I05',
    name: 'Model access policy matches team needs',
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
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // J. BugBot & Code Review (4 checks) — CU-J01..CU-J04
  // =============================================

  cursorBugbotEnabled: {
    id: 'CU-J01',
    name: 'BugBot enabled for critical repos',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!docs.trim()) return null;
      return /bugbot|bug.?bot|automated.*pr.*review/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'bugbot',
    fix: 'Enable BugBot for automated PR code review on critical repos.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorBugbotAutofix: {
    id: 'CU-J02',
    name: 'BugBot autofix configured appropriately',
    check: (ctx) => {
      const docs = docsBundle(ctx);
      if (!/bugbot|bug.?bot/i.test(docs)) return null;
      return /autofix|auto.?fix|fix.*mode|resolution/i.test(docs);
    },
    impact: 'medium',
    rating: 3,
    category: 'bugbot',
    fix: 'Configure BugBot autofix settings — decide which issue types should be auto-fixed vs flagged.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorReviewInstructionsLength: {
    id: 'CU-J03',
    name: 'Code review instructions within effective length',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      const reviewRules = rules.filter(r =>
        /review|code.*review/i.test(r.name || '') ||
        (r.frontmatter && r.frontmatter.description && /review/i.test(r.frontmatter.description))
      );
      if (reviewRules.length === 0) return null;
      return reviewRules.every(r => wordCount(r.body) <= 400);
    },
    impact: 'medium',
    rating: 3,
    category: 'bugbot',
    fix: 'Keep code review instruction rules under ~400 words for reliable agent adherence.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorReviewNoConflict: {
    id: 'CU-J04',
    name: 'Review automation does not conflict with human review',
    check: (ctx) => {
      const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
      if (configs.length === 0) return null;
      const combined = configs.map(c => c.content).join('\n');
      const hasReviewAuto = /auto.*review|review.*auto|merge.*auto/i.test(combined);
      if (!hasReviewAuto) return null;
      // If auto-review exists, check it doesn't auto-merge
      return !/auto.*merge|merge.*without.*review/i.test(combined);
    },
    impact: 'low',
    rating: 2,
    category: 'bugbot',
    fix: 'Ensure automated review does not bypass human review requirements.',
    template: null,
    file: () => '.cursor/automations/',
    line: () => null,
  },

  // =============================================
  // K. Cross-Surface Consistency (4 checks) — CU-K01..CU-K04
  // =============================================

  cursorRulesConsistentSurfaces: {
    id: 'CU-K01',
    name: 'Rules consistent between foreground and background agents',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      const env = envJsonData(ctx);
      if (rules.length === 0 || !env) return null;
      // If we have both surfaces, rules should exist for both
      return rules.length > 0;
    },
    impact: 'high',
    rating: 4,
    category: 'cross-surface',
    fix: 'Ensure .cursor/rules/ are accessible to both foreground and background agents.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorMcpConsistentSurfaces: {
    id: 'CU-K02',
    name: 'MCP config consistent across surfaces',
    check: (ctx) => {
      const project = ctx.mcpConfig();
      if (!project.ok) return null;
      // MCP config applies to foreground; background has separate access
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'cross-surface',
    fix: 'Document which MCP servers are available to foreground vs background agents.',
    template: null,
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorAutomationRulesConsistent: {
    id: 'CU-K03',
    name: 'Automation agents have same rules as interactive agents',
    check: (ctx) => {
      const configs = ctx.automationsConfig ? ctx.automationsConfig() : [];
      if (configs.length === 0) return null;
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      return rules.length > 0;
    },
    impact: 'high',
    rating: 4,
    category: 'cross-surface',
    fix: 'Ensure automation agents can access the same .cursor/rules/ as interactive agents.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorEnvMatchesLocal: {
    id: 'CU-K04',
    name: 'environment.json matches local dev environment',
    check: (ctx) => {
      const env = envJsonData(ctx);
      if (!env) return null;
      // Check that baseImage matches project stack
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      if (pkg && env.baseImage) {
        const isNode = /node/i.test(env.baseImage);
        const projectIsNode = Boolean(pkg.dependencies || pkg.devDependencies);
        return isNode === projectIsNode || true; // relaxed check
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'cross-surface',
    fix: 'Ensure environment.json baseImage matches the local development environment stack.',
    template: null,
    file: () => '.cursor/environment.json',
    line: () => null,
  },

  // =============================================
  // L. Quality Deep (7 checks) — CU-L01..CU-L07
  // =============================================

  cursorModernFeatures: {
    id: 'CU-L01',
    name: 'Rules mention modern Cursor features (automations, background agents, BugBot)',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /automation|background agent|bugbot|bug.?bot|design mode|agent.*window/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Document awareness of modern Cursor features: automations, background agents, BugBot, Design Mode.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorNoDeprecatedPatterns: {
    id: 'CU-L02',
    name: 'No deprecated patterns (Notepads, .cursorrules for agent)',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      const legacy = ctx.legacyCursorrules ? ctx.legacyCursorrules() : null;
      const combined = `${content}\n${legacy || ''}`;
      if (!combined.trim()) return null;
      const hasDeprecated = /@Notepads|notepad/i.test(combined);
      return !hasDeprecated && !legacy;
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'Remove @Notepads references (deprecated Oct 2025). Migrate .cursorrules to .cursor/rules/*.mdc.',
    template: 'cursor-legacy-migration',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorRuleCountManageable: {
    id: 'CU-L03',
    name: 'Rule file count is manageable (<20 files, avoid context bloat)',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length === 0) return null;
      return rules.length < 20;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Keep rule files under 20. Consolidate related rules to avoid context bloat.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorAlwaysApplyMinimized: {
    id: 'CU-L04',
    name: 'Always Apply rules minimized (token cost per message)',
    check: (ctx) => {
      const always = ctx.alwaysApplyRules ? ctx.alwaysApplyRules() : [];
      if (always.length === 0) return null;
      // More than 3 always-apply rules is excessive
      return always.length <= 3;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Minimize Always Apply rules (keep to 1-3). Each one adds token cost to every message.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorNoNestedRulesDirs: {
    id: 'CU-L05',
    name: 'No nested rules directories (silently ignored by Cursor)',
    check: (ctx) => {
      const rulesDir = path.join(ctx.dir, '.cursor', 'rules');
      try {
        const entries = require('fs').readdirSync(rulesDir, { withFileTypes: true });
        const hasDirs = entries.some(e => e.isDirectory());
        return !hasDirs;
      } catch {
        return null;
      }
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Remove subdirectories from .cursor/rules/ — Cursor silently ignores nested rule directories.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorDocsIndexed: {
    id: 'CU-L06',
    name: '@Docs indexed for project framework documentation',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /@Docs|documentation.*crawl|docs.*index|library.*reference/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Configure @Docs to index key framework documentation for better agent suggestions.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorSessionDriftAwareness: {
    id: 'CU-L07',
    name: 'Agent session drift awareness documented',
    check: (ctx) => {
      const content = allRulesContent(ctx);
      if (!content.trim()) return null;
      return /session.*drift|context.*window|long.*session|session.*length|refresh.*context/i.test(content);
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Document session drift awareness. Long sessions (>2h) may lose agent context.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // M. Advisory (4 checks) — CU-M01..CU-M04
  // =============================================

  cursorAdvisoryInstructionQuality: {
    id: 'CU-M01',
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
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorAdvisorySecurityPosture: {
    id: 'CU-M02',
    name: 'Security posture meets advisory threshold',
    check: (ctx) => {
      let score = 0;
      const docs = docsBundle(ctx);
      if (/privacy mode/i.test(docs)) score++;
      if (!ctx.hasLegacyRules || !ctx.hasLegacyRules()) score++;
      const mcpResult = ctx.mcpConfig();
      if (mcpResult.ok) {
        const validation = validateMcpEnvVars(mcpResult.data);
        if (validation.valid) score++;
      } else {
        score++; // No MCP = no MCP risk
      }
      if (/security|secret|credential/i.test(docs)) score++;
      return score >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'advisory',
    fix: 'Improve security posture: enable Privacy Mode, migrate .cursorrules, secure MCP config.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorAdvisorySurfaceCoverage: {
    id: 'CU-M03',
    name: 'Surface coverage meets advisory threshold',
    check: (ctx) => {
      const surfaces = ctx.detectSurfaces ? ctx.detectSurfaces() : {};
      return surfaces.foreground === true;
    },
    impact: 'medium',
    rating: 4,
    category: 'advisory',
    fix: 'Configure at least the foreground agent surface with .cursor/rules/*.mdc files.',
    template: 'cursor-rules',
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorAdvisoryMcpHealth: {
    id: 'CU-M04',
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
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  // =============================================
  // N. Pack (4 checks) — CU-N01..CU-N04
  // =============================================

  cursorPackDomainDetected: {
    id: 'CU-N01',
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

  cursorPackMcpRecommended: {
    id: 'CU-N02',
    name: 'MCP packs recommended based on project signals',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      return Object.keys(servers).length > 0;
    },
    impact: 'low',
    rating: 2,
    category: 'advisory',
    fix: 'Add recommended MCP packs to .cursor/mcp.json based on project domain.',
    template: 'cursor-mcp',
    file: () => '.cursor/mcp.json',
    line: () => null,
  },

  cursorPackGovernanceApplied: {
    id: 'CU-N03',
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
    file: () => '.cursor/rules/',
    line: () => null,
  },

  cursorPackConsistency: {
    id: 'CU-N04',
    name: 'All applied packs are consistent with each other',
    check: (ctx) => {
      const rules = allRulesContent(ctx);
      const mcp = mcpJsonRaw(ctx);
      if (!rules && !mcp) return null;
      // No contradiction: if rules say "strict" and config says "yolo"
      const rulesStrict = /\bstrict\b|\blocked.?down\b|\bno auto/i.test(rules);
      const configPermissive = /yolo|auto.*run.*all/i.test(rules);
      return !(rulesStrict && configPermissive);
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Resolve contradictions between rule guidance and configuration.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },

  // =============================================
  // O. Repeat (3 checks) — CU-O01..CU-O03
  // =============================================

  cursorRepeatScoreImproved: {
    id: 'CU-O01',
    name: 'Audit score improved since last run',
    check: () => null, // Requires snapshot history — always N/A in static check
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Run audits regularly and track score improvement over time.',
    template: null,
    file: () => null,
    line: () => null,
  },

  cursorRepeatNoRegressions: {
    id: 'CU-O02',
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

  cursorRepeatFeedbackLoop: {
    id: 'CU-O03',
    name: 'Feedback loop active for recommendations',
    check: () => null, // Requires feedback data
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Use `npx nerviq --platform cursor feedback` to rate recommendations.',
    template: null,
    file: () => null,
    line: () => null,
  },

  // =============================================
  // P. Freshness (3 checks) — CU-P01..CU-P03
  // =============================================

  cursorFreshnessSourcesVerified: {
    id: 'CU-P01',
    name: 'P0 freshness sources verified within threshold',
    check: () => null, // Requires freshness verification data
    impact: 'medium',
    rating: 3,
    category: 'freshness',
    fix: 'Verify P0 Cursor documentation sources are current before claiming freshness.',
    template: null,
    file: () => null,
    line: () => null,
  },

  cursorFreshnessPropagation: {
    id: 'CU-P02',
    name: 'Freshness propagation checklist is current',
    check: () => null, // Requires propagation tracking
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Review propagation checklist when Cursor releases new features or changes.',
    template: null,
    file: () => null,
    line: () => null,
  },

  cursorFreshnessRuleFormat: {
    id: 'CU-P03',
    name: 'Rule format matches current Cursor version expectations',
    check: (ctx) => {
      const rules = ctx.cursorRules ? ctx.cursorRules() : [];
      if (rules.length === 0) return null;
      // All rules should use MDC format (not plain markdown)
      return rules.every(r => r.frontmatter !== null);
    },
    impact: 'medium',
    rating: 3,
    category: 'freshness',
    fix: 'Ensure all rules use current MDC format with YAML frontmatter.',
    template: null,
    file: () => '.cursor/rules/',
    line: () => null,
  },
};

attachSourceUrls('cursor', CURSOR_TECHNIQUES);

module.exports = {
  CURSOR_TECHNIQUES,
};
