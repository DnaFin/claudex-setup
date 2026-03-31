/**
 * CLAUDEX Technique Database
 * Curated from 1,107 verified techniques, filtered to actionable setup recommendations.
 * Each technique includes: what to check, how to fix, impact level.
 */

function hasFrontendSignals(ctx) {
  const pkg = ctx.fileContent('package.json') || '';
  return /react|vue|angular|next|svelte|tailwind|vite|astro/i.test(pkg) ||
    ctx.files.some(f => /tailwind\.config|vite\.config|next\.config|svelte\.config|nuxt\.config|pages\/|components\/|app\//i.test(f));
}

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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
    name: 'CLAUDE.md uses @import for modularity',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md') || '';
      return md.includes('@import');
    },
    impact: 'medium',
    rating: 4,
    category: 'memory',
    fix: 'Use @import in CLAUDE.md to split instructions into focused modules (e.g. @import ./docs/coding-style.md).',
    template: null
  },

  underlines200: {
    id: 681,
    name: 'CLAUDE.md under 200 lines (concise)',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md') || '';
      return md.split('\n').length < 200;
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
      const md = ctx.fileContent('CLAUDE.md') || '';
      return md.includes('test') || md.includes('verify') || md.includes('lint') || md.includes('check');
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const md = ctx.fileContent('CLAUDE.md') || '';
      return /eslint|prettier|ruff|black|clippy|golangci-lint|rubocop/.test(md);
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const md = ctx.fileContent('CLAUDE.md') || '';
      return !/sk-[a-zA-Z0-9]{20,}|xoxb-|AKIA[A-Z0-9]{16}/.test(md);
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
    check: (ctx) => ctx.hasDir('.claude/skills') && ctx.dirFiles('.claude/skills').length > 0,
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Add skills for domain-specific workflows.',
    template: 'skills'
  },

  multipleSkills: {
    id: 2101,
    name: '2+ skills for specialization',
    check: (ctx) => ctx.hasDir('.claude/skills') && ctx.dirFiles('.claude/skills').length >= 2,
    impact: 'medium',
    rating: 4,
    category: 'workflow',
    fix: 'Add at least 2 skills to cover different domain areas.',
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.permissions) return null; // no settings = skip (not applicable)
      return settings.permissions.defaultMode !== 'bypassPermissions';
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
    check: (ctx) => ctx.hasDir('.claude/hooks') && ctx.dirFiles('.claude/hooks').length > 0,
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Add hooks for auto-lint, auto-test, or file change tracking.',
    template: 'hooks'
  },

  hooksInSettings: {
    id: 8801,
    name: 'Hooks configured in settings',
    check: (ctx) => {
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.hooks) return false;
      return Object.keys(settings.hooks).length > 0;
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.hooks) return false;
      return !!settings.hooks.PreToolUse;
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.hooks) return false;
      return !!settings.hooks.PostToolUse;
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.hooks) return false;
      return !!settings.hooks.SessionStart;
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
    check: (ctx) => ctx.hasDir('.github/workflows'),
    impact: 'high',
    rating: 4,
    category: 'devops',
    fix: 'Add .github/workflows/ with CI pipeline for automated testing and deployment.',
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      return !!(settings && settings.mcpServers && Object.keys(settings.mcpServers).length > 0);
    },
    impact: 'medium',
    rating: 3,
    category: 'tools',
    fix: 'Configure MCP servers for external tool integration (database, APIs, etc).',
    template: null
  },

  multipleMcpServers: {
    id: 1801,
    name: '2+ MCP servers for rich tooling',
    check: (ctx) => {
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      return !!(settings && settings.mcpServers && Object.keys(settings.mcpServers).length >= 2);
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
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      if (!settings || !settings.mcpServers) return false;
      return Object.keys(settings.mcpServers).some(k => /context7/i.test(k));
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const md = ctx.fileContent('CLAUDE.md') || '';
      return /you are|your role|act as|persona|behave as/i.test(md);
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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
      const md = ctx.fileContent('CLAUDE.md') || '';
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      const settingsStr = JSON.stringify(settings || {});
      return md.toLowerCase().includes('channel') || settingsStr.includes('channel');
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
      const md = ctx.fileContent('CLAUDE.md') || '';
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

  claudeMdNotOverlong: {
    id: 2002,
    name: 'CLAUDE.md is concise (under 200 lines)',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md');
      if (!md) return false; // no CLAUDE.md = not passing
      return md.split('\n').length <= 200;
    },
    impact: 'medium',
    rating: 4,
    category: 'quality-deep',
    fix: 'CLAUDE.md over 200 lines wastes tokens every session. Move detailed docs to .claude/rules/ or skills. Keep CLAUDE.md lean.',
    template: null
  },

  claudeMdNoContradictions: {
    id: 2003,
    name: 'CLAUDE.md has no obvious contradictions',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md');
      if (!md || md.length < 50) return false; // no CLAUDE.md or too short = not passing
      // Check for common contradictions
      const hasNever = /never.*always|always.*never/i.test(md);
      const hasBothStyles = /use tabs/i.test(md) && /use spaces/i.test(md);
      return !hasNever && !hasBothStyles;
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
    name: 'Agents have maxTurns limit',
    check: (ctx) => {
      if (!ctx.hasDir('.claude/agents')) return null;
      const files = ctx.dirFiles('.claude/agents');
      if (files.length === 0) return null;
      for (const f of files) {
        const content = ctx.fileContent(`.claude/agents/${f}`) || '';
        if (!content.includes('maxTurns')) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Agents without maxTurns can run indefinitely. Add "maxTurns: 50" to agent frontmatter.',
    template: null
  },

  securityReviewInWorkflow: {
    id: 2008,
    name: '/security-review in workflow',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md') || '';
      const hasCommand = ctx.hasDir('.claude/commands') &&
        (ctx.dirFiles('.claude/commands') || []).some(f => f.includes('security') || f.includes('review'));
      return md.toLowerCase().includes('security') || hasCommand;
    },
    impact: 'high',
    rating: 4,
    category: 'quality-deep',
    fix: 'Claude Code has built-in /security-review (OWASP Top 10). Add it to your workflow or create a /security command.',
    template: null
  },

  noDeprecatedPatterns: {
    id: 2009,
    name: 'No deprecated patterns detected',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md');
      if (!md) return false; // no CLAUDE.md = not passing
      // Check for patterns deprecated in Claude 4.x
      const deprecated = [
        'prefill', // deprecated in 4.6
        'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', // old model names
        'human_prompt', 'assistant_prompt', // old API format
      ];
      return !deprecated.some(d => md.toLowerCase().includes(d));
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'CLAUDE.md references deprecated patterns (old model names or API formats). Update to current Claude 4.x conventions.',
    template: null
  },
};

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
};

module.exports = { TECHNIQUES, STACKS };
