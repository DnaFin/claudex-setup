/**
 * Copilot techniques module — CHECK CATALOG
 *
 * 86 checks across 17 categories:
 *   v0.1 (38): A. Instructions(8), B. Config(6), C. Trust & Safety(9), D. MCP(5), E. Cloud Agent(5), F. Organization(5)
 *   v0.5 (54): G. Prompt Files(4), H. Agents & Skills(4), I. VS Code IDE(4), J. CLI(4)
 *   v1.0 (70): K. Cross-Surface(5), L. Enterprise(5), M. Quality Deep(6)
 *   CP-08 (82): N. Advisory(4), O. Pack(4), P. Repeat(3)
 *   v1.1 (87): Q. Experiment-Verified CLI Fixes (CLI ingests AGENTS.md/CLAUDE.md, mcpServers key, VS Code settings not CLI-relevant, org policy MCP blocks, BYOK MCP caveat)
 *
 * Each check: { id, name, check(ctx), impact, rating, category, fix, template, file(), line() }
 */

const os = require('os');
const path = require('path');
const { CopilotProjectContext } = require('./context');
const { EMBEDDED_SECRET_PATTERNS, containsEmbeddedSecret } = require('../secret-patterns');
const { attachSourceUrls } = require('../source-urls');
const { extractFrontmatter, validateInstructionFrontmatter, validatePromptFrontmatter } = require('./config-parser');

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

function copilotInstructions(ctx) {
  return ctx.copilotInstructionsContent ? ctx.copilotInstructionsContent() : (ctx.fileContent('.github/copilot-instructions.md') || null);
}

function vscodeSettingsRaw(ctx) {
  return ctx.fileContent('.vscode/settings.json') || '';
}

function vscodeSettingsData(ctx) {
  const result = ctx.vscodeSettings();
  return result && result.ok ? result.data : null;
}

function mcpJsonRaw(ctx) {
  return ctx.fileContent('.vscode/mcp.json') || '';
}

function mcpJsonData(ctx) {
  const result = ctx.mcpConfig();
  return result && result.ok ? result.data : null;
}

function cloudAgentContent(ctx) {
  return ctx.cloudAgentConfig ? ctx.cloudAgentConfig() : null;
}

