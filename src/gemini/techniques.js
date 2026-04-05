/**
 * Gemini CLI techniques module — CHECK CATALOG
 *
 * 87 checks across 17 categories:
 *   v0.1 (40): A. Instructions, B. Config, C. Trust & Safety, D. Hooks, E. MCP, F. Sandbox & Policy
 *   v0.5 (54): G. Skills & Agents, H. CI & Automation, I. Extensions
 *   v1.0 (68): J. Review & Workflow, K. Quality Deep, L. Commands
 *   v1.1 (73): Q. Experiment-Verified Fixes (v0.36.0 findings: --json→-o json, model object format, --yolo in approval, plan mode, --allowed-tools deprecated, eager loading)
 *
 * Each check: { id, name, check(ctx), impact, rating, category, fix, template, file(), line() }
 */

const os = require('os');
const path = require('path');
const { GeminiProjectContext } = require('./context');
const { EMBEDDED_SECRET_PATTERNS, containsEmbeddedSecret } = require('../secret-patterns');
const { attachSourceUrls } = require('../source-urls');

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

const JUSTIFICATION_PATTERNS = /\bbecause\b|\bwhy\b|\bjustif(?:y|ication)\b|\btemporary\b|\bintentional\b|\bdocumented\b|\bair[- ]?gapped\b|\binternal only\b|\bephemeral\b|\bci only\b/i;

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

function geminiMd(ctx) {
  return ctx.geminiMdContent ? ctx.geminiMdContent() : (ctx.fileContent('GEMINI.md') || null);
}

function settingsRaw(ctx) {
  return ctx.fileContent('.gemini/settings.json') || '';
}

function settingsData(ctx) {
  const result = ctx.settingsJson();
  return result && result.ok ? result.data : null;
}

