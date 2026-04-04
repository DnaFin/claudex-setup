/**
 * Copilot MCP Pack System
 *
 * 26 MCP packs with JSON-aware projection, detection,
 * recommendation, merge logic, and trust preflight.
 *
 * KEY DIFFERENCE: Copilot MCP uses .vscode/mcp.json format,
 * which is a separate file from .vscode/settings.json.
 * The cloud agent has MCP limitations (no OAuth remote servers).
 *
 * .vscode/mcp.json format:
 * {
 *   "servers": {
 *     "server-name": {
 *       "command": "npx",
 *       "args": [...],
 *       "env": {...}
 *     }
 *   }
 * }
 */

const COPILOT_MCP_PACKS = [
  {
    key: 'context7-docs',
    label: 'Context7 Docs',
    description: 'Live, current framework and library documentation during Copilot sessions.',
    useWhen: 'Repos that use any framework, library, or SDK and benefit from up-to-date docs.',
    adoption: 'Safe default docs pack for most application repos. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'context7',
    jsonProjection: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'github-mcp',
    label: 'GitHub',
    description: 'Issue, PR, and repository context during Copilot sessions.',
    useWhen: 'Repos hosted on GitHub that benefit from issue, PR, and repo context.',
    adoption: 'Recommended for any GitHub-hosted project. Requires GITHUB_PERSONAL_ACCESS_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    serverName: 'github',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' } },
    excludeTools: ['create_repository', 'delete_file', 'push_files'],
    cloudAgentCompatible: true,
  },
  {
    key: 'playwright-mcp',
    label: 'Playwright Browser',
    description: 'Browser automation, E2E testing, and visual QA.',
    useWhen: 'Frontend repos with E2E tests or browser-based workflows.',
    adoption: 'Recommended for frontend-ui repos with E2E tests. No auth required.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'playwright',
    jsonProjection: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'postgres-mcp',
    label: 'PostgreSQL',
    description: 'Schema inspection and query assistance for PostgreSQL databases.',
    useWhen: 'Repos with PostgreSQL databases that benefit from schema and query context.',
    adoption: 'Useful for backend-api and data-pipeline repos. Requires DATABASE_URL.',
    trustLevel: 'low',
    transport: 'stdio',
    requiredAuth: ['DATABASE_URL'],
    serverName: 'postgres',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'] },
    excludeTools: ['execute_sql'],
    cloudAgentCompatible: false, // Requires local DB access
  },
  {
    key: 'memory-mcp',
    label: 'Memory / Knowledge Graph',
    description: 'Persistent entity and relationship tracking across Copilot sessions.',
    useWhen: 'Long-running or complex projects with many interconnected concepts.',
    adoption: 'Safe for any repo. Stores data locally. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'memory',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
    excludeTools: [],
    cloudAgentCompatible: false, // Ephemeral VM = no persistence
  },
  {
    key: 'sequential-thinking',
    label: 'Sequential Thinking',
    description: 'Structured step-by-step reasoning for complex problem-solving.',
    useWhen: 'Complex problem-solving sessions that benefit from structured reasoning.',
    adoption: 'Safe default for any repo. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'sequential-thinking',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'filesystem-mcp',
    label: 'Filesystem',
    description: 'Read-only filesystem access for documentation and reference files.',
    useWhen: 'Repos with reference files, docs, or config that Copilot needs to read.',
    adoption: 'Read-only default. Pass allowed directories as args.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'filesystem',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
    excludeTools: ['write_file', 'create_directory', 'move_file'],
    cloudAgentCompatible: true,
  },
  {
    key: 'fetch-mcp',
    label: 'Fetch / HTTP',
    description: 'HTTP access for fetching web pages, APIs, and documentation.',
    useWhen: 'Repos that need HTTP access to external APIs or documentation sources.',
    adoption: 'Useful for repos integrating external services. No auth required.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'fetch',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'next-devtools',
    label: 'Next.js Devtools',
    description: 'Runtime-aware debugging and framework-specific tooling for Next.js.',
    useWhen: 'Next.js repos that need runtime-aware debugging.',
    adoption: 'Useful companion for frontend-ui repos running Next.js.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'next-devtools',
    jsonProjection: { command: 'npx', args: ['-y', 'next-devtools-mcp@latest'] },
    excludeTools: [],
    cloudAgentCompatible: false, // Requires local dev server
  },
  {
    key: 'docker-mcp',
    label: 'Docker',
    description: 'Container management during Copilot sessions.',
    useWhen: 'Repos with containerized workflows.',
    adoption: 'Requires Docker running locally.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'docker',
    jsonProjection: { command: 'npx', args: ['-y', '@hypnosis/docker-mcp-server'] },
    excludeTools: ['remove_container', 'remove_image'],
    cloudAgentCompatible: false, // Requires local Docker
  },
  {
    key: 'notion-mcp',
    label: 'Notion',
    description: 'Access Notion documentation and wikis.',
    useWhen: 'Teams using Notion for docs or knowledge bases.',
    adoption: 'Requires NOTION_API_KEY.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['NOTION_API_KEY'],
    serverName: 'notion',
    jsonProjection: { command: 'npx', args: ['-y', '@notionhq/notion-mcp-server'], env: { NOTION_API_KEY: '${NOTION_API_KEY}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'linear-mcp',
    label: 'Linear',
    description: 'Issue tracking and sprint context.',
    useWhen: 'Teams using Linear for issue tracking.',
    adoption: 'Requires LINEAR_API_KEY.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['LINEAR_API_KEY'],
    serverName: 'linear',
    jsonProjection: { command: 'npx', args: ['-y', '@mseep/linear-mcp'], env: { LINEAR_API_KEY: '${LINEAR_API_KEY}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'sentry-mcp',
    label: 'Sentry',
    description: 'Error tracking and debugging context.',
    useWhen: 'Repos with Sentry error tracking.',
    adoption: 'Requires SENTRY_AUTH_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['SENTRY_AUTH_TOKEN'],
    serverName: 'sentry',
    jsonProjection: { command: 'npx', args: ['-y', '@sentry/mcp-server'], env: { SENTRY_AUTH_TOKEN: '${SENTRY_AUTH_TOKEN}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'slack-mcp',
    label: 'Slack',
    description: 'Draft and preview Slack messages.',
    useWhen: 'Teams using Slack for communication.',
    adoption: 'Requires SLACK_BOT_TOKEN.',
    trustLevel: 'low',
    transport: 'stdio',
    requiredAuth: ['SLACK_BOT_TOKEN'],
    serverName: 'slack',
    jsonProjection: { command: 'npx', args: ['-y', 'slack-mcp-server'], env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}' } },
    excludeTools: ['delete_message'],
    cloudAgentCompatible: true,
  },
  {
    key: 'stripe-mcp',
    label: 'Stripe',
    description: 'Payment and billing workflow context.',
    useWhen: 'Repos with Stripe integration.',
    adoption: 'Requires STRIPE_API_KEY.',
    trustLevel: 'low',
    transport: 'stdio',
    requiredAuth: ['STRIPE_API_KEY'],
    serverName: 'stripe',
    jsonProjection: { command: 'npx', args: ['-y', '@stripe/mcp'], env: { STRIPE_API_KEY: '${STRIPE_API_KEY}' } },
    excludeTools: ['create_charge', 'delete_customer'],
    cloudAgentCompatible: true,
  },
  {
    key: 'figma-mcp',
    label: 'Figma',
    description: 'Design file access and component inspection.',
    useWhen: 'Design-heavy repos needing Figma access.',
    adoption: 'Requires FIGMA_ACCESS_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['FIGMA_ACCESS_TOKEN'],
    serverName: 'figma',
    jsonProjection: { command: 'npx', args: ['-y', 'claude-talk-to-figma-mcp'], env: { FIGMA_ACCESS_TOKEN: '${FIGMA_ACCESS_TOKEN}' } },
    excludeTools: [],
    cloudAgentCompatible: false, // Requires OAuth
  },
  {
    key: 'mcp-security',
    label: 'MCP Security Scanner',
    description: 'Scan MCP servers for tool poisoning and prompt injection.',
    useWhen: 'Any repo with 2+ MCP servers.',
    adoption: 'Safety companion for multi-MCP setups.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'mcp-scan',
    jsonProjection: { command: 'npx', args: ['-y', 'mcp-scan@latest'] },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'composio-mcp',
    label: 'Composio Universal',
    description: '500+ integrations through a single MCP gateway.',
    useWhen: 'Enterprise or integration-heavy repos.',
    adoption: 'Requires COMPOSIO_API_KEY.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['COMPOSIO_API_KEY'],
    serverName: 'composio',
    jsonProjection: { command: 'npx', args: ['-y', '@composio/mcp'], env: { COMPOSIO_API_KEY: '${COMPOSIO_API_KEY}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'jira-confluence',
    label: 'Jira',
    description: 'Issue tracking and project management.',
    useWhen: 'Teams using Atlassian Jira.',
    adoption: 'Requires ATLASSIAN_API_TOKEN and ATLASSIAN_EMAIL.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['ATLASSIAN_API_TOKEN', 'ATLASSIAN_EMAIL'],
    serverName: 'jira',
    jsonProjection: { command: 'npx', args: ['-y', 'jira-mcp'], env: { ATLASSIAN_API_TOKEN: '${ATLASSIAN_API_TOKEN}', ATLASSIAN_EMAIL: '${ATLASSIAN_EMAIL}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'ga4-analytics',
    label: 'Google Analytics 4',
    description: 'Live GA4 data, attribution, and audience insights.',
    useWhen: 'Repos with web analytics needs.',
    adoption: 'Requires GA4_PROPERTY_ID and GOOGLE_APPLICATION_CREDENTIALS.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['GA4_PROPERTY_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
    serverName: 'ga4',
    jsonProjection: { command: 'npx', args: ['-y', 'mcp-server-ga4'], env: { GA4_PROPERTY_ID: '${GA4_PROPERTY_ID}', GOOGLE_APPLICATION_CREDENTIALS: '${GOOGLE_APPLICATION_CREDENTIALS}' } },
    excludeTools: [],
    cloudAgentCompatible: false, // Requires OAuth credentials
  },
  {
    key: 'search-console',
    label: 'Google Search Console',
    description: 'Search performance and indexing data.',
    useWhen: 'SEO-focused repos.',
    adoption: 'Requires Google OAuth credentials.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    serverName: 'gsc',
    jsonProjection: { command: 'npx', args: ['-y', 'mcp-gsc@latest'], env: { GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}', GOOGLE_CLIENT_SECRET: '${GOOGLE_CLIENT_SECRET}' } },
    excludeTools: [],
    cloudAgentCompatible: false, // Requires OAuth
  },
  {
    key: 'n8n-workflows',
    label: 'n8n Workflow Automation',
    description: 'Workflow automation with 1,396 integration nodes.',
    useWhen: 'Teams using n8n for workflow automation.',
    adoption: 'Requires N8N_URL and N8N_API_KEY.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['N8N_URL', 'N8N_API_KEY'],
    serverName: 'n8n',
    jsonProjection: { command: 'npx', args: ['-y', 'n8n-mcp-server@latest'], env: { N8N_URL: '${N8N_URL}', N8N_API_KEY: '${N8N_API_KEY}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'zendesk-mcp',
    label: 'Zendesk',
    description: 'Ticket management and help center content.',
    useWhen: 'Support teams using Zendesk.',
    adoption: 'Requires ZENDESK_API_TOKEN and ZENDESK_SUBDOMAIN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['ZENDESK_API_TOKEN', 'ZENDESK_SUBDOMAIN'],
    serverName: 'zendesk',
    jsonProjection: { command: 'npx', args: ['-y', 'zendesk-mcp'], env: { ZENDESK_API_TOKEN: '${ZENDESK_API_TOKEN}', ZENDESK_SUBDOMAIN: '${ZENDESK_SUBDOMAIN}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'infisical-secrets',
    label: 'Infisical Secrets',
    description: 'Secrets management with auto-rotation.',
    useWhen: 'Repos using Infisical for secrets.',
    adoption: 'Requires INFISICAL_TOKEN.',
    trustLevel: 'low',
    transport: 'stdio',
    requiredAuth: ['INFISICAL_TOKEN'],
    serverName: 'infisical',
    jsonProjection: { command: 'npx', args: ['-y', '@infisical/mcp'], env: { INFISICAL_TOKEN: '${INFISICAL_TOKEN}' } },
    excludeTools: ['delete_secret', 'update_secret'],
    cloudAgentCompatible: true,
  },
  {
    key: 'shopify-mcp',
    label: 'Shopify',
    description: 'Shopify API and deployment tooling.',
    useWhen: 'Shopify stores and apps.',
    adoption: 'Requires SHOPIFY_ACCESS_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['SHOPIFY_ACCESS_TOKEN'],
    serverName: 'shopify',
    jsonProjection: { command: 'npx', args: ['-y', 'shopify-mcp'], env: { SHOPIFY_ACCESS_TOKEN: '${SHOPIFY_ACCESS_TOKEN}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
  {
    key: 'huggingface-mcp',
    label: 'Hugging Face',
    description: 'Model search, dataset discovery, and Spaces.',
    useWhen: 'AI/ML repos needing model registry access.',
    adoption: 'Requires HF_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['HF_TOKEN'],
    serverName: 'huggingface',
    jsonProjection: { command: 'npx', args: ['-y', 'huggingface-mcp-server'], env: { HF_TOKEN: '${HF_TOKEN}' } },
    excludeTools: [],
    cloudAgentCompatible: true,
  },
];

// --- Helpers ---

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasDependency(deps, name) {
  return Object.prototype.hasOwnProperty.call(deps || {}, name);
}

function hasFileContentMatch(ctx, filePath, pattern) {
  if (!ctx) return false;
  const content = ctx.fileContent(filePath);
  return !!(content && pattern.test(content));
}

function getProjectDependencies(ctx) {
  if (!ctx) return {};
  if (typeof ctx.projectDependencies === 'function') return ctx.projectDependencies();
  const pkg = ctx.jsonFile('package.json') || {};
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
}

function hasPostgresSignals(ctx, deps) {
  if (hasDependency(deps, 'pg') || hasDependency(deps, 'postgres') || hasDependency(deps, 'pg-promise') ||
      hasDependency(deps, 'slonik') || hasDependency(deps, '@neondatabase/serverless') || hasDependency(deps, '@vercel/postgres')) {
    return true;
  }
  return (
    hasFileContentMatch(ctx, 'prisma/schema.prisma', /provider\s*=\s*["']postgresql["']/i) ||
    hasFileContentMatch(ctx, 'docker-compose.yml', /\bpostgres\b/i) ||
    hasFileContentMatch(ctx, 'docker-compose.yaml', /\bpostgres\b/i)
  );
}

// --- Core Functions ---

function getCopilotMcpPack(key) {
  return COPILOT_MCP_PACKS.find(pack => pack.key === key) || null;
}

function normalizeCopilotMcpPackKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map(key => `${key}`.trim())
    .filter(Boolean))]
    .filter(key => !!getCopilotMcpPack(key));
}

/**
 * Generate .vscode/mcp.json entry for a single MCP pack.
 * Copilot uses .vscode/mcp.json with "servers" wrapper (not settings.json mcpServers).
 */
function packToJson(pack) {
  const entry = {};
  const proj = pack.jsonProjection;

  if (proj.command) entry.command = proj.command;
  if (proj.url) entry.url = proj.url;
  if (proj.args && proj.args.length > 0) entry.args = [...proj.args];
  if (proj.env && Object.keys(proj.env).length > 0) entry.env = { ...proj.env };
  if (pack.excludeTools && pack.excludeTools.length > 0) entry.excludeTools = [...pack.excludeTools];

  return { [pack.serverName]: entry };
}

/**
 * Detect which MCP packs to recommend for a Copilot project.
 */
function recommendCopilotMcpPacks(stacks = [], domainPacks = [], options = {}) {
  const recommended = new Set();
  const stackKeys = new Set(stacks.map(s => s.key));
  const ctx = options.ctx || null;
  const deps = getProjectDependencies(ctx);
  const domainKeys = new Set(domainPacks.map(p => p.key));
  const cloudOnly = options.cloudOnly === true;

  if (stackKeys.size > 0) recommended.add('context7-docs');
  if (domainKeys.has('enterprise-governed') || domainKeys.has('monorepo')) recommended.add('github-mcp');

  if (domainKeys.has('frontend-ui') || stackKeys.has('react') || stackKeys.has('nextjs') ||
      stackKeys.has('vue') || stackKeys.has('angular') || stackKeys.has('svelte')) {
    recommended.add('playwright-mcp');
  }

  if (stackKeys.has('nextjs') || hasDependency(deps, 'next')) recommended.add('next-devtools');

  if ((domainKeys.has('backend-api') || domainKeys.has('infra-platform')) && hasPostgresSignals(ctx, deps)) {
    recommended.add('postgres-mcp');
  }

  if (domainKeys.has('monorepo') || domainKeys.has('enterprise-governed')) recommended.add('memory-mcp');
  if (domainKeys.has('enterprise-governed') || domainKeys.has('monorepo') || domainKeys.has('infra-platform')) recommended.add('sequential-thinking');
  if (domainKeys.has('infra-platform')) recommended.add('filesystem-mcp');

  if (domainKeys.has('backend-api') && ctx && (hasDependency(deps, 'axios') || hasDependency(deps, 'node-fetch') || hasDependency(deps, 'got'))) {
    recommended.add('fetch-mcp');
  }

  if (domainKeys.has('infra-platform') || domainKeys.has('devops-cicd')) recommended.add('docker-mcp');
  if (domainKeys.has('ecommerce') && (hasDependency(deps, 'stripe') || hasDependency(deps, '@stripe/stripe-js'))) recommended.add('stripe-mcp');
  if (domainKeys.has('ecommerce') && (hasDependency(deps, 'shopify') || hasDependency(deps, '@shopify/shopify-api'))) recommended.add('shopify-mcp');
  if (domainKeys.has('ai-ml')) recommended.add('huggingface-mcp');
  if (domainKeys.has('design-system')) recommended.add('figma-mcp');
  if (recommended.size >= 2) recommended.add('mcp-security');
  if (recommended.size === 0) recommended.add('context7-docs');

  let result = COPILOT_MCP_PACKS.filter(pack => recommended.has(pack.key)).map(pack => clone(pack));

  // Filter out cloud-incompatible packs if targeting cloud agent
  if (cloudOnly) {
    result = result.filter(pack => pack.cloudAgentCompatible !== false);
  }

  return result;
}

/**
 * Trust preflight: check if packs are safe to install.
 */
function getCopilotMcpPreflight(packKeys = [], env = process.env) {
  return normalizeCopilotMcpPackKeys(packKeys)
    .map(key => {
      const pack = getCopilotMcpPack(key);
      if (!pack) return null;
      const missingEnvVars = pack.requiredAuth.filter(envKey => {
        const value = env && Object.prototype.hasOwnProperty.call(env, envKey) ? env[envKey] : '';
        return !`${value || ''}`.trim();
      });
      return {
        key,
        label: pack.label,
        trustLevel: pack.trustLevel,
        transport: pack.transport,
        requiredAuth: pack.requiredAuth,
        missingEnvVars,
        safe: missingEnvVars.length === 0,
        cloudAgentCompatible: pack.cloudAgentCompatible,
        warning: missingEnvVars.length > 0
          ? `Missing env vars: ${missingEnvVars.join(', ')}. Pack will be included but may fail at runtime.`
          : null,
      };
    })
    .filter(Boolean);
}

/**
 * Merge MCP packs into existing .vscode/mcp.json content.
 * Uses "servers" wrapper format (Copilot-specific).
 */
function mergeCopilotMcpJson(existingContent = {}, packKeys = []) {
  let settings;
  if (typeof existingContent === 'string') {
    try { settings = JSON.parse(existingContent); } catch { settings = {}; }
  } else {
    settings = clone(existingContent);
  }

  if (!settings.servers || typeof settings.servers !== 'object') {
    settings.servers = {};
  }

  const existingServers = new Set(Object.keys(settings.servers));
  const newPacks = normalizeCopilotMcpPackKeys(packKeys)
    .map(key => getCopilotMcpPack(key))
    .filter(pack => pack && !existingServers.has(pack.serverName));

  for (const pack of newPacks) {
    const entry = packToJson(pack);
    const serverName = Object.keys(entry)[0];
    settings.servers[serverName] = entry[serverName];
  }

  return settings;
}

module.exports = {
  COPILOT_MCP_PACKS,
  getCopilotMcpPack,
  recommendCopilotMcpPacks,
  getCopilotMcpPreflight,
  mergeCopilotMcpJson,
  packToJson,
};