function docsBundle(ctx) {
  const instr = copilotInstructions(ctx) || '';
  const readme = ctx.fileContent('README.md') || '';
  return `${instr}\n${readme}`;
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

function getCopilotSetting(ctx, key) {
  const data = vscodeSettingsData(ctx);
  if (!data) return undefined;
  // Support dotted key navigation through nested objects
  const parts = key.split('.');
  let cursor = data;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

// ─── COPILOT_TECHNIQUES ──────────────────────────────────────────────────────

const COPILOT_TECHNIQUES = {

  // =============================================
  // A. Instructions (8 checks) — CP-A01..CP-A08
  // =============================================

  copilotInstructionsExists: {
    id: 'CP-A01',
    name: '.github/copilot-instructions.md exists',
    check: (ctx) => Boolean(copilotInstructions(ctx)),
    impact: 'critical',
    rating: 5,
    category: 'instructions',
    fix: 'Create .github/copilot-instructions.md with repo-specific instructions for Copilot.',
    template: 'copilot-instructions',
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => (copilotInstructions(ctx) ? 1 : null),
  },

  copilotInstructionsSubstantive: {
    id: 'CP-A02',
    name: 'Instructions have substantive content (>20 lines, 2+ sections)',
    check: (ctx) => {
      const content = copilotInstructions(ctx);
      if (!content) return null;
      const nonEmpty = content.split(/\r?\n/).filter(l => l.trim()).length;
      return nonEmpty >= 20 && countSections(content) >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'instructions',
    fix: 'Expand copilot-instructions.md to at least 20 substantive lines and 2+ sections.',
    template: 'copilot-instructions',
    file: () => '.github/copilot-instructions.md',
    line: () => 1,
  },

  copilotInstructionsCommands: {
    id: 'CP-A03',
    name: 'Instructions include build/test/lint commands',
    check: (ctx) => {
      const content = copilotInstructions(ctx);
      if (!content) return null;
      const expected = expectedVerificationCategories(ctx);
      if (expected.length === 0) return /\bverify\b|\btest\b|\blint\b|\bbuild\b/i.test(content);
      return expected.every(cat => hasCommandMention(content, cat));
    },
    impact: 'high',
    rating: 5,
    category: 'instructions',
    fix: 'Document the actual test/lint/build commands so Copilot agent can verify its changes.',
    template: 'copilot-instructions',
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => {
      const content = copilotInstructions(ctx);
      return content ? (firstLineMatching(content, /\bVerification\b|\btest\b|\blint\b|\bbuild\b/i) || 1) : null;
    },
  },

  copilotInstructionsNoFiller: {
    id: 'CP-A04',
    name: 'No generic filler instructions',
    check: (ctx) => {
      const content = copilotInstructions(ctx);
      if (!content) return null;
      return !FILLER_PATTERNS.some(p => p.test(content));
    },
    impact: 'low',
    rating: 3,
    category: 'instructions',
    fix: 'Replace generic filler like "be helpful" with concrete repo-specific guidance.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => {
      const content = copilotInstructions(ctx);
      return content ? findFillerLine(content) : null;
    },
  },

  copilotInstructionsNoSecrets: {
    id: 'CP-A05',
    name: 'No secrets/API keys in instruction files',
    check: (ctx) => {
      const content = copilotInstructions(ctx) || '';
      const scoped = (ctx.scopedInstructions ? ctx.scopedInstructions() : []).map(s => s.body || '').join('\n');
      const prompts = (ctx.promptFiles ? ctx.promptFiles() : []).map(p => p.body || '').join('\n');
      const combined = `${content}\n${scoped}\n${prompts}`;
      if (!combined.trim()) return null;
      return !containsEmbeddedSecret(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'instructions',
    fix: 'Remove API keys and secrets from instruction and prompt files. Use environment variables instead.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => {
      const content = copilotInstructions(ctx);
      return content ? findSecretLine(content) : null;
    },
  },

  copilotScopedInstructionsFrontmatter: {
    id: 'CP-A06',
    name: 'Scoped instruction files have valid applyTo glob in frontmatter',
    check: (ctx) => {
      const scoped = ctx.scopedInstructions ? ctx.scopedInstructions() : [];
      if (scoped.length === 0) return null; // No scoped instructions = N/A
      return scoped.every(s => {
        if (!s.frontmatter) return false;
        const validation = validateInstructionFrontmatter(s.frontmatter);
        return validation.valid;
      });
    },
    impact: 'high',
    rating: 4,
    category: 'instructions',
    fix: 'Add valid applyTo glob pattern in YAML frontmatter of each .github/instructions/*.instructions.md file.',
    template: null,
    file: () => '.github/instructions/',
    line: () => 1,
  },

  copilotNoOrgContradiction: {
    id: 'CP-A07',
    name: 'No contradictions between repo and org instructions',
    check: (ctx) => {
      // Can't detect org instructions from files alone; check for explicit org markers
      const content = copilotInstructions(ctx);
      if (!content) return null;
      // Check if instructions reference overriding org-level rules
      const hasOrgOverride = /\boverride org\b|\bignore org\b|\bdisable org\b/i.test(content);
      return !hasOrgOverride;
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions',
    fix: 'Ensure repo instructions complement (not contradict) org-level instructions.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => {
      const content = copilotInstructions(ctx);
      return content ? firstLineMatching(content, /\boverride org\b|\bignore org\b|\bdisable org\b/i) : null;
    },
  },

  copilotNoDeprecatedCodeGenInstructions: {
    id: 'CP-A08',
    name: 'Deprecated codeGeneration.instructions not used in VS Code settings',
    check: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      if (!raw) return null;
      return !raw.includes('codeGeneration.instructions');
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Remove github.copilot.chat.codeGeneration.instructions from settings.json (deprecated since VS Code 1.102). Use .github/instructions/*.instructions.md instead.',
    template: null,
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /codeGeneration\.instructions/) : null;
    },
  },

  // =============================================
  // B. Config (6 checks) — CP-B01..CP-B06
  // =============================================

  copilotVscodeSettingsExists: {
    id: 'CP-B01',
    name: '.vscode/settings.json has Copilot agent settings (VS Code-only)',
    check: (ctx) => {
      const data = vscodeSettingsData(ctx);
      if (!data) return false;
      // Check for any Copilot or chat-related key
      // NOTE: These settings affect VS Code only. Copilot CLI ignores them.
      const raw = vscodeSettingsRaw(ctx);
      return /github\.copilot|chat\./.test(raw);
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Add Copilot agent settings to .vscode/settings.json. NOTE: These are VS Code-only — Copilot CLI has its own configuration surface.',
    template: 'copilot-vscode-settings',
    file: () => '.vscode/settings.json',
    line: () => 1,
  },

  copilotCloudAgentSetup: {
    id: 'CP-B02',
    name: 'Cloud agent setup workflow exists if cloud agent is used',
    check: (ctx) => {
      const content = cloudAgentContent(ctx);
      // If no cloud agent signals, N/A
      const hasCloudSignals = ctx.fileContent('.github/copilot-instructions.md') &&
        (ctx.workflowFiles ? ctx.workflowFiles() : []).some(f => f.includes('copilot'));
      if (!hasCloudSignals && !content) return null;
      return Boolean(content);
    },
    impact: 'high',
    rating: 5,
    category: 'config',
    fix: 'Create .github/workflows/copilot-setup-steps.yml to configure the cloud agent environment.',
    template: 'copilot-cloud-setup',
    file: () => '.github/workflows/copilot-setup-steps.yml',
    line: () => 1,
  },

  copilotModelExplicit: {
    id: 'CP-B03',
    name: 'Model preference is explicit (not silently defaulting)',
    check: (ctx) => {
      // Check prompt files for explicit model setting
      const prompts = ctx.promptFiles ? ctx.promptFiles() : [];
      const hasModelInPrompt = prompts.some(p => p.frontmatter && p.frontmatter.model);
      // Check instructions for model guidance
      const instr = copilotInstructions(ctx) || '';
      const hasModelMention = /\bmodel\b.*\b(gpt|claude|o[134]|sonnet|opus)\b/i.test(instr);
      if (!prompts.length && !instr) return null;
      return hasModelInPrompt || hasModelMention;
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Set model preference explicitly in prompt files or instructions to avoid silent downgrades.',
    template: null,
    file: () => '.github/prompts/',
    line: () => 1,
  },

  copilotNoDeprecatedSettings: {
    id: 'CP-B04',
    name: 'No deprecated VS Code Copilot settings',
    check: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      if (!raw) return null;
      const deprecatedPatterns = [
        /github\.copilot\.chat\.codeGeneration\.instructions/,
        /github\.copilot\.inlineSuggest\.enable/,
      ];
      return !deprecatedPatterns.some(p => p.test(raw));
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Replace deprecated Copilot settings with current equivalents.',
    template: null,
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /codeGeneration\.instructions|inlineSuggest\.enable/) : null;
    },
  },

  copilotPromptFilesValid: {
    id: 'CP-B05',
    name: 'Prompt files (.github/prompts/) use valid frontmatter',
    check: (ctx) => {
      const prompts = ctx.promptFiles ? ctx.promptFiles() : [];
      if (prompts.length === 0) return null;
      return prompts.every(p => {
        if (!p.frontmatter) return false;
        const validation = validatePromptFrontmatter(p.frontmatter);
        return validation.valid;
      });
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Ensure all .github/prompts/*.prompt.md files have valid YAML frontmatter with description, agent, model, or tools fields.',
    template: null,
    file: () => '.github/prompts/',
    line: () => 1,
  },

  copilotVscodeSettingsValidJson: {
    id: 'CP-B06',
    name: 'VS Code settings.json is valid JSON',
    check: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      if (!raw) return null;
      const result = ctx.vscodeSettings();
      return result && result.ok;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Fix malformed JSON in .vscode/settings.json.',
    template: null,
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const result = ctx.vscodeSettings();
      if (result && result.ok) return null;
      if (result && result.error) {
        const match = result.error.match(/position (\d+)/i);
        if (match) {
          const raw = vscodeSettingsRaw(ctx);
          return raw ? raw.slice(0, Number(match[1])).split('\n').length : 1;
        }
      }
      return 1;
    },
  },

  // =============================================
  // C. Trust & Safety (9 checks) — CP-C01..CP-C09
  // =============================================

  copilotContentExclusions: {
    id: 'CP-C01',
    name: 'Content exclusions configured for sensitive files',
    check: (ctx) => {
      const exclusions = ctx.contentExclusions ? ctx.contentExclusions() : null;
      if (exclusions) return true;
      // Also check for .gitignore patterns that suggest awareness
      const gitignore = ctx.fileContent('.gitignore') || '';
      return /\.env\b|secrets\/|credentials|\.pem\b|\.key\b/i.test(gitignore);
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Configure content exclusions for .env, secrets/, credentials, and *.pem files in org settings or repo config.',
    template: null,
    file: () => '.vscode/settings.json',
    line: () => null,
  },

  copilotCloudContentExclusionGap: {
    id: 'CP-C02',
    name: 'Cloud agent content exclusion gap documented',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null; // N/A if no cloud agent
      // Check if the gap is documented
      const instr = copilotInstructions(ctx) || '';
      return /content exclu.*cloud|cloud.*content exclu|cloud agent.*sensitive|exclusion.*not enforced/i.test(instr) ||
             /content exclu.*cloud|cloud.*content exclu/i.test(cloud);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Document that content exclusions are NOT enforced on the cloud agent. Review cloud agent PRs carefully for sensitive file access.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotTerminalSandboxEnabled: {
    id: 'CP-C03',
    name: 'Terminal sandbox enabled (VS Code-only — does NOT affect CLI)',
    check: (ctx) => {
      const data = vscodeSettingsData(ctx);
      if (!data) return false;
      const raw = vscodeSettingsRaw(ctx);
      // Check for chat.tools.terminal.sandbox.enabled = true
      // NOTE: This setting is VS Code-specific. Copilot CLI ignores it entirely.
      if (raw.includes('terminal.sandbox') && raw.includes('true')) return true;
      return getCopilotSetting(ctx, 'chat.tools.terminal.sandbox.enabled') === true;
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Add "chat.tools.terminal.sandbox.enabled": true to .vscode/settings.json. NOTE: This is VS Code-only — Copilot CLI uses its own permission flags, not VS Code settings.',
    template: 'copilot-vscode-settings',
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /terminal\.sandbox/) : null;
    },
  },

  copilotNoWindowsSandbox: {
    id: 'CP-C04',
    name: 'No terminal sandbox on Windows — documented',
    check: (ctx) => {
      if (os.platform() !== 'win32') return null; // N/A on non-Windows
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      const combined = `${instr}\n${readme}`;
      return /\bwindows\b.*sandbox|sandbox.*\bwindows\b|terminal sandbox.*unavailable|no sandbox.*windows/i.test(combined);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Document that terminal sandbox is unavailable on native Windows. Use WSL2 or Docker for sandboxed execution.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotAutoApprovalSpecific: {
    id: 'CP-C05',
    name: 'Auto-approval rules are specific (VS Code-only — CLI uses permission flags)',
    check: (ctx) => {
      const data = vscodeSettingsData(ctx);
      if (!data) return null;
      const raw = vscodeSettingsRaw(ctx);
      // Check for auto-approval patterns
      // NOTE: autoApproval.terminalCommands is VS Code-specific.
      // Copilot CLI uses its own --permission flags, not this setting.
      const autoApproval = getCopilotSetting(ctx, 'chat.agent.autoApproval.terminalCommands');
      if (!autoApproval || !Array.isArray(autoApproval)) return null;
      // Fail if any wildcard patterns
      return !autoApproval.some(pattern => pattern === '*' || pattern === '**' || pattern === '.*');
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Replace wildcard auto-approval patterns with specific command patterns (e.g., "npm test", "npm run lint"). NOTE: This setting only affects VS Code — Copilot CLI approval is controlled by CLI permission flags.',
    template: null,
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /autoApproval/) : null;
    },
  },

  copilotCloudAgentPRReview: {
    id: 'CP-C06',
    name: 'Cloud agent PRs require review before CI runs',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      // Check workflows for branch protection or review requirements
      const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
      const hasReviewGate = workflows.some(f => {
        const content = ctx.fileContent(f) || '';
        return /pull_request_review|required_status_checks|require.*approval/i.test(content);
      });
      // Also check instructions for review guidance
      const instr = copilotInstructions(ctx) || '';
      return hasReviewGate || /\breview before merge\b|\breview required\b|\bPR review\b/i.test(instr);
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'Ensure cloud agent PRs require human review before CI/CD runs.',
    template: null,
    file: () => '.github/workflows/',
    line: () => null,
  },

  copilotDataUsageOptOut: {
    id: 'CP-C07',
    name: 'Data usage opt-out configured for training-sensitive repos',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      const combined = `${instr}\n${readme}`;
      // Check if there's awareness of data training policy
      if (/\bopt.?out\b.*training|\bdata.*training.*opt|\binteraction data\b/i.test(combined)) return true;
      // If repo looks regulated, it should document this
      const filenames = (ctx.files || []).join('\n');
      const isRegulated = /\bhipaa\b|\bpci\b|\bsoc2\b|\bgdpr\b|\bcompliance\b/i.test(`${filenames}\n${combined}`);
      if (isRegulated) return false;
      return null; // N/A for non-regulated repos
    },
    impact: 'medium',
    rating: 3,
    category: 'trust',
    fix: 'Document data usage training opt-out if required. Since April 24, 2026, interaction data may be used for training on Free/Pro/Pro+ plans.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotNoSecretsInCloudSetup: {
    id: 'CP-C08',
    name: 'No secrets in copilot-setup-steps.yml',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      return !containsEmbeddedSecret(cloud);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove hardcoded secrets from copilot-setup-steps.yml. Use GitHub Actions secrets instead (${{ secrets.* }}).',
    template: null,
    file: () => '.github/workflows/copilot-setup-steps.yml',
    line: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      return cloud ? findSecretLine(cloud) : null;
    },
  },

  copilotMcpOrgAllowlist: {
    id: 'CP-C09',
    name: 'MCP servers restricted by org allowlist (if Enterprise/Business)',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      if (Object.keys(servers).length === 0) return null;
      // Check instructions for MCP governance mention
      const instr = copilotInstructions(ctx) || '';
      return /\bmcp.*allowlist\b|\bmcp.*registry\b|\bmcp.*approved\b|\borg.*mcp/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'trust',
    fix: 'If using Business/Enterprise plan, configure MCP server allowlist in org admin settings.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  // =============================================
  // D. MCP (5 checks) — CP-D01..CP-D05
  // =============================================

  copilotMcpConfigured: {
    id: 'CP-D01',
    name: 'MCP servers configured per surface (.vscode/mcp.json)',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      return Object.keys(servers).length > 0;
    },
    impact: 'medium',
    rating: 4,
    category: 'mcp',
    fix: 'Configure MCP servers in .vscode/mcp.json for VS Code agent mode.',
    template: 'copilot-mcp',
    file: () => '.vscode/mcp.json',
    line: () => 1,
  },

  copilotMcpCloudNoOAuth: {
    id: 'CP-D02',
    name: 'Cloud agent MCP avoids OAuth-required servers (known gap)',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      const mcpData = mcpJsonData(ctx);
      if (!mcpData) return null;
      const servers = mcpData.servers || mcpData.mcpServers || {};
      // Check if any server has OAuth requirements and cloud references them
      for (const [name, config] of Object.entries(servers)) {
        const configStr = JSON.stringify(config);
        if (/oauth|auth_url|authorization_url/i.test(configStr) && cloud.includes(name)) {
          return false;
        }
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'mcp',
    fix: 'Remove OAuth-dependent MCP servers from cloud agent config. OAuth is not supported on cloud agent.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  copilotMcpToolRestrictions: {
    id: 'CP-D03',
    name: 'MCP tool restrictions configured',
    check: (ctx) => {
      const mcpData = mcpJsonData(ctx);
      if (!mcpData) return null;
      const servers = mcpData.servers || mcpData.mcpServers || {};
      if (Object.keys(servers).length === 0) return null;
      // Check if any server has tool restrictions
      return Object.values(servers).some(config =>
        config.tools || config.excludeTools || config.allowedTools
      );
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Add tool restrictions to MCP server configs to limit which tools can be invoked.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  copilotMcpConsistentAcrossSurfaces: {
    id: 'CP-D04',
    name: 'MCP config consistent across surfaces',
    check: (ctx) => {
      const mcpData = mcpJsonData(ctx);
      if (!mcpData) return null;
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      // If both VS Code MCP and cloud config exist, check for alignment
      const vsCodeServers = Object.keys(mcpData.servers || mcpData.mcpServers || {});
      if (vsCodeServers.length === 0) return null;
      // Check if cloud setup mentions MCP or server names
      const cloudMentionsMcp = /mcp|server/i.test(cloud);
      return cloudMentionsMcp;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Ensure MCP server configuration is consistent across VS Code and cloud agent surfaces.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  copilotMcpAuthDocumented: {
    id: 'CP-D05',
    name: 'MCP auth requirements documented',
    check: (ctx) => {
      const mcpData = mcpJsonData(ctx);
      if (!mcpData) return null;
      const servers = mcpData.servers || mcpData.mcpServers || {};
      if (Object.keys(servers).length === 0) return null;
      // Check if any server has env vars that need to be set
      const hasEnvVars = Object.values(servers).some(config => {
        const configStr = JSON.stringify(config);
        return /\$\{|\benv\b|API_KEY|TOKEN|SECRET/i.test(configStr);
      });
      if (!hasEnvVars) return true;
      // Check if auth is documented
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      return /mcp.*auth|mcp.*key|mcp.*token|mcp.*secret/i.test(`${instr}\n${readme}`);
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Document MCP server authentication requirements (API keys, tokens) in instructions or README.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // E. Cloud Agent (5 checks) — CP-E01..CP-E05
  // =============================================

  copilotCloudDependencyInstall: {
    id: 'CP-E01',
    name: 'copilot-setup-steps.yml has dependency installation',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      return /npm install|yarn install|pnpm install|pip install|apt-get|brew install|go mod download|cargo build/i.test(cloud);
    },
    impact: 'high',
    rating: 5,
    category: 'cloud-agent',
    fix: 'Add dependency installation steps to copilot-setup-steps.yml.',
    template: 'copilot-cloud-setup',
    file: () => '.github/workflows/copilot-setup-steps.yml',
    line: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      return cloud ? firstLineMatching(cloud, /install/) : null;
    },
  },

  copilotCloudTestConfigured: {
    id: 'CP-E02',
    name: 'copilot-setup-steps.yml has test command configured',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      return /npm test|yarn test|pnpm test|pytest|go test|cargo test|make test/i.test(cloud);
    },
    impact: 'high',
    rating: 4,
    category: 'cloud-agent',
    fix: 'Add test command to copilot-setup-steps.yml so cloud agent can verify changes.',
    template: 'copilot-cloud-setup',
    file: () => '.github/workflows/copilot-setup-steps.yml',
    line: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      return cloud ? firstLineMatching(cloud, /test/) : null;
    },
  },

  copilotCloudSignedCommits: {
    id: 'CP-E03',
    name: 'Cloud agent commits are signed (verified GA April 3, 2026)',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      // Signed commits are now GA — check if documented
      const instr = copilotInstructions(ctx) || '';
      return /signed commit|commit.*sign|gpg.*sign|verified.*commit/i.test(`${instr}\n${cloud}`);
    },
    impact: 'medium',
    rating: 3,
    category: 'cloud-agent',
    fix: 'Document that cloud agent commits are signed (GA since April 3, 2026).',
    template: null,
    file: () => '.github/workflows/copilot-setup-steps.yml',
    line: () => null,
  },

  copilotCloudNoUnsafeEnvVars: {
    id: 'CP-E04',
    name: 'No unsafe env vars exposed in setup workflow',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      // Check for hardcoded secrets or dangerous env patterns
      if (containsEmbeddedSecret(cloud)) return false;
      // Check for env vars that expose secrets without using GitHub secrets syntax
      const lines = cloud.split(/\r?\n/);
      for (const line of lines) {
        if (/^\s*(export\s+)?[A-Z_]+=\S/.test(line) && !/\$\{\{/.test(line)) {
          if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(line)) return false;
        }
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'cloud-agent',
    fix: 'Use ${{ secrets.* }} for all sensitive env vars in copilot-setup-steps.yml instead of hardcoded values.',
    template: null,
    file: () => '.github/workflows/copilot-setup-steps.yml',
    line: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      return cloud ? findSecretLine(cloud) : null;
    },
  },

  copilotCloudImplementationPlan: {
    id: 'CP-E05',
    name: 'Implementation plan mode enabled for complex tasks',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!instr) return null;
      return /implementation plan|plan mode|step.?by.?step plan|break.*into.*steps/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'cloud-agent',
    fix: 'Document implementation plan mode in instructions for complex cloud agent tasks.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => {
      const instr = copilotInstructions(ctx);
      return instr ? firstLineMatching(instr, /implementation plan|plan mode/i) : null;
    },
  },

  // =============================================
  // F. Organization (5 checks) — CP-F01..CP-F05
  // =============================================

  copilotOrgPoliciesConfigured: {
    id: 'CP-F01',
    name: 'Org policies are configured (if Business/Enterprise)',
    check: (ctx) => {
      // Can't detect org policies from files; check for awareness
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      const hasOrgMention = /\borg.*polic|\borg.*admin|\bbusiness plan|\benterprise/i.test(`${instr}\n${readme}`);
      if (hasOrgMention) return true;
      return null; // N/A if no org signals
    },
    impact: 'medium',
    rating: 3,
    category: 'organization',
    fix: 'If using Business/Enterprise plan, document org-level policies that affect Copilot behavior.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotThirdPartyAgentPolicy: {
    id: 'CP-F02',
    name: 'Third-party agent policy is explicit',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      return /third.?party.*agent|agent.*policy|claude.*copilot|codex.*copilot/i.test(`${instr}\n${readme}`);
    },
    impact: 'medium',
    rating: 3,
    category: 'organization',
    fix: 'Document third-party agent policy (whether Claude, Codex, etc. are allowed within Copilot).',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotAuditLogsEnabled: {
    id: 'CP-F03',
    name: 'Audit logs enabled (Enterprise)',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      const combined = `${instr}\n${readme}`;
      if (!/enterprise/i.test(combined)) return null;
      return /\baudit log|\baudit trail/i.test(combined);
    },
    impact: 'medium',
    rating: 3,
    category: 'organization',
    fix: 'Enable and document audit log configuration for Enterprise Copilot usage.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotModelAccessPolicy: {
    id: 'CP-F04',
    name: 'Model access policy matches team needs',
    check: (ctx) => {
      // N/A unless we detect team/org signals
      const instr = copilotInstructions(ctx) || '';
      if (!/\bteam\b|\borg\b|\benterprise\b/i.test(instr)) return null;
      return /model.*access|model.*policy|allowed model/i.test(instr);
    },
    impact: 'low',
    rating: 2,
    category: 'organization',
    fix: 'Document model access policy if specific models need to be enabled or restricted for the team.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotContentExclusionPropagation: {
    id: 'CP-F05',
    name: 'Content exclusion propagation delay documented',
    check: (ctx) => {
      const exclusions = ctx.contentExclusions ? ctx.contentExclusions() : null;
      if (!exclusions) return null;
      const instr = copilotInstructions(ctx) || '';
      return /propagation.*delay|30 minute|exclusion.*delay/i.test(instr);
    },
    impact: 'low',
    rating: 2,
    category: 'organization',
    fix: 'Document that content exclusion changes have up to 30-minute propagation delay.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // G. Prompt Files & Templates (4 checks) — CP-G01..CP-G04
  // =============================================

  copilotPromptDirExists: {
    id: 'CP-G01',
    name: '.github/prompts/ directory exists with reusable templates',
    check: (ctx) => {
      return ctx.hasDir('.github/prompts');
    },
    impact: 'medium',
    rating: 4,
    category: 'prompt-files',
    fix: 'Create .github/prompts/ directory with reusable prompt templates.',
    template: 'copilot-prompts',
    file: () => '.github/prompts/',
    line: () => null,
  },

  copilotPromptFilesValidFrontmatter: {
    id: 'CP-G02',
    name: 'Prompt files have valid frontmatter (agent, model, tools)',
    check: (ctx) => {
      const prompts = ctx.promptFiles ? ctx.promptFiles() : [];
      if (prompts.length === 0) return null;
      return prompts.every(p => p.frontmatter !== null);
    },
    impact: 'high',
    rating: 4,
    category: 'prompt-files',
    fix: 'Add YAML frontmatter to all .prompt.md files with at least a description field.',
    template: null,
    file: () => '.github/prompts/',
    line: () => 1,
  },

  copilotPromptParameterization: {
    id: 'CP-G03',
    name: 'Prompt files use ${input:var} for parameterization',
    check: (ctx) => {
      const prompts = ctx.promptFiles ? ctx.promptFiles() : [];
      if (prompts.length === 0) return null;
      // Not all prompts need params, but check if any use them
      return prompts.some(p => /\$\{input:/.test(p.body || ''));
    },
    impact: 'low',
    rating: 2,
    category: 'prompt-files',
    fix: 'Consider using ${input:variable} in prompt files for dynamic parameterization.',
    template: null,
    file: () => '.github/prompts/',
    line: () => null,
  },

  copilotNoDuplicatePromptNames: {
    id: 'CP-G04',
    name: 'No duplicate prompt names (avoid /name conflicts)',
    check: (ctx) => {
      const prompts = ctx.promptFiles ? ctx.promptFiles() : [];
      if (prompts.length <= 1) return null;
      const names = prompts.map(p => p.name);
      return new Set(names).size === names.length;
    },
    impact: 'medium',
    rating: 3,
    category: 'prompt-files',
    fix: 'Rename duplicate prompt files to avoid /name conflicts in Copilot Chat.',
    template: null,
    file: () => '.github/prompts/',
    line: () => null,
  },

  // =============================================
  // H. Agents & Skills (4 checks) — CP-H01..CP-H04
  // =============================================

  copilotAgentsMdEnabled: {
    id: 'CP-H01',
    name: 'If AGENTS.md exists, verify it is enabled in VS Code (CLI reads it automatically)',
    check: (ctx) => {
      const agentsMd = ctx.fileContent('AGENTS.md');
      if (!agentsMd) return null; // N/A
      // AGENTS.md support needs explicit enabling in VS Code
      // WARNING: Copilot CLI reads AGENTS.md (and CLAUDE.md) automatically without any setting!
      // Use --no-custom-instructions in CLI to prevent this
      const data = vscodeSettingsData(ctx);
      if (!data) return false;
      const raw = vscodeSettingsRaw(ctx);
      return /chat\.agent\.enabled.*true|agent\.enabled.*true/i.test(raw);
    },
    impact: 'critical',
    rating: 5,
    category: 'skills-agents',
    fix: 'Enable AGENTS.md in VS Code settings (off by default). WARNING: Copilot CLI reads AGENTS.md and CLAUDE.md automatically — use --no-custom-instructions to prevent cross-platform instruction leakage.',
    template: 'copilot-vscode-settings',
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /agent\.enabled/) : null;
    },
  },

  copilotExtensionsMode: {
    id: 'CP-H02',
    name: 'Extensions are compatible with intended mode (Ask vs Agent)',
    check: (ctx) => {
      // Check if instructions mention extensions and clarify mode compatibility
      const instr = copilotInstructions(ctx) || '';
      if (!/extension/i.test(instr)) return null;
      return /extension.*ask mode|extension.*agent mode|ask mode.*extension|agent mode.*extension/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'skills-agents',
    fix: 'Document that Copilot Extensions only work in Ask mode, not Agent mode.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotSpacesIndexed: {
    id: 'CP-H03',
    name: 'Spaces/knowledge bases are indexed for relevant repos',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!/space|knowledge base/i.test(instr)) return null;
      return /space.*index|index.*space|knowledge.*base.*configured/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'skills-agents',
    fix: 'Configure Copilot Spaces/knowledge bases for relevant repos.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotWorkingSetAppropriate: {
    id: 'CP-H04',
    name: 'VS Code agent working set is appropriate for project size',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      return /working set|context.*window|file.*limit|token.*limit/i.test(instr);
    },
    impact: 'low',
    rating: 2,
    category: 'skills-agents',
    fix: 'Document working set and context management guidance for large projects.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // I. VS Code IDE (4 checks) — CP-I01..CP-I04
  // =============================================

  copilotAgentModeEnabled: {
    id: 'CP-I01',
    name: 'Agent mode enabled in VS Code',
    check: (ctx) => {
      const data = vscodeSettingsData(ctx);
      if (!data) return null;
      const raw = vscodeSettingsRaw(ctx);
      return /agent\.enabled.*true|github\.copilot\.chat\.agent\.enabled.*true/i.test(raw);
    },
    impact: 'medium',
    rating: 4,
    category: 'extensions',
    fix: 'Enable agent mode in .vscode/settings.json: "github.copilot.chat.agent.enabled": true',
    template: 'copilot-vscode-settings',
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /agent\.enabled/) : null;
    },
  },

  copilotChatParticipants: {
    id: 'CP-I02',
    name: 'Chat participants (@workspace, @terminal) configured',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      return /@workspace|@terminal|@vscode|chat participant/i.test(instr);
    },
    impact: 'low',
    rating: 2,
    category: 'extensions',
    fix: 'Document available chat participants (@workspace, @terminal) in instructions.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotActiveInstructions: {
    id: 'CP-I03',
    name: 'Review, commit, PR instructions are active (not deprecated)',
    check: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      if (!raw) return null;
      // Check if any active instruction keys are used
      return /reviewSelection\.instructions|commitMessageGeneration\.instructions|pullRequestDescriptionGeneration\.instructions/i.test(raw);
    },
    impact: 'medium',
    rating: 3,
    category: 'extensions',
    fix: 'Use active instruction keys (reviewSelection, commitMessageGeneration, pullRequestDescriptionGeneration) instead of deprecated codeGeneration.',
    template: null,
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /reviewSelection|commitMessage|pullRequestDescription/) : null;
    },
  },

  copilotDevContainerSupport: {
    id: 'CP-I04',
    name: 'DevContainer support documented if used',
    check: (ctx) => {
      const hasDevContainer = ctx.fileContent('.devcontainer/devcontainer.json') || ctx.hasDir('.devcontainer');
      if (!hasDevContainer) return null;
      const instr = copilotInstructions(ctx) || '';
      return /devcontainer|dev container|codespace/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'extensions',
    fix: 'Document DevContainer / Codespaces configuration for Copilot usage.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // J. CLI (4 checks) — CP-J01..CP-J04
  // =============================================

  copilotCliInstalled: {
    id: 'CP-J01',
    name: 'gh copilot installed and authenticated',
    check: (ctx) => {
      // Can't detect CLI from files; check for CLI documentation
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      return /gh copilot|github copilot cli/i.test(`${instr}\n${readme}`);
    },
    impact: 'medium',
    rating: 3,
    category: 'ci-automation',
    fix: 'Document gh copilot CLI setup instructions.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotCliMcp: {
    id: 'CP-J02',
    name: 'CLI MCP servers configured',
    check: (ctx) => {
      // CLI MCP is local-only; check for documentation
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      if (!/cli.*mcp|mcp.*cli/i.test(`${instr}\n${readme}`)) return null;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'ci-automation',
    fix: 'Document CLI MCP server configuration.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotCliAliases: {
    id: 'CP-J03',
    name: 'CLI aliases (ghcs/ghce) set up',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      const readme = ctx.fileContent('README.md') || '';
      return /ghcs|ghce|copilot suggest|copilot explain/i.test(`${instr}\n${readme}`);
    },
    impact: 'low',
    rating: 2,
    category: 'ci-automation',
    fix: 'Document CLI aliases (ghcs for suggest, ghce for explain).',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotCliAuthToken: {
    id: 'CP-J04',
    name: 'CLI auth uses token, not hardcoded credentials',
    check: (ctx) => {
      // Check if any file has hardcoded gh auth tokens
      const files = ['.env', '.env.example', 'copilot-setup-steps.yml'];
      for (const f of files) {
        const content = ctx.fileContent(f) || ctx.fileContent(`.github/workflows/${f}`) || '';
        if (/gh[ps]_[A-Za-z0-9_]{36,}/.test(content)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 5,
    category: 'ci-automation',
    fix: 'Use gh auth login or token-based auth instead of hardcoded credentials.',
    template: null,
    file: () => '.env',
    line: () => null,
  },

  // =============================================
  // K. Cross-Surface Consistency (5 checks) — CP-K01..CP-K05
  // =============================================

  copilotCrossSurfaceInstructions: {
    id: 'CP-K01',
    name: 'Instructions are consistent across VS Code, cloud, and CLI surfaces',
    check: (ctx) => {
      const instr = copilotInstructions(ctx);
      const cloud = cloudAgentContent(ctx);
      if (!instr) return null;
      if (!cloud) return null;
      // Check that cloud setup references the instructions
      return /copilot-instructions|instructions/i.test(cloud);
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'Ensure instructions are referenced consistently across all Copilot surfaces.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotCrossSurfaceMcp: {
    id: 'CP-K02',
    name: 'MCP config is consistent across surfaces',
    check: (ctx) => {
      const mcpData = mcpJsonData(ctx);
      const cloud = cloudAgentContent(ctx);
      if (!mcpData || !cloud) return null;
      return /mcp/i.test(cloud);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Align MCP server configuration across VS Code and cloud agent surfaces.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  copilotCrossSurfaceModel: {
    id: 'CP-K03',
    name: 'Model preferences are aligned across surfaces',
    check: (ctx) => {
      const prompts = ctx.promptFiles ? ctx.promptFiles() : [];
      const models = new Set();
      for (const p of prompts) {
        if (p.frontmatter && p.frontmatter.model) {
          models.add(p.frontmatter.model);
        }
      }
      if (models.size <= 1) return null;
      // Multiple different models in prompt files — flag for review
      return models.size <= 2; // Allow up to 2 different models
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Align model preferences across prompt files and surfaces for consistent behavior.',
    template: null,
    file: () => '.github/prompts/',
    line: () => null,
  },

  copilotCrossSurfaceSecurity: {
    id: 'CP-K04',
    name: 'Security posture is consistent (no surface has weaker controls)',
    check: (ctx) => {
      const hasSandbox = getCopilotSetting(ctx, 'chat.tools.terminal.sandbox.enabled') === true;
      const cloud = cloudAgentContent(ctx);
      const instr = copilotInstructions(ctx) || '';
      // If VS Code is sandboxed, check cloud and CLI awareness
      if (hasSandbox && cloud) {
        return /security|review.*required|PR.*gate/i.test(cloud);
      }
      return null;
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'Ensure no Copilot surface has weaker security controls than others.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotCrossSurfaceExclusions: {
    id: 'CP-K05',
    name: 'Content exclusions applied at org level (not just repo)',
    check: (ctx) => {
      const exclusions = ctx.contentExclusions ? ctx.contentExclusions() : null;
      if (!exclusions) return null;
      const instr = copilotInstructions(ctx) || '';
      return /org.*exclu|exclu.*org|organization.*content/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Apply content exclusions at org level for consistent enforcement across repos.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // L. Enterprise & Governance (5 checks) — CP-L01..CP-L05
  // =============================================

  copilotBYOKConfigured: {
    id: 'CP-L01',
    name: 'BYOK (custom model provider) is configured correctly',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!/byok|bring your own|custom model|custom provider/i.test(instr)) return null;
      return /byok.*configured|custom.*model.*set/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Document BYOK (custom model provider) configuration if used.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotFineTunedModelScoped: {
    id: 'CP-L02',
    name: 'Fine-tuned model access is scoped to appropriate repos',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!/fine.?tune|custom.*model/i.test(instr)) return null;
      return /scope|restrict|appropriate.*repo/i.test(instr);
    },
    impact: 'high',
    rating: 4,
    category: 'enterprise',
    fix: 'Scope fine-tuned model access to appropriate repos only.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotAuditRetention: {
    id: 'CP-L03',
    name: 'Audit log retention meets compliance requirements',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!/audit.*log|audit.*trail/i.test(instr)) return null;
      return /retention|compliance|retention.*day|retention.*month/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Document audit log retention policy for compliance.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotMcpRegistryAllowlist: {
    id: 'CP-L04',
    name: 'MCP registry allowlist is maintained',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      if (Object.keys(servers).length === 0) return null;
      const instr = copilotInstructions(ctx) || '';
      return /mcp.*allowlist|mcp.*registry|approved.*mcp/i.test(instr);
    },
    impact: 'high',
    rating: 4,
    category: 'enterprise',
    fix: 'Maintain an MCP registry allowlist for governance.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotThirdPartyAgentGoverned: {
    id: 'CP-L05',
    name: 'Third-party agent usage is explicitly governed',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      return /third.?party.*agent.*governed|agent.*governance|governed.*agent/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'enterprise',
    fix: 'Document governance rules for third-party agent usage within Copilot.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // M. Quality Deep (6 checks) — CP-M01..CP-M06
  // =============================================

  copilotModernFeatures: {
    id: 'CP-M01',
    name: 'Instructions mention modern Copilot features (prompt files, Spaces, agent mode)',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!instr) return null;
      return /\bprompt file|\bspace|\bagent mode|\b\.prompt\.md/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Reference modern Copilot features (prompt files, Spaces, agent mode) in instructions.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotNoDeprecatedReferences: {
    id: 'CP-M02',
    name: 'No references to deprecated features (knowledge bases, codeGeneration.instructions)',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!instr) return null;
      return !/codeGeneration\.instructions|knowledge base.*deprecated/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Remove references to deprecated features from instructions.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: (ctx) => {
      const instr = copilotInstructions(ctx);
      return instr ? firstLineMatching(instr, /codeGeneration\.instructions/) : null;
    },
  },

  copilotColdBootAwareness: {
    id: 'CP-M03',
    name: 'Cloud agent cold-boot awareness documented',
    check: (ctx) => {
      const cloud = cloudAgentContent(ctx);
      if (!cloud) return null;
      const instr = copilotInstructions(ctx) || '';
      return /cold.?boot|90 second|startup.*delay|initialization.*time/i.test(`${instr}\n${cloud}`);
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Document cloud agent cold-boot time (~90 seconds) and mitigation strategies.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotBillingAwareness: {
    id: 'CP-M04',
    name: 'Rate limit / premium billing awareness documented',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!instr) return null;
      return /rate limit|billing|premium|usage limit|token limit/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Document rate limits, premium billing, and usage awareness.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotReviewCharLimit: {
    id: 'CP-M05',
    name: 'Instructions tailored for code review (within 4,000 char limit)',
    check: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      if (!raw) return null;
      if (!raw.includes('reviewSelection')) return null;
      // Check if review instructions exist and are within char limit
      const reviewInstr = getCopilotSetting(ctx, 'github.copilot.chat.reviewSelection.instructions');
      if (!reviewInstr) return null;
      const content = Array.isArray(reviewInstr)
        ? reviewInstr.map(i => typeof i === 'string' ? i : (i.text || '')).join('\n')
        : String(reviewInstr);
      return content.length <= 4000;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Keep code review instructions within the 4,000 character limit.',
    template: null,
    file: () => '.vscode/settings.json',
    line: (ctx) => {
      const raw = vscodeSettingsRaw(ctx);
      return raw ? firstLineMatching(raw, /reviewSelection/) : null;
    },
  },

  copilotInstructionDuplication: {
    id: 'CP-M06',
    name: 'Cross-surface instruction duplication minimized',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      const cloud = cloudAgentContent(ctx) || '';
      if (!instr || !cloud) return null;
      // Simple check: count common substantial lines
      const instrLines = instr.split(/\r?\n/).filter(l => l.trim().length > 30);
      const cloudLines = new Set(cloud.split(/\r?\n/).filter(l => l.trim().length > 30));
      let dupes = 0;
      for (const line of instrLines) {
        if (cloudLines.has(line.trim())) dupes++;
      }
      return dupes < 5;
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Minimize instruction duplication across surfaces. Use copilot-instructions.md as single source of truth.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  // =============================================
  // N. Advisory (4 checks) — CP-N01..CP-N04
  // =============================================

  copilotAdvisoryInstructionQuality: {
    id: 'CP-N01',
    name: 'Instruction quality score meets advisory threshold',
    check: (ctx) => {
      const content = copilotInstructions(ctx);
      if (!content) return null;
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
    fix: 'Improve instruction quality: add more sections, architecture diagram, and verification commands.',
    template: 'copilot-instructions',
    file: () => '.github/copilot-instructions.md',
    line: () => 1,
  },

  copilotAdvisorySecurityPosture: {
    id: 'CP-N02',
    name: 'Security posture meets advisory threshold',
    check: (ctx) => {
      let score = 0;
      if (getCopilotSetting(ctx, 'chat.tools.terminal.sandbox.enabled') === true) score++;
      if (ctx.contentExclusions && ctx.contentExclusions()) score++;
      const autoApproval = getCopilotSetting(ctx, 'chat.agent.autoApproval.terminalCommands');
      if (!autoApproval || (Array.isArray(autoApproval) && !autoApproval.includes('*'))) score++;
      const instr = copilotInstructions(ctx) || '';
      if (/security|secret|credential/i.test(instr)) score++;
      return score >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'advisory',
    fix: 'Improve security posture: enable sandbox, configure exclusions, restrict auto-approval.',
    template: null,
    file: () => '.vscode/settings.json',
    line: () => null,
  },

  copilotAdvisorySurfaceCoverage: {
    id: 'CP-N03',
    name: 'Multi-surface coverage meets advisory threshold',
    check: (ctx) => {
      const surfaces = ctx.detectSurfaces ? ctx.detectSurfaces() : {};
      let configured = 0;
      if (surfaces.vscode) configured++;
      if (surfaces.cloudAgent) configured++;
      // At least VS Code surface should be configured
      return configured >= 1;
    },
    impact: 'medium',
    rating: 4,
    category: 'advisory',
    fix: 'Configure at least VS Code surface. Add cloud agent setup for full coverage.',
    template: null,
    file: () => '.vscode/settings.json',
    line: () => null,
  },

  copilotAdvisoryMcpHealth: {
    id: 'CP-N04',
    name: 'MCP configuration health meets advisory threshold',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const count = Object.keys(servers).length;
      if (count === 0) return null;
      // Check that MCP config is valid JSON and servers have required fields
      const mcpResult = ctx.mcpConfig();
      return mcpResult && mcpResult.ok;
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Ensure MCP configuration is valid and servers are properly configured.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  // =============================================
  // O. Pack (4 checks) — CP-O01..CP-O04
  // =============================================

  copilotPackDomainDetected: {
    id: 'CP-O01',
    name: 'Domain pack detection returns relevant results',
    check: (ctx) => {
      // Always passes if we can detect stacks
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

  copilotPackMcpRecommended: {
    id: 'CP-O02',
    name: 'MCP packs recommended based on project signals',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      return Object.keys(servers).length > 0;
    },
    impact: 'low',
    rating: 2,
    category: 'advisory',
    fix: 'Add recommended MCP packs to .vscode/mcp.json based on project domain.',
    template: 'copilot-mcp',
    file: () => '.vscode/mcp.json',
    line: () => null,
  },

  copilotPackGovernanceApplied: {
    id: 'CP-O03',
    name: 'Governance pack applied if enterprise signals detected',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!/enterprise|business/i.test(instr)) return null;
      return /governance|policy|audit/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Apply governance pack for enterprise repos.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotPackConsistency: {
    id: 'CP-O04',
    name: 'All applied packs are consistent with each other',
    check: (ctx) => {
      // Check that instructions and settings don't contradict
      const instr = copilotInstructions(ctx) || '';
      const raw = vscodeSettingsRaw(ctx);
      if (!instr || !raw) return null;
      // No contradiction: if instructions say "strict" and settings say "yolo"
      const instrStrict = /\bstrict\b|\blocked.?down\b|\bno auto/i.test(instr);
      const settingsPermissive = /autoApproval.*\*|yolo/i.test(raw);
      return !(instrStrict && settingsPermissive);
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Resolve contradictions between instruction guidance and settings configuration.',
    template: null,
    file: () => '.vscode/settings.json',
    line: () => null,
  },

  // =============================================
  // P. Repeat (3 checks) — CP-P01..CP-P03
  // =============================================

  copilotRepeatScoreImproved: {
    id: 'CP-P01',
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

  copilotRepeatNoRegressions: {
    id: 'CP-P02',
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

  copilotRepeatFeedbackLoop: {
    id: 'CP-P03',
    name: 'Feedback loop active for recommendations',
    check: () => null, // Requires feedback data
    impact: 'low',
    rating: 2,
    category: 'freshness',
    fix: 'Use `npx nerviq --platform copilot feedback` to rate recommendations.',
    template: null,
    file: () => null,
    line: () => null,
  },

  // =============================================
  // Q. Experiment-Verified CLI Fixes (5 checks) — CP-Q01..CP-Q05
  // Added from runtime experiment findings (2026-04-05)
  // =============================================

  copilotCliIngestsNonCopilotFiles: {
    id: 'CP-Q01',
    name: 'Aware that Copilot CLI ingests AGENTS.md and CLAUDE.md',
    check: (ctx) => {
      const agentsMd = ctx.fileContent('AGENTS.md');
      const claudeMd = ctx.fileContent('CLAUDE.md');
      if (!agentsMd && !claudeMd) return null; // No cross-platform files
      const instr = copilotInstructions(ctx) || '';
      // If non-Copilot instruction files exist, check that instructions acknowledge this
      return /copilot cli|--no-custom-instructions|cross.platform|AGENTS\.md|CLAUDE\.md/i.test(instr);
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'WARNING: Copilot CLI ingests AGENTS.md and CLAUDE.md alongside copilot-instructions.md. Document this or use --no-custom-instructions for clean runs.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotCliMcpUsesServerKey: {
    id: 'CP-Q02',
    name: 'CLI MCP config uses mcpServers key (not servers)',
    check: (ctx) => {
      const mcpData = mcpJsonData(ctx);
      if (!mcpData) return null;
      // CLI expects mcpServers, not servers
      if (mcpData.servers && !mcpData.mcpServers) return false;
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'ci-automation',
    fix: 'Copilot CLI MCP config expects the "mcpServers" key. "servers" alone may not work in CLI context.',
    template: null,
    file: () => '.vscode/mcp.json',
    line: () => 1,
  },

  copilotVscodeSettingsNotCliRelevant: {
    id: 'CP-Q03',
    name: 'VS Code-specific settings not assumed to affect CLI',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      if (!instr) return null;
      // If instructions reference VS Code settings as if they affect CLI, flag it
      const mentionsCli = /copilot cli|gh copilot/i.test(instr);
      const mentionsVscodeForCli = /chat\.tools.*cli|terminal\.sandbox.*cli|autoApproval.*cli/i.test(instr);
      if (mentionsCli && mentionsVscodeForCli) return false;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'VS Code settings (sandbox, autoApproval, instructionsFilesLocations) do not affect Copilot CLI. Document CLI-specific configuration separately.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotOrgPolicyBlocksMcp: {
    id: 'CP-Q04',
    name: 'Org policy MCP restrictions documented if applicable',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      const mcpData = mcpJsonData(ctx);
      if (!mcpData) return null;
      const servers = mcpData.servers || mcpData.mcpServers || {};
      if (Object.keys(servers).length === 0) return null;
      // If MCP servers are configured, check that org policy restrictions are documented
      return /org.policy|policy.block|third.party.*mcp|mcp.*restrict|Access denied/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Document that org policies can block third-party MCP servers even in local CLI sessions. Error: "Access denied by policy settings".',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },

  copilotByokMcpCaveat: {
    id: 'CP-Q05',
    name: 'BYOK mode MCP limitations documented',
    check: (ctx) => {
      const instr = copilotInstructions(ctx) || '';
      // Only relevant if BYOK is mentioned
      if (!/byok|bring your own key|openai.*key|COPILOT_.*KEY/i.test(instr)) return null;
      return /byok.*mcp|mcp.*byok|oauth.*broken|built.in.*github.*mcp/i.test(instr);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Document that BYOK mode breaks built-in GitHub MCP server (OAuth auth unavailable). Third-party MCP may also be restricted by org policy.',
    template: null,
    file: () => '.github/copilot-instructions.md',
    line: () => null,
  },
};

attachSourceUrls('copilot', COPILOT_TECHNIQUES);

module.exports = {
  COPILOT_TECHNIQUES,
};
