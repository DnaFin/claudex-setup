/**
 * Aider Technique Database — 71 checks (AD-A01 through AD-P06)
 *
 * Aider is fundamentally different from IDE platforms:
 * - Git-first CLI tool: git is the ONLY safety mechanism
 * - No hooks, no MCP, no skills, no agents
 * - Config: .aider.conf.yml (YAML), .aider.model.settings.yml, .env
 * - 3 model roles: main (coding), editor (applying), weak (commit messages)
 * - Architect mode (2-model workflow, ~1.73x cost vs standard)
 * - Convention files must be EXPLICITLY passed AND referenced in prompts (no auto-discovery)
 * - 4-level config precedence: env vars > CLI args > .aider.conf.yml > defaults
 * - Key gotcha: default auto-commit bypasses pre-commit hooks (use --git-commit-verify)
 * - Key gotcha: exit code 0 returned even on auth failure in headless mode
 * - Key gotcha: Playwright auto-scrapes URLs in messages (unexpected side effect)
 *
 * Categories: Config(8), Git Safety(10), Model Config(8), Conventions(6),
 *   Architecture(4), Security(6), CI(4), Quality(6) + M/N/O/P expansion (19)
 *
 * Check ID prefix: AD-
 */

const { containsEmbeddedSecret } = require('../secret-patterns');
const { attachSourceUrls } = require('../source-urls');

const FILLER_PATTERNS = [
  /\bbe helpful\b/i,
  /\bbe accurate\b/i,
  /\bbe concise\b/i,
  /\balways do your best\b/i,
  /\bmaintain high quality\b/i,
  /\bwrite clean code\b/i,
  /\bfollow best practices\b/i,
];

function configContent(ctx) {
  return ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.aider.conf.yml') || '');
}

function envContent(ctx) {
  return ctx.envContent ? (ctx.envContent() || '') : (ctx.fileContent('.env') || '');
}

function modelSettingsContent(ctx) {
  return ctx.modelSettingsContent ? (ctx.modelSettingsContent() || '') : (ctx.fileContent('.aider.model.settings.yml') || '');
}

function conventionFiles(ctx) {
  return ctx.conventionFiles ? ctx.conventionFiles() : [];
}

function conventionContent(ctx) {
  const files = conventionFiles(ctx);
  return files.map(f => ctx.fileContent(f) || '').join('\n');
}

function gitignoreContent(ctx) {
  return ctx.gitignoreContent ? (ctx.gitignoreContent() || '') : (ctx.fileContent('.gitignore') || '');
}

function hasGitRepo(ctx) {
  return ctx.hasGitRepo ? ctx.hasGitRepo() : ctx.files.includes('.git/');
}

function modelRoles(ctx) {
  if (ctx.modelRoles) return ctx.modelRoles();
  const config = ctx.parsedConfig ? ctx.parsedConfig() : { ok: false, data: null };
  const data = config.ok ? config.data : {};
  return {
    main: data.model || data['main-model'] || null,
    editor: data['editor-model'] || null,
    weak: data['weak-model'] || null,
    architect: data.architect || false,
  };
}

function firstLineMatching(text, matcher) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (typeof matcher === 'string' && line.includes(matcher)) return index + 1;
    if (matcher instanceof RegExp && matcher.test(line)) { matcher.lastIndex = 0; return index + 1; }
    if (typeof matcher === 'function' && matcher(line, index + 1)) return index + 1;
  }
  return null;
}

function findFillerLine(content) {
  return firstLineMatching(content, (line) => FILLER_PATTERNS.some((pattern) => pattern.test(line)));
}

function repoLooksRegulated(ctx) {
  const filenames = ctx.files.join('\n');
  const packageJson = ctx.fileContent('package.json') || '';
  const readme = ctx.fileContent('README.md') || '';
  const combined = `${filenames}\n${packageJson}\n${readme}`;
  return /\bhipaa\b|\bphi\b|\bpci\b|\bsoc2\b|\biso[- ]?27001\b|\bcompliance\b|\bhealth(?:care)?\b|\bmedical\b|\bbank(?:ing)?\b|\bpayments?\b|\bfintech\b/i.test(combined);
}

// ============================================================================
// 68 AIDER TECHNIQUES
// ============================================================================

