/**
 * OpenCode MCP Pack System — 26 MCP packs
 *
 * MCP config in OpenCode lives in opencode.json under "mcp": { "<name>": { ... } }
 * Uses JSONC format with command/args/environment/tools fields.
 */

const OPENCODE_MCP_PACKS = [
  {
    key: 'context7-docs',
    label: 'Context7 Docs',
    description: 'Live, current framework and library documentation during OpenCode sessions.',
    useWhen: 'Repos that use any framework, library, or SDK and benefit from up-to-date docs.',
    adoption: 'Safe default docs pack for most application repos. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'context7',
    jsoncProjection: { command: ['npx', '-y', '@upstash/context7-mcp@latest'] },
    enabledTools: ['resolve-library-id', 'get-library-docs'],
  },
  {
    key: 'github-mcp',
    label: 'GitHub',
    description: 'Issue, PR, and repository context during OpenCode sessions.',
    useWhen: 'Repos hosted on GitHub that benefit from issue, PR, and repo context.',
    adoption: 'Recommended for any GitHub-hosted project. Requires GITHUB_PERSONAL_ACCESS_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    serverName: 'github',
    jsoncProjection: {
      command: ['npx', '-y', '@modelcontextprotocol/server-github'],
      environment: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' },
    },
    enabledTools: ['list_issues', 'get_issue', 'search_issues', 'list_pull_requests', 'get_pull_request', 'get_file_contents', 'search_code'],
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
    jsoncProjection: { command: ['npx', '-y', '@playwright/mcp@latest'] },
    enabledTools: ['browser_navigate', 'browser_screenshot', 'browser_click', 'browser_type', 'browser_wait_for_selector'],
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
    jsoncProjection: {
      command: ['npx', '-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    },
    enabledTools: ['query', 'list_tables', 'describe_table'],
  },
  {
    key: 'memory-mcp',
    label: 'Memory / Knowledge Graph',
    description: 'Persistent entity and relationship tracking across OpenCode sessions.',
    useWhen: 'Long-running or complex projects with many interconnected concepts.',
    adoption: 'Safe for any repo. Stores data locally. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'memory',
    jsoncProjection: { command: ['npx', '-y', '@modelcontextprotocol/server-memory'] },
    enabledTools: ['create_entities', 'create_relations', 'search_nodes', 'open_nodes', 'read_graph'],
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
    jsoncProjection: { command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking'] },
    enabledTools: ['sequentialthinking'],
  },
  {
    key: 'filesystem-mcp',
    label: 'Filesystem',
    description: 'Read-only filesystem access for documentation and reference files.',
    useWhen: 'Repos with reference files, docs, or config that OpenCode needs to read.',
    adoption: 'Read-only default. Pass allowed directories as args.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'filesystem',
    jsoncProjection: { command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '.'] },
    enabledTools: ['read_file', 'list_directory', 'search_files', 'get_file_info'],
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
    jsoncProjection: { command: ['npx', '-y', '@modelcontextprotocol/server-fetch'] },
    enabledTools: ['fetch'],
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
    jsoncProjection: { command: ['npx', '-y', 'next-devtools-mcp@latest'] },
    enabledTools: ['get_page_info', 'get_routes', 'get_components'],
  },
  {
    key: 'docker-mcp',
    label: 'Docker',
    description: 'Container management during OpenCode sessions.',
    useWhen: 'Repos with containerized workflows.',
    adoption: 'Requires Docker running locally.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'docker',
    jsoncProjection: { command: ['npx', '-y', '@hypnosis/docker-mcp-server'] },
    enabledTools: ['list_containers', 'container_logs', 'container_inspect'],
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
    jsoncProjection: { command: ['npx', '-y', '@notionhq/notion-mcp-server'], environment: { NOTION_API_KEY: '${NOTION_API_KEY}' } },
    enabledTools: ['search', 'get_page', 'get_database'],
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
    jsoncProjection: { command: ['npx', '-y', '@mseep/linear-mcp'], environment: { LINEAR_API_KEY: '${LINEAR_API_KEY}' } },
    enabledTools: ['list_issues', 'get_issue', 'search_issues'],
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
    jsoncProjection: { command: ['npx', '-y', '@sentry/mcp-server'], environment: { SENTRY_AUTH_TOKEN: '${SENTRY_AUTH_TOKEN}' } },
    enabledTools: ['get_issues', 'get_issue_details', 'search_errors'],
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
    jsoncProjection: { command: ['npx', '-y', 'slack-mcp-server'], environment: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}' } },
    enabledTools: ['list_channels', 'post_message', 'search_messages'],
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
    jsoncProjection: { command: ['npx', '-y', '@stripe/mcp'], environment: { STRIPE_API_KEY: '${STRIPE_API_KEY}' } },
    enabledTools: ['list_products', 'get_subscription', 'search_customers'],
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
    jsoncProjection: { command: ['npx', '-y', 'claude-talk-to-figma-mcp'], environment: { FIGMA_ACCESS_TOKEN: '${FIGMA_ACCESS_TOKEN}' } },
    enabledTools: ['get_file', 'get_components', 'get_styles'],
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
    jsoncProjection: { command: ['npx', '-y', 'mcp-scan@latest'] },
    enabledTools: ['scan_servers', 'check_tools'],
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
    jsoncProjection: { command: ['npx', '-y', '@composio/mcp'], environment: { COMPOSIO_API_KEY: '${COMPOSIO_API_KEY}' } },
    enabledTools: [],
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
    jsoncProjection: { command: ['npx', '-y', 'jira-mcp'], environment: { ATLASSIAN_API_TOKEN: '${ATLASSIAN_API_TOKEN}', ATLASSIAN_EMAIL: '${ATLASSIAN_EMAIL}' } },
    enabledTools: ['list_issues', 'get_issue', 'search_issues'],
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
    jsoncProjection: { command: ['npx', '-y', 'mcp-server-ga4'], environment: { GA4_PROPERTY_ID: '${GA4_PROPERTY_ID}', GOOGLE_APPLICATION_CREDENTIALS: '${GOOGLE_APPLICATION_CREDENTIALS}' } },
    enabledTools: ['run_report', 'get_metadata'],
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
    jsoncProjection: { command: ['npx', '-y', 'mcp-gsc@latest'], environment: { GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}', GOOGLE_CLIENT_SECRET: '${GOOGLE_CLIENT_SECRET}' } },
    enabledTools: ['search_analytics', 'get_sitemaps'],
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
    jsoncProjection: { command: ['npx', '-y', 'n8n-mcp-server@latest'], environment: { N8N_URL: '${N8N_URL}', N8N_API_KEY: '${N8N_API_KEY}' } },
    enabledTools: ['list_workflows', 'execute_workflow'],
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
    jsoncProjection: { command: ['npx', '-y', 'zendesk-mcp'], environment: { ZENDESK_API_TOKEN: '${ZENDESK_API_TOKEN}', ZENDESK_SUBDOMAIN: '${ZENDESK_SUBDOMAIN}' } },
    enabledTools: ['list_tickets', 'get_ticket', 'search_tickets'],
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
    jsoncProjection: { command: ['npx', '-y', '@infisical/mcp'], environment: { INFISICAL_TOKEN: '${INFISICAL_TOKEN}' } },
    enabledTools: ['get_secret', 'list_secrets'],
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
    jsoncProjection: { command: ['npx', '-y', 'shopify-mcp'], environment: { SHOPIFY_ACCESS_TOKEN: '${SHOPIFY_ACCESS_TOKEN}' } },
    enabledTools: ['get_products', 'get_orders'],
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
    jsoncProjection: { command: ['npx', '-y', 'huggingface-mcp-server'], environment: { HF_TOKEN: '${HF_TOKEN}' } },
    enabledTools: ['search_models', 'get_model_info', 'search_datasets'],
  },
];

// --- Helpers ---

function getOpenCodeMcpPack(key) {
  return OPENCODE_MCP_PACKS.find(pack => pack.key === key) || null;
}

function normalizeOpenCodeMcpPackKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map(key => `${key}`.trim())
    .filter(Boolean))]
    .filter(key => !!getOpenCodeMcpPack(key));
}

