/**
 * CLAUDEX Technique Database
 * Curated from 1107 verified techniques, filtered to actionable setup recommendations.
 * Each technique includes: what to check, how to fix, impact level.
 */

function hasFrontendSignals(ctx) {
  const pkg = ctx.fileContent('package.json') || '';
  return /react|vue|angular|next|svelte|tailwind|vite|astro/i.test(pkg) ||
    ctx.files.some(f => /tailwind\.config|vite\.config|next\.config|svelte\.config|nuxt\.config|pages\/|components\/|app\//i.test(f));
}

const { containsEmbeddedSecret } = require('./secret-patterns');
const { attachSourceUrls } = require('./source-urls');
const { buildSupplementalChecks } = require('./supplemental-checks');

const CLAUDE_SUPPLEMENTAL_SOURCE_URLS = {
  'testing-strategy': 'https://code.claude.com/docs/en/common-workflows',
  'code-quality': 'https://code.claude.com/docs/en/best-practices',
  'api-design': 'https://code.claude.com/docs/en/best-practices',
  database: 'https://code.claude.com/docs/en/common-workflows',
  authentication: 'https://code.claude.com/docs/en/permissions',
  monitoring: 'https://code.claude.com/docs/en/common-workflows',
  'dependency-management': 'https://code.claude.com/docs/en/best-practices',
  'cost-optimization': 'https://code.claude.com/docs/en/memory',
};

const TECHNIQUES = {
  // ============================================================
  // === MEMORY & CONTEXT (category: 'memory') ==================
  // ============================================================

  claudeMd: {
    id: 1,
    name: 'CLAUDE.md project instructions',
    check: (ctx) => ctx.files.includes('CLAUDE.md') || ctx.files.includes('.claude/CLAUDE.md'),
    impact: 'critical',
    rating: 5,
    category: 'memory',
    fix: 'Create CLAUDE.md with project-specific instructions, build commands, and coding conventions.',
    template: 'claude-md'
  },

  mermaidArchitecture: {
    id: 51,
    name: 'Mermaid architecture diagram',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return md.includes('mermaid') || md.includes('graph ') || md.includes('flowchart ');
    },
    impact: 'high',
    rating: 5,
    category: 'memory',
    fix: 'Add a Mermaid diagram to CLAUDE.md showing project architecture. Saves 73% tokens vs prose.',
    template: 'mermaid'
  },

  pathRules: {
    id: 3,
    name: 'Path-specific rules',
    check: (ctx) => ctx.hasDir('.claude/rules') && ctx.dirFiles('.claude/rules').length > 0,
    impact: 'medium',
    rating: 4,
    category: 'memory',
    fix: 'Add rules for different file types (frontend vs backend conventions).',
    template: 'rules'
  },

  importSyntax: {
    id: 763,
    name: 'CLAUDE.md uses @path imports for modularity',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      // Current syntax is @path/to/file (no "import" keyword)
      return /@\S+\.(md|txt|json|yml|yaml|toml)/i.test(md) || /@\w+\//.test(md);
    },
    impact: 'medium',
    rating: 4,
    category: 'memory',
    fix: 'Use @path syntax in CLAUDE.md to split instructions into focused modules (e.g. @docs/coding-style.md). You can also use .claude/rules/ for path-specific rules.',
    template: null
  },

  underlines200: {
    id: 681,
    name: 'CLAUDE.md under 200 lines (concise)',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return md.split('\n').length <= 200;
    },
    impact: 'medium',
    rating: 4,
    category: 'memory',
    fix: 'Keep CLAUDE.md under 200 lines. Use @import or .claude/rules/ to split large instructions.',
    template: null
  },

  // ============================================================
  // === QUALITY & TESTING (category: 'quality') ================
  // ============================================================

  verificationLoop: {
    id: 93,
    name: 'Verification criteria in CLAUDE.md',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /\b(npm test|yarn test|pnpm test|pytest|go test|make test|npm run lint|yarn lint|npx |ruff |eslint)\b/i.test(md) ||
        /\b(test command|lint command|build command|verify|run tests|run lint)\b/i.test(md);
    },
    impact: 'critical',
    rating: 5,
    category: 'quality',
    fix: 'Add test/lint/build commands to CLAUDE.md so Claude can verify its own work.',
    template: null
  },

  testCommand: {
    id: 93001,
    name: 'CLAUDE.md contains a test command',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /npm test|pytest|jest|vitest|cargo test|go test|mix test|rspec/.test(md);
    },
    impact: 'high',
    rating: 5,
    category: 'quality',
    fix: 'Add an explicit test command to CLAUDE.md (e.g. "Run `npm test` before committing").',
    template: null
  },

  lintCommand: {
    id: 93002,
    name: 'CLAUDE.md contains a lint command',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /eslint|prettier|ruff|black|clippy|golangci-lint|rubocop|npm run lint|yarn lint|pnpm lint|bun lint/.test(md);
    },
    impact: 'high',
    rating: 4,
    category: 'quality',
    fix: 'Add a lint command to CLAUDE.md so Claude auto-formats and checks code style.',
    template: null
  },

  buildCommand: {
    id: 93003,
    name: 'CLAUDE.md contains a build command',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /npm run build|cargo build|go build|make|tsc|gradle build|mvn compile/.test(md);
    },
    impact: 'medium',
    rating: 4,
    category: 'quality',
    fix: 'Add a build command to CLAUDE.md so Claude can verify compilation before committing.',
    template: null
  },

  // ============================================================
  // === GIT SAFETY (category: 'git') ===========================
  // ============================================================

  gitIgnoreClaudeTracked: {
    id: 976,
    name: '.claude/ tracked in git',
    check: (ctx) => {
      if (!ctx.fileContent('.gitignore')) return true; // no gitignore = ok
      const lines = ctx.fileContent('.gitignore')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      const ignoresClaudeDir = lines.some(line => /^(\/|\*\*\/)?\.claude\/?$/.test(line));
      const unignoresClaudeDir = lines.some(line => /^!(\/)?\.claude(\/|\*\*)?$/.test(line));
      return !ignoresClaudeDir || unignoresClaudeDir;
    },
    impact: 'high',
    rating: 4,
    category: 'git',
    fix: 'Remove .claude/ from .gitignore (keep .claude/settings.local.json ignored).',
    template: null
  },

  gitIgnoreEnv: {
    id: 917,
    name: '.gitignore blocks .env files',
    check: (ctx) => {
      const gitignore = ctx.fileContent('.gitignore') || '';
      return gitignore.includes('.env');
    },
    impact: 'critical',
    rating: 5,
    category: 'git',
    fix: 'Add .env to .gitignore to prevent leaking secrets.',
    template: null
  },

  gitIgnoreNodeModules: {
    id: 91701,
    name: '.gitignore blocks node_modules',
    check: (ctx) => {
      const hasNodeSignals = ctx.files.includes('package.json') ||
        ctx.files.includes('tsconfig.json') ||
        ctx.files.some(f => /package-lock\.json|pnpm-lock\.yaml|yarn\.lock|next\.config|vite\.config/i.test(f));
      if (!hasNodeSignals) return null;
      const gitignore = ctx.fileContent('.gitignore') || '';
      return gitignore.includes('node_modules');
    },
    impact: 'high',
    rating: 4,
    category: 'git',
    fix: 'Add node_modules/ to .gitignore.',
    template: null
  },

  noSecretsInClaude: {
    id: 1039,
    name: 'CLAUDE.md has no embedded API keys',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return !containsEmbeddedSecret(md);
    },
    impact: 'critical',
    rating: 5,
    category: 'git',
    fix: 'Remove API keys from CLAUDE.md. Use environment variables or .env files instead.',
    template: null
  },

  // ============================================================
  // === WORKFLOW (category: 'workflow') =========================
  // ============================================================

  customCommands: {
    id: 20,
    name: 'Custom slash commands',
    check: (ctx) => ctx.hasDir('.claude/commands') && ctx.dirFiles('.claude/commands').length > 0,
    impact: 'high',
    rating: 4,
    category: 'workflow',
    fix: 'Create custom commands for repeated workflows (/test, /deploy, /review).',
    template: 'commands'
  },

  multipleCommands: {
    id: 20001,
    name: '3+ slash commands for rich workflow',
    check: (ctx) => ctx.hasDir('.claude/commands') && ctx.dirFiles('.claude/commands').length >= 3,
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Add at least 3 slash commands to cover your main workflows (test, deploy, review, etc.).',
    template: 'commands'
  },

  deployCommand: {
    id: 20002,
    name: 'Has /deploy or /release command',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/commands')) return false;
      const files = ctx.dirFiles('.claude/commands');
      return files.some(f => /deploy|release/i.test(f));
    },
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Create a /deploy or /release command for one-click deployments.',
    template: null
  },

  reviewCommand: {
    id: 20003,
    name: 'Has /review command',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/commands')) return false;
      const files = ctx.dirFiles('.claude/commands');
      return files.some(f => /review/i.test(f));
    },
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Create a /review command for code review workflows.',
    template: null
  },

  skills: {
    id: 21,
    name: 'Custom skills',
    check: (ctx) => {
      // Skills use directory-per-skill structure: .claude/skills/<name>/SKILL.md
      if (!ctx.hasDir('.claude/skills')) return false;
      const dirs = ctx.dirFiles('.claude/skills');
      // Check for SKILL.md inside skill directories
      for (const d of dirs) {
        if (ctx.fileContent(`.claude/skills/${d}/SKILL.md`)) return true;
      }
      // Fallback: any files in skills dir (legacy .claude/commands/ also works)
      return dirs.length > 0;
    },
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Create skills at .claude/skills/<name>/SKILL.md with YAML frontmatter (name, description). Each skill is a directory with a SKILL.md file.',
    template: 'skills'
  },

  multipleSkills: {
    id: 2101,
    name: '2+ skills for specialization',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/skills')) return false;
      return ctx.dirFiles('.claude/skills').length >= 2;
    },
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Add at least 2 skills covering different workflows (e.g. code-review, test-writer).',
    template: 'skills'
  },

  agents: {
    id: 22,
    name: 'Custom agents',
    check: (ctx) => ctx.hasDir('.claude/agents') && ctx.dirFiles('.claude/agents').length > 0,
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Create specialized agents (security-reviewer, test-writer) in .claude/agents/.',
    template: 'agents'
  },

  multipleAgents: {
    id: 2201,
    name: '2+ agents for delegation',
    check: (ctx) => ctx.hasDir('.claude/agents') && ctx.dirFiles('.claude/agents').length >= 2,
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Add at least 2 agents for specialized tasks (e.g. security-reviewer, test-writer).',
    template: 'agents'
  },

  multipleRules: {
    id: 301,
    name: '2+ rules files for granular control',
    check: (ctx) => ctx.hasDir('.claude/rules') && ctx.dirFiles('.claude/rules').length >= 2,
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Add path-specific rules for different parts of the codebase (frontend, backend, tests).',
    template: 'rules'
  },

  // ============================================================
  // === SECURITY (category: 'security') ========================
  // ============================================================

  settingsPermissions: {
    id: 24,
    name: 'Permission configuration',
    check: (ctx) => {
      // Prefer local (effective config) — any settings file with permissions passes
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      return !!(settings && settings.permissions);
    },
    impact: 'medium',
    rating: 4,
    category: 'security',
    fix: 'Configure allow/deny permission lists for safe tool usage.',
    template: null
  },

  permissionDeny: {
    id: 2401,
    name: 'Deny rules configured in permissions',
    check: (ctx) => {
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.permissions) return false;
      const deny = settings.permissions.deny;
      return Array.isArray(deny) && deny.length > 0;
    },
    impact: 'high',
    rating: 5,
    category: 'security',
    fix: 'Add permissions.deny rules to block dangerous operations (e.g. rm -rf, dropping databases).',
    template: null
  },

  noBypassPermissions: {
    id: 2402,
    name: 'Default mode is not bypassPermissions',
    check: (ctx) => {
      // Check shared settings first (committed to git) — if the shared baseline
      // is safe, a personal settings.local.json override should not fail the audit.
      const shared = ctx.jsonFile('.claude/settings.json');
      if (shared && shared.permissions) {
        return shared.permissions.defaultMode !== 'bypassPermissions';
      }
      const local = ctx.jsonFile('.claude/settings.local.json');
      if (!local || !local.permissions) return null;
      return local.permissions.defaultMode !== 'bypassPermissions';
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Do not set defaultMode to bypassPermissions. Use explicit allow rules instead.',
    template: null
  },

  secretsProtection: {
    id: 1096,
    name: 'Secrets protection configured',
    check: (ctx) => {
      // Prefer shared settings.json (committed) over local override
      const settings = ctx.jsonFile('.claude/settings.json') || ctx.jsonFile('.claude/settings.local.json');
      if (!settings || !settings.permissions) return false;
      const deny = JSON.stringify(settings.permissions.deny || []);
      return deny.includes('.env') || deny.includes('secrets');
    },
    impact: 'critical',
    rating: 5,
    category: 'security',
    fix: 'Add permissions.deny rules to block reading .env files and secrets directories.',
    template: null
  },

  securityReview: {
    id: 1031,
    name: 'Security review command awareness',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return md.includes('security') || md.includes('/security-review');
    },
    impact: 'high',
    rating: 5,
    category: 'security',
    fix: 'Add /security-review to your workflow. Claude Code has built-in OWASP Top 10 scanning.',
    template: null
  },

  // ============================================================
  // === AUTOMATION (category: 'automation') =====================
  // ============================================================

  hooks: {
    id: 19,
    name: 'Hooks for automation',
    check: (ctx) => {
      // Hooks are configured in settings.json (not .claude/hooks/ directory)
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      return !!(shared.hooks && Object.keys(shared.hooks).length > 0) || !!(local.hooks && Object.keys(local.hooks).length > 0);
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Add hooks in .claude/settings.json under the "hooks" key. Supported events: PreToolUse, PostToolUse, Notification, Stop, StopFailure, SubagentStop, and more.',
    template: 'hooks'
  },

  hooksInSettings: {
    id: 8801,
    name: 'Hooks configured in settings',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json');
      const local = ctx.jsonFile('.claude/settings.local.json');
      const hasSharedHooks = shared && shared.hooks && Object.keys(shared.hooks).length > 0;
      const hasLocalHooks = local && local.hooks && Object.keys(local.hooks).length > 0;
      return hasSharedHooks || hasLocalHooks;
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Add hooks in .claude/settings.json for automated enforcement (lint-on-save, test-on-commit).',
    template: 'hooks'
  },

  preToolUseHook: {
    id: 8802,
    name: 'PreToolUse hook configured',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json');
      const local = ctx.jsonFile('.claude/settings.local.json');
      return !!(shared?.hooks?.PreToolUse || local?.hooks?.PreToolUse);
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Add PreToolUse hooks for validation before tool calls (e.g. block writes to protected files).',
    template: null
  },

  postToolUseHook: {
    id: 8803,
    name: 'PostToolUse hook configured',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json');
      const local = ctx.jsonFile('.claude/settings.local.json');
      return !!(shared?.hooks?.PostToolUse || local?.hooks?.PostToolUse);
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Add PostToolUse hooks for auto-lint or auto-format after file writes.',
    template: null
  },

  sessionStartHook: {
    id: 8804,
    name: 'SessionStart hook configured',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json');
      const local = ctx.jsonFile('.claude/settings.local.json');
      if (!(shared?.hooks || local?.hooks)) return false;
      return !!(shared?.hooks?.SessionStart || local?.hooks?.SessionStart);
    },
    impact: 'medium',
    rating: 4,
    category: 'automation',
    fix: 'Add a SessionStart hook for initialization tasks (log rotation, state loading, etc.).',
    template: null
  },

  // ============================================================
  // === DESIGN (category: 'design') ============================
  // ============================================================

  frontendDesignSkill: {
    id: 1025,
    name: 'Frontend design skill for anti-AI-slop',
    check: (ctx) => {
      if (!hasFrontendSignals(ctx)) return null;
      const md = ctx.claudeMdContent() || '';
      return md.includes('frontend_aesthetics') || md.includes('anti-AI-slop') || md.includes('frontend-design');
    },
    impact: 'medium',
    rating: 5,
    category: 'design',
    fix: 'Install the official frontend-design skill for better UI output quality.',
    template: null
  },

  tailwindMention: {
    id: 102501,
    name: 'Tailwind CSS configured',
    check: (ctx) => {
      if (!hasFrontendSignals(ctx)) return null;
      const pkg = ctx.fileContent('package.json') || '';
      return pkg.includes('tailwind') ||
        ctx.files.some(f => /tailwind\.config/.test(f));
    },
    impact: 'low',
    rating: 3,
    category: 'design',
    fix: 'Consider adding Tailwind CSS for rapid, consistent UI styling with Claude.',
    template: null
  },

  // ============================================================
  // === DEVOPS (category: 'devops') ============================
  // ============================================================

  dockerfile: {
    id: 399,
    name: 'Has Dockerfile',
    check: (ctx) => ctx.files.some(f => /^Dockerfile/i.test(f)),
    impact: 'medium',
    rating: 3,
    category: 'devops',
    fix: 'Add a Dockerfile for containerized builds and deployments.',
    template: null
  },

  dockerCompose: {
    id: 39901,
    name: 'Has docker-compose.yml',
    check: (ctx) => ctx.files.some(f => /^docker-compose\.(yml|yaml)$/i.test(f)),
    impact: 'medium',
    rating: 3,
    category: 'devops',
    fix: 'Add docker-compose.yml for multi-service local development.',
    template: null
  },

  ciPipeline: {
    id: 260,
    name: 'CI pipeline configured',
    check: (ctx) => ctx.hasDir('.github/workflows') || ctx.hasDir('.circleci') ||
      ctx.files.includes('.gitlab-ci.yml') || ctx.files.includes('Jenkinsfile') ||
      ctx.files.includes('.travis.yml') || ctx.files.includes('bitbucket-pipelines.yml'),
    impact: 'high',
    rating: 4,
    category: 'devops',
    fix: 'Add a CI pipeline (GitHub Actions, GitLab CI, CircleCI, etc.) for automated testing and deployment.',
    template: null
  },

  terraformFiles: {
    id: 397,
    name: 'Infrastructure as Code (Terraform)',
    check: (ctx) => ctx.files.some(f => /\.tf$/.test(f)) || ctx.files.includes('main.tf'),
    impact: 'medium',
    rating: 3,
    category: 'devops',
    fix: 'Add Terraform files for infrastructure-as-code management.',
    template: null
  },

  // ============================================================
  // === PROJECT HYGIENE (category: 'hygiene') ==================
  // ============================================================

  readme: {
    id: 416,
    name: 'Has README.md',
    check: (ctx) => ctx.files.some(f => /^readme\.md$/i.test(f)),
    impact: 'high',
    rating: 4,
    category: 'hygiene',
    fix: 'Add a README.md with project overview, setup instructions, and usage.',
    template: null
  },

  changelog: {
    id: 417,
    name: 'Has CHANGELOG.md',
    check: (ctx) => ctx.files.some(f => /^changelog\.md$/i.test(f)),
    impact: 'low',
    rating: 3,
    category: 'hygiene',
    fix: 'Add a CHANGELOG.md to track notable changes across versions.',
    template: null
  },

  contributing: {
    id: 418,
    name: 'Has CONTRIBUTING.md',
    check: (ctx) => ctx.files.some(f => /^contributing\.md$/i.test(f)),
    impact: 'low',
    rating: 3,
    category: 'hygiene',
    fix: 'Add a CONTRIBUTING.md with contribution guidelines and code standards.',
    template: null
  },

  license: {
    id: 434,
    name: 'Has LICENSE file',
    check: (ctx) => ctx.files.some(f => /^license/i.test(f)),
    impact: 'low',
    rating: 3,
    category: 'hygiene',
    fix: 'Add a LICENSE file to clarify usage rights.',
    template: null
  },

  editorconfig: {
    id: 5001,
    name: 'Has .editorconfig',
    check: (ctx) => ctx.files.includes('.editorconfig'),
    impact: 'low',
    rating: 3,
    category: 'hygiene',
    fix: 'Add .editorconfig for consistent formatting across editors and Claude.',
    template: null
  },

  nvmrc: {
    id: 5002,
    name: 'Node version pinned',
    check: (ctx) => {
      const hasNodeSignals = ctx.files.includes('package.json') ||
        ctx.files.includes('tsconfig.json') ||
        ctx.files.some(f => /package-lock\.json|pnpm-lock\.yaml|yarn\.lock|next\.config|vite\.config/i.test(f));
      if (!hasNodeSignals) return null;
      if (ctx.files.includes('.nvmrc') || ctx.files.includes('.node-version')) return true;
      const pkg = ctx.jsonFile('package.json');
      return !!(pkg && pkg.engines && pkg.engines.node);
    },
    impact: 'low',
    rating: 3,
    category: 'hygiene',
    fix: 'Add .nvmrc, .node-version, or engines.node in package.json to pin Node version.',
    template: null
  },

  // ============================================================
  // === PERFORMANCE (category: 'performance') ==================
  // ============================================================

  compactionAwareness: {
    id: 568,
    name: 'CLAUDE.md mentions /compact or compaction',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /\/compact|compaction|context.*(limit|manage|budget)/i.test(md);
    },
    impact: 'medium',
    rating: 4,
    category: 'performance',
    fix: 'Add compaction guidance to CLAUDE.md (e.g. "Run /compact when context is heavy").',
    template: null
  },

  contextManagement: {
    id: 45,
    name: 'Context management awareness',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /context.*(manage|window|limit|budget|token)/i.test(md);
    },
    impact: 'medium',
    rating: 4,
    category: 'performance',
    fix: 'Add context management tips to CLAUDE.md to help Claude stay within token limits.',
    template: null
  },

  // ============================================================
  // === MCP / TOOLS (category: 'tools') ========================
  // ============================================================

  mcpServers: {
    id: 18,
    name: 'MCP servers configured',
    check: (ctx) => {
      // MCP now lives in .mcp.json (project) and ~/.claude.json (user), NOT settings.json
      const mcpJson = ctx.jsonFile('.mcp.json');
      if (mcpJson && mcpJson.mcpServers && Object.keys(mcpJson.mcpServers).length > 0) return true;
      // Fallback: check settings for legacy format
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      return !!(settings && settings.mcpServers && Object.keys(settings.mcpServers).length > 0);
    },
    impact: 'medium',
    rating: 3,
    category: 'tools',
    fix: 'Configure MCP servers in .mcp.json at project root. Use `claude mcp add` to add servers. Project-level MCP is committed to git for team sharing.',
    template: null
  },

  multipleMcpServers: {
    id: 1801,
    name: '2+ MCP servers for rich tooling',
    check: (ctx) => {
      let count = 0;
      const mcpJson = ctx.jsonFile('.mcp.json');
      if (mcpJson && mcpJson.mcpServers) count += Object.keys(mcpJson.mcpServers).length;
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (settings && settings.mcpServers) count += Object.keys(settings.mcpServers).length;
      return count >= 2;
    },
    impact: 'medium',
    rating: 4,
    category: 'tools',
    fix: 'Add at least 2 MCP servers for broader tool coverage (e.g. database + search).',
    template: null
  },

  context7Mcp: {
    id: 110,
    name: 'Context7 MCP for real-time docs',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      const mcp = ctx.jsonFile('.mcp.json') || {};
      const all = { ...(shared.mcpServers || {}), ...(local.mcpServers || {}), ...(mcp.mcpServers || {}) };
      if (Object.keys(all).length === 0) return false;
      return Object.keys(all).some(k => /context7/i.test(k));
    },
    impact: 'medium',
    rating: 4,
    category: 'tools',
    fix: 'Add Context7 MCP server for real-time documentation lookup (always up-to-date library docs).',
    template: null
  },

  // ============================================================
  // === PROMPTING (category: 'prompting') ======================
  // ============================================================

  xmlTags: {
    id: 96,
    name: 'XML tags for structured prompts',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      // Give credit for XML tags OR well-structured markdown with clear sections
      const hasXml = md.includes('<constraints') || md.includes('<rules') ||
        md.includes('<validation') || md.includes('<instructions');
      const hasStructuredMd = (md.includes('## Rules') || md.includes('## Constraints') ||
        md.includes('## Do not') || md.includes('## Never') || md.includes('## Important')) &&
        md.split('\n').length > 20;
      return hasXml || hasStructuredMd;
    },
    impact: 'medium',
    rating: 4,
    category: 'prompting',
    fix: 'Add clear rules sections to CLAUDE.md. XML tags (<constraints>) are optional but improve clarity.',
    template: null
  },

  fewShotExamples: {
    id: 9,
    name: 'CLAUDE.md contains code examples',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return (md.match(/```/g) || []).length >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'prompting',
    fix: 'Add code examples (few-shot) in CLAUDE.md to show preferred patterns and conventions.',
    template: null
  },

  roleDefinition: {
    id: 10,
    name: 'CLAUDE.md defines a role or persona',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /^you are a |^your role is|^act as a |persona:|behave as a /im.test(md);
    },
    impact: 'medium',
    rating: 4,
    category: 'prompting',
    fix: 'Define a role or persona in CLAUDE.md (e.g. "You are a senior backend engineer...").',
    template: null
  },

  constraintBlocks: {
    id: 9601,
    name: 'XML constraint blocks in CLAUDE.md',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /<constraints|<rules|<requirements|<boundaries/i.test(md);
    },
    impact: 'high',
    rating: 5,
    category: 'prompting',
    fix: 'Wrap critical rules in <constraints> XML blocks for 40% better adherence.',
    template: null
  },

  // ============================================================
  // === FEATURES (category: 'features') ========================
  // ============================================================

  channelsAwareness: {
    id: 1102,
    name: 'Claude Code Channels awareness',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      const settingsStr = JSON.stringify(settings || {});
      return /\bchannels?\b.*\b(telegram|discord|imessage|slack|bridge)\b|\b(telegram|discord|imessage|slack|bridge)\b.*\bchannels?\b/i.test(md) || settingsStr.includes('channels');
    },
    impact: 'low',
    rating: 3,
    category: 'features',
    fix: 'Claude Code Channels (v2.1.80+) bridges Telegram/Discord/iMessage to your session.',
    template: null
  },

  // ============================================================
  // === QUALITY CHECKS FOR VETERANS (category: 'quality-deep')
  // These check HOW GOOD your config is, not just IF it exists.
  // ============================================================

  claudeMdFreshness: {
    id: 2001,
    name: 'CLAUDE.md mentions current Claude features',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      if (md.length < 50) return false; // too short to evaluate
      // Check for awareness of features from 2025+
      const modernFeatures = ['hook', 'skill', 'agent', 'subagent', 'mcp', 'compact', '/clear', 'extended thinking', 'tool_use', 'worktree'];
      const found = modernFeatures.filter(f => md.toLowerCase().includes(f));
      return found.length >= 2; // knows at least 2 modern features
    },
    impact: 'medium',
    rating: 4,
    category: 'quality-deep',
    fix: 'Your CLAUDE.md may be outdated. Modern Claude Code supports hooks, skills, agents, MCP, worktrees, and extended thinking. Mention the ones you use.',
    template: null
  },

  // claudeMdNotOverlong removed — duplicate of underlines200 (id 681)

  claudeLocalMd: {
    id: 2002,
    name: 'CLAUDE.local.md for personal overrides',
    check: (ctx) => {
      // CLAUDE.local.md is for personal, non-committed overrides
      return ctx.files.includes('CLAUDE.local.md') || ctx.files.includes('.claude/CLAUDE.local.md');
    },
    impact: 'low',
    rating: 2,
    category: 'memory',
    fix: 'Create CLAUDE.local.md for personal preferences that should not be committed (add to .gitignore).',
    template: null
  },

  claudeMdNoContradictions: {
    id: 2003,
    name: 'CLAUDE.md has no obvious contradictions',
    check: (ctx) => {
      const md = ctx.claudeMdContent();
      if (!md || md.length < 50) return false; // no CLAUDE.md or too short = not passing
      // Check for common contradictions
      // Check for contradictions on the SAME topic (same line or adjacent sentence)
      const lines = md.split('\n');
      let hasContradiction = false;
      for (const line of lines) {
        if (/\balways\b.*\bnever\b|\bnever\b.*\balways\b/i.test(line)) {
          hasContradiction = true;
          break;
        }
      }
      const hasBothStyles = /\buse tabs\b/i.test(md) && /\buse spaces\b/i.test(md);
      return !hasContradiction && !hasBothStyles;
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'CLAUDE.md may contain contradictory instructions. Review for conflicting rules (e.g., "always X" and "never X" about the same topic).',
    template: null
  },

  hooksAreSpecific: {
    id: 2004,
    name: 'Hooks use specific matchers (not catch-all)',
    check: (ctx) => {
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.hooks) return null; // no hooks = not applicable
      const hookStr = JSON.stringify(settings.hooks);
      // Check that hooks have matchers, not just catch-all
      return hookStr.includes('matcher');
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Hooks without matchers run on every tool call. Use matchers like "Write|Edit" or "Bash" to target specific tools.',
    template: null
  },

  // permissionsNotBypassed removed - duplicate of noBypassPermissions (#24)

  commandsUseArguments: {
    id: 2006,
    name: 'Commands use $ARGUMENTS for flexibility',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/commands')) return null; // not applicable
      const files = ctx.dirFiles('.claude/commands');
      if (files.length === 0) return null;
      // Check if at least one command uses $ARGUMENTS
      for (const f of files) {
        const content = ctx.fileContent(`.claude/commands/${f}`) || '';
        if (content.includes('$ARGUMENTS') || content.includes('$arguments')) return true;
      }
      return false;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Commands without $ARGUMENTS are static. Use $ARGUMENTS to make them flexible: "Fix the issue: $ARGUMENTS"',
    template: null
  },

  agentsHaveMaxTurns: {
    id: 2007,
    name: 'Subagents have max-turns limit',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/agents')) return null;
      const files = ctx.dirFiles('.claude/agents');
      if (files.length === 0) return null;
      for (const f of files) {
        const content = ctx.fileContent(`.claude/agents/${f}`) || '';
        // Current frontmatter uses kebab-case: max-turns (also accept legacy maxTurns)
        if (!content.includes('max-turns') && !content.includes('maxTurns')) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Subagents without max-turns can run indefinitely. Add "max-turns: 50" to subagent YAML frontmatter.',
    template: null
  },

  securityReviewInWorkflow: {
    id: 2008,
    name: '/security-review command or workflow',
    check: (ctx) => {
      const hasCommand = ctx.hasDir('.claude/commands') &&
        (ctx.dirFiles('.claude/commands') || []).some(f => f.includes('security') || f.includes('review'));
      const md = ctx.claudeMdContent() || '';
      const hasExplicitRef = /\/security-review|security review command|security workflow/i.test(md);
      return hasCommand || hasExplicitRef;
    },
    impact: 'medium',
    rating: 4,
    category: 'quality-deep',
    fix: 'Claude Code has built-in /security-review (OWASP Top 10). Add it to your workflow or create a /security command.',
    template: null
  },

  // --- New checks: testing depth ---
  testCoverage: {
    id: 2010,
    name: 'Test coverage or strategy mentioned',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /coverage|test.*strateg|e2e|integration test|unit test/i.test(md);
    },
    impact: 'medium', rating: 3, category: 'quality',
    fix: 'Mention your testing strategy in CLAUDE.md (unit, integration, E2E, coverage targets).',
    template: null
  },

  // --- New checks: agent depth ---
  agentHasAllowedTools: {
    id: 2011,
    name: 'At least one subagent restricts tools',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/agents')) return null;
      const files = ctx.dirFiles('.claude/agents');
      if (files.length === 0) return null;
      for (const f of files) {
        const content = ctx.fileContent(`.claude/agents/${f}`) || '';
        // Current frontmatter uses allowed-tools (also accept legacy tools:)
        if (/allowed-tools:/i.test(content) || /tools:\s*\[/.test(content)) return true;
      }
      return false;
    },
    impact: 'medium', rating: 3, category: 'workflow',
    fix: 'Add allowed-tools to subagent frontmatter (e.g. allowed-tools: Read Grep Bash) for safer delegation.',
    template: null
  },

  // --- New checks: memory / auto-memory ---
  autoMemoryAwareness: {
    id: 2012,
    name: 'Auto-memory or memory management mentioned',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /auto.?memory|memory.*manage|remember|persistent.*context/i.test(md);
    },
    impact: 'low', rating: 3, category: 'memory',
    fix: 'Claude Code supports auto-memory for cross-session learning. Mention your memory strategy if relevant.',
    template: null
  },

  // --- New checks: sandbox / security depth ---
  sandboxAwareness: {
    id: 2013,
    name: 'Sandbox or isolation mentioned',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      const settings = ctx.jsonFile('.claude/settings.json') || {};
      return /sandbox|isolat/i.test(md) || !!settings.sandbox;
    },
    impact: 'medium', rating: 3, category: 'security',
    fix: 'Claude Code supports sandboxed command execution. Consider enabling it for untrusted operations.',
    template: null
  },

  denyRulesDepth: {
    id: 2014,
    name: 'Deny rules cover 3+ patterns',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json');
      const local = ctx.jsonFile('.claude/settings.local.json');
      const deny = (shared?.permissions?.deny || []).concat(local?.permissions?.deny || []);
      return deny.length >= 3;
    },
    impact: 'high', rating: 4, category: 'security',
    fix: 'Add at least 3 deny rules: rm -rf, force-push, and .env reads. More patterns = safer Claude.',
    template: null
  },

  // --- New checks: git depth ---
  gitAttributionDecision: {
    id: 2015,
    name: 'Git attribution configured',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      return shared.attribution !== undefined || local.attribution !== undefined ||
             shared.includeCoAuthoredBy !== undefined || local.includeCoAuthoredBy !== undefined;
    },
    impact: 'low', rating: 3, category: 'git',
    fix: 'Decide on git attribution: set attribution.commit or includeCoAuthoredBy in settings.',
    template: null
  },

  // --- New checks: performance ---
  effortLevelConfigured: {
    id: 2016,
    name: 'Effort level or thinking configuration',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      return /effort|thinking/i.test(md) || shared.effortLevel || local.effortLevel ||
             shared.alwaysThinkingEnabled !== undefined || local.alwaysThinkingEnabled !== undefined;
    },
    impact: 'low', rating: 3, category: 'performance',
    fix: 'Configure effortLevel or mention thinking strategy in CLAUDE.md for task-appropriate reasoning depth.',
    template: null
  },

  // --- New checks: workflow depth ---
  hasSnapshotHistory: {
    id: 2017,
    name: 'Audit snapshot history exists',
    check: (ctx) => {
      return !!ctx.fileContent('.claude/claudex-setup/snapshots/index.json');
    },
    impact: 'low', rating: 3, category: 'workflow',
    fix: 'Run `npx nerviq --snapshot` to start tracking your setup score over time.',
    template: null
  },

  worktreeAwareness: {
    id: 2018,
    name: 'Worktree or parallel sessions mentioned',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      return /worktree|parallel.*session/i.test(md) || !!shared.worktree;
    },
    impact: 'low', rating: 3, category: 'features',
    fix: 'Claude Code supports git worktrees for parallel isolated sessions. Mention if relevant.',
    template: null
  },

  // --- New checks: prompting depth ---
  negativeInstructions: {
    id: 2019,
    name: 'CLAUDE.md includes "do not" instructions',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /do not|don't|never|avoid|must not/i.test(md);
    },
    impact: 'medium', rating: 4, category: 'prompting',
    fix: 'Add explicit "do not" rules to CLAUDE.md. Negative constraints reduce common mistakes.',
    template: null
  },

  outputStyleGuidance: {
    id: 2020,
    name: 'CLAUDE.md includes output or style guidance',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /coding style|naming convention|code style|style guide|formatting rules|\bprefer\b.*\b(single|double|tabs|spaces|camel|snake|kebab|named|default|const|let|arrow|function)\b/i.test(md);
    },
    impact: 'medium', rating: 3, category: 'prompting',
    fix: 'Add coding style and naming conventions to CLAUDE.md so Claude matches your project patterns.',
    template: null
  },

  // --- New checks: devops depth ---
  githubActionsOrCI: {
    id: 2021,
    name: 'GitHub Actions or CI configured',
    check: (ctx) => {
      return ctx.hasDir('.github/workflows') || !!ctx.fileContent('.circleci/config.yml') ||
             !!ctx.fileContent('.gitlab-ci.yml') || !!ctx.fileContent('Jenkinsfile') ||
             !!ctx.fileContent('.travis.yml') || !!ctx.fileContent('bitbucket-pipelines.yml');
    },
    impact: 'medium', rating: 3, category: 'devops',
    fix: 'Add CI pipeline for automated testing. Claude Code has a GitHub Action for audit gates.',
    template: null
  },

  // --- New checks: depth round 2 ---
  projectDescriptionInClaudeMd: {
    id: 2022,
    name: 'CLAUDE.md describes what the project does',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /what.*does|overview|purpose|about|description|project.*is/i.test(md) && md.length > 100;
    },
    impact: 'high', rating: 4, category: 'memory',
    fix: 'Start CLAUDE.md with a clear project description. Claude needs to know what your project does.',
    template: null
  },

  directoryStructureInClaudeMd: {
    id: 2023,
    name: 'CLAUDE.md documents directory structure',
    check: (ctx) => {
      const md = ctx.claudeMdContent() || '';
      return /src\/|app\/|lib\/|structure|director|folder/i.test(md);
    },
    impact: 'medium', rating: 4, category: 'memory',
    fix: 'Document your directory structure in CLAUDE.md so Claude navigates your codebase efficiently.',
    template: null
  },

  multipleHookTypes: {
    id: 2024,
    name: '2+ hook event types configured',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      const hooks = { ...(shared.hooks || {}), ...(local.hooks || {}) };
      return Object.keys(hooks).length >= 2;
    },
    impact: 'medium', rating: 3, category: 'automation',
    fix: 'Add at least 2 hook types (e.g. PostToolUse for linting + SessionStart for initialization).',
    template: null
  },

  stopFailureHook: {
    id: 2025,
    name: 'StopFailure hook for error tracking',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      // StopFailure = error stop (API errors), Stop = normal completion — both useful but different
      return !!(shared.hooks?.StopFailure || local.hooks?.StopFailure);
    },
    impact: 'low', rating: 3, category: 'automation',
    fix: 'Add a StopFailure hook to log API errors and unexpected stops. Note: StopFailure (errors) is different from Stop (normal completion).',
    template: null
  },

  skillUsesPaths: {
    id: 2026,
    name: 'At least one skill uses paths for scoping',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/skills')) return null;
      const entries = ctx.dirFiles('.claude/skills');
      if (entries.length === 0) return null;
      for (const entry of entries) {
        // Skills can be files or dirs with SKILL.md inside
        const direct = ctx.fileContent(`.claude/skills/${entry}`) || '';
        if (/paths:/i.test(direct)) return true;
        const nested = ctx.fileContent(`.claude/skills/${entry}/SKILL.md`) || '';
        if (/paths:/i.test(nested)) return true;
      }
      return false;
    },
    impact: 'low', rating: 3, category: 'workflow',
    fix: 'Add paths to skill frontmatter to scope when skills activate (e.g. paths: ["src/**/*.ts"]).',
    template: null
  },

  mcpHasEnvConfig: {
    id: 2027,
    name: 'MCP servers have environment configuration',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      const mcp = ctx.jsonFile('.mcp.json') || {};
      const allServers = { ...(shared.mcpServers || {}), ...(local.mcpServers || {}), ...(mcp.mcpServers || {}) };
      if (Object.keys(allServers).length === 0) return null;
      return Object.values(allServers).some(s => s.env && Object.keys(s.env).length > 0);
    },
    impact: 'low', rating: 3, category: 'tools',
    fix: 'Configure environment variables for MCP servers that need authentication (e.g. GITHUB_TOKEN).',
    template: null
  },

  gitIgnoreClaudeLocal: {
    id: 2028,
    name: '.gitignore excludes settings.local.json',
    check: (ctx) => {
      const gitignore = ctx.fileContent('.gitignore') || '';
      return /settings\.local\.json|settings\.local/i.test(gitignore);
    },
    impact: 'medium', rating: 4, category: 'git',
    fix: 'Add .claude/settings.local.json to .gitignore. Personal overrides should not be committed.',
    template: null
  },

  envExampleExists: {
    id: 2029,
    name: '.env.example or .env.template exists',
    check: (ctx) => {
      return !!(ctx.fileContent('.env.example') || ctx.fileContent('.env.template') || ctx.fileContent('.env.sample'));
    },
    impact: 'low', rating: 3, category: 'hygiene',
    fix: 'Add .env.example so new developers know which environment variables are needed.',
    template: null
  },

  packageJsonHasScripts: {
    id: 2030,
    name: 'package.json has dev/test/build scripts',
    check: (ctx) => {
      const pkg = ctx.jsonFile('package.json');
      if (!pkg) return null;
      const scripts = pkg.scripts || {};
      const has = (k) => !!scripts[k];
      return has('test') || has('dev') || has('build') || has('start');
    },
    impact: 'medium', rating: 3, category: 'hygiene',
    fix: 'Add scripts to package.json (test, dev, build). Claude uses these for verification.',
    template: null
  },

  typeCheckingConfigured: {
    id: 2031,
    name: 'Type checking configured (TypeScript or similar)',
    check: (ctx) => {
      return !!(ctx.fileContent('tsconfig.json') || ctx.fileContent('jsconfig.json') ||
        ctx.fileContent('pyrightconfig.json') || ctx.fileContent('mypy.ini'));
    },
    impact: 'medium', rating: 3, category: 'quality',
    fix: 'Add type checking configuration. Type-safe code produces fewer Claude errors.',
    template: null
  },

  noDeprecatedPatterns: {
    id: 2009,
    name: 'No deprecated patterns detected',
    check: (ctx) => {
      const md = ctx.claudeMdContent();
      if (!md) return false;
      // Only flag truly deprecated patterns, not valid aliases
      const deprecatedPatterns = [
        /\bhuman_prompt\b/i, /\bassistant_prompt\b/i, // old completions API format (not Messages API)
        /\buse model claude-3-opus\b/i, // explicit recommendation to use old name as --model
        /\buse model claude-3-sonnet\b/i,
      ];
      return !deprecatedPatterns.some(p => p.test(md));
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'CLAUDE.md references deprecated API patterns (human_prompt/assistant_prompt). Update to current Messages API conventions.',
    template: null
  },

  claudeMdQuality: {
    id: 102502,
    name: 'CLAUDE.md has substantive content',
    check: (ctx) => {
      const md = ctx.claudeMdContent();
      if (!md) return null;
      const lines = md.split('\n').filter(l => l.trim());
      const sections = (md.match(/^##\s/gm) || []).length;
      const hasCommand = /\b(npm|yarn|pnpm|pytest|go |make |ruff |cargo |dotnet )\b/i.test(md);
      return lines.length >= 15 && sections >= 2 && hasCommand;
    },
    impact: 'medium',
    rating: 4,
    category: 'quality-deep',
    fix: 'CLAUDE.md exists but lacks substance. Add at least 2 sections (## headings) and include your test/build/lint commands.',
    template: null
  },

  // ============================================================
  // === NEW CHECKS: Uncovered features (2026-04-05) ============
  // ============================================================

  mcpJsonProject: {
    id: 2032,
    name: 'Project-level .mcp.json exists',
    check: (ctx) => ctx.files.includes('.mcp.json'),
    impact: 'medium',
    rating: 3,
    category: 'tools',
    fix: 'Create .mcp.json at project root for team-shared MCP servers. Use `claude mcp add --project` to add servers.',
    template: null
  },

  hooksNotificationEvent: {
    id: 2033,
    name: 'Notification hook for alerts',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      return !!(shared.hooks?.Notification || local.hooks?.Notification);
    },
    impact: 'low',
    rating: 2,
    category: 'automation',
    fix: 'Add a Notification hook to capture alerts and status updates from Claude during long tasks.',
    template: null
  },

  subagentStopHook: {
    id: 2034,
    name: 'SubagentStop hook for delegation tracking',
    check: (ctx) => {
      const shared = ctx.jsonFile('.claude/settings.json') || {};
      const local = ctx.jsonFile('.claude/settings.local.json') || {};
      return !!(shared.hooks?.SubagentStop || local.hooks?.SubagentStop);
    },
    impact: 'low',
    rating: 2,
    category: 'automation',
    fix: 'Add a SubagentStop hook to track when delegated subagent tasks complete.',
    template: null
  },

  rulesDirectory: {
    id: 2035,
    name: 'Path-specific rules in .claude/rules/',
    check: (ctx) => ctx.hasDir('.claude/rules') && ctx.dirFiles('.claude/rules').length > 0,
    impact: 'medium',
    rating: 3,
    category: 'workflow',
    fix: 'Create .claude/rules/ with path-specific rules for different parts of your codebase (e.g. frontend.md, backend.md).',
    template: null
  },

  gitignoreClaudeLocal: {
    id: 2036,
    name: 'CLAUDE.local.md in .gitignore',
    check: (ctx) => {
      const gitignore = ctx.fileContent('.gitignore') || '';
      return /CLAUDE\.local\.md/i.test(gitignore);
    },
    impact: 'medium',
    rating: 3,
    category: 'git',
    fix: 'Add CLAUDE.local.md to .gitignore — it contains personal overrides that should not be committed.',
    template: null
  },


  // ============================================================
  // === PYTHON STACK CHECKS (category: 'python') ===============
  // ============================================================

  pythonProjectExists: {
    id: 'CL-PY01',
    name: 'Python project detected (pyproject.toml / setup.py / requirements.txt)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return true; },
    impact: 'high',
    category: 'python',
    fix: 'Ensure pyproject.toml, setup.py, or requirements.txt exists for Python projects.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonVersionSpecified: {
    id: 'CL-PY02',
    name: 'Python version specified (.python-version or requires-python)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return ctx.files.some(f => /\.python-version$/.test(f)) || /requires-python/i.test(ctx.fileContent('pyproject.toml') || ''); },
    impact: 'medium',
    category: 'python',
    fix: 'Create .python-version or add requires-python to pyproject.toml.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonVenvMentioned: {
    id: 'CL-PY03',
    name: 'Virtual environment mentioned in instructions',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /venv|virtualenv|conda|poetry shell|uv venv/i.test(docs); },
    impact: 'medium',
    category: 'python',
    fix: 'Document virtual environment setup in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonLockfileExists: {
    id: 'CL-PY04',
    name: 'Python lockfile exists (poetry.lock / uv.lock / Pipfile.lock / pinned requirements)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return ctx.files.some(f => /poetry\.lock$|uv\.lock$|Pipfile\.lock$/.test(f)) || /==/m.test(ctx.fileContent('requirements.txt') || ''); },
    impact: 'high',
    category: 'python',
    fix: 'Add a lockfile (poetry.lock, uv.lock, Pipfile.lock) or pin versions with == in requirements.txt.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonPytestConfigured: {
    id: 'CL-PY05',
    name: 'pytest configured (pyproject.toml [tool.pytest] / pytest.ini / conftest.py)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return /\[tool\.pytest/i.test(ctx.fileContent('pyproject.toml') || '') || ctx.files.some(f => /pytest\.ini$|conftest\.py$/.test(f)); },
    impact: 'high',
    category: 'python',
    fix: 'Configure pytest in pyproject.toml [tool.pytest.ini_options] or create pytest.ini.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonLinterConfigured: {
    id: 'CL-PY06',
    name: 'Python linter configured (ruff / flake8 / pylint)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const pp = ctx.fileContent('pyproject.toml') || ''; return /\[tool\.ruff|\[tool\.flake8|\[tool\.pylint/i.test(pp) || ctx.files.some(f => /\.flake8$|pylintrc$|\.pylintrc$|ruff\.toml$/.test(f)); },
    impact: 'medium',
    category: 'python',
    fix: 'Configure ruff, flake8, or pylint in pyproject.toml or dedicated config file.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonTypeCheckerConfigured: {
    id: 'CL-PY07',
    name: 'Type checker configured (mypy / pyright)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const pp = ctx.fileContent('pyproject.toml') || ''; return /\[tool\.mypy|\[tool\.pyright/i.test(pp) || ctx.files.some(f => /mypy\.ini$|pyrightconfig\.json$/.test(f)); },
    impact: 'medium',
    category: 'python',
    fix: 'Configure mypy or pyright in pyproject.toml or dedicated config file.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonFormatterConfigured: {
    id: 'CL-PY08',
    name: 'Formatter configured (black / isort / ruff format)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const pp = ctx.fileContent('pyproject.toml') || ''; return /\[tool\.black|\[tool\.isort|\[tool\.ruff\.format/i.test(pp); },
    impact: 'medium',
    category: 'python',
    fix: 'Configure black, isort, or ruff format in pyproject.toml.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonDjangoSettingsDocumented: {
    id: 'CL-PY09',
    name: 'Django settings documented if Django project',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; if (!ctx.files.some(f => /manage\.py$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /django|settings\.py|DJANGO_SETTINGS_MODULE/i.test(docs); },
    impact: 'high',
    category: 'python',
    fix: 'Document Django settings module and configuration in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonFastapiEntryDocumented: {
    id: 'CL-PY10',
    name: 'FastAPI entry point documented if FastAPI project',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const deps = (ctx.fileContent('pyproject.toml') || '') + (ctx.fileContent('requirements.txt') || ''); if (!/fastapi/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /fastapi|uvicorn|app\.py|main\.py/i.test(docs); },
    impact: 'high',
    category: 'python',
    fix: 'Document FastAPI entry point and how to run the development server.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonMigrationsDocumented: {
    id: 'CL-PY11',
    name: 'Database migrations mentioned (alembic / Django migrations)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /alembic|migrate|makemigrations|django.{0,10}migration/i.test(docs) || ctx.files.some(f => /alembic[.]ini$|alembic[/]/.test(f)); },
    impact: 'medium',
    category: 'python',
    fix: 'Document database migration workflow (alembic or Django migrations).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonEnvHandlingDocumented: {
    id: 'CL-PY12',
    name: '.env handling documented (python-dotenv)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const deps = (ctx.fileContent('pyproject.toml') || '') + (ctx.fileContent('requirements.txt') || ''); if (!/dotenv|python-dotenv|environs/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /\.env|dotenv|environment.{0,10}variable/i.test(docs); },
    impact: 'medium',
    category: 'python',
    fix: 'Document .env file usage and python-dotenv configuration.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonPreCommitConfigured: {
    id: 'CL-PY13',
    name: 'pre-commit hooks configured (.pre-commit-config.yaml)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return ctx.files.some(f => /\.pre-commit-config\.yaml$/.test(f)); },
    impact: 'medium',
    category: 'python',
    fix: 'Add .pre-commit-config.yaml with Python-specific hooks (ruff, mypy, etc.).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonDockerBaseImage: {
    id: 'CL-PY14',
    name: 'Docker uses Python base image correctly',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const df = ctx.fileContent('Dockerfile') || ''; if (!df) return null; return /FROM.*python:/i.test(df); },
    impact: 'medium',
    category: 'python',
    fix: 'Use official Python base image in Dockerfile (e.g., FROM python:3.12-slim).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonTestMatrixConfigured: {
    id: 'CL-PY15',
    name: 'Test matrix configured (tox.ini / noxfile.py)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return ctx.files.some(f => /tox\.ini$|noxfile\.py$/.test(f)); },
    impact: 'low',
    category: 'python',
    fix: 'Configure tox or nox for multi-environment testing.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonValidationUsed: {
    id: 'CL-PY16',
    name: 'Pydantic or dataclass validation used',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const deps = (ctx.fileContent('pyproject.toml') || '') + (ctx.fileContent('requirements.txt') || ''); return /pydantic|dataclass/i.test(deps); },
    impact: 'medium',
    category: 'python',
    fix: 'Use pydantic or dataclasses for data validation and type safety.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonAsyncDocumented: {
    id: 'CL-PY17',
    name: 'Async patterns documented if async project',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const deps = (ctx.fileContent('pyproject.toml') || '') + (ctx.fileContent('requirements.txt') || ''); if (!/asyncio|aiohttp|fastapi|starlette|httpx/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /async|await|asyncio|event.{0,5}loop/i.test(docs); },
    impact: 'medium',
    category: 'python',
    fix: 'Document async patterns and conventions used in the project.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonPinnedVersions: {
    id: 'CL-PY18',
    name: 'Requirements have pinned versions (== in requirements.txt)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const req = ctx.fileContent('requirements.txt') || ''; if (!req.trim()) return null; const lines = req.split('\n').filter(l => l.trim() && !l.startsWith('#')); return lines.length > 0 && lines.every(l => /==/.test(l) || /^-/.test(l.trim())); },
    impact: 'high',
    category: 'python',
    fix: 'Pin all dependency versions with == in requirements.txt for reproducible builds.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonPackageStructure: {
    id: 'CL-PY19',
    name: 'Python package has proper structure (src/ layout or __init__.py)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return ctx.files.some(f => /src[/].*[/]__init__\.py$|^[^/]+[/]__init__\.py$/.test(f)); },
    impact: 'medium',
    category: 'python',
    fix: 'Use src/ layout or ensure packages have __init__.py files.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonDocsToolConfigured: {
    id: 'CL-PY20',
    name: 'Documentation tool configured (sphinx / mkdocs)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; return ctx.files.some(f => /mkdocs\.yml$|conf\.py$|docs[/]/.test(f)) || /sphinx|mkdocs/i.test(ctx.fileContent('pyproject.toml') || ''); },
    impact: 'low',
    category: 'python',
    fix: 'Configure sphinx or mkdocs for project documentation.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonCoverageConfigured: {
    id: 'CL-PY21',
    name: 'Coverage configured (coverage / pytest-cov)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const pp = ctx.fileContent('pyproject.toml') || ''; return /\[tool\.coverage|pytest-cov|coverage/i.test(pp) || ctx.files.some(f => /\.coveragerc$/.test(f)); },
    impact: 'medium',
    category: 'python',
    fix: 'Configure coverage reporting with pytest-cov or coverage.py.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonNoSecretsInSettings: {
    id: 'CL-PY22',
    name: 'No secrets in Django settings.py',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const settings = ctx.fileContent('settings.py') || ctx.files.filter(f => /settings\.py$/.test(f)).map(f => ctx.fileContent(f) || '').join(''); if (!settings) return null; return !/SECRET_KEY\s*=\s*['"][^'"]{10,}/i.test(settings); },
    impact: 'critical',
    category: 'python',
    fix: 'Move SECRET_KEY and other secrets to environment variables, not hardcoded in settings.py.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonWsgiAsgiDocumented: {
    id: 'CL-PY23',
    name: 'WSGI/ASGI server documented (gunicorn / uvicorn)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const deps = (ctx.fileContent('pyproject.toml') || '') + (ctx.fileContent('requirements.txt') || ''); if (!/gunicorn|uvicorn|daphne|hypercorn/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /gunicorn|uvicorn|daphne|hypercorn|wsgi|asgi/i.test(docs); },
    impact: 'medium',
    category: 'python',
    fix: 'Document WSGI/ASGI server configuration (gunicorn, uvicorn).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonTaskQueueDocumented: {
    id: 'CL-PY24',
    name: 'Task queue documented if used (celery / rq)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const deps = (ctx.fileContent('pyproject.toml') || '') + (ctx.fileContent('requirements.txt') || ''); if (!/celery|rq|dramatiq|huey/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /celery|rq|dramatiq|huey|task.{0,10}queue|worker/i.test(docs); },
    impact: 'medium',
    category: 'python',
    fix: 'Document task queue configuration and worker setup.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  pythonGitignore: {
    id: 'CL-PY25',
    name: 'Python-specific .gitignore (__pycache__, *.pyc, .venv)',
    check: (ctx) => { const hasPy = ctx.files.some(f => /pyproject\.toml$|requirements\.txt$|setup\.py$|manage\.py$/.test(f)); if (!hasPy) return null; const gi = ctx.fileContent('.gitignore') || ''; return /__pycache__|\*\.pyc|\.venv/i.test(gi); },
    impact: 'medium',
    category: 'python',
    fix: 'Add Python-specific entries to .gitignore (__pycache__, *.pyc, .venv, *.egg-info).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  // ============================================================
  // === GO STACK CHECKS (category: 'go') =======================
  // ============================================================

  goModExists: {
    id: 'CL-GO01',
    name: 'go.mod exists',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; return true; },
    impact: 'high',
    category: 'go',
    fix: 'Initialize Go module with go mod init.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goSumCommitted: {
    id: 'CL-GO02',
    name: 'go.sum committed',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; return ctx.files.some(f => /go\.sum$/.test(f)); },
    impact: 'high',
    category: 'go',
    fix: 'Commit go.sum to version control for reproducible builds.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  golangciLintConfigured: {
    id: 'CL-GO03',
    name: 'golangci-lint configured (.golangci.yml)',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; return ctx.files.some(f => /\.golangci\.ya?ml$|\.golangci\.toml$/.test(f)); },
    impact: 'medium',
    category: 'go',
    fix: 'Add .golangci.yml to configure linting rules.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goTestDocumented: {
    id: 'CL-GO04',
    name: 'go test documented in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /go test/i.test(docs); },
    impact: 'high',
    category: 'go',
    fix: 'Document go test command in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goBuildDocumented: {
    id: 'CL-GO05',
    name: 'go build documented in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /go build|go install/i.test(docs); },
    impact: 'high',
    category: 'go',
    fix: 'Document go build command in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goStandardLayout: {
    id: 'CL-GO06',
    name: 'Standard Go layout (cmd/ / internal/ / pkg/)',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; return ctx.files.some(f => /^cmd[/]|^internal[/]|^pkg[/]/.test(f)); },
    impact: 'medium',
    category: 'go',
    fix: 'Use standard Go project layout with cmd/, internal/, and/or pkg/ directories.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goErrorHandlingDocumented: {
    id: 'CL-GO07',
    name: 'Error handling patterns documented',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /error handling|errors?\.(?:New|Wrap|Is|As)|fmt\.Errorf/i.test(docs); },
    impact: 'medium',
    category: 'go',
    fix: 'Document error handling conventions (error wrapping, sentinel errors, etc.).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goContextUsageDocumented: {
    id: 'CL-GO08',
    name: 'Context usage documented',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /context\.Context|ctx\.Done|context\.WithCancel|context\.WithTimeout/i.test(docs); },
    impact: 'medium',
    category: 'go',
    fix: 'Document context.Context usage patterns for cancellation and timeouts.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goroutineSafetyDocumented: {
    id: 'CL-GO09',
    name: 'Goroutine safety documented',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /goroutine|sync\.Mutex|sync\.WaitGroup|channel|concurren/i.test(docs); },
    impact: 'medium',
    category: 'go',
    fix: 'Document goroutine safety patterns, mutex usage, and channel conventions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goModTidyMentioned: {
    id: 'CL-GO10',
    name: 'go mod tidy mentioned in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /go mod tidy/i.test(docs); },
    impact: 'low',
    category: 'go',
    fix: 'Document go mod tidy in project workflow instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goVetConfigured: {
    id: 'CL-GO11',
    name: 'go vet or staticcheck configured',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; const ci = ctx.fileContent('.github/workflows/ci.yml') || ctx.fileContent('.github/workflows/go.yml') || ''; return /go vet|staticcheck/i.test(docs + ci); },
    impact: 'medium',
    category: 'go',
    fix: 'Configure go vet and/or staticcheck in CI or project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goMakefileExists: {
    id: 'CL-GO12',
    name: 'Makefile or Taskfile exists for Go project',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; return ctx.files.some(f => /^Makefile$|^Taskfile\.ya?ml$/.test(f)); },
    impact: 'medium',
    category: 'go',
    fix: 'Add Makefile or Taskfile.yml with common Go targets (build, test, lint).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goDockerMultiStage: {
    id: 'CL-GO13',
    name: 'Docker multi-stage build for Go',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const df = ctx.fileContent('Dockerfile') || ''; if (!df) return null; return /FROM.*golang.*AS/i.test(df) && /FROM.*(?:alpine|scratch|distroless|gcr\.io)/i.test(df); },
    impact: 'medium',
    category: 'go',
    fix: 'Use multi-stage Docker build: build in golang image, run in minimal image (alpine/scratch/distroless).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goCgoDocumented: {
    id: 'CL-GO14',
    name: 'CGO documented if used',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const goMod = ctx.fileContent('go.mod') || ''; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; if (!/CGO_ENABLED|import "C"/i.test(goMod + docs)) return null; return /CGO|cgo/i.test(docs); },
    impact: 'low',
    category: 'go',
    fix: 'Document CGO usage, dependencies, and build requirements.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goWorkForMonorepo: {
    id: 'CL-GO15',
    name: 'go.work for monorepo',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const multiMod = ctx.files.filter(f => /go\.mod$/.test(f)).length > 1; if (!multiMod) return null; return ctx.files.some(f => /go\.work$/.test(f)); },
    impact: 'medium',
    category: 'go',
    fix: 'Use go.work for Go workspace in monorepo with multiple modules.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goBenchmarkTests: {
    id: 'CL-GO16',
    name: 'Benchmark tests mentioned',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /go test.*-bench|Benchmark/i.test(docs); },
    impact: 'low',
    category: 'go',
    fix: 'Document benchmark testing with go test -bench.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goRaceDetector: {
    id: 'CL-GO17',
    name: 'Race detector (-race) documented',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; const ci = ctx.fileContent('.github/workflows/ci.yml') || ctx.fileContent('.github/workflows/go.yml') || ''; return /-race/i.test(docs + ci); },
    impact: 'medium',
    category: 'go',
    fix: 'Document and enable race detector with go test -race.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goGenerateDocumented: {
    id: 'CL-GO18',
    name: 'go generate documented',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /go generate/i.test(docs) || ctx.files.some(f => /generate\.go$/.test(f)); },
    impact: 'low',
    category: 'go',
    fix: 'Document go generate usage and generated files.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goInterfaceDesignDocumented: {
    id: 'CL-GO19',
    name: 'Interface-based design documented',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /interface|mock|stub|dependency injection/i.test(docs); },
    impact: 'low',
    category: 'go',
    fix: 'Document interface-based design patterns for testability and dependency injection.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  goGitignore: {
    id: 'CL-GO20',
    name: 'Go-specific .gitignore entries',
    check: (ctx) => { if (!ctx.files.some(f => /go\.mod$/.test(f))) return null; const gi = ctx.fileContent('.gitignore') || ''; return /vendor[/]|\*\.exe|\*\.test|\*\.out|[/]bin[/]/i.test(gi); },
    impact: 'low',
    category: 'go',
    fix: 'Add Go-specific entries to .gitignore (vendor/, *.exe, *.test, /bin/).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },
  // ============================================================
  // === RUST STACK CHECKS (category: 'rust') ===================
  // ============================================================

  rustCargoTomlExists: {
    id: 'CL-RS01',
    name: 'Cargo.toml exists with edition field',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; return /edition\s*=/.test(cargo); },
    impact: 'high',
    category: 'rust',
    fix: 'Ensure Cargo.toml exists and specifies the edition field (e.g., edition = "2021").',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustCargoLockCommitted: {
    id: 'CL-RS02',
    name: 'Cargo.lock committed (for binary crates)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; return ctx.files.some(f => /Cargo\.lock$/.test(f)); },
    impact: 'high',
    category: 'rust',
    fix: 'Commit Cargo.lock for binary crates to ensure reproducible builds.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustClippyConfigured: {
    id: 'CL-RS03',
    name: 'Clippy configured (CI or .cargo/config.toml)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const ci = ctx.fileContent('.github/workflows/ci.yml') || ctx.fileContent('.github/workflows/rust.yml') || ''; const cargoConfig = ctx.fileContent('.cargo/config.toml') || ''; return /clippy/i.test(ci + cargoConfig); },
    impact: 'medium',
    category: 'rust',
    fix: 'Configure clippy in CI or .cargo/config.toml for lint enforcement.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustFmtConfigured: {
    id: 'CL-RS04',
    name: 'rustfmt configured (rustfmt.toml or .rustfmt.toml)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; return ctx.files.some(f => /rustfmt\.toml$|\.rustfmt\.toml$/.test(f)); },
    impact: 'medium',
    category: 'rust',
    fix: 'Create rustfmt.toml or .rustfmt.toml to configure code formatting.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustCargoTestDocumented: {
    id: 'CL-RS05',
    name: 'cargo test documented in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /cargo test/i.test(docs); },
    impact: 'high',
    category: 'rust',
    fix: 'Document cargo test command in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustCargoBuildDocumented: {
    id: 'CL-RS06',
    name: 'cargo build/check documented in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /cargo (?:build|check)/i.test(docs); },
    impact: 'high',
    category: 'rust',
    fix: 'Document cargo build or cargo check command in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustUnsafePolicyDocumented: {
    id: 'CL-RS07',
    name: 'Unsafe code policy documented',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /unsafe|#!?\[forbid\(unsafe|#!?\[deny\(unsafe/i.test(docs); },
    impact: 'high',
    category: 'rust',
    fix: 'Document unsafe code policy (forbidden, minimized, or where allowed).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustErrorHandlingStrategy: {
    id: 'CL-RS08',
    name: 'Error handling strategy (anyhow/thiserror in deps)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; return /anyhow|thiserror|eyre|color-eyre/i.test(cargo); },
    impact: 'medium',
    category: 'rust',
    fix: 'Use anyhow (applications) or thiserror (libraries) for structured error handling.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustFeatureFlagsDocumented: {
    id: 'CL-RS09',
    name: 'Feature flags documented (Cargo.toml [features])',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; if (!/\[features\]/i.test(cargo)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /feature|--features|--all-features/i.test(docs); },
    impact: 'medium',
    category: 'rust',
    fix: 'Document feature flags and their purpose in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustWorkspaceConfig: {
    id: 'CL-RS10',
    name: 'Workspace config if multi-crate (Cargo.toml [workspace])',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; if (ctx.files.filter(f => /Cargo\.toml$/.test(f)).length <= 1) return null; return /\[workspace\]/i.test(cargo); },
    impact: 'medium',
    category: 'rust',
    fix: 'Configure [workspace] in root Cargo.toml for multi-crate projects.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustMsrvSpecified: {
    id: 'CL-RS11',
    name: 'MSRV specified (rust-version field)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; return /rust-version\s*=/.test(cargo); },
    impact: 'medium',
    category: 'rust',
    fix: 'Specify rust-version (MSRV) in Cargo.toml for compatibility guarantees.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustDocCommentsEncouraged: {
    id: 'CL-RS12',
    name: 'Doc comments (///) encouraged in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /doc comment|\/{3}|rustdoc|cargo doc/i.test(docs); },
    impact: 'low',
    category: 'rust',
    fix: 'Encourage /// doc comments and cargo doc in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustBenchmarksConfigured: {
    id: 'CL-RS13',
    name: 'Criterion benchmarks mentioned (benches/ dir)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; return ctx.files.some(f => /benches[/]/.test(f)) || /criterion/i.test(ctx.fileContent('Cargo.toml') || ''); },
    impact: 'low',
    category: 'rust',
    fix: 'Set up criterion benchmarks in benches/ directory.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustCrossCompilationDocumented: {
    id: 'CL-RS14',
    name: 'Cross-compilation documented',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /cross.?compil|--target|rustup target|cargo build.*--target/i.test(docs); },
    impact: 'low',
    category: 'rust',
    fix: 'Document cross-compilation targets and setup instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustMemorySafetyDocumented: {
    id: 'CL-RS15',
    name: 'Memory safety patterns documented',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /ownership|borrow|lifetime|memory.?safe|Arc|Rc|RefCell/i.test(docs); },
    impact: 'medium',
    category: 'rust',
    fix: 'Document memory safety patterns (ownership, borrowing, lifetime conventions).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustAsyncRuntimeDocumented: {
    id: 'CL-RS16',
    name: 'Async runtime documented (tokio/async-std in deps)',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; if (!/tokio|async-std|smol/i.test(cargo)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /tokio|async-std|async|await|runtime/i.test(docs); },
    impact: 'medium',
    category: 'rust',
    fix: 'Document async runtime choice and patterns (tokio, async-std).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustSerdeDocumented: {
    id: 'CL-RS17',
    name: 'Serde patterns documented',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; if (!/serde/i.test(cargo)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /serde|Serialize|Deserialize|serde_json|serde_yaml/i.test(docs); },
    impact: 'medium',
    category: 'rust',
    fix: 'Document serde serialization/deserialization patterns and conventions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustCargoAuditConfigured: {
    id: 'CL-RS18',
    name: 'cargo-audit configured in CI',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const ci = ctx.fileContent('.github/workflows/ci.yml') || ctx.fileContent('.github/workflows/rust.yml') || ctx.fileContent('.github/workflows/audit.yml') || ''; return /cargo.?audit|advisory/i.test(ci); },
    impact: 'medium',
    category: 'rust',
    fix: 'Configure cargo-audit in CI for vulnerability scanning.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustWasmTargetDocumented: {
    id: 'CL-RS19',
    name: 'WASM target documented if applicable',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const cargo = ctx.fileContent('Cargo.toml') || ''; if (!/wasm|wasm-bindgen|wasm-pack/i.test(cargo)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /wasm|WebAssembly|wasm-pack|wasm-bindgen/i.test(docs); },
    impact: 'low',
    category: 'rust',
    fix: 'Document WASM target configuration and build process.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rustGitignore: {
    id: 'CL-RS20',
    name: 'Rust .gitignore includes target/',
    check: (ctx) => { if (!ctx.files.some(f => /Cargo\.toml$/.test(f))) return null; const gi = ctx.fileContent('.gitignore') || ''; return /target[/]|[/]target/i.test(gi); },
    impact: 'medium',
    category: 'rust',
    fix: 'Add target/ to .gitignore for Rust build artifacts.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  // ============================================================
  // === JAVA/SPRING STACK CHECKS (category: 'java') ============
  // ============================================================

  javaBuildFileExists: {
    id: 'CL-JV01',
    name: 'pom.xml or build.gradle exists',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return true; },
    impact: 'high',
    category: 'java',
    fix: 'Ensure pom.xml or build.gradle exists for Java projects.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaVersionSpecified: {
    id: 'CL-JV02',
    name: 'Java version specified',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const pom = ctx.fileContent('pom.xml') || ''; const gradle = ctx.fileContent('build.gradle') || ctx.fileContent('build.gradle.kts') || ''; return /java\.version|maven\.compiler\.source|sourceCompatibility|JavaVersion/i.test(pom + gradle) || ctx.files.some(f => /\.java-version$/.test(f)); },
    impact: 'high',
    category: 'java',
    fix: 'Specify Java version in pom.xml properties, build.gradle, or .java-version file.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaWrapperCommitted: {
    id: 'CL-JV03',
    name: 'Maven/Gradle wrapper committed (mvnw or gradlew)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return ctx.files.some(f => /mvnw$|gradlew$/.test(f)); },
    impact: 'high',
    category: 'java',
    fix: 'Commit mvnw (Maven) or gradlew (Gradle) wrapper for reproducible builds.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaSpringBootVersion: {
    id: 'CL-JV04',
    name: 'Spring Boot version documented if Spring project',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const pom = ctx.fileContent('pom.xml') || ''; const gradle = ctx.fileContent('build.gradle') || ctx.fileContent('build.gradle.kts') || ''; if (!/spring-boot/i.test(pom + gradle)) return null; return /spring-boot.*\d+\.\d+/i.test(pom + gradle); },
    impact: 'high',
    category: 'java',
    fix: 'Document Spring Boot version in build configuration.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaApplicationConfig: {
    id: 'CL-JV05',
    name: 'application.yml or application.properties exists',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return ctx.files.some(f => /application\.ya?ml$|application\.properties$/.test(f)); },
    impact: 'medium',
    category: 'java',
    fix: 'Create application.yml or application.properties for Spring configuration.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaTestFramework: {
    id: 'CL-JV06',
    name: 'Test framework configured (JUnit/TestNG in deps)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const pom = ctx.fileContent('pom.xml') || ''; const gradle = ctx.fileContent('build.gradle') || ctx.fileContent('build.gradle.kts') || ''; return /junit|testng|spring-boot-starter-test/i.test(pom + gradle); },
    impact: 'high',
    category: 'java',
    fix: 'Configure JUnit or TestNG test framework in project dependencies.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaCodeStyleConfigured: {
    id: 'CL-JV07',
    name: 'Code style configured (checkstyle.xml, spotbugs)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return ctx.files.some(f => /checkstyle\.xml$|spotbugs.*\.xml$/.test(f)) || /checkstyle|spotbugs|google-java-format/i.test((ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || '')); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure checkstyle or spotbugs for code quality enforcement.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaSpringProfilesDocumented: {
    id: 'CL-JV08',
    name: 'Spring profiles documented',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); if (!/spring/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /spring[.]profiles|@Profile|SPRING_PROFILES_ACTIVE/i.test(docs); },
    impact: 'medium',
    category: 'java',
    fix: 'Document Spring profiles and their configuration in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaDatabaseMigration: {
    id: 'CL-JV09',
    name: 'Database migration configured (flyway/liquibase)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); return /flyway|liquibase/i.test(deps) || ctx.files.some(f => /db[/]migration|flyway|liquibase/i.test(f)); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure database migration tool (Flyway or Liquibase) for schema management.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaLombokDocumented: {
    id: 'CL-JV10',
    name: 'Lombok/MapStruct documented if used',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); if (!/lombok|mapstruct/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /lombok|mapstruct/i.test(docs); },
    impact: 'low',
    category: 'java',
    fix: 'Document Lombok/MapStruct usage and IDE setup requirements.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaApiDocsConfigured: {
    id: 'CL-JV11',
    name: 'API docs configured (springdoc/swagger deps)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); return /springdoc|swagger|openapi/i.test(deps); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure API documentation with springdoc-openapi or Swagger.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaSecurityConfigured: {
    id: 'CL-JV12',
    name: 'Security configuration documented',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); if (!/spring-security|spring-boot-starter-security/i.test(deps)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /security|authentication|authorization|SecurityConfig|@EnableWebSecurity/i.test(docs); },
    impact: 'high',
    category: 'java',
    fix: 'Document Spring Security configuration and authentication setup.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaActuatorConfigured: {
    id: 'CL-JV13',
    name: 'Actuator/health checks configured',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); return /actuator|spring-boot-starter-actuator/i.test(deps); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure Spring Boot Actuator for health checks and monitoring.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaLoggingConfigured: {
    id: 'CL-JV14',
    name: 'Logging configured (logback.xml or log4j2.xml)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return ctx.files.some(f => /logback.*\.xml$|log4j2?.*\.xml$|logging\.properties$/.test(f)); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure logging with logback.xml or log4j2.xml.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaMultiModuleProject: {
    id: 'CL-JV15',
    name: 'Multi-module project configured if applicable',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const buildFiles = ctx.files.filter(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f)); if (buildFiles.length <= 1) return null; const rootPom = ctx.fileContent('pom.xml') || ''; const rootGradle = ctx.fileContent('settings.gradle') || ctx.fileContent('settings.gradle.kts') || ''; return /<modules>|include\s/i.test(rootPom + rootGradle); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure multi-module project structure in root build file.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaDockerConfigured: {
    id: 'CL-JV16',
    name: 'Docker build configured (Dockerfile or Jib plugin)',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const df = ctx.fileContent('Dockerfile') || ''; const deps = (ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || ''); return /FROM.*(?:openjdk|eclipse-temurin|amazoncorretto)/i.test(df) || /jib/i.test(deps); },
    impact: 'medium',
    category: 'java',
    fix: 'Configure Docker build with Dockerfile or Jib plugin.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaEnvConfigsSeparated: {
    id: 'CL-JV17',
    name: 'Environment-specific configs separated',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return ctx.files.some(f => /application-(?:dev|prod|staging|test|local)\.(?:ya?ml|properties)$/.test(f)); },
    impact: 'medium',
    category: 'java',
    fix: 'Separate environment configs (application-dev.yml, application-prod.yml, etc.).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaNoSecretsInConfig: {
    id: 'CL-JV18',
    name: 'No secrets in application.yml/properties',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const appYml = ctx.files.filter(f => /application.*\.ya?ml$|application.*\.properties$/.test(f)).map(f => ctx.fileContent(f) || '').join(''); if (!appYml) return null; return !/password\s*[:=]\s*[^$\{\s][^\s]{8,}|secret\s*[:=]\s*[^$\{\s][^\s]{8,}/i.test(appYml); },
    impact: 'critical',
    category: 'java',
    fix: 'Move secrets to environment variables or external secret management, not application config files.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaIntegrationTestsSeparate: {
    id: 'CL-JV19',
    name: 'Integration tests separate from unit tests',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; return ctx.files.some(f => /src[/](?:integration-?test|it)[/]|IT\.java$|Integration(?:Test)?\.java$/.test(f)) || /failsafe|integration-test/i.test((ctx.fileContent('pom.xml') || '') + (ctx.fileContent('build.gradle') || '') + (ctx.fileContent('build.gradle.kts') || '')); },
    impact: 'medium',
    category: 'java',
    fix: 'Separate integration tests from unit tests using Maven Failsafe or dedicated source set.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  javaBuildCommandDocumented: {
    id: 'CL-JV20',
    name: 'Build command documented in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /pom\.xml$|build\.gradle$|build\.gradle\.kts$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /mvn|gradle|mvnw|gradlew|maven|./i.test(docs) && /build|compile|package|install/i.test(docs); },
    impact: 'high',
    category: 'java',
    fix: 'Document build command (mvnw package, gradlew build) in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  // ============================================================
  // === RUBY/RAILS STACK CHECKS (category: 'ruby') =============
  // ============================================================

  rubyGemfileExists: {
    id: 'CL-RB01',
    name: 'Gemfile exists',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return true; },
    impact: 'high',
    category: 'ruby',
    fix: 'Create a Gemfile to manage Ruby dependencies.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyGemfileLockCommitted: {
    id: 'CL-RB02',
    name: 'Gemfile.lock committed',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /Gemfile\.lock$/.test(f)); },
    impact: 'high',
    category: 'ruby',
    fix: 'Commit Gemfile.lock to version control for reproducible builds.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyVersionSpecified: {
    id: 'CL-RB03',
    name: 'Ruby version specified (.ruby-version)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /\.ruby-version$/.test(f)) || /ruby ['"]~?\d/i.test(ctx.fileContent('Gemfile') || ''); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Create .ruby-version or specify ruby version in Gemfile.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyRubocopConfigured: {
    id: 'CL-RB04',
    name: 'RuboCop configured (.rubocop.yml)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /\.rubocop\.ya?ml$/.test(f)); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Add .rubocop.yml to configure Ruby style checking.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyTestFrameworkConfigured: {
    id: 'CL-RB05',
    name: 'RSpec or Minitest configured (spec/ or test/)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /^spec\/|^test\/|spec_helper\.rb$|test_helper\.rb$/.test(f)); },
    impact: 'high',
    category: 'ruby',
    fix: 'Configure RSpec (spec/) or Minitest (test/) for testing.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyRailsCredentialsDocumented: {
    id: 'CL-RB06',
    name: 'Rails credentials documented in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; if (!ctx.files.some(f => /config\/credentials/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /credentials|encrypted|master\.key|secret_key_base/i.test(docs); },
    impact: 'high',
    category: 'ruby',
    fix: 'Document Rails credentials management (rails credentials:edit) in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyMigrationsDocumented: {
    id: 'CL-RB07',
    name: 'Database migrations documented (db/migrate/)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; if (!ctx.files.some(f => /db\/migrate\//.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /migration|migrate|db:migrate|rails db/i.test(docs); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Document database migration workflow (rails db:migrate) in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyBundlerAuditConfigured: {
    id: 'CL-RB08',
    name: 'Bundler audit configured',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; const gf = ctx.fileContent('Gemfile') || ''; return /bundler-audit|bundle.audit/i.test(gf) || ctx.files.some(f => /\.bundler-audit/i.test(f)); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Add bundler-audit gem for dependency vulnerability scanning.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyTypeCheckingConfigured: {
    id: 'CL-RB09',
    name: 'Sorbet/RBS type checking configured (sorbet/ or sig/)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /sorbet\/|sig\/|\.rbs$/.test(f)) || /sorbet|tapioca/i.test(ctx.fileContent('Gemfile') || ''); },
    impact: 'low',
    category: 'ruby',
    fix: 'Configure Sorbet or RBS for type checking.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyRailsRoutesDocumented: {
    id: 'CL-RB10',
    name: 'Rails routes documented',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; if (!ctx.files.some(f => /config\/routes\.rb$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /routes|endpoints|api.*path|REST/i.test(docs); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Document key routes and API endpoints in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyBackgroundJobsDocumented: {
    id: 'CL-RB11',
    name: 'Background jobs documented (Sidekiq/GoodJob)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; const gf = ctx.fileContent('Gemfile') || ''; if (!/sidekiq|good_job|delayed_job|resque/i.test(gf)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /sidekiq|good_job|delayed_job|resque|background.*job|worker|queue/i.test(docs); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Document background job framework and worker configuration.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyRailsEnvConfigsSeparated: {
    id: 'CL-RB12',
    name: 'Rails environment configs separated (config/environments/)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /config\/environments\//.test(f)); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Ensure config/environments/ has separate files for development, test, and production.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyAssetPipelineDocumented: {
    id: 'CL-RB13',
    name: 'Asset pipeline documented',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; const gf = ctx.fileContent('Gemfile') || ''; if (!/sprockets|propshaft|webpacker|jsbundling|cssbundling/i.test(gf)) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /asset|sprockets|propshaft|webpacker|jsbundling|cssbundling|esbuild|vite/i.test(docs); },
    impact: 'low',
    category: 'ruby',
    fix: 'Document asset pipeline configuration (Sprockets, Propshaft, or JS/CSS bundling).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyMasterKeyInGitignore: {
    id: 'CL-RB14',
    name: 'Rails master.key in .gitignore',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; if (!ctx.files.some(f => /config\/credentials/.test(f))) return null; const gi = ctx.fileContent('.gitignore') || ''; return /master\.key/i.test(gi); },
    impact: 'critical',
    category: 'ruby',
    fix: 'Add config/master.key to .gitignore to prevent secret leakage.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  rubyTestDataFactories: {
    id: 'CL-RB15',
    name: 'Factory Bot/fixtures for test data (spec/factories/)',
    check: (ctx) => { if (!ctx.files.some(f => /Gemfile$/.test(f))) return null; return ctx.files.some(f => /spec\/factories\/|test\/fixtures\//.test(f)) || /factory_bot|fabrication/i.test(ctx.fileContent('Gemfile') || ''); },
    impact: 'medium',
    category: 'ruby',
    fix: 'Configure Factory Bot (spec/factories/) or fixtures (test/fixtures/) for test data.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  // ============================================================
  // === .NET/C# STACK CHECKS (category: 'dotnet') ==============
  // ============================================================

  dotnetProjectExists: {
    id: 'CL-DN01',
    name: '.csproj or .sln exists',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return true; },
    impact: 'high',
    category: 'dotnet',
    fix: 'Ensure .csproj or .sln file exists for .NET projects.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetVersionSpecified: {
    id: 'CL-DN02',
    name: '.NET version specified (global.json or TargetFramework)',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /global\.json$/.test(f)) || ctx.files.some(f => { if (!/\.csproj$/.test(f)) return false; const c = ctx.fileContent(f) || ''; return /TargetFramework/i.test(c); }); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Create global.json or ensure TargetFramework is set in .csproj.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetPackagesLock: {
    id: 'CL-DN03',
    name: 'NuGet packages lock (packages.lock.json)',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /packages\.lock\.json$/.test(f)); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Enable NuGet lock file (packages.lock.json) for reproducible restores.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetTestDocumented: {
    id: 'CL-DN04',
    name: 'dotnet test documented',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /dotnet test|xunit|nunit|mstest/i.test(docs); },
    impact: 'high',
    category: 'dotnet',
    fix: 'Document how to run tests with dotnet test in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetEditorConfigExists: {
    id: 'CL-DN05',
    name: 'EditorConfig configured (.editorconfig)',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /\.editorconfig$/.test(f)); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Add .editorconfig for consistent code style across the team.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetRoslynAnalyzers: {
    id: 'CL-DN06',
    name: 'Roslyn analyzers configured',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => { if (!/\.csproj$/.test(f)) return false; const c = ctx.fileContent(f) || ''; return /Analyzer|StyleCop|SonarAnalyzer|Microsoft\.CodeAnalysis/i.test(c); }); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Add Roslyn analyzers (StyleCop.Analyzers, Microsoft.CodeAnalysis) to the project.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetAppsettingsExists: {
    id: 'CL-DN07',
    name: 'appsettings.json exists',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /appsettings\.json$/.test(f)); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Create appsettings.json for application configuration.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetUserSecretsDocumented: {
    id: 'CL-DN08',
    name: 'User secrets configured in instructions',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /user.?secrets|dotnet secrets|Secret Manager/i.test(docs); },
    impact: 'high',
    category: 'dotnet',
    fix: 'Document user secrets management (dotnet user-secrets) in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetEfMigrations: {
    id: 'CL-DN09',
    name: 'Entity Framework migrations (Migrations/ directory)',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /Migrations\//.test(f)); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Document Entity Framework migration workflow (dotnet ef migrations).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetHealthChecks: {
    id: 'CL-DN10',
    name: 'Health checks configured',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => { if (!/\.cs$/.test(f)) return false; const c = ctx.fileContent(f) || ''; return /AddHealthChecks|MapHealthChecks|IHealthCheck/i.test(c); }); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Configure health checks with AddHealthChecks() and MapHealthChecks().',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetSwaggerConfigured: {
    id: 'CL-DN11',
    name: 'Swagger/OpenAPI configured',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => { if (!/\.cs$|.csproj$/.test(f)) return false; const c = ctx.fileContent(f) || ''; return /Swashbuckle|AddSwaggerGen|UseSwagger|NSwag|AddOpenApi/i.test(c); }); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Configure Swagger/OpenAPI with Swashbuckle or NSwag.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetNoConnectionStringsInConfig: {
    id: 'CL-DN12',
    name: 'No connection strings in appsettings.json',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; const settings = ctx.fileContent('appsettings.json') || ''; if (!settings) return null; return !/Server=.*Password=|Data Source=.*Password=/i.test(settings); },
    impact: 'critical',
    category: 'dotnet',
    fix: 'Move connection strings with passwords to user secrets or environment variables.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetDockerSupport: {
    id: 'CL-DN13',
    name: 'Docker support configured',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; const df = ctx.fileContent('Dockerfile') || ''; return /dotnet|aspnet|sdk/i.test(df); },
    impact: 'medium',
    category: 'dotnet',
    fix: 'Add Dockerfile with official .NET SDK/ASP.NET base images.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetTestProjectSeparate: {
    id: 'CL-DN14',
    name: 'Unit test project separate (.Tests.csproj)',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /\.Tests?\.csproj$|Tests?\/.*\.csproj$/.test(f)); },
    impact: 'high',
    category: 'dotnet',
    fix: 'Create separate test project (e.g., MyApp.Tests.csproj) for unit tests.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  dotnetGlobalUsingsDocumented: {
    id: 'CL-DN15',
    name: 'GlobalUsings documented',
    check: (ctx) => { if (!ctx.files.some(f => /\.csproj$|\.sln$/.test(f))) return null; return ctx.files.some(f => /GlobalUsings\.cs$|Usings\.cs$/.test(f)) || ctx.files.some(f => { if (!/\.csproj$/.test(f)) return false; const c = ctx.fileContent(f) || ''; return /ImplicitUsings/i.test(c); }); },
    impact: 'low',
    category: 'dotnet',
    fix: 'Document global using directives in GlobalUsings.cs or enable ImplicitUsings in .csproj.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  // ============================================================
  // === PHP/LARAVEL STACK CHECKS (category: 'php') ==============
  // ============================================================

  phpComposerJsonExists: {
    id: 'CL-PHP01',
    name: 'composer.json exists',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; return true; },
    impact: 'high',
    category: 'php',
    fix: 'Create composer.json to manage PHP dependencies.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpComposerLockCommitted: {
    id: 'CL-PHP02',
    name: 'composer.lock committed',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; return ctx.files.some(f => /composer\.lock$/.test(f)); },
    impact: 'high',
    category: 'php',
    fix: 'Commit composer.lock to version control for reproducible installs.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpVersionSpecified: {
    id: 'CL-PHP03',
    name: 'PHP version specified (composer.json require.php)',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; const cj = ctx.fileContent('composer.json') || ''; return /"php"s*:/i.test(cj); },
    impact: 'medium',
    category: 'php',
    fix: 'Specify PHP version requirement in composer.json require section.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpStaticAnalysisConfigured: {
    id: 'CL-PHP04',
    name: 'PHPStan/Psalm configured (phpstan.neon)',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; return ctx.files.some(f => /phpstan\.neon$|phpstan\.neon\.dist$|psalm\.xml$/.test(f)); },
    impact: 'medium',
    category: 'php',
    fix: 'Configure PHPStan (phpstan.neon) or Psalm (psalm.xml) for static analysis.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpCsFixerConfigured: {
    id: 'CL-PHP05',
    name: 'PHP CS Fixer configured (.php-cs-fixer.php)',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; return ctx.files.some(f => /\.php-cs-fixer\.php$|\.php-cs-fixer\.dist\.php$/.test(f)); },
    impact: 'medium',
    category: 'php',
    fix: 'Add .php-cs-fixer.php for consistent code formatting.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpUnitConfigured: {
    id: 'CL-PHP06',
    name: 'PHPUnit configured (phpunit.xml)',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; return ctx.files.some(f => /phpunit\.xml$|phpunit\.xml\.dist$/.test(f)); },
    impact: 'high',
    category: 'php',
    fix: 'Configure PHPUnit with phpunit.xml for testing.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpLaravelEnvExample: {
    id: 'CL-PHP07',
    name: 'Laravel .env.example exists',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; if (!ctx.files.some(f => /artisan$/.test(f))) return null; return ctx.files.some(f => /\.env\.example$/.test(f)); },
    impact: 'high',
    category: 'php',
    fix: 'Create .env.example with all required environment variables documented.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpLaravelAppKeyNotCommitted: {
    id: 'CL-PHP08',
    name: 'Laravel APP_KEY not committed',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; if (!ctx.files.some(f => /artisan$/.test(f))) return null; const env = ctx.fileContent('.env') || ''; if (!env) return null; return !/APP_KEY=base64:[A-Za-z0-9+/=]{30,}/i.test(env); },
    impact: 'critical',
    category: 'php',
    fix: 'Ensure .env with APP_KEY is in .gitignore — never commit application keys.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpLaravelMigrationsExist: {
    id: 'CL-PHP09',
    name: 'Laravel migrations exist (database/migrations/)',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; if (!ctx.files.some(f => /artisan$/.test(f))) return null; return ctx.files.some(f => /database\/migrations\//.test(f)); },
    impact: 'medium',
    category: 'php',
    fix: 'Create database migrations in database/migrations/ directory.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpArtisanCommandsDocumented: {
    id: 'CL-PHP10',
    name: 'Artisan commands documented',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; if (!ctx.files.some(f => /artisan$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /artisan|php artisan|make:model|make:controller|migrate/i.test(docs); },
    impact: 'medium',
    category: 'php',
    fix: 'Document key Artisan commands (migrate, seed, make:*) in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpQueueWorkerDocumented: {
    id: 'CL-PHP11',
    name: 'Queue worker documented',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; const cj = ctx.fileContent('composer.json') || ''; if (!/horizon|queue/i.test(cj) && !ctx.files.some(f => /artisan$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /queue|horizon|worker|job|dispatch/i.test(docs); },
    impact: 'medium',
    category: 'php',
    fix: 'Document queue worker setup (php artisan queue:work, Horizon).',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpLaravelPintConfigured: {
    id: 'CL-PHP12',
    name: 'Laravel Pint configured (pint.json)',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; return ctx.files.some(f => /pint\.json$/.test(f)) || /laravel\/pint/i.test(ctx.fileContent('composer.json') || ''); },
    impact: 'low',
    category: 'php',
    fix: 'Configure Laravel Pint (pint.json) for code style enforcement.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpAssetBundlingDocumented: {
    id: 'CL-PHP13',
    name: 'Vite/Mix asset bundling documented',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; if (!ctx.files.some(f => /vite\.config\.|webpack\.mix\.js$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /vite|mix|asset|npm run dev|npm run build/i.test(docs); },
    impact: 'low',
    category: 'php',
    fix: 'Document asset bundling setup (Vite or Mix) in project instructions.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpConfigCachingDocumented: {
    id: 'CL-PHP14',
    name: 'Laravel config caching documented',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; if (!ctx.files.some(f => /artisan$/.test(f))) return null; const docs = (ctx.claudeMdContent ? ctx.claudeMdContent() : ctx.fileContent('CLAUDE.md')) || ctx.fileContent('README.md') || ''; return /config:cache|config:clear|route:cache|optimize/i.test(docs); },
    impact: 'low',
    category: 'php',
    fix: 'Document config/route caching strategy (php artisan config:cache) for production.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },

  phpComposerScriptsDefined: {
    id: 'CL-PHP15',
    name: 'Composer scripts defined',
    check: (ctx) => { if (!ctx.files.some(f => /composer\.json$/.test(f))) return null; const cj = ctx.fileContent('composer.json') || ''; return /"scripts"s*:/i.test(cj); },
    impact: 'medium',
    category: 'php',
    fix: 'Define composer scripts for common tasks (test, lint, analyze) in composer.json.',
    // sourceUrl assigned by attachSourceUrls via category mapping
    confidence: 0.7,
  },


};

Object.assign(TECHNIQUES, buildSupplementalChecks({
  idPrefix: 'CL-T',
  urlMap: CLAUDE_SUPPLEMENTAL_SOURCE_URLS,
  docs: (ctx) => [
    ctx.claudeMdContent ? ctx.claudeMdContent() : (ctx.fileContent('CLAUDE.md') || ctx.fileContent('.claude/CLAUDE.md') || ''),
    ctx.fileContent('README.md') || '',
  ].filter(Boolean).join('\n'),
}));

// Stack detection
const STACKS = {
  react: { files: ['package.json'], content: { 'package.json': 'react' }, label: 'React' },
  vue: { files: ['package.json'], content: { 'package.json': 'vue' }, label: 'Vue' },
  angular: { files: ['angular.json'], content: {}, label: 'Angular' },
  nextjs: { files: ['next.config'], content: {}, label: 'Next.js' },
  python: { files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'], content: {}, label: 'Python' },
  django: { files: ['manage.py'], content: {}, label: 'Django' },
  fastapi: { files: ['requirements.txt'], content: { 'requirements.txt': 'fastapi' }, label: 'FastAPI' },
  node: { files: ['package.json'], content: {}, label: 'Node.js' },
  typescript: { files: ['tsconfig.json'], content: {}, label: 'TypeScript' },
  rust: { files: ['Cargo.toml'], content: {}, label: 'Rust' },
  go: { files: ['go.mod'], content: {}, label: 'Go' },
  docker: { files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'], content: {}, label: 'Docker' },
  svelte: { files: ['svelte.config.js'], content: {}, label: 'Svelte' },
  flutter: { files: ['pubspec.yaml'], content: {}, label: 'Flutter' },
  ruby: { files: ['Gemfile'], content: {}, label: 'Ruby' },
  java: { files: ['pom.xml'], content: {}, label: 'Java' },
  kotlin: { files: ['build.gradle.kts'], content: {}, label: 'Kotlin' },
  swift: { files: ['Package.swift'], content: {}, label: 'Swift' },
  terraform: { files: ['main.tf', 'terraform'], content: {}, label: 'Terraform' },
  kubernetes: { files: ['k8s', 'kubernetes', 'helm'], content: {}, label: 'Kubernetes' },
  cpp: { files: ['CMakeLists.txt', 'Makefile', '.clang-format'], content: {}, label: 'C++' },
  bazel: { files: ['BUILD', 'WORKSPACE', 'BUILD.bazel', 'WORKSPACE.bazel'], content: {}, label: 'Bazel' },
  deno: { files: ['deno.json', 'deno.jsonc', 'deno.lock'], content: {}, label: 'Deno' },
  bun: { files: ['bun.lockb', 'bunfig.toml'], content: {}, label: 'Bun' },
  elixir: { files: ['mix.exs'], content: {}, label: 'Elixir' },
  astro: { files: ['astro.config.mjs', 'astro.config.ts'], content: {}, label: 'Astro' },
  remix: { files: ['remix.config.js', 'remix.config.ts'], content: {}, label: 'Remix' },
  nestjs: { files: ['nest-cli.json'], content: {}, label: 'NestJS' },
  laravel: { files: ['artisan'], content: {}, label: 'Laravel' },
  dotnet: { files: ['global.json', 'Directory.Build.props'], content: {}, label: '.NET' },
};

attachSourceUrls('claude', TECHNIQUES);

module.exports = { TECHNIQUES, STACKS, containsEmbeddedSecret };