const AIDER_TECHNIQUES = {

  // =========================================================================
  // A — Config (8 checks: AD-A01 .. AD-A08)
  // =========================================================================

  aiderConfYmlExists: {
    id: 'AD-A01',
    name: '.aider.conf.yml config file exists',
    check: (ctx) => Boolean(ctx.fileContent('.aider.conf.yml')),
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Create .aider.conf.yml with project-specific Aider settings.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: () => null,
  },

  aiderConfYmlValid: {
    id: 'AD-A02',
    name: '.aider.conf.yml is valid YAML',
    check: (ctx) => {
      const content = configContent(ctx);
      if (!content) return null;
      const parsed = ctx.parsedConfig ? ctx.parsedConfig() : require('./config-parser').tryParseYaml(content);
      return parsed.ok;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Fix YAML syntax errors in .aider.conf.yml.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: () => null,
  },

  aiderModelSpecified: {
    id: 'AD-A03',
    name: 'Main model explicitly configured',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bmodel\s*:/i.test(config) || /\bmain-model\s*:/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Set `model:` in .aider.conf.yml to pin the main coding model.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /\bmodel\s*:|main-model\s*:/i),
  },

  aiderAutoCommitsConfigured: {
    id: 'AD-A04',
    name: 'Auto-commits setting is explicit',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bauto-commits\s*:/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Set `auto-commits: true` in .aider.conf.yml to ensure git safety.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /auto-commits\s*:/i),
  },

  aiderMapTokensConfigured: {
    id: 'AD-A05',
    name: 'Map tokens setting is configured',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bmap-tokens\s*:/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Set `map-tokens:` in .aider.conf.yml to control repo map size.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /map-tokens\s*:/i),
  },

  aiderLintCmdConfigured: {
    id: 'AD-A06',
    name: 'Lint command configured for auto-fix',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\blint-cmd\s*:/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Set `lint-cmd:` in .aider.conf.yml so Aider can auto-fix lint errors.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /lint-cmd\s*:/i),
  },

  aiderTestCmdConfigured: {
    id: 'AD-A07',
    name: 'Test command configured for auto-fix',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\btest-cmd\s*:/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'Set `test-cmd:` in .aider.conf.yml so Aider can run and auto-fix tests.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /test-cmd\s*:/i),
  },

  aiderEditFormatConfigured: {
    id: 'AD-A08',
    name: 'Edit format explicitly set',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bedit-format\s*:/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'Set `edit-format:` (diff, whole, udiff, diff-fenced) in .aider.conf.yml for predictable edits.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /edit-format\s*:/i),
  },

  // =========================================================================
  // B — Git Safety (8 checks: AD-B01 .. AD-B08)
  // =========================================================================

  aiderGitRepoExists: {
    id: 'AD-B01',
    name: 'Project is a git repository',
    check: (ctx) => hasGitRepo(ctx),
    impact: 'critical',
    rating: 5,
    category: 'git-safety',
    fix: 'Initialize a git repo with `git init`. Aider requires git as its ONLY safety mechanism.',
    template: null,
    file: () => '.git',
    line: () => null,
  },

  aiderAutoCommitsEnabled: {
    id: 'AD-B02',
    name: 'Auto-commits not disabled (git safety)',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      // Failing = auto-commits explicitly set to false
      if (/\bauto-commits\s*:\s*false\b/i.test(config)) return false;
      return true;
    },
    impact: 'critical',
    rating: 5,
    category: 'git-safety',
    fix: 'Do not set `auto-commits: false` — git commits are Aider\'s primary safety mechanism.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /auto-commits\s*:\s*false/i),
  },

  aiderGitignoreCoversArtifacts: {
    id: 'AD-B03',
    name: '.gitignore includes .aider* artifacts',
    check: (ctx) => {
      const gi = gitignoreContent(ctx);
      if (!gi) return false;
      return /\.aider/i.test(gi);
    },
    impact: 'high',
    rating: 4,
    category: 'git-safety',
    fix: 'Add `.aider*` to .gitignore to exclude chat history and cache files.',
    template: 'gitignore',
    file: () => '.gitignore',
    line: (ctx) => firstLineMatching(gitignoreContent(ctx), /\.aider/i),
  },

  aiderDirtyTreeCheck: {
    id: 'AD-B04',
    name: 'No uncommitted changes when starting Aider (advisory)',
    check: (ctx) => {
      const status = ctx.gitStatus ? ctx.gitStatus() : null;
      if (status === null) return null; // Can't check
      return status === '';
    },
    impact: 'medium',
    rating: 3,
    category: 'git-safety',
    fix: 'Commit or stash changes before running Aider so its auto-commits stay clean.',
    template: null,
    file: () => null,
    line: () => null,
  },

  aiderDirtyCommitsNotDisabled: {
    id: 'AD-B05',
    name: 'Dirty-commits not disabled',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      if (/\bdirty-commits\s*:\s*false\b/i.test(config)) return false;
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'git-safety',
    fix: 'Keep `dirty-commits` enabled (default) so Aider can commit even with dirty working tree.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /dirty-commits\s*:\s*false/i),
  },

  aiderAttributeAuthorConfigured: {
    id: 'AD-B06',
    name: 'Attribute author/committer set for traceability',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\battribute-author\s*:/i.test(config) || /\battribute-committer\s*:/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'git-safety',
    fix: 'Set `attribute-author: true` or `attribute-committer: true` for AI-change traceability.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /attribute-(?:author|committer)\s*:/i),
  },

  aiderCommitPrefixConfigured: {
    id: 'AD-B07',
    name: 'Commit prefix set for AI-authored commits',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\baider-commit-prefix\s*:/i.test(config) || /\bcommit-prefix\s*:/i.test(config);
    },
    impact: 'low',
    rating: 2,
    category: 'git-safety',
    fix: 'Set `aider-commit-prefix:` to tag AI-authored commits (e.g., "aider: ").',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /commit-prefix\s*:/i),
  },

  aiderUndoSafetyAware: {
    id: 'AD-B08',
    name: '/undo command awareness documented',
    check: (ctx) => {
      const conventions = conventionContent(ctx);
      const config = configContent(ctx);
      return /\bundo\b/i.test(conventions) || /\bundo\b/i.test(config);
    },
    impact: 'low',
    rating: 2,
    category: 'git-safety',
    fix: 'Document the /undo command in conventions for reverting Aider changes.',
    template: 'aider-conventions',
    file: () => null,
    line: () => null,
  },

  // =========================================================================
  // C — Model Config (8 checks: AD-C01 .. AD-C08)
  // =========================================================================

  aiderEditorModelConfigured: {
    id: 'AD-C01',
    name: 'Editor model explicitly configured',
    check: (ctx) => {
      const roles = modelRoles(ctx);
      return roles.editor !== null;
    },
    impact: 'high',
    rating: 4,
    category: 'model-config',
    fix: 'Set `editor-model:` in .aider.conf.yml for the model that applies edits.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /editor-model\s*:/i),
  },

  aiderWeakModelConfigured: {
    id: 'AD-C02',
    name: 'Weak model configured for commit messages',
    check: (ctx) => {
      const roles = modelRoles(ctx);
      return roles.weak !== null;
    },
    impact: 'medium',
    rating: 3,
    category: 'model-config',
    fix: 'Set `weak-model:` in .aider.conf.yml for cheap commit message generation.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /weak-model\s*:/i),
  },

  aiderArchitectModeAvailable: {
    id: 'AD-C03',
    name: 'Architect mode configured (2-model workflow)',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\barchitect\s*:\s*true\b/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'model-config',
    fix: 'Set `architect: true` to use a 2-model workflow (architect plans, editor applies). NOTE: architect mode costs ~1.73x standard mode per edit ($0.00026 vs $0.00015 measured in live experiment). auto_accept_architect is on by default — no confirmation between steps.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /architect\s*:/i),
  },

  aiderModelSettingsFileExists: {
    id: 'AD-C04',
    name: '.aider.model.settings.yml exists for model customization',
    check: (ctx) => Boolean(ctx.fileContent('.aider.model.settings.yml')),
    impact: 'medium',
    rating: 3,
    category: 'model-config',
    fix: 'Create .aider.model.settings.yml for custom model definitions and aliases.',
    template: 'aider-model-settings',
    file: () => '.aider.model.settings.yml',
    line: () => null,
  },

  aiderApiKeyInEnvNotConfig: {
    id: 'AD-C05',
    name: 'API keys in .env, not in .aider.conf.yml',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      // Fail if API keys are in the YAML config instead of .env
      return !/\b(?:api[_-]?key|openai[_-]?api[_-]?key|anthropic[_-]?api[_-]?key)\s*:/i.test(config);
    },
    impact: 'critical',
    rating: 5,
    category: 'model-config',
    fix: 'Move API keys to .env file, not .aider.conf.yml which may be committed.',
    template: 'aider-env',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /api[_-]?key\s*:/i),
  },

  aiderCachePromptsEnabled: {
    id: 'AD-C06',
    name: 'Prompt caching enabled for cost savings',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bcache-prompts\s*:\s*true\b/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'model-config',
    fix: 'Set `cache-prompts: true` in .aider.conf.yml to reduce API costs.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /cache-prompts\s*:/i),
  },

  aiderMaxChatHistoryReasonable: {
    id: 'AD-C07',
    name: 'Max chat history tokens is bounded',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      const match = config.match(/\bmax-chat-history-tokens\s*:\s*(\d+)/i);
      if (!match) return null; // Not set, using default
      return Number.parseInt(match[1], 10) <= 32768;
    },
    impact: 'low',
    rating: 2,
    category: 'model-config',
    fix: 'Set `max-chat-history-tokens` to a reasonable limit (e.g., 16384) to control costs.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /max-chat-history-tokens\s*:/i),
  },

  aiderStreamEnabled: {
    id: 'AD-C08',
    name: 'Streaming not disabled',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      if (/\bno-stream\s*:\s*true\b/i.test(config) || /\bstream\s*:\s*false\b/i.test(config)) return false;
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'model-config',
    fix: 'Keep streaming enabled for better developer experience.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /no-stream\s*:\s*true|stream\s*:\s*false/i),
  },

  // =========================================================================
  // D — Conventions (6 checks: AD-D01 .. AD-D06)
  // =========================================================================

  aiderConventionFileExists: {
    id: 'AD-D01',
    name: 'Convention file exists for Aider context',
    check: (ctx) => conventionFiles(ctx).length > 0,
    impact: 'high',
    rating: 4,
    category: 'conventions',
    fix: 'Create CONVENTIONS.md with project coding standards and pass via `read:` in .aider.conf.yml.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderConventionLinkedInConfig: {
    id: 'AD-D02',
    name: 'Convention file referenced in .aider.conf.yml read list',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bread\s*:/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'conventions',
    fix: 'Add `read: [CONVENTIONS.md]` to .aider.conf.yml — Aider has NO auto-discovery. Additionally, convention files are only followed when EXPLICITLY referenced in the prompt itself (confirmed by live experiment with gpt-4o-mini). Just loading them via --read is not enough; your prompts must say "follow the conventions in CONVENTIONS.md".',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /read\s*:/i),
  },

  aiderConventionHasArchitecture: {
    id: 'AD-D03',
    name: 'Convention file includes architecture/structure section',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /##\s+(?:Architecture|Structure|Project Map|Directory)/i.test(content) ||
        /```mermaid/i.test(content);
    },
    impact: 'high',
    rating: 4,
    category: 'conventions',
    fix: 'Add a ## Architecture section with project structure to your convention file.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderConventionHasVerification: {
    id: 'AD-D04',
    name: 'Convention file includes verification commands',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /\bnpm test\b|\bpnpm test\b|\byarn test\b|\bpytest\b|\bgo test\b|\bcargo test\b|\bmake test\b/i.test(content);
    },
    impact: 'high',
    rating: 4,
    category: 'conventions',
    fix: 'Add test/lint/build commands to your convention file for Aider to use.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderConventionNoFiller: {
    id: 'AD-D05',
    name: 'Convention file has no filler/platitude lines',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return !findFillerLine(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'conventions',
    fix: 'Remove generic filler like "be helpful" — use specific, actionable instructions.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: (ctx) => findFillerLine(conventionContent(ctx)),
  },

  aiderConventionReasonableSize: {
    id: 'AD-D06',
    name: 'Convention file not excessively large',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return content.length < 32768;
    },
    impact: 'medium',
    rating: 3,
    category: 'conventions',
    fix: 'Keep convention files under 32KB — large files consume context tokens.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  // =========================================================================
  // E — Architecture (4 checks: AD-E01 .. AD-E04)
  // =========================================================================

  aiderRepoMapEnabled: {
    id: 'AD-E01',
    name: 'Repo map not disabled',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      if (/\bmap-tokens\s*:\s*0\b/i.test(config) || /\bno-repo-map\s*:\s*true\b/i.test(config)) return false;
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'architecture',
    fix: 'Do not disable repo map — it gives Aider critical project structure awareness.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /map-tokens\s*:\s*0|no-repo-map\s*:\s*true/i),
  },

  aiderSubtreeUsedForLargeRepos: {
    id: 'AD-E02',
    name: 'Subtree-only or file filtering for large repos',
    check: (ctx) => {
      // Only relevant for large repos
      if (ctx.files.length < 100) return null;
      const config = configContent(ctx);
      if (!config) return null;
      return /\bsubtree-only\s*:\s*true\b/i.test(config) || /\bmap-tokens\s*:/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'architecture',
    fix: 'Use `subtree-only: true` or limit `map-tokens` for large repositories.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /subtree-only\s*:|map-tokens\s*:/i),
  },

  aiderAiderignoreExists: {
    id: 'AD-E03',
    name: '.aiderignore file exists for file filtering',
    check: (ctx) => Boolean(ctx.fileContent('.aiderignore')),
    impact: 'medium',
    rating: 3,
    category: 'architecture',
    fix: 'Create .aiderignore to exclude files Aider should not edit (similar to .gitignore syntax).',
    template: 'aiderignore',
    file: () => '.aiderignore',
    line: () => null,
  },

  aiderAutoTestEnabled: {
    id: 'AD-E04',
    name: 'Auto-test enabled for verification loop',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bauto-test\s*:\s*true\b/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'architecture',
    fix: 'Set `auto-test: true` with `test-cmd` to enable automatic test verification.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /auto-test\s*:/i),
  },

  // =========================================================================
  // F — Security (6 checks: AD-F01 .. AD-F06)
  // =========================================================================

  aiderEnvInGitignore: {
    id: 'AD-F01',
    name: '.env file excluded from git',
    check: (ctx) => {
      const gi = gitignoreContent(ctx);
      if (!gi) return false;
      return /^\.env$/m.test(gi) || /^\.env\b/m.test(gi);
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Add `.env` to .gitignore to prevent API key leaks.',
    template: 'gitignore',
    file: () => '.gitignore',
    line: (ctx) => firstLineMatching(gitignoreContent(ctx), /^\.env/m),
  },

  aiderNoSecretsInConfig: {
    id: 'AD-F02',
    name: 'No embedded secrets in .aider.conf.yml',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return !containsEmbeddedSecret(config);
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Remove secrets from .aider.conf.yml — use .env or environment variables instead.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: () => null,
  },

  aiderNoSecretsInConventions: {
    id: 'AD-F03',
    name: 'No embedded secrets in convention files',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return !containsEmbeddedSecret(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Remove secrets from convention files.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderChatHistoryExcluded: {
    id: 'AD-F04',
    name: 'Chat history files excluded from git',
    check: (ctx) => {
      const gi = gitignoreContent(ctx);
      if (!gi) return false;
      return /\.aider\.chat\.history/i.test(gi) || /\.aider\*/i.test(gi) || /\.aider/i.test(gi);
    },
    impact: 'high',
    rating: 4,
    category: 'security',
    fix: 'Ensure .aider.chat.history.md is gitignored — it may contain sensitive context.',
    template: 'gitignore',
    file: () => '.gitignore',
    line: (ctx) => firstLineMatching(gitignoreContent(ctx), /\.aider/i),
  },

  aiderRegulatedRepoHasGuardrails: {
    id: 'AD-F05',
    name: 'Regulated repo has explicit guardrails in conventions',
    check: (ctx) => {
      if (!repoLooksRegulated(ctx)) return null;
      const content = conventionContent(ctx);
      if (!content) return false;
      return /\bsecurity\b|\bcompliance\b|\breview\b|\bapproval\b/i.test(content);
    },
    impact: 'high',
    rating: 4,
    category: 'security',
    fix: 'Add security and compliance guardrails to convention files for regulated repos.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderNoAutoRunInUntrusted: {
    id: 'AD-F06',
    name: 'Auto-run commands not enabled in untrusted context',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      // suggest-shell-commands with auto-run is risky
      if (/\bauto-lint\s*:\s*true\b/i.test(config) && /\bauto-test\s*:\s*true\b/i.test(config)) {
        // Both auto-lint and auto-test — check if commands are explicit
        return /\blint-cmd\s*:/i.test(config) && /\btest-cmd\s*:/i.test(config);
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'security',
    fix: 'When using auto-lint/auto-test, always specify explicit commands.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: () => null,
  },

  // =========================================================================
  // G — CI (4 checks: AD-G01 .. AD-G04)
  // =========================================================================

  aiderCiWorkflowExists: {
    id: 'AD-G01',
    name: 'CI workflow exists',
    check: (ctx) => {
      const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
      return workflows.length > 0;
    },
    impact: 'high',
    rating: 4,
    category: 'ci',
    fix: 'Add a CI workflow (.github/workflows/) to verify Aider-generated changes.',
    template: 'aider-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  aiderCiRunsTests: {
    id: 'AD-G02',
    name: 'CI runs tests on Aider PRs',
    check: (ctx) => {
      const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
      for (const wf of workflows) {
        const content = ctx.fileContent(wf) || '';
        if (/\btest\b/i.test(content) && /\bpull_request\b/i.test(content)) return true;
      }
      return workflows.length > 0 ? false : null;
    },
    impact: 'high',
    rating: 4,
    category: 'ci',
    fix: 'Ensure CI runs tests on pull requests — Aider changes should be verified.',
    template: 'aider-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  aiderCiRunsLint: {
    id: 'AD-G03',
    name: 'CI runs linting',
    check: (ctx) => {
      const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
      for (const wf of workflows) {
        const content = ctx.fileContent(wf) || '';
        if (/\blint\b/i.test(content)) return true;
      }
      return workflows.length > 0 ? false : null;
    },
    impact: 'medium',
    rating: 3,
    category: 'ci',
    fix: 'Add linting to CI to catch style issues in Aider-generated code.',
    template: 'aider-ci',
    file: () => '.github/workflows/',
    line: () => null,
  },

  aiderGitHooksForPreCommit: {
    id: 'AD-G04',
    name: 'Git pre-commit hooks or CI gates for quality',
    check: (ctx) => {
      // Check for pre-commit config or husky
      return Boolean(ctx.fileContent('.pre-commit-config.yaml')) ||
        Boolean(ctx.fileContent('.husky/pre-commit')) ||
        Boolean(ctx.fileContent('.lefthook.yml'));
    },
    impact: 'high',
    rating: 4,
    category: 'ci',
    fix: 'Add pre-commit hooks (pre-commit, husky, lefthook). IMPORTANT: Aider default auto-commit BYPASSES pre-commit hooks (confirmed by live experiment). If hooks are critical, pass --git-commit-verify to Aider to restore hook enforcement.',
    template: null,
    file: () => null,
    line: () => null,
  },

  aiderGitCommitVerify: {
    id: 'AD-G05',
    name: '--git-commit-verify recommended when pre-commit hooks exist',
    check: (ctx) => {
      // Only relevant if pre-commit hooks exist
      const hasHooks = Boolean(ctx.fileContent('.pre-commit-config.yaml')) ||
        Boolean(ctx.fileContent('.husky/pre-commit')) ||
        Boolean(ctx.fileContent('.lefthook.yml'));
      if (!hasHooks) return null;
      const config = configContent(ctx);
      if (!config) return false;
      // Check if git-commit-verify is set in config or documented in conventions
      return /git-commit-verify/i.test(config) ||
        /git-commit-verify/i.test(conventionContent(ctx));
    },
    impact: 'high',
    rating: 4,
    category: 'ci',
    fix: 'When pre-commit hooks exist, add --git-commit-verify to Aider invocations. Default Aider auto-commits SKIP pre-commit hooks entirely (experimentally confirmed). Without this flag, hooks that enforce security or quality checks are silently bypassed.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /git-commit-verify/i),
  },

  aiderCiExitCodeUnreliable: {
    id: 'AD-G06',
    name: 'CI scripts handle exit code 0 on auth failure (unreliable exit code)',
    check: (ctx) => {
      const workflows = ctx.workflowFiles ? ctx.workflowFiles() : [];
      if (workflows.length === 0) return null;
      // Check if any workflow mentions aider and has output checking
      for (const wf of workflows) {
        const content = ctx.fileContent(wf) || '';
        if (/aider/i.test(content)) {
          // Good if it checks output, not just exit code
          return /grep|check.*output|--json|error.*detect/i.test(content);
        }
      }
      return null;
    },
    impact: 'high',
    rating: 4,
    category: 'ci',
    fix: 'Aider returns exit code 0 even on auth failure (experimentally confirmed). CI scripts that use Aider MUST NOT rely solely on exit codes to detect failure. Check Aider output for error strings or use output parsing to detect real failures.',
    template: null,
    file: () => '.github/workflows/',
    line: () => null,
  },

  // =========================================================================
  // H — Quality (6 checks: AD-H01 .. AD-H06)
  // =========================================================================

  aiderConventionHasCodingStandards: {
    id: 'AD-H01',
    name: 'Convention file has coding standards section',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /##\s+(?:Coding|Style|Standards|Formatting|Conventions)/i.test(content);
    },
    impact: 'high',
    rating: 4,
    category: 'quality',
    fix: 'Add a ## Coding Standards section to your convention file.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderConventionHasErrorHandling: {
    id: 'AD-H02',
    name: 'Convention file covers error handling',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /\berror\s+handling\b|\bexception\b|\btry[- ]catch\b|\bResult\s*<\b/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'quality',
    fix: 'Document error handling patterns in your convention file.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderConventionHasTestingGuidelines: {
    id: 'AD-H03',
    name: 'Convention file covers testing guidelines',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /##\s+(?:Test|Testing)/i.test(content) || /\bunit test\b|\bintegration test\b|\btest coverage\b/i.test(content);
    },
    impact: 'high',
    rating: 4,
    category: 'quality',
    fix: 'Add testing guidelines to your convention file.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderAutoLintEnabled: {
    id: 'AD-H04',
    name: 'Auto-lint enabled for code quality',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bauto-lint\s*:\s*true\b/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'quality',
    fix: 'Set `auto-lint: true` with `lint-cmd` to auto-fix lint errors after edits.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /auto-lint\s*:/i),
  },

  aiderShowDiffsEnabled: {
    id: 'AD-H05',
    name: 'Show-diffs enabled for review',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      if (/\bshow-diffs\s*:\s*false\b/i.test(config)) return false;
      return true; // Default is true
    },
    impact: 'medium',
    rating: 3,
    category: 'quality',
    fix: 'Keep `show-diffs` enabled so you can review changes before accepting.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /show-diffs\s*:\s*false/i),
  },

  aiderPrettyOutput: {
    id: 'AD-H06',
    name: 'Pretty output not disabled',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      if (/\bno-pretty\s*:\s*true\b/i.test(config) || /\bpretty\s*:\s*false\b/i.test(config)) return false;
      return true;
    },
    impact: 'low',
    rating: 2,
    category: 'quality',
    fix: 'Keep pretty output enabled for better readability.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /no-pretty\s*:\s*true|pretty\s*:\s*false/i),
  },

  // =========================================================================
  // M — Advanced Config (4 checks: AD-M01 .. AD-M04)
  // =========================================================================

  aiderEnvFileExists: {
    id: 'AD-M01',
    name: '.env file exists with API configuration',
    check: (ctx) => Boolean(ctx.fileContent('.env')),
    impact: 'high',
    rating: 4,
    category: 'advanced-config',
    fix: 'Create .env with OPENAI_API_KEY or ANTHROPIC_API_KEY for Aider.',
    template: 'aider-env',
    file: () => '.env',
    line: () => null,
  },

  aiderEnvHasApiKey: {
    id: 'AD-M02',
    name: '.env contains at least one API key',
    check: (ctx) => {
      const env = envContent(ctx);
      if (!env) return null;
      return /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|DEEPSEEK_API_KEY)\s*=/i.test(env);
    },
    impact: 'high',
    rating: 4,
    category: 'advanced-config',
    fix: 'Add an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) to .env.',
    template: 'aider-env',
    file: () => '.env',
    line: () => null,
  },

  aiderYesAlwaysNotSet: {
    id: 'AD-M03',
    name: '--yes-always not set as default (safety)',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return !/\byes-always\s*:\s*true\b/i.test(config);
    },
    impact: 'high',
    rating: 4,
    category: 'advanced-config',
    fix: 'Do not set `yes-always: true` in config — it bypasses all confirmation prompts.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /yes-always\s*:\s*true/i),
  },

  aiderVerboseNotDefault: {
    id: 'AD-M04',
    name: 'Verbose mode not enabled by default',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return !/\bverbose\s*:\s*true\b/i.test(config);
    },
    impact: 'low',
    rating: 2,
    category: 'advanced-config',
    fix: 'Do not default `verbose: true` in config — use --verbose as a CLI flag when needed.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /verbose\s*:\s*true/i),
  },

  // =========================================================================
  // N — Workflow Patterns (4 checks: AD-N01 .. AD-N04)
  // =========================================================================

  aiderLintAndTestLoop: {
    id: 'AD-N01',
    name: 'Lint-and-test loop configured (lint-cmd + test-cmd + auto-lint + auto-test)',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      const hasLint = /\blint-cmd\s*:/i.test(config) && /\bauto-lint\s*:\s*true\b/i.test(config);
      const hasTest = /\btest-cmd\s*:/i.test(config) && /\bauto-test\s*:\s*true\b/i.test(config);
      return hasLint && hasTest;
    },
    impact: 'high',
    rating: 4,
    category: 'workflow-patterns',
    fix: 'Configure the full lint-and-test loop: lint-cmd + auto-lint + test-cmd + auto-test.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: () => null,
  },

  aiderBrowserModeForDocs: {
    id: 'AD-N02',
    name: 'Browser integration known (/web command)',
    check: (ctx) => {
      const content = conventionContent(ctx);
      return /\b\/web\b|\bbrowser\b/i.test(content);
    },
    impact: 'low',
    rating: 2,
    category: 'workflow-patterns',
    fix: 'Document the /web command in conventions for pulling in documentation.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderInChatCommandsDocumented: {
    id: 'AD-N03',
    name: 'Key in-chat commands documented in conventions',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      // Check for documentation of key commands
      const commands = ['/add', '/drop', '/run', '/test', '/undo'];
      const found = commands.filter(cmd => content.includes(cmd));
      return found.length >= 2;
    },
    impact: 'medium',
    rating: 3,
    category: 'workflow-patterns',
    fix: 'Document key Aider commands (/add, /drop, /run, /test, /undo) in conventions.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderVoiceModeAware: {
    id: 'AD-N04',
    name: 'Voice mode configuration known',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bvoice-language\s*:/i.test(config) || /\bvoice\b/i.test(conventionContent(ctx));
    },
    impact: 'low',
    rating: 2,
    category: 'workflow-patterns',
    fix: 'Optionally configure `voice-language:` for voice coding sessions.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /voice-language\s*:/i),
  },

  aiderPlaywrightUrlScraping: {
    id: 'AD-N05',
    name: 'Playwright URL auto-scraping side effect is expected',
    check: (ctx) => {
      const conventions = conventionContent(ctx);
      const config = configContent(ctx);
      // Check if team is aware of the Playwright auto-scraping behavior
      return /playwright|url.*scrap|scrape.*url|auto.*fetch|web.*fetch/i.test(conventions) ||
        /playwright|url.*scrap/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'workflow-patterns',
    fix: 'Aider automatically scrapes URLs found in messages using Playwright (experimentally confirmed side effect). This causes unexpected network requests and delays. Document this in conventions, and avoid putting real URLs in messages unless scraping is intentional.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  // =========================================================================
  // O — Editor Integration (4 checks: AD-O01 .. AD-O04)
  // =========================================================================

  aiderEditorIntegrationDocumented: {
    id: 'AD-O01',
    name: 'Editor integration documented (VS Code, NeoVim, etc.)',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /\bvs\s*code\b|\bneovim\b|\bvim\b|\beditor\b/i.test(content);
    },
    impact: 'low',
    rating: 2,
    category: 'editor-integration',
    fix: 'Document editor integration (VS Code extension, NeoVim plugin) in conventions.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderWatchModeKnown: {
    id: 'AD-O02',
    name: 'Watch mode (--watch-files) documented or configured',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bwatch-files\s*:/i.test(config) || /\bwatch\b/i.test(conventionContent(ctx));
    },
    impact: 'medium',
    rating: 3,
    category: 'editor-integration',
    fix: 'Consider `watch-files: true` for automatic file change detection.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /watch-files\s*:/i),
  },

  aiderDarkModeConfigured: {
    id: 'AD-O03',
    name: 'Theme/dark mode configured for terminal',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bdark-mode\s*:/i.test(config) || /\blight-mode\s*:/i.test(config);
    },
    impact: 'low',
    rating: 1,
    category: 'editor-integration',
    fix: 'Set `dark-mode: true` or `light-mode: true` for terminal readability.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /dark-mode\s*:|light-mode\s*:/i),
  },

  aiderInputHistoryExcluded: {
    id: 'AD-O04',
    name: 'Input history file excluded from git',
    check: (ctx) => {
      const gi = gitignoreContent(ctx);
      if (!gi) return false;
      return /\.aider\.input\.history/i.test(gi) || /\.aider\*/i.test(gi) || /\.aider/i.test(gi);
    },
    impact: 'medium',
    rating: 3,
    category: 'editor-integration',
    fix: 'Ensure .aider.input.history is gitignored.',
    template: 'gitignore',
    file: () => '.gitignore',
    line: (ctx) => firstLineMatching(gitignoreContent(ctx), /\.aider/i),
  },

  // =========================================================================
  // P — Release Readiness (3 checks: AD-P01 .. AD-P03)
  // =========================================================================

  aiderVersionPinned: {
    id: 'AD-P01',
    name: 'Aider version pinned in requirements or package manager',
    check: (ctx) => {
      const req = ctx.fileContent('requirements.txt') || '';
      const pipfile = ctx.fileContent('Pipfile') || '';
      const pyproject = ctx.fileContent('pyproject.toml') || '';
      return /\baider-chat\b/i.test(req) || /\baider-chat\b/i.test(pipfile) || /\baider-chat\b/i.test(pyproject);
    },
    impact: 'medium',
    rating: 3,
    category: 'release-readiness',
    fix: 'Pin `aider-chat` version in requirements.txt or pyproject.toml.',
    template: null,
    file: () => null,
    line: () => null,
  },

  aiderAllConfigSurfacesPresent: {
    id: 'AD-P02',
    name: 'All essential Aider config surfaces present',
    check: (ctx) => {
      const hasConf = Boolean(ctx.fileContent('.aider.conf.yml'));
      const hasEnv = Boolean(ctx.fileContent('.env'));
      const hasGitignore = Boolean(ctx.fileContent('.gitignore'));
      return hasConf && hasEnv && hasGitignore;
    },
    impact: 'high',
    rating: 4,
    category: 'release-readiness',
    fix: 'Ensure .aider.conf.yml, .env, and .gitignore all exist.',
    template: null,
    file: () => null,
    line: () => null,
  },

  aiderDocumentedWorkflow: {
    id: 'AD-P03',
    name: 'Aider workflow documented in README or conventions',
    check: (ctx) => {
      const readme = ctx.fileContent('README.md') || '';
      const content = conventionContent(ctx);
      return /\baider\b/i.test(readme) || /\bworkflow\b/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'release-readiness',
    fix: 'Document Aider workflow in README.md or convention files.',
    template: 'aider-conventions',
    file: () => 'README.md',
    line: () => null,
  },

  aiderNoConflictingPlatformConfigs: {
    id: 'AD-P04',
    name: 'No conflicting platform configs (CLAUDE.md, AGENTS.md) without awareness',
    check: (ctx) => {
      const hasAider = Boolean(ctx.fileContent('.aider.conf.yml'));
      const hasClaude = Boolean(ctx.fileContent('CLAUDE.md')) || Boolean(ctx.fileContent('.claude/CLAUDE.md'));
      const hasCodex = Boolean(ctx.fileContent('AGENTS.md'));
      if (!hasAider) return null;
      // Multi-platform is fine — just check conventions mention it
      if (hasClaude || hasCodex) {
        const content = conventionContent(ctx);
        return /\bmulti[- ]?platform\b|\bclaude\b|\bcodex\b/i.test(content);
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'release-readiness',
    fix: 'If using multiple AI platforms, document the multi-platform strategy in conventions.',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },

  aiderModelCostAwareness: {
    id: 'AD-P05',
    name: 'Model cost awareness configured (cache-prompts or explicit model selection)',
    check: (ctx) => {
      const config = configContent(ctx);
      if (!config) return null;
      return /\bcache-prompts\s*:\s*true\b/i.test(config) ||
        /\bweak-model\s*:/i.test(config) ||
        /\beditor-model\s*:/i.test(config);
    },
    impact: 'medium',
    rating: 3,
    category: 'release-readiness',
    fix: 'Enable prompt caching or configure separate weak/editor models for cost optimization. Cost reference (measured): standard edit ~$0.00015, architect mode edit ~$0.00026 (~1.73x). Set cache-prompts: true for repeated context, and weak-model for commit messages to reduce costs.',
    template: 'aider-conf-yml',
    file: () => '.aider.conf.yml',
    line: (ctx) => firstLineMatching(configContent(ctx), /cache-prompts\s*:|weak-model\s*:|editor-model\s*:/i),
  },

  aiderGitBranchStrategy: {
    id: 'AD-P06',
    name: 'Git branch strategy for Aider work',
    check: (ctx) => {
      const content = conventionContent(ctx);
      if (!content) return null;
      return /\bbranch\b/i.test(content) && /\baider\b/i.test(content);
    },
    impact: 'medium',
    rating: 3,
    category: 'release-readiness',
    fix: 'Document a branch strategy for Aider work (e.g., feature branches, PR workflow).',
    template: 'aider-conventions',
    file: () => 'CONVENTIONS.md',
    line: () => null,
  },
};

attachSourceUrls('aider', AIDER_TECHNIQUES);

module.exports = {
  AIDER_TECHNIQUES,
};
