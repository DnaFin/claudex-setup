/**
 * CLAUDEX Technique Database
 * Curated from 972 verified techniques, filtered to actionable setup recommendations.
 * Each technique includes: what to check, how to fix, impact level.
 */

const TECHNIQUES = {
  // === CRITICAL (must-have for any project) ===
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

  gitIgnoreClaudeTracked: {
    id: 976,
    name: '.claude/ tracked in git',
    check: (ctx) => {
      if (!ctx.fileContent('.gitignore')) return true; // no gitignore = ok
      const content = ctx.fileContent('.gitignore');
      return !content.includes('.claude/') || content.includes('!.claude/');
    },
    impact: 'high',
    rating: 4,
    category: 'git',
    fix: 'Remove .claude/ from .gitignore (keep .claude/settings.local.json ignored).',
    template: null
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

  mcpServers: {
    id: 18,
    name: 'MCP servers configured',
    check: (ctx) => {
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      return settings && settings.mcpServers && Object.keys(settings.mcpServers).length > 0;
    },
    impact: 'medium',
    rating: 3,
    category: 'tools',
    fix: 'Configure MCP servers for external tool integration (database, APIs, etc).',
    template: null
  },

  settingsPermissions: {
    id: 24,
    name: 'Permission configuration',
    check: (ctx) => {
      const settings = ctx.jsonFile('.claude/settings.local.json') || ctx.jsonFile('.claude/settings.json');
      return settings && settings.permissions;
    },
    impact: 'medium',
    rating: 4,
    category: 'security',
    fix: 'Configure allow/deny permission lists for safe tool usage.',
    template: null
  },

  xmlTags: {
    id: 96,
    name: 'XML tags for structured prompts',
    check: (ctx) => {
      const md = ctx.fileContent('CLAUDE.md') || '';
      return md.includes('<') && md.includes('>') && (
        md.includes('<constraints') || md.includes('<rules') ||
        md.includes('<validation') || md.includes('<instructions')
      );
    },
    impact: 'high',
    rating: 5,
    category: 'prompting',
    fix: 'Use XML tags (<constraints>, <validation>) in CLAUDE.md for unambiguous instructions.',
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
};

module.exports = { TECHNIQUES, STACKS };