function packToJsonc(pack) {
  const proj = pack.jsoncProjection;
  const entry = {};
  if (proj.command) entry.command = proj.command;
  if (proj.environment) entry.environment = proj.environment;
  if (pack.enabledTools && pack.enabledTools.length > 0) {
    entry.tools = {};
    for (const tool of pack.enabledTools) {
      entry.tools[tool] = true;
    }
  }
  return { [pack.serverName]: entry };
}

function packsToJsonc(packKeys = []) {
  const mcp = {};
  for (const key of normalizeOpenCodeMcpPackKeys(packKeys)) {
    const pack = getOpenCodeMcpPack(key);
    if (!pack) continue;
    Object.assign(mcp, packToJsonc(pack));
  }
  return JSON.stringify({ mcp }, null, 2);
}

function hasPostgresSignals(ctx, deps) {
  const hasDep = (name) => Object.prototype.hasOwnProperty.call(deps || {}, name);
  return hasDep('pg') || hasDep('postgres') || hasDep('prisma') || hasDep('@prisma/client');
}

function getProjectDependencies(ctx) {
  if (typeof ctx.projectDependencies === 'function') return ctx.projectDependencies();
  const pkg = ctx.jsonFile('package.json') || {};
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
}

function recommendOpenCodeMcpPacks(stacks = [], domainPacks = [], options = {}) {
  const ctx = options.ctx || null;
  const stackKeys = new Set(stacks.map(s => s.key));
  const domainKeys = new Set(domainPacks.map(p => p.key));
  const deps = ctx ? getProjectDependencies(ctx) : {};
  const recommended = [];

  function add(key, reason) {
    if (recommended.some(r => r.key === key)) return;
    const pack = getOpenCodeMcpPack(key);
    if (!pack) return;
    recommended.push({ ...pack, matchReason: reason });
  }

  // Always recommend docs
  add('context7-docs', 'Safe default for up-to-date docs.');

  // GitHub for GitHub repos
  if (ctx && (ctx.hasDir('.github') || ctx.fileContent('.git/config'))) {
    add('github-mcp', 'GitHub-hosted repo detected.');
  }

  // Frontend packs
  if (stackKeys.has('react') || stackKeys.has('nextjs') || stackKeys.has('vue') || domainKeys.has('frontend-ui')) {
    add('playwright-mcp', 'Frontend stack detected.');
  }
  if (stackKeys.has('nextjs')) {
    add('next-devtools', 'Next.js detected.');
  }

  // Backend / data packs
  if (ctx && hasPostgresSignals(ctx, deps)) {
    add('postgres-mcp', 'PostgreSQL signals detected.');
  }

  // Docker
  if (stackKeys.has('docker') || (ctx && (ctx.fileContent('Dockerfile') || ctx.fileContent('docker-compose.yml')))) {
    add('docker-mcp', 'Docker usage detected.');
  }

  // Security scanner for multi-MCP
  if (recommended.length >= 2) {
    add('mcp-security', 'Multiple MCP servers — security scanner recommended.');
  }

  return recommended;
}

function getOpenCodeMcpPreflight(packKeys = []) {
  return normalizeOpenCodeMcpPackKeys(packKeys).map(key => {
    const pack = getOpenCodeMcpPack(key);
    if (!pack) return { key, safe: false, warning: `Unknown pack "${key}".` };
    if (pack.requiredAuth.length === 0) {
      return { key, label: pack.label, safe: true, warning: null };
    }
    return {
      key,
      label: pack.label,
      safe: false,
      warning: `Requires: ${pack.requiredAuth.join(', ')}. Set these as environment variables before enabling.`,
    };
  });
}

module.exports = {
  OPENCODE_MCP_PACKS,
  getOpenCodeMcpPack,
  normalizeOpenCodeMcpPackKeys,
  packToJsonc,
  packsToJsonc,
  recommendOpenCodeMcpPacks,
  getOpenCodeMcpPreflight,
};