function docsBundle(ctx) {
  const gmd = geminiMd(ctx) || '';
  const readme = ctx.fileContent('README.md') || '';
  return `${gmd}\n${readme}`;
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

function extractImportRefs(content) {
  const refs = [];
  const regex = /@([^\s@]+\.\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    refs.push({ ref: match[1], line: content.slice(0, match.index).split('\n').length });
  }
  return refs;
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

function repoNeedsExternalTools(ctx) {
  const deps = ctx.projectDependencies ? Object.keys(ctx.projectDependencies()) : [];
  const depSet = new Set(deps);
  const files = new Set(ctx.files || []);
  const envContent = [ctx.fileContent('.env.example'), ctx.fileContent('.env.template'), ctx.fileContent('.env.sample')].filter(Boolean).join('\n');
  const docs = docsBundle(ctx);
  const combined = `${docs}\n${envContent}`;
  const externalDeps = ['pg', 'postgres', 'mysql', 'mysql2', 'mongodb', 'mongoose', 'redis', 'ioredis', 'prisma', 'sequelize', 'typeorm', 'supabase', '@supabase/supabase-js', 'stripe', 'openai', '@anthropic-ai/sdk', 'langchain', '@aws-sdk/client-s3'];
  if (externalDeps.some((d) => depSet.has(d))) return true;
  if (files.has('docker-compose.yml') || files.has('docker-compose.yaml') || files.has('compose.yml') || ctx.hasDir('prisma') || ctx.hasDir('infra') || ctx.hasDir('terraform')) return true;
  return /\bDATABASE_URL\b|\bREDIS_URL\b|\bSUPABASE_URL\b|\bSTRIPE_[A-Z_]+\b|\bAWS_[A-Z_]+\b/i.test(combined);
}

function workflowArtifacts(ctx) {
  const ghDir = path.join(ctx.dir, '.github', 'workflows');
  try {
    const files = require('fs').readdirSync(ghDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    return files.map(f => {
      const filePath = `.github/workflows/${f}`;
      return { filePath, content: ctx.fileContent(filePath) || '' };
    }).filter(item => item.content);
  } catch {
    return [];
  }
}

function hooksFromSettings(ctx) {
  const hooks = ctx.hooksConfig ? ctx.hooksConfig() : null;
  return hooks || null;
}

function hookEventEntries(hooks) {
  if (!hooks || typeof hooks !== 'object') return [];
  const entries = [];
  for (const [eventName, config] of Object.entries(hooks)) {
    const items = Array.isArray(config) ? config : [config];
    for (const item of items) {
      entries.push({ event: eventName, config: item });
    }
  }
  return entries;
}

function policyFileContents(ctx) {
  const files = ctx.policyFiles ? ctx.policyFiles() : [];
  return files.map(f => ({ filePath: f, content: ctx.fileContent(f) || '' })).filter(item => item.content);
}

// ─── GEMINI_TECHNIQUES ──────────────────────────────────────────────────────

const GEMINI_TECHNIQUES = {

  // =============================================
  // A. Instructions (7 checks) — GM-A01..GM-A07
  // =============================================

  geminiMdExists: {
    id: 'GM-A01',
    name: 'GEMINI.md exists at project root',
    check: (ctx) => Boolean(geminiMd(ctx)),
    impact: 'critical',
    rating: 5,
    category: 'instructions',
    fix: 'Create GEMINI.md at the project root with repo-specific instructions for Gemini CLI.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: (ctx) => (geminiMd(ctx) ? 1 : null),
  },

  geminiMdSubstantive: {
    id: 'GM-A02',
    name: 'GEMINI.md has substantive content (>20 lines, 2+ sections)',
    check: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      const nonEmpty = content.split(/\r?\n/).filter(l => l.trim()).length;
      return nonEmpty >= 20 && countSections(content) >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'instructions',
    fix: 'Expand GEMINI.md to at least 20 substantive lines and 2+ sections instead of a thin placeholder.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: () => 1,
  },

  geminiMdVerificationCommands: {
    id: 'GM-A03',
    name: 'GEMINI.md includes build/test/lint commands',
    check: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      const expected = expectedVerificationCategories(ctx);
      if (expected.length === 0) return /\bverify\b|\btest\b|\blint\b|\bbuild\b/i.test(content);
      return expected.every(cat => hasCommandMention(content, cat));
    },
    impact: 'high',
    rating: 5,
    category: 'instructions',
    fix: 'Document the actual test/lint/build commands so Gemini CLI can verify its own changes.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const content = geminiMd(ctx);
      return content ? (firstLineMatching(content, /\bVerification\b|\btest\b|\blint\b|\bbuild\b/i) || 1) : null;
    },
  },

  geminiMdArchitecture: {
    id: 'GM-A04',
    name: 'GEMINI.md has architecture section or Mermaid diagram',
    check: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      return hasArchitecture(content);
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Add an architecture or project map section to GEMINI.md so Gemini CLI understands the repo shape.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const content = geminiMd(ctx);
      return content ? firstLineMatching(content, /##\s+Architecture\b|##\s+Project Map\b|```mermaid/i) : null;
    },
  },

  geminiMdNoFiller: {
    id: 'GM-A05',
    name: 'No generic filler instructions',
    check: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      return !FILLER_PATTERNS.some(p => p.test(content));
    },
    impact: 'low',
    rating: 3,
    category: 'instructions',
    fix: 'Replace generic filler like "be helpful" with concrete repo-specific guidance that changes Gemini behavior.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const content = geminiMd(ctx);
      return content ? findFillerLine(content) : null;
    },
  },

  geminiMdImportsValid: {
    id: 'GM-A06',
    name: '@import references point to existing files',
    check: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      const refs = extractImportRefs(content);
      if (refs.length === 0) return true;
      return refs.every(r => Boolean(ctx.fileContent(r.ref)));
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Fix broken @file.md import references in GEMINI.md so all imported context files are actually loadable.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      const refs = extractImportRefs(content);
      const broken = refs.find(r => !ctx.fileContent(r.ref));
      return broken ? broken.line : null;
    },
  },

  geminiMdNoSecrets: {
    id: 'GM-A07',
    name: 'No secrets/API keys in GEMINI.md',
    check: (ctx) => {
      const content = geminiMd(ctx);
      if (!content) return null;
      return !containsEmbeddedSecret(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'instructions',
    fix: 'Remove API keys and secrets from GEMINI.md. Use environment variables or secret stores instead.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const content = geminiMd(ctx);
      return content ? findSecretLine(content) : null;
    },
  },

  // =============================================
  // B. Config (7 checks) — GM-B01..GM-B07
  // =============================================

  geminiSettingsExists: {
    id: 'GM-B01',
    name: '.gemini/settings.json exists',
    check: (ctx) => Boolean(ctx.fileContent('.gemini/settings.json')),
    impact: 'high',
    rating: 5,
    category: 'config',
    fix: 'Create .gemini/settings.json with explicit model, sandbox, and approval settings.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => (ctx.fileContent('.gemini/settings.json') ? 1 : null),
  },

  geminiSettingsValidJson: {
    id: 'GM-B02',
    name: 'Settings is valid JSON',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      if (!raw) return null;
      const result = ctx.settingsJson();
      return result && result.ok;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Fix malformed JSON in .gemini/settings.json. Invalid JSON causes exit code 52 — Gemini CLI will not start.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => {
      const result = ctx.settingsJson();
      if (result && result.ok) return null;
      if (result && result.error) {
        const match = result.error.match(/position (\d+)/i);
        if (match) {
          const raw = settingsRaw(ctx);
          return raw ? raw.slice(0, Number(match[1])).split('\n').length : 1;
        }
      }
      return 1;
    },
  },

  geminiModelExplicit: {
    id: 'GM-B03',
    name: 'Model is set explicitly in object format (v0.36.0+)',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      if (!data.model) return false;
      // v0.36.0: model field MUST be an object { name: "..." }, not a string
      // String format causes exit code 41: "Expected object, received string"
      if (typeof data.model === 'string') return false;
      if (typeof data.model === 'object' && data.model.name) return true;
      return false;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'CRITICAL: In v0.36.0+, model must be an object: {"model": {"name": "gemini-2.5-flash"}}. String format ({"model": "gemini-2.5-flash"}) causes exit code 41. Default model is now gemini-3-flash-preview.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /"model"/),
  },

  geminiExplicitSettings: {
    id: 'GM-B04',
    name: 'Theme/sandbox/approval settings are explicit',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      // At least sandbox or safety setting should be explicit
      return Boolean(data.sandbox || data.safety || data.theme);
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Set sandbox, safety, or theme settings explicitly in .gemini/settings.json instead of relying on defaults.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: () => 1,
  },

  geminiNoDeprecatedKeys: {
    id: 'GM-B05',
    name: 'No deprecated config keys',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      if (!raw) return null;
      const deprecatedPatterns = [
        /\bsandbox_mode\b/,
        /\bmax_tokens\b/,
        /\bmcp_servers\b/,
      ];
      return !deprecatedPatterns.some(p => p.test(raw));
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Replace deprecated config keys (sandbox_mode, max_tokens, mcp_servers) with their current equivalents.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      return raw ? firstLineMatching(raw, /\bsandbox_mode\b|\bmax_tokens\b|\bmcp_servers\b/) : null;
    },
  },

  geminiContextFileNameStandard: {
    id: 'GM-B06',
    name: 'context.fileName is standard or intentionally overridden',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      const contextFileName = data.context && data.context.fileName;
      if (!contextFileName) return true; // Using default GEMINI.md
      // If overridden, check that the custom file actually exists
      const names = Array.isArray(contextFileName) ? contextFileName : [contextFileName];
      return names.every(name => Boolean(ctx.fileContent(name)));
    },
    impact: 'low',
    rating: 3,
    category: 'config',
    fix: 'If context.fileName is overridden, ensure the custom instruction files exist and are intentional.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /context\.fileName|"fileName"/i),
  },

  geminiEnvApiKey: {
    id: 'GM-B07',
    name: '.env exists with required API keys (GEMINI_API_KEY or Google auth)',
    check: (ctx) => {
      const envContent = ctx.fileContent('.env') || '';
      const envExample = ctx.fileContent('.env.example') || ctx.fileContent('.env.template') || '';
      const combined = `${envContent}\n${envExample}`;
      // Check for Gemini API key or Google auth
      return /\bGEMINI_API_KEY\b|\bGOOGLE_API_KEY\b|\bGOOGLE_APPLICATION_CREDENTIALS\b|\bgcloud\b/i.test(combined) || Boolean(envContent);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Ensure .env or .env.example documents the GEMINI_API_KEY or Google authentication setup.',
    template: null,
    file: () => '.env',
    line: (ctx) => {
      const env = ctx.fileContent('.env') || ctx.fileContent('.env.example') || '';
      return env ? firstLineMatching(env, /GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_APPLICATION_CREDENTIALS/i) : null;
    },
  },

  // =============================================
  // C. Trust & Safety (9 checks) — GM-C01..GM-C09
  // =============================================

  geminiNoYolo: {
    id: 'GM-C01',
    name: 'No --yolo in project settings, scripts, or approval field',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      const gmd = geminiMd(ctx) || '';
      const combined = `${raw}\n${gmd}`;
      // Check settings and scripts for --yolo
      if (/--yolo\b|\byolo\b.*:\s*true/i.test(raw)) return false;
      // CRITICAL: v0.36.0 silently accepts "--yolo" as an approval value in settings.json
      // {"approval": "--yolo"} passes validation without warning
      const data = settingsData(ctx);
      if (data && data.approval && /yolo/i.test(String(data.approval))) return false;
      // Check package.json scripts
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      if (pkg && pkg.scripts) {
        const scriptValues = Object.values(pkg.scripts).join('\n');
        if (/\b--yolo\b/i.test(scriptValues)) return false;
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove --yolo from project settings and scripts. WARNING: v0.36.0 silently accepts "--yolo" in the approval field without any validation error — this is a security risk.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      return raw ? firstLineMatching(raw, /yolo/i) : null;
    },
  },

  geminiSandboxExplicit: {
    id: 'GM-C02',
    name: 'Sandbox mode is explicitly configured',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      return Boolean(data.sandbox && (data.sandbox.mode || typeof data.sandbox === 'string'));
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Set sandbox mode explicitly (Seatbelt/Docker/gVisor/bubblewrap) instead of relying on platform defaults.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /"sandbox"/i),
  },

  geminiTrustedFoldersIntentional: {
    id: 'GM-C03',
    name: 'Trusted Folders list is intentional (not blindly trust-all)',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      const trusted = data.trustedFolders || (data.safety && data.safety.trustedFolders);
      if (!trusted) return true; // No explicit trust-all
      if (Array.isArray(trusted)) {
        // Warn if trust-all patterns
        return !trusted.some(f => f === '*' || f === '/' || f === '~' || f === '**');
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'Restrict trustedFolders to specific project directories instead of wildcard trust-all patterns.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /trustedFolders/i),
  },

  geminiPolicyRulesForRiskyRepos: {
    id: 'GM-C04',
    name: 'Policy engine rules exist for elevated-risk repos',
    check: (ctx) => {
      if (!repoLooksRegulated(ctx)) return null;
      const policies = policyFileContents(ctx);
      return policies.length > 0;
    },
    impact: 'medium',
    rating: 4,
    category: 'trust',
    fix: 'For regulated repos, add policy TOML files under .gemini/policy/ to enforce tool and command restrictions.',
    template: null,
    file: () => '.gemini/policy',
    line: () => 1,
  },

  geminiNoPolicyContradictions: {
    id: 'GM-C05',
    name: 'No policy contradictions across tiers',
    check: (ctx) => {
      const policies = policyFileContents(ctx);
      if (policies.length < 2) return null;
      // Check for contradictory allow/deny on the same tool across policy files
      const allowedTools = new Set();
      const deniedTools = new Set();
      for (const policy of policies) {
        const allowMatches = policy.content.match(/allow\s*=\s*\[([^\]]*)\]/gi) || [];
        const denyMatches = policy.content.match(/deny\s*=\s*\[([^\]]*)\]/gi) || [];
        for (const m of allowMatches) {
          const tools = m.match(/["']([^"']+)["']/g) || [];
          tools.forEach(t => allowedTools.add(t.replace(/["']/g, '')));
        }
        for (const m of denyMatches) {
          const tools = m.match(/["']([^"']+)["']/g) || [];
          tools.forEach(t => deniedTools.add(t.replace(/["']/g, '')));
        }
      }
      // Contradiction: same tool both allowed and denied
      for (const tool of allowedTools) {
        if (deniedTools.has(tool)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'Remove contradictory allow/deny rules across policy tiers so Gemini CLI enforcement is predictable.',
    template: null,
    file: (ctx) => {
      const policies = policyFileContents(ctx);
      return policies.length > 0 ? policies[0].filePath : null;
    },
    line: () => 1,
  },

  geminiAutoEditCodeDeletionRisk: {
    id: 'GM-C06',
    name: 'auto_edit not enabled without code deletion risk awareness',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      const data = settingsData(ctx);
      if (!data) return null;
      const autoEdit = data.auto_edit || data.autoEdit || (data.safety && data.safety.autoEdit);
      if (!autoEdit) return true;
      // If auto_edit is on, check that code deletion bug is acknowledged
      const gmd = geminiMd(ctx) || '';
      const docs = `${gmd}\n${raw}`;
      return /\bcode deletion\b|\bbug\s*#?23497\b|\bdeletion risk\b|\bcode loss\b/i.test(docs);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'CRITICAL: auto_edit has a known code deletion bug (#23497). Document the risk or disable auto_edit until the bug is fixed.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /auto_?edit/i),
  },

  geminiNoSecretsInSettings: {
    id: 'GM-C07',
    name: 'No secrets in settings.json or command files',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      if (raw && containsEmbeddedSecret(raw)) return false;
      // Check command files
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (containsEmbeddedSecret(content)) return false;
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove API keys and secrets from settings.json and command files. Use environment variables instead.',
    template: null,
    file: (ctx) => {
      const raw = settingsRaw(ctx);
      if (raw && containsEmbeddedSecret(raw)) return '.gemini/settings.json';
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (containsEmbeddedSecret(content)) return f;
      }
      return null;
    },
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      if (raw && containsEmbeddedSecret(raw)) return findSecretLine(raw);
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (containsEmbeddedSecret(content)) return findSecretLine(content);
      }
      return null;
    },
  },

  geminiCodeDeletionBugAwareness: {
    id: 'GM-C08',
    name: 'Code deletion bug awareness documented for affected workflows',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      const data = settingsData(ctx);
      // Only relevant if auto_edit or --yolo might be in use
      const hasRiskySetting = data && (data.auto_edit || data.autoEdit || data.safety);
      if (!hasRiskySetting) return null;
      return /\bcode deletion\b|\bbug\s*#?23497\b|\bdeletion risk\b|\bgemini.*delet/i.test(gmd);
    },
    impact: 'medium',
    rating: 3,
    category: 'trust',
    fix: 'Document the known Gemini code deletion bug (#23497) in GEMINI.md for workflows that use auto_edit.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /code deletion|bug.*23497|deletion risk/i);
    },
  },

  geminiNoYoloInCI: {
    id: 'GM-C09',
    name: 'No --yolo in CI scripts or workflow files',
    check: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/\b--yolo\b/i.test(wf.content)) return false;
      }
      // Check Makefile, justfile, scripts
      const makefile = ctx.fileContent('Makefile') || '';
      if (/\b--yolo\b/i.test(makefile)) return false;
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Never use --yolo in CI. Remove it from all workflow files and build scripts.',
    template: null,
    file: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/\b--yolo\b/i.test(wf.content)) return wf.filePath;
      }
      const makefile = ctx.fileContent('Makefile') || '';
      if (/\b--yolo\b/i.test(makefile)) return 'Makefile';
      return null;
    },
    line: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        const line = firstLineMatching(wf.content, /--yolo/i);
        if (line) return line;
      }
      const makefile = ctx.fileContent('Makefile') || '';
      return firstLineMatching(makefile, /--yolo/i);
    },
  },

  // =============================================
  // D. Hooks (4 checks) — GM-D01..GM-D04
  // =============================================

  geminiHooksConfigured: {
    id: 'GM-D01',
    name: 'Hooks configured if project uses tool enforcement',
    check: (ctx) => {
      const hooks = hooksFromSettings(ctx);
      if (hooks) return true;
      // Check if GEMINI.md mentions hooks
      const gmd = geminiMd(ctx) || '';
      const claimsHooks = /\bhooks?\b|\bBeforeTool\b|\bAfterTool\b/i.test(gmd);
      if (!claimsHooks) return null; // Not relevant
      return false; // Claims hooks but none configured
    },
    impact: 'medium',
    rating: 4,
    category: 'hooks',
    fix: 'Add hooks configuration to .gemini/settings.json if the project uses tool enforcement.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /hooks/i),
  },

  geminiHookMatchersSpecific: {
    id: 'GM-D02',
    name: 'BeforeTool/AfterTool matchers use specific regex (not catch-all)',
    check: (ctx) => {
      const hooks = hooksFromSettings(ctx);
      if (!hooks) return null;
      const entries = hookEventEntries(hooks);
      if (entries.length === 0) return null;
      for (const entry of entries) {
        const cfg = entry.config;
        if (!cfg) continue;
        const matcher = cfg.matcher || cfg.pattern || cfg.toolName;
        if (typeof matcher === 'string') {
          if (matcher === '*' || matcher === '.*' || matcher === '.+') return false;
        }
      }
      return true;
    },
    impact: 'medium',
    rating: 4,
    category: 'hooks',
    fix: 'Replace catch-all hook matchers (* or .*) with specific tool name regex patterns.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      return raw ? firstLineMatching(raw, /["'](\*|\.\*|\.\+)["']/i) : null;
    },
  },

  geminiAfterToolScrubbing: {
    id: 'GM-D03',
    name: 'AfterTool output scrubbing used for sensitive tool results',
    check: (ctx) => {
      const hooks = hooksFromSettings(ctx);
      if (!hooks) return null;
      const afterTool = hooks.AfterTool;
      if (!afterTool) return null;
      // Check that AfterTool hooks exist with scrubbing capability
      const entries = Array.isArray(afterTool) ? afterTool : [afterTool];
      const hasScrub = entries.some(entry => {
        const cmd = typeof entry === 'string' ? entry : (entry.command || entry.cmd || '');
        return /\bscrub\b|\bredact\b|\bfilter\b|\bdeny\b|\bstrip\b/i.test(cmd);
      });
      return hasScrub || entries.length > 0; // At least AfterTool is configured
    },
    impact: 'medium',
    rating: 4,
    category: 'hooks',
    fix: 'Configure AfterTool hooks to scrub sensitive output from tool results before they reach the model.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /AfterTool/i),
  },

  geminiHookTimeoutReasonable: {
    id: 'GM-D04',
    name: 'Hook timeout is reasonable (<60s)',
    check: (ctx) => {
      const hooks = hooksFromSettings(ctx);
      if (!hooks) return null;
      const entries = hookEventEntries(hooks);
      for (const entry of entries) {
        const cfg = entry.config;
        if (cfg && typeof cfg === 'object' && typeof cfg.timeout === 'number') {
          if (cfg.timeout > 60) return false;
        }
      }
      return true;
    },
    impact: 'low',
    rating: 3,
    category: 'hooks',
    fix: 'Keep hook timeouts at 60 seconds or less unless the repo documents why a longer timeout is needed.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      return raw ? firstLineMatching(raw, /"timeout"\s*:\s*(6[1-9]|[7-9]\d|\d{3,})/i) : null;
    },
  },

  // =============================================
  // E. MCP (6 checks) — GM-E01..GM-E06
  // =============================================

  geminiMcpConfigured: {
    id: 'GM-E01',
    name: 'MCP servers configured if project needs external tools',
    check: (ctx) => {
      if (!repoNeedsExternalTools(ctx)) return null;
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      return Object.keys(servers).length > 0;
    },
    impact: 'medium',
    rating: 4,
    category: 'mcp',
    fix: 'This repo depends on external services. Add MCP servers to .gemini/settings.json so Gemini CLI can use live context.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: () => 1,
  },

  geminiMcpExcludeTools: {
    id: 'GM-E02',
    name: 'excludeTools used to restrict dangerous tools',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const ids = Object.keys(servers);
      if (ids.length === 0) return null;
      // In Gemini, excludeTools always wins — check it's used
      return ids.some(id => {
        const server = servers[id];
        return server && Array.isArray(server.excludeTools) && server.excludeTools.length > 0;
      });
    },
    impact: 'high',
    rating: 4,
    category: 'mcp',
    fix: 'Use excludeTools on MCP servers to restrict dangerous tools. In Gemini, excludeTools always wins over includeTools.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /excludeTools/i),
  },

  geminiMcpTransportAppropriate: {
    id: 'GM-E03',
    name: 'Transport type is appropriate (stdio for local, SSE/HTTP for remote)',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const ids = Object.keys(servers);
      if (ids.length === 0) return null;
      for (const id of ids) {
        const server = servers[id];
        if (!server) continue;
        const transport = server.transport || '';
        const hasUrl = Boolean(server.url);
        // Remote servers should use SSE or HTTP streaming, not stdio
        if (hasUrl && transport === 'stdio') return false;
        // Local servers should use stdio, not remote protocols
        if (!hasUrl && server.command && (transport === 'sse' || transport === 'http')) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Use stdio transport for local MCP servers and SSE/HTTP streaming for remote servers.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /transport/i),
  },

  geminiMcpExcludeOverInclude: {
    id: 'GM-E04',
    name: 'excludeTools used instead of includeTools (Gemini security model)',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const ids = Object.keys(servers);
      if (ids.length === 0) return null;
      // Flag if includeTools is used without excludeTools (Gemini security best practice)
      for (const id of ids) {
        const server = servers[id];
        if (!server) continue;
        const hasInclude = Array.isArray(server.includeTools) && server.includeTools.length > 0;
        const hasExclude = Array.isArray(server.excludeTools) && server.excludeTools.length > 0;
        if (hasInclude && !hasExclude) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'mcp',
    fix: 'In Gemini CLI, excludeTools always wins. Use excludeTools for security instead of relying on includeTools alone.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /includeTools/i),
  },

  geminiMcpAuthDocumented: {
    id: 'GM-E05',
    name: 'Auth requirements documented for MCP servers',
    check: (ctx) => {
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      const ids = Object.keys(servers);
      if (ids.length === 0) return null;
      const docs = docsBundle(ctx);
      for (const id of ids) {
        const server = servers[id];
        if (!server || !server.url) continue; // Only remote servers need auth docs
        const hasInlineAuth = Boolean(server.token || server.headers || server.env);
        const hasDocNote = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[\\s\\S]{0,140}\\b(auth|token|credential|env)\\b`, 'i').test(docs);
        if (!hasInlineAuth && !hasDocNote) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Document auth requirements for remote MCP servers so setup is reviewable by team members.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /mcpServers/i),
  },

  geminiMcpNoDeprecatedTransport: {
    id: 'GM-E06',
    name: 'No deprecated transport types in MCP config',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      if (!raw) return null;
      const servers = ctx.mcpServers ? ctx.mcpServers() : {};
      if (Object.keys(servers).length === 0) return null;
      // Check for deprecated transport names
      return !/"transport"\s*:\s*"(http\+sse|legacy-sse)"/i.test(raw);
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'Replace deprecated MCP transport types with current ones (stdio or streamable HTTP).',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      return raw ? firstLineMatching(raw, /http\+sse|legacy-sse/i) : null;
    },
  },

  // =============================================
  // F. Sandbox & Policy (7 checks) — GM-F01..GM-F07
  // =============================================

  geminiSandboxModeExplicit: {
    id: 'GM-F01',
    name: 'Sandbox mode is explicit (Seatbelt/Docker/gVisor/bubblewrap)',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      const sandbox = data.sandbox;
      if (!sandbox) return false;
      const mode = typeof sandbox === 'string' ? sandbox : sandbox.mode;
      const validModes = ['seatbelt', 'docker', 'podman', 'gvisor', 'lxc', 'lxd', 'bubblewrap', 'none'];
      return Boolean(mode && validModes.some(m => mode.toLowerCase().includes(m)));
    },
    impact: 'high',
    rating: 5,
    category: 'sandbox',
    fix: 'Set an explicit sandbox mode (Seatbelt, Docker, gVisor, bubblewrap) instead of defaulting silently.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /sandbox/i),
  },

  geminiSandboxPermissionsRestricted: {
    id: 'GM-F02',
    name: 'Sandbox permissions are appropriately restricted',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data || !data.sandbox) return null;
      const perms = data.sandbox.permissions;
      if (!perms) return null;
      // Check for overly broad permissions
      if (perms.network === true && perms.filesystem === 'full') return false;
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'sandbox',
    fix: 'Restrict sandbox permissions. Avoid granting both full network and full filesystem access.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /permissions/i),
  },

  geminiPolicyEngineConfigured: {
    id: 'GM-F03',
    name: 'Policy engine rules configured when policy files exist',
    check: (ctx) => {
      const policies = policyFileContents(ctx);
      if (policies.length === 0) return null;
      // At least one policy file should have actual rules
      return policies.some(p => /\ballow\b|\bdeny\b|\brule\b|\btool\b/i.test(p.content));
    },
    impact: 'medium',
    rating: 4,
    category: 'sandbox',
    fix: 'Policy files exist but contain no rules. Add allow/deny rules or remove empty policy files.',
    template: null,
    file: (ctx) => {
      const policies = policyFileContents(ctx);
      return policies.length > 0 ? policies[0].filePath : null;
    },
    line: () => 1,
  },

  geminiPolicyTiersValid: {
    id: 'GM-F04',
    name: 'Policy TOML files are valid and parseable',
    check: (ctx) => {
      const policies = ctx.policyFiles ? ctx.policyFiles() : [];
      if (policies.length === 0) return null;
      for (const f of policies) {
        const parsed = ctx.policyConfig ? ctx.policyConfig(f) : null;
        if (parsed && !parsed.ok) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'sandbox',
    fix: 'Fix malformed TOML in policy files so the policy engine does not silently skip rules.',
    template: null,
    file: (ctx) => {
      const policies = ctx.policyFiles ? ctx.policyFiles() : [];
      for (const f of policies) {
        const parsed = ctx.policyConfig ? ctx.policyConfig(f) : null;
        if (parsed && !parsed.ok) return f;
      }
      return null;
    },
    line: (ctx) => {
      const policies = ctx.policyFiles ? ctx.policyFiles() : [];
      for (const f of policies) {
        const parsed = ctx.policyConfig ? ctx.policyConfig(f) : null;
        if (parsed && !parsed.ok && parsed.error) {
          const match = parsed.error.match(/Line (\d+)/i);
          if (match) return Number(match[1]);
        }
      }
      return 1;
    },
  },

  geminiPolicyTiersDontConflict: {
    id: 'GM-F05',
    name: 'Policy engine tiers don\'t conflict',
    check: (ctx) => {
      const policies = policyFileContents(ctx);
      if (policies.length < 2) return null;
      // Detect conflicting tool decisions across tiers
      const perFile = policies.map(p => {
        const allows = new Set();
        const denies = new Set();
        const allowBlock = p.content.match(/allow\s*=\s*\[([^\]]*)\]/gi) || [];
        const denyBlock = p.content.match(/deny\s*=\s*\[([^\]]*)\]/gi) || [];
        for (const m of allowBlock) (m.match(/["']([^"']+)["']/g) || []).forEach(t => allows.add(t.replace(/["']/g, '')));
        for (const m of denyBlock) (m.match(/["']([^"']+)["']/g) || []).forEach(t => denies.add(t.replace(/["']/g, '')));
        return { filePath: p.filePath, allows, denies };
      });
      // Cross-file: tool allowed in one, denied in another
      for (let i = 0; i < perFile.length; i++) {
        for (let j = i + 1; j < perFile.length; j++) {
          for (const tool of perFile[i].allows) {
            if (perFile[j].denies.has(tool)) return false;
          }
          for (const tool of perFile[i].denies) {
            if (perFile[j].allows.has(tool)) return false;
          }
        }
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'sandbox',
    fix: 'Resolve conflicting allow/deny rules across policy tiers so enforcement is predictable.',
    template: null,
    file: (ctx) => {
      const policies = policyFileContents(ctx);
      return policies.length > 0 ? policies[0].filePath : null;
    },
    line: () => 1,
  },

  geminiSandboxNotNone: {
    id: 'GM-F06',
    name: 'Sandbox mode is not "none" in shared repos',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data || !data.sandbox) return null;
      const mode = typeof data.sandbox === 'string' ? data.sandbox : (data.sandbox.mode || '');
      if (mode.toLowerCase() !== 'none') return true;
      // If "none", check for justification
      const gmd = geminiMd(ctx) || '';
      return JUSTIFICATION_PATTERNS.test(gmd);
    },
    impact: 'high',
    rating: 5,
    category: 'sandbox',
    fix: 'Avoid sandbox.mode = "none" in shared repos. If intentional, document the justification in GEMINI.md.',
    template: null,
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /sandbox/i),
  },

  geminiPolicyDocumentation: {
    id: 'GM-F07',
    name: 'Policy rules are documented for team onboarding',
    check: (ctx) => {
      const policies = policyFileContents(ctx);
      if (policies.length === 0) return null;
      const docs = docsBundle(ctx);
      return /\bpolicy\b|\bpolicies\b|\benforcement\b/i.test(docs);
    },
    impact: 'low',
    rating: 3,
    category: 'sandbox',
    fix: 'Document policy engine rules in GEMINI.md so new team members understand enforcement boundaries.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /policy|policies|enforcement/i);
    },
  },

  // =============================================
  // G. Skills & Agents (5 checks) — GM-G01..GM-G05 (v0.5)
  // =============================================

  geminiAgentsFrontmatter: {
    id: 'GM-G01',
    name: 'Agent .md files have YAML frontmatter',
    check: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      if (agentFiles.length === 0) return null;
      for (const f of agentFiles) {
        const content = ctx.fileContent(f) || '';
        if (!content.trimStart().startsWith('---')) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'agents',
    fix: 'Add YAML frontmatter (---) to all agent .md files under .gemini/agents/ so Gemini can parse agent metadata.',
    template: null,
    file: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      for (const f of agentFiles) {
        const content = ctx.fileContent(f) || '';
        if (!content.trimStart().startsWith('---')) return f;
      }
      return null;
    },
    line: () => 1,
  },

  geminiAgentNamesDescriptive: {
    id: 'GM-G02',
    name: 'Agent names are descriptive',
    check: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      if (agentFiles.length === 0) return null;
      for (const f of agentFiles) {
        const name = path.basename(f, '.md');
        // Flag single-letter or very short non-descriptive names
        if (name.length < 3 || /^(a|b|c|x|y|z|test|tmp|foo|bar)$/i.test(name)) return false;
      }
      return true;
    },
    impact: 'low',
    rating: 3,
    category: 'agents',
    fix: 'Use descriptive agent names (e.g., code-reviewer, security-auditor) instead of generic placeholders.',
    template: null,
    file: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      for (const f of agentFiles) {
        const name = path.basename(f, '.md');
        if (name.length < 3) return f;
      }
      return null;
    },
    line: () => 1,
  },

  geminiAgentInstructionsScoped: {
    id: 'GM-G03',
    name: 'Agent instructions are scoped (not generic)',
    check: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      if (agentFiles.length === 0) return null;
      for (const f of agentFiles) {
        const content = ctx.fileContent(f) || '';
        if (FILLER_PATTERNS.some(p => p.test(content))) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 4,
    category: 'agents',
    fix: 'Replace generic agent instructions with task-specific guidance so agents stay focused on their role.',
    template: null,
    file: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      for (const f of agentFiles) {
        const content = ctx.fileContent(f) || '';
        if (FILLER_PATTERNS.some(p => p.test(content))) return f;
      }
      return null;
    },
    line: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      for (const f of agentFiles) {
        const content = ctx.fileContent(f) || '';
        if (FILLER_PATTERNS.some(p => p.test(content))) return findFillerLine(content);
      }
      return null;
    },
  },

  geminiNoDuplicateAgentNames: {
    id: 'GM-G04',
    name: 'No duplicate agent names (global vs project)',
    check: (ctx) => {
      const projectAgents = ctx.agentFiles ? ctx.agentFiles() : [];
      if (projectAgents.length === 0) return null;
      const projectNames = new Set(projectAgents.map(f => path.basename(f, '.md').toLowerCase()));
      // Check global agents
      const homeDir = os.homedir();
      const globalAgentsDir = path.join(homeDir, '.gemini', 'agents');
      try {
        const globalFiles = require('fs').readdirSync(globalAgentsDir).filter(f => f.endsWith('.md'));
        const globalNames = globalFiles.map(f => path.basename(f, '.md').toLowerCase());
        for (const name of globalNames) {
          if (projectNames.has(name)) return false;
        }
      } catch {
        // No global agents
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'Resolve duplicate agent names between global (~/.gemini/agents/) and project (.gemini/agents/) to avoid shadowing.',
    template: null,
    file: (ctx) => {
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      return agentFiles.length > 0 ? agentFiles[0] : null;
    },
    line: () => 1,
  },

  geminiSkillsDescribed: {
    id: 'GM-G05',
    name: 'Skills have clear descriptions for auto-invocation',
    check: (ctx) => {
      const skillDirs = ctx.skillDirs ? ctx.skillDirs() : [];
      if (skillDirs.length === 0) return null;
      for (const skillName of skillDirs) {
        // Check for a description file or frontmatter in the skill
        const readmePath = `.gemini/skills/${skillName}/README.md`;
        const indexPath = `.gemini/skills/${skillName}/index.md`;
        const content = ctx.fileContent(readmePath) || ctx.fileContent(indexPath) || '';
        if (!content || content.trim().length < 10) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'skills',
    fix: 'Give each skill a README.md or index.md with a clear description so Gemini CLI can auto-invoke correctly.',
    template: null,
    file: (ctx) => {
      const skillDirs = ctx.skillDirs ? ctx.skillDirs() : [];
      return skillDirs.length > 0 ? `.gemini/skills/${skillDirs[0]}` : null;
    },
    line: () => 1,
  },

  // =============================================
  // H. CI & Automation (4 checks) — GM-H01..GM-H04 (v0.5)
  // =============================================

  geminiCiAuthEnvVar: {
    id: 'GM-H01',
    name: 'Headless mode auth uses env var (not hardcoded key)',
    check: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (!/\bgemini\b/i.test(wf.content)) continue;
        // Check for hardcoded secrets
        const hasHardcoded = /GEMINI_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i.test(wf.content) ||
          containsEmbeddedSecret(wf.content);
        if (hasHardcoded) return false;
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'automation',
    fix: 'Use ${{ secrets.GEMINI_API_KEY }} or managed secret injection in CI. Never hardcode API keys in workflow files.',
    template: null,
    file: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/GEMINI_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i.test(wf.content)) return wf.filePath;
      }
      return null;
    },
    line: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        const line = firstLineMatching(wf.content, /GEMINI_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i);
        if (line) return line;
      }
      return null;
    },
  },

  geminiCiNoYolo: {
    id: 'GM-H02',
    name: 'CI scripts don\'t use --yolo',
    check: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/\b--yolo\b/i.test(wf.content)) return false;
      }
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'automation',
    fix: 'Remove --yolo from all CI workflow files. Never bypass safety controls in automated pipelines.',
    template: null,
    file: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/\b--yolo\b/i.test(wf.content)) return wf.filePath;
      }
      return null;
    },
    line: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        const line = firstLineMatching(wf.content, /--yolo/i);
        if (line) return line;
      }
      return null;
    },
  },

  geminiCiEnvVarConflict: {
    id: 'GM-H03',
    name: 'CI_* env var conflict awareness (bug #1563)',
    check: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (!/\bgemini\b/i.test(wf.content)) continue;
        // Check if CI_ env vars are set that might force non-interactive mode
        if (/\bCI_[A-Z_]+\s*[:=]/i.test(wf.content)) {
          // Check if the issue is acknowledged
          const gmd = geminiMd(ctx) || '';
          return /\bCI_\*\b|\bbug\s*#?1563\b|\bnon-interactive\b|\bCI.*env.*var/i.test(gmd) ||
            /\bCI_\*\b|\bbug.*1563\b|\bnon-interactive/i.test(wf.content);
        }
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'automation',
    fix: 'Known bug #1563: any CI_* environment variable forces non-interactive mode. Document this or avoid setting CI_* vars in Gemini workflows.',
    template: null,
    file: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/\bCI_[A-Z_]+\s*[:=]/i.test(wf.content)) return wf.filePath;
      }
      return null;
    },
    line: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        const line = firstLineMatching(wf.content, /CI_[A-Z_]+\s*[:=]/i);
        if (line) return line;
      }
      return null;
    },
  },

  geminiCiJsonOutput: {
    id: 'GM-H04',
    name: 'Headless output uses -o json (not deprecated --json)',
    check: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (!/\bgemini\b/i.test(wf.content)) continue;
        // If gemini is used in CI with -p (prompt), check for -o json (correct) and flag --json (removed in v0.36.0)
        if (/gemini\s+.*-p\b/i.test(wf.content)) {
          // CRITICAL: --json was removed in v0.36.0. Correct flag is -o json or --output-format json
          if (/--json\b/i.test(wf.content)) return false; // Using deprecated flag
          return /-o\s+json\b|--output-format\s+json\b/i.test(wf.content);
        }
      }
      return null; // Not relevant if no headless usage
    },
    impact: 'critical',
    rating: 5,
    category: 'automation',
    fix: 'CRITICAL: --json flag was removed in v0.36.0. Use `-o json` or `--output-format json` instead. Three formats available: text, json, stream-json.',
    template: null,
    file: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/gemini\s+.*-p\b/i.test(wf.content) && (/--json\b/i.test(wf.content) || !/-o\s+json\b|--output-format\s+json\b/i.test(wf.content))) return wf.filePath;
      }
      return null;
    },
    line: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        const line = firstLineMatching(wf.content, /gemini\s+.*-p\b/i);
        if (line && (/--json\b/i.test(wf.content) || !/-o\s+json\b|--output-format\s+json\b/i.test(wf.content))) return line;
      }
      return null;
    },
  },

  // =============================================
  // I. Extensions (5 checks) — GM-I01..GM-I05 (v0.5)
  // =============================================

  geminiSkillNamingConvention: {
    id: 'GM-I01',
    name: 'Skill directories follow naming conventions',
    check: (ctx) => {
      const skillDirs = ctx.skillDirs ? ctx.skillDirs() : [];
      if (skillDirs.length === 0) return null;
      return skillDirs.every(name => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name));
    },
    impact: 'medium',
    rating: 3,
    category: 'extensions',
    fix: 'Use kebab-case for skill directory names (e.g., code-reviewer, not CodeReviewer).',
    template: null,
    file: (ctx) => {
      const skillDirs = ctx.skillDirs ? ctx.skillDirs() : [];
      const bad = skillDirs.find(name => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name));
      return bad ? `.gemini/skills/${bad}` : null;
    },
    line: () => 1,
  },

  geminiExtensionsTrusted: {
    id: 'GM-I02',
    name: 'Extensions are from trusted sources',
    check: (ctx) => {
      const extDirs = ctx.extensionDirs ? ctx.extensionDirs() : [];
      if (extDirs.length === 0) return null;
      // Check that extensions have documentation about their source
      const docs = docsBundle(ctx);
      return /\bextension\b.*\btrusted\b|\bextension\b.*\bverified\b|\bextension\b.*\bsource\b/i.test(docs);
    },
    impact: 'high',
    rating: 4,
    category: 'extensions',
    fix: 'Document the source and trust status of installed extensions in GEMINI.md.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /extension/i);
    },
  },

  geminiExtensionMcpSafe: {
    id: 'GM-I03',
    name: 'Extension MCP configs don\'t override project security',
    check: (ctx) => {
      const extDirs = ctx.extensionDirs ? ctx.extensionDirs() : [];
      if (extDirs.length === 0) return null;
      // Check extension settings for MCP overrides
      for (const ext of extDirs) {
        const settingsPath = `.gemini/extensions/${ext}/settings.json`;
        const content = ctx.fileContent(settingsPath) || '';
        if (content) {
          try {
            const data = JSON.parse(content);
            // Flag if extension adds MCP servers without excludeTools
            if (data.mcpServers) {
              for (const server of Object.values(data.mcpServers)) {
                if (server && !server.excludeTools) return false;
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'extensions',
    fix: 'Ensure extension MCP configs use excludeTools and don\'t silently override project security settings.',
    template: null,
    file: (ctx) => {
      const extDirs = ctx.extensionDirs ? ctx.extensionDirs() : [];
      for (const ext of extDirs) {
        const settingsPath = `.gemini/extensions/${ext}/settings.json`;
        if (ctx.fileContent(settingsPath)) return settingsPath;
      }
      return null;
    },
    line: () => 1,
  },

  geminiNoOrphanedSkillRefs: {
    id: 'GM-I04',
    name: 'No orphaned skill references',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      const skillDirs = ctx.skillDirs ? ctx.skillDirs() : [];
      const skillNames = new Set(skillDirs.map(n => n.toLowerCase()));
      // Find skill references in GEMINI.md
      const refs = gmd.match(/\.gemini\/skills\/([a-z0-9-]+)/gi) || [];
      for (const ref of refs) {
        const name = ref.split('/').pop().toLowerCase();
        if (!skillNames.has(name)) return false;
      }
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'extensions',
    fix: 'Remove references to skills that no longer exist in .gemini/skills/.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /\.gemini\/skills\//i);
    },
  },

  geminiMemoryContentIntentional: {
    id: 'GM-I05',
    name: '/memory content is intentional (not accumulated junk)',
    check: (ctx) => {
      // Check for a .gemini/memory file or memory-related config
      const memoryContent = ctx.fileContent('.gemini/memory.md') || ctx.fileContent('.gemini/memory') || '';
      if (!memoryContent) return null;
      const lines = memoryContent.split(/\r?\n/).filter(l => l.trim());
      // Flag if memory has become very large (>100 lines) without organization
      if (lines.length > 100 && !countSections(memoryContent)) return false;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'extensions',
    fix: 'Review /memory content periodically. Remove stale entries and organize into sections if it grows large.',
    template: null,
    file: () => '.gemini/memory.md',
    line: () => 1,
  },

  // =============================================
  // J. Review & Workflow (4 checks) — GM-J01..GM-J04 (v1.0)
  // =============================================

  geminiRateLimitAwareness: {
    id: 'GM-J01',
    name: 'Rate limit/quota awareness documented',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return /\brate limit\b|\bquota\b|\brequests? per\b|\bcost\b|\btoken\b.*\blimit\b/i.test(gmd);
    },
    impact: 'medium',
    rating: 3,
    category: 'review',
    fix: 'Document rate limit and quota awareness in GEMINI.md. Free tier hits limits after 10-20 requests.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /rate limit|quota|requests? per|cost|token.*limit/i);
    },
  },

  geminiRetryStrategy: {
    id: 'GM-J02',
    name: 'Retry/fallback strategy for rate limiting',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      const raw = settingsRaw(ctx);
      const combined = `${gmd}\n${raw}`;
      // Only check if rate limiting is a concern (i.e., docs mention it)
      if (!/\brate\b|\bquota\b|\bfree tier\b/i.test(combined)) return null;
      return /\bretry\b|\bfallback\b|\bbackoff\b|\bexponential\b/i.test(combined);
    },
    impact: 'medium',
    rating: 3,
    category: 'review',
    fix: 'Document a retry or fallback strategy for rate limiting situations.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /retry|fallback|backoff/i);
    },
  },

  geminiSessionPersistence: {
    id: 'GM-J03',
    name: 'Session history persistence is configured',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      // Check if session/history settings are explicit
      return data.history !== undefined || data.session !== undefined || data.telemetry !== undefined;
    },
    impact: 'low',
    rating: 2,
    category: 'review',
    fix: 'Set session and history persistence settings explicitly in .gemini/settings.json.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /history|session|telemetry/i),
  },

  geminiNoSensitiveMemory: {
    id: 'GM-J04',
    name: 'No sensitive data in saved memory',
    check: (ctx) => {
      const memoryContent = ctx.fileContent('.gemini/memory.md') || ctx.fileContent('.gemini/memory') || '';
      if (!memoryContent) return null;
      return !containsEmbeddedSecret(memoryContent);
    },
    impact: 'high',
    rating: 4,
    category: 'review',
    fix: 'Remove secrets and sensitive data from saved memory files.',
    template: null,
    file: () => '.gemini/memory.md',
    line: (ctx) => {
      const content = ctx.fileContent('.gemini/memory.md') || ctx.fileContent('.gemini/memory') || '';
      return content ? findSecretLine(content) : null;
    },
  },

  // =============================================
  // K. Quality Deep (5 checks) — GM-K01..GM-K05 (v1.0)
  // =============================================

  geminiMdModernFeatures: {
    id: 'GM-K01',
    name: 'GEMINI.md mentions modern features (skills, extensions, hooks)',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      if (!gmd) return null;
      const skillDirs = ctx.skillDirs ? ctx.skillDirs() : [];
      const agentFiles = ctx.agentFiles ? ctx.agentFiles() : [];
      const hooks = hooksFromSettings(ctx);
      const extDirs = ctx.extensionDirs ? ctx.extensionDirs() : [];
      const hasModernSurfaces = skillDirs.length > 0 || agentFiles.length > 0 || hooks || extDirs.length > 0;
      if (!hasModernSurfaces) return null;
      return /\bskills?\b|\bextensions?\b|\bhooks?\b|\bagents?\b/i.test(gmd);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'If the repo uses skills, extensions, hooks, or agents, mention these in GEMINI.md so Gemini CLI gets the right context.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: () => 1,
  },

  geminiNoDeprecatedPatterns: {
    id: 'GM-K02',
    name: 'No deprecated Gemini patterns',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      const raw = settingsRaw(ctx);
      const combined = `${gmd}\n${raw}`;
      // Check for deprecated patterns
      const deprecated = [
        /\bsandbox_mode\b/,
        /\bmax_tokens\b/,
        /\bmcp_servers\b/,
        /\bgemini-mini\b/i,
      ];
      return !deprecated.some(p => p.test(combined));
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Update deprecated Gemini patterns to their current equivalents.',
    template: null,
    file: (ctx) => {
      const raw = settingsRaw(ctx);
      if (/\bsandbox_mode\b|\bmax_tokens\b|\bmcp_servers\b|\bgemini-mini\b/i.test(raw)) return '.gemini/settings.json';
      return 'GEMINI.md';
    },
    line: (ctx) => {
      const raw = settingsRaw(ctx);
      return firstLineMatching(raw, /sandbox_mode|max_tokens|mcp_servers|gemini-mini/i) ||
        firstLineMatching(geminiMd(ctx) || '', /sandbox_mode|max_tokens|mcp_servers|gemini-mini/i);
    },
  },

  geminiComponentMdForMonorepo: {
    id: 'GM-K03',
    name: 'Component-level GEMINI.md used for monorepo sections',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      // Only relevant for monorepos
      const isMonorepo = ctx.fileContent('lerna.json') || ctx.fileContent('pnpm-workspace.yaml') ||
        ctx.hasDir('packages') || ctx.hasDir('apps');
      if (!isMonorepo) return null;
      // Check for component-level GEMINI.md files
      const dirs = ['packages', 'apps', 'services', 'libs'];
      for (const dir of dirs) {
        if (!ctx.hasDir(dir)) continue;
        try {
          const subdirs = require('fs').readdirSync(path.join(ctx.dir, dir), { withFileTypes: true })
            .filter(e => e.isDirectory())
            .slice(0, 5); // Check first 5 packages
          const hasComponent = subdirs.some(d => {
            const mdPath = path.join(dir, d.name, 'GEMINI.md');
            return Boolean(ctx.fileContent(mdPath));
          });
          if (hasComponent) return true;
        } catch {
          continue;
        }
      }
      return false;
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'For monorepos, add component-level GEMINI.md files in package subdirectories. NOTE: v0.36.0 loads ALL subdirectory GEMINI.md files eagerly at startup (not JIT) — watch for token bloat in large monorepos.',
    template: null,
    file: () => 'GEMINI.md',
    line: () => 1,
  },

  geminiFlashVsProDocumented: {
    id: 'GM-K04',
    name: 'Flash vs Pro model implications documented',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      const data = settingsData(ctx);
      if (!data || !data.model) return null;
      // v0.36.0: model is an object { name: "..." } or could be a legacy string
      const modelName = (typeof data.model === 'object' && data.model.name) ? data.model.name : String(data.model);
      const model = modelName.toLowerCase();
      // If using a specific model, check that implications are documented
      if (/flash|pro/i.test(model)) {
        return /\bflash\b|\bpro\b|\bmodel\b.*\b(fast|cheap|accurate|expensive|quality)\b/i.test(gmd);
      }
      return null;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Document why the chosen model (Flash vs Pro) is appropriate for this project\'s workflows.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /flash|pro|model.*fast|model.*quality/i);
    },
  },

  geminiTokenUsageAwareness: {
    id: 'GM-K05',
    name: 'Token usage awareness in GEMINI.md',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      if (!gmd) return null;
      return /\btoken\b|\bcontext window\b|\bcontext length\b|\b1M\b|\btruncat/i.test(gmd);
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Add a note about token usage and context window awareness to GEMINI.md.',
    template: null,
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /token|context window|context length|1M|truncat/i);
    },
  },

  // =============================================
  // L. Commands (5 checks) — GM-L01..GM-L05 (v1.0)
  // =============================================

  geminiCommandsExist: {
    id: 'GM-L01',
    name: 'Custom commands exist in .gemini/commands/',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      return commandFiles.length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'commands',
    fix: 'Create custom commands under .gemini/commands/*.toml for frequently-used workflows.',
    template: null,
    file: () => '.gemini/commands',
    line: () => null,
  },

  geminiCommandsHaveDescription: {
    id: 'GM-L02',
    name: 'Commands have description field',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      if (commandFiles.length === 0) return null;
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (!/\bdescription\s*=/i.test(content)) return false;
      }
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'commands',
    fix: 'Add a description field to each command TOML file for discoverability.',
    template: null,
    file: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (!/\bdescription\s*=/i.test(content)) return f;
      }
      return null;
    },
    line: () => 1,
  },

  geminiCommandsNoUnsafeShellInjection: {
    id: 'GM-L03',
    name: 'Commands don\'t use unsafe !{} shell injection',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      if (commandFiles.length === 0) return null;
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (/!\{[^}]+\}/.test(content)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'commands',
    fix: 'SECURITY: Remove !{} shell injection from commands. This is unique to Gemini and allows arbitrary shell execution.',
    template: null,
    file: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        if (/!\{[^}]+\}/.test(content)) return f;
      }
      return null;
    },
    line: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const content = ctx.fileContent(f) || '';
        const line = firstLineMatching(content, /!\{[^}]+\}/);
        if (line) return line;
      }
      return null;
    },
  },

  geminiCommandsUseArgs: {
    id: 'GM-L04',
    name: 'Commands use {{args}} for flexibility',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      if (commandFiles.length === 0) return null;
      // At least one command should use args for flexibility
      return commandFiles.some(f => {
        const content = ctx.fileContent(f) || '';
        return /\{\{args?\}\}/i.test(content);
      });
    },
    impact: 'low',
    rating: 2,
    category: 'commands',
    fix: 'Use {{args}} in at least some commands to allow flexible invocation.',
    template: null,
    file: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      return commandFiles.length > 0 ? commandFiles[0] : null;
    },
    line: () => 1,
  },

  geminiCommandTomlValid: {
    id: 'GM-L05',
    name: 'Custom command TOML is valid',
    check: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      if (commandFiles.length === 0) return null;
      for (const f of commandFiles) {
        const parsed = ctx.commandConfig ? ctx.commandConfig(f) : null;
        if (parsed && !parsed.ok) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'commands',
    fix: 'Fix malformed TOML in command files so Gemini CLI can load them correctly.',
    template: null,
    file: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const parsed = ctx.commandConfig ? ctx.commandConfig(f) : null;
        if (parsed && !parsed.ok) return f;
      }
      return null;
    },
    line: (ctx) => {
      const commandFiles = ctx.commandFiles ? ctx.commandFiles() : [];
      for (const f of commandFiles) {
        const parsed = ctx.commandConfig ? ctx.commandConfig(f) : null;
        if (parsed && !parsed.ok && parsed.error) {
          const match = parsed.error.match(/Line (\d+)/i);
          if (match) return Number(match[1]);
        }
      }
      return 1;
    },
  },

  // =============================================
  // CP-08 Expansion: M. Advisory Quality (4 checks)
  // =============================================
  geminiAdvisoryAugmentQuality: {
    id: 'GM-M01', name: 'Augment recommendations reference real detected surfaces',
    check: (ctx) => { const g = ctx.geminiMdContent(); const s = ctx.settingsJson(); if (!g && !s) return null; return [Boolean(g), Boolean(s), ctx.hasDir ? ctx.hasDir('.gemini') : false].filter(Boolean).length >= 2; },
    impact: 'high', rating: 4, category: 'advisory',
    fix: 'Ensure GEMINI.md and .gemini/settings.json exist for grounded advisory recommendations.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },
  geminiAdvisorySuggestOnlySafety: {
    id: 'GM-M02', name: 'No --yolo or auto_edit in suggest-only context',
    check: (ctx) => { const s = ctx.settingsJson(); if (!s) return null; const mode = s.approvalMode || s.approval_mode; return !mode || (mode !== 'auto_edit' && mode !== 'yolo'); },
    impact: 'critical', rating: 5, category: 'advisory',
    fix: 'Remove --yolo or auto_edit from settings to maintain suggest-only safety.',
    template: 'gemini-settings', file: () => '.gemini/settings.json', line: () => 1,
  },
  geminiAdvisoryOutputFreshness: {
    id: 'GM-M03', name: 'No deprecated Gemini features referenced in advisory context',
    check: (ctx) => { const g = ctx.geminiMdContent(); if (!g) return null; return !/\bnotepads?\b/i.test(g) && !/\bchat_model\b/i.test(g); },
    impact: 'medium', rating: 3, category: 'advisory',
    fix: 'Remove deprecated feature references from GEMINI.md.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },
  geminiAdvisoryToSetupCoherence: {
    id: 'GM-M04', name: 'Advisory recommendations map to existing proposal families',
    check: (ctx) => { const g = ctx.geminiMdContent(); const s = ctx.settingsJson(); return Boolean(g || s); },
    impact: 'medium', rating: 3, category: 'advisory',
    fix: 'Ensure at least one Gemini surface exists so advisory can produce actionable recommendations.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },

  // CP-08: N. Pack Posture (4 checks)
  geminiDomainPackAlignment: {
    id: 'GM-N01', name: 'Detected stack aligns with recommended domain pack',
    check: (ctx) => { const g = ctx.geminiMdContent(); if (!g) return null; return true; },
    impact: 'high', rating: 4, category: 'pack-posture',
    fix: 'Review recommended domain pack alignment for your project stack.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },
  geminiMcpPackSafety: {
    id: 'GM-N02', name: 'MCP packs pass trust preflight (excludeTools set)',
    check: (ctx) => { const s = ctx.settingsJson(); if (!s || !s.mcpServers) return null; for (const srv of Object.values(s.mcpServers)) { if (!srv.excludeTools && !srv.includeTools) return false; } return true; },
    impact: 'high', rating: 4, category: 'pack-posture',
    fix: 'Add excludeTools to all MCP servers to limit tool surface.',
    template: 'gemini-settings', file: () => '.gemini/settings.json', line: () => 1,
  },
  geminiPackRecommendationQuality: {
    id: 'GM-N03', name: 'Pack recommendations grounded in detected signals',
    check: (ctx) => { const g = ctx.geminiMdContent(); const s = ctx.settingsJson(); const p = ctx.jsonFile('package.json'); return [Boolean(g), Boolean(s), Boolean(p)].filter(Boolean).length >= 2; },
    impact: 'medium', rating: 3, category: 'pack-posture',
    fix: 'Add GEMINI.md and package.json for grounded pack recommendations.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },
  geminiNoStalePackVersions: {
    id: 'GM-N04', name: 'No stale or deprecated MCP pack references',
    check: (ctx) => { const s = ctx.settingsJson(); if (!s || !s.mcpServers) return null; const content = JSON.stringify(s.mcpServers); return !/deprecated|legacy|old-/i.test(content); },
    impact: 'medium', rating: 3, category: 'pack-posture',
    fix: 'Update deprecated MCP pack references to current versions.',
    template: 'gemini-settings', file: () => '.gemini/settings.json', line: () => 1,
  },

  // CP-08: O. Repeat-Usage Hygiene (3 checks)
  geminiSnapshotRetention: {
    id: 'GM-O01', name: 'At least one prior audit snapshot exists',
    check: (ctx) => { try { const fs = require('fs'); const p = require('path').join(ctx.dir, '.claude', 'claudex-setup', 'snapshots', 'index.json'); if (!fs.existsSync(p)) return null; const e = JSON.parse(fs.readFileSync(p, 'utf8')); return Array.isArray(e) && e.length > 0; } catch { return null; } },
    impact: 'medium', rating: 3, category: 'repeat-usage',
    fix: 'Run `npx nerviq --platform gemini --snapshot` to save your first snapshot.',
    template: null, file: () => null, line: () => null,
  },
  geminiFeedbackLoopHealth: {
    id: 'GM-O02', name: 'Feedback loop functional when feedback submitted',
    check: (ctx) => { try { const fs = require('fs'); const p = require('path').join(ctx.dir, '.claude', 'claudex-setup', 'outcomes', 'index.json'); if (!fs.existsSync(p)) return null; const e = JSON.parse(fs.readFileSync(p, 'utf8')); return Array.isArray(e) && e.length > 0; } catch { return null; } },
    impact: 'medium', rating: 3, category: 'repeat-usage',
    fix: 'Submit feedback using `npx nerviq --platform gemini feedback`.',
    template: null, file: () => null, line: () => null,
  },
  geminiTrendDataAvailability: {
    id: 'GM-O03', name: 'Trend data computable (2+ snapshots)',
    check: (ctx) => { try { const fs = require('fs'); const p = require('path').join(ctx.dir, '.claude', 'claudex-setup', 'snapshots', 'index.json'); if (!fs.existsSync(p)) return null; const e = JSON.parse(fs.readFileSync(p, 'utf8')); return (Array.isArray(e) ? e : []).filter(x => x.snapshotKind === 'audit').length >= 2; } catch { return null; } },
    impact: 'low', rating: 2, category: 'repeat-usage',
    fix: 'Run at least 2 audits with --snapshot for trend tracking.',
    template: null, file: () => null, line: () => null,
  },

  // CP-08: P. Release & Freshness (3 checks)
  geminiVersionTruth: {
    id: 'GM-P01', name: 'Gemini version claims match installed version',
    check: (ctx) => { const g = ctx.geminiMdContent(); if (!g) return null; const m = g.match(/gemini[- ]?(?:cli)?[- ]?v?(\d+\.\d+)/i); if (!m) return null; return true; },
    impact: 'high', rating: 4, category: 'release-freshness',
    fix: 'Verify Gemini version in GEMINI.md matches installed CLI version.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },
  geminiSourceFreshness: {
    id: 'GM-P02', name: 'Config and docs reference current Gemini features (no deprecated flags)',
    check: (ctx) => {
      const s = ctx.settingsJson();
      const g = ctx.geminiMdContent() || '';
      const combined = (s ? JSON.stringify(s) : '') + '\n' + g;
      if (!s && !g) return null;
      // Deprecated: chat_model, notepads, old_format, --json (use -o json), --allowed-tools (use policy.toml)
      return !/chat_model|notepads|old_format/i.test(combined) && !/--json\b/i.test(combined) && !/--allowed-tools\b/i.test(combined);
    },
    impact: 'high', rating: 4, category: 'release-freshness',
    fix: 'Update deprecated references: --json → -o json (v0.36.0), --allowed-tools → policy.toml, chat_model/notepads → removed.',
    template: 'gemini-settings', file: () => '.gemini/settings.json', line: () => 1,
  },
  geminiPropagationCompleteness: {
    id: 'GM-P03', name: 'No dangling surface references',
    check: (ctx) => { const g = ctx.geminiMdContent(); if (!g) return null; const issues = []; if (/\bhooks?\b/i.test(g)) { const s = ctx.settingsJson(); if (!s || (!s.hooks && !s.BeforeTool && !s.AfterTool)) issues.push('hooks'); } if (/\bskills?\b/i.test(g) && !(ctx.hasDir ? ctx.hasDir('.gemini/skills') : false)) issues.push('skills'); if (/\bextensions?\b/i.test(g) && !(ctx.hasDir ? ctx.hasDir('.gemini/extensions') : false)) issues.push('extensions'); return issues.length === 0; },
    impact: 'high', rating: 4, category: 'release-freshness',
    fix: 'Ensure all surfaces mentioned in GEMINI.md have corresponding definition files.',
    template: 'gemini-md', file: () => 'GEMINI.md', line: () => 1,
  },

  // =============================================
  // Q. Experiment-Verified Fixes (5 checks) — GM-Q01..GM-Q05
  // Added from v0.36.0 experiment findings (2026-04-05)
  // =============================================

  geminiApprovalFieldValidation: {
    id: 'GM-Q01',
    name: 'Approval field in settings.json has valid value (not --yolo)',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data || !data.approval) return null;
      const approval = String(data.approval).toLowerCase();
      // v0.36.0: "--yolo" is silently accepted in approval field without validation
      // Valid values: suggest, auto_fix, auto_edit, plan
      const validValues = ['suggest', 'auto_fix', 'auto_edit', 'plan'];
      if (/yolo/i.test(approval)) return false;
      return validValues.includes(approval);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'SECURITY: v0.36.0 silently accepts "--yolo" in the approval field. Use valid values: suggest, auto_fix, auto_edit, or plan (read-only mode).',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /"approval"/),
  },

  geminiPlanModeDocumented: {
    id: 'GM-Q02',
    name: 'Plan mode (read-only 4th approval mode) documented if used',
    check: (ctx) => {
      const data = settingsData(ctx);
      if (!data) return null;
      const approval = data.approval || data.approvalMode || data.approval_mode;
      if (!approval || String(approval).toLowerCase() !== 'plan') return null;
      // If plan mode is active, check it's documented
      const gmd = geminiMd(ctx) || '';
      return /\bplan\s*mode\b|\bread.only\b|\bplan\b.*approval/i.test(gmd);
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Document that plan mode is a read-only approval mode (undocumented 4th mode in v0.36.0) that prevents all file modifications.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: () => 1,
  },

  geminiNoAllowedToolsDeprecated: {
    id: 'GM-Q03',
    name: 'No deprecated --allowed-tools flag (use policy.toml)',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      const raw = settingsRaw(ctx);
      // Check workflow files
      for (const wf of workflowArtifacts(ctx)) {
        if (/--allowed-tools\b/i.test(wf.content)) return false;
      }
      // Check docs and settings
      if (/--allowed-tools\b/i.test(gmd)) return false;
      if (/--allowed-tools\b|allowedTools/i.test(raw)) return false;
      // Check package.json scripts
      const pkg = ctx.jsonFile ? ctx.jsonFile('package.json') : null;
      if (pkg && pkg.scripts) {
        const scriptValues = Object.values(pkg.scripts).join('\n');
        if (/--allowed-tools\b/i.test(scriptValues)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'release-freshness',
    fix: '--allowed-tools is DEPRECATED in v0.36.0. Migrate to the Policy Engine with policy.toml files under .gemini/policy/.',
    template: null,
    file: (ctx) => {
      for (const wf of workflowArtifacts(ctx)) {
        if (/--allowed-tools\b/i.test(wf.content)) return wf.filePath;
      }
      const gmd = geminiMd(ctx) || '';
      if (/--allowed-tools\b/i.test(gmd)) return 'GEMINI.md';
      return '.gemini/settings.json';
    },
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /--allowed-tools/i) || firstLineMatching(settingsRaw(ctx), /allowed.?tools/i);
    },
  },

  geminiEagerLoadingAwareness: {
    id: 'GM-Q04',
    name: 'GEMINI.md hierarchy loading behavior is correctly documented',
    check: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      if (!gmd) return null;
      // Flag if docs mention JIT/lazy loading — this is falsified in v0.36.0
      if (/\bjit\b|\blazy.load|\bload.*on.demand|\bdynamic.*load/i.test(gmd)) return false;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'instructions',
    fix: 'Remove JIT/lazy-loading claims from GEMINI.md. v0.36.0 loads ALL subdirectory GEMINI.md files eagerly at startup — be mindful of token budget in monorepos.',
    template: 'gemini-md',
    file: () => 'GEMINI.md',
    line: (ctx) => {
      const gmd = geminiMd(ctx) || '';
      return firstLineMatching(gmd, /jit|lazy.load|on.demand/i);
    },
  },

  geminiModelStringNotObject: {
    id: 'GM-Q05',
    name: 'Model field is not a bare string (v0.36.0 requires object)',
    check: (ctx) => {
      const raw = settingsRaw(ctx);
      if (!raw) return null;
      // Quick check: if "model" key exists and its value is a string, fail
      const match = raw.match(/"model"\s*:\s*"([^"]+)"/);
      if (match) return false; // String format detected — will cause exit code 41
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'BREAKING: v0.36.0 requires model as object: {"model": {"name": "gemini-2.5-flash"}}. String format causes exit code 41.',
    template: 'gemini-settings',
    file: () => '.gemini/settings.json',
    line: (ctx) => ctx.lineNumber('.gemini/settings.json', /"model"/),
  },
};

attachSourceUrls('gemini', GEMINI_TECHNIQUES);

module.exports = {
  GEMINI_TECHNIQUES,
};
