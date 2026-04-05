/**
 * Codex MCP Pack System — CP-03
 *
 * 8 priority MCP packs with TOML-aware projection, detection,
 * recommendation, merge logic, and trust preflight.
 *
 * Codex MCP config lives in .codex/config.toml under [mcp_servers.<name>].
 * Each server uses TOML format with command/args/env/enabled_tools fields.
 */

const CODEX_MCP_PACKS = [
  {
    key: 'context7-docs',
    label: 'Context7 Docs',
    description: 'Live, current framework and library documentation during Codex sessions.',
    useWhen: 'Repos that use any framework, library, or SDK and benefit from up-to-date docs.',
    adoption: 'Safe default docs pack for most application repos. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'context7',
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp@latest'],
    },
    enabledTools: ['resolve-library-id', 'get-library-docs'],
  },
  {
    key: 'github-mcp',
    label: 'GitHub',
    description: 'Issue, PR, and repository context during Codex sessions.',
    useWhen: 'Repos hosted on GitHub that benefit from issue, PR, and repo context.',
    adoption: 'Recommended for any GitHub-hosted project. Requires GITHUB_PERSONAL_ACCESS_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    serverName: 'github',
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' },
    },
    enabledTools: [
      'list_issues', 'get_issue', 'search_issues',
      'list_pull_requests', 'get_pull_request',
      'get_file_contents', 'search_code',
    ],
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
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
    },
    enabledTools: [
      'browser_navigate', 'browser_screenshot', 'browser_click',
      'browser_type', 'browser_wait_for_selector',
    ],
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
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    },
    enabledTools: ['query', 'list_tables', 'describe_table'],
  },
  {
    key: 'memory-mcp',
    label: 'Memory / Knowledge Graph',
    description: 'Persistent entity and relationship tracking across Codex sessions.',
    useWhen: 'Long-running or complex projects with many interconnected concepts.',
    adoption: 'Safe for any repo. Stores data locally. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'memory',
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    enabledTools: [
      'create_entities', 'create_relations', 'search_nodes',
      'open_nodes', 'read_graph',
    ],
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
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    },
    enabledTools: ['sequentialthinking'],
  },
  {
    key: 'filesystem-mcp',
    label: 'Filesystem',
    description: 'Read-only filesystem access for documentation and reference files.',
    useWhen: 'Repos with reference files, docs, or config that Codex needs to read outside sandbox.',
    adoption: 'Read-only default. Pass allowed directories as args.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'filesystem',
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
    enabledTools: [
      'read_file', 'list_directory', 'search_files', 'get_file_info',
    ],
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
    tomlProjection: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    enabledTools: ['fetch'],
  },
  // --- Parity expansion: 18 new packs to match Claude's 26 ---
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
    tomlProjection: { command: 'npx', args: ['-y', 'next-devtools-mcp@latest'] },
    enabledTools: ['get_page_info', 'get_routes', 'get_components'],
  },
  {
    key: 'docker-mcp',
    label: 'Docker',
    description: 'Container management during Codex sessions.',
    useWhen: 'Repos with containerized workflows.',
    adoption: 'Requires Docker running locally.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'docker',
    tomlProjection: { command: 'npx', args: ['-y', '@hypnosis/docker-mcp-server'] },
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
    tomlProjection: { command: 'npx', args: ['-y', '@notionhq/notion-mcp-server'], env: { NOTION_API_KEY: '${NOTION_API_KEY}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', '@mseep/linear-mcp'], env: { LINEAR_API_KEY: '${LINEAR_API_KEY}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', '@sentry/mcp-server'], env: { SENTRY_AUTH_TOKEN: '${SENTRY_AUTH_TOKEN}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'slack-mcp-server'], env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', '@stripe/mcp'], env: { STRIPE_API_KEY: '${STRIPE_API_KEY}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'claude-talk-to-figma-mcp'], env: { FIGMA_ACCESS_TOKEN: '${FIGMA_ACCESS_TOKEN}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'mcp-scan@latest'] },
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
    tomlProjection: { command: 'npx', args: ['-y', '@composio/mcp'], env: { COMPOSIO_API_KEY: '${COMPOSIO_API_KEY}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'jira-mcp'], env: { ATLASSIAN_API_TOKEN: '${ATLASSIAN_API_TOKEN}', ATLASSIAN_EMAIL: '${ATLASSIAN_EMAIL}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'mcp-server-ga4'], env: { GA4_PROPERTY_ID: '${GA4_PROPERTY_ID}', GOOGLE_APPLICATION_CREDENTIALS: '${GOOGLE_APPLICATION_CREDENTIALS}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'mcp-gsc@latest'], env: { GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}', GOOGLE_CLIENT_SECRET: '${GOOGLE_CLIENT_SECRET}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'n8n-mcp-server@latest'], env: { N8N_URL: '${N8N_URL}', N8N_API_KEY: '${N8N_API_KEY}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'zendesk-mcp'], env: { ZENDESK_API_TOKEN: '${ZENDESK_API_TOKEN}', ZENDESK_SUBDOMAIN: '${ZENDESK_SUBDOMAIN}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', '@infisical/mcp'], env: { INFISICAL_TOKEN: '${INFISICAL_TOKEN}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'shopify-mcp'], env: { SHOPIFY_ACCESS_TOKEN: '${SHOPIFY_ACCESS_TOKEN}' } },
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
    tomlProjection: { command: 'npx', args: ['-y', 'huggingface-mcp-server'], env: { HF_TOKEN: '${HF_TOKEN}' } },
    enabledTools: ['search_models', 'get_model_info', 'search_datasets'],
  },
  // ── 23 new packs ─────────────────────────────────────────────────────────
  {
    key: 'supabase-mcp', label: 'Supabase',
    description: 'Database, auth, and storage for Supabase.',
    useWhen: 'Repos using Supabase.',
    adoption: 'Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    serverName: 'supabase',
    tomlProjection: { command: 'npx', args: ['-y', '@supabase/mcp-server-supabase@latest'],
      env: { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_SERVICE_ROLE_KEY: '${SUPABASE_SERVICE_ROLE_KEY}' } },
    enabledTools: ['list_tables', 'query', 'insert', 'update'],
  },
  {
    key: 'prisma-mcp', label: 'Prisma ORM',
    description: 'Schema inspection and migrations via Prisma.',
    useWhen: 'Repos with a Prisma schema.',
    adoption: 'Requires: DATABASE_URL.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['DATABASE_URL'],
    serverName: 'prisma',
    tomlProjection: { command: 'npx', args: ['-y', 'prisma-mcp-server@latest'],
      env: { DATABASE_URL: '${DATABASE_URL}' } },
    enabledTools: ['introspect_schema', 'list_models', 'query_raw'],
  },
  {
    key: 'vercel-mcp', label: 'Vercel',
    description: 'Deployment management via Vercel.',
    useWhen: 'Repos deployed on Vercel.',
    adoption: 'Requires: VERCEL_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['VERCEL_TOKEN'],
    serverName: 'vercel',
    tomlProjection: { command: 'npx', args: ['-y', '@vercel/mcp-server@latest'],
      env: { VERCEL_TOKEN: '${VERCEL_TOKEN}' } },
    enabledTools: ['list_projects', 'get_deployment', 'list_deployments'],
  },
  {
    key: 'cloudflare-mcp', label: 'Cloudflare',
    description: 'Workers, KV, R2, and D1 management.',
    useWhen: 'Repos using Cloudflare edge.',
    adoption: 'Requires: CLOUDFLARE_API_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CLOUDFLARE_API_TOKEN'],
    serverName: 'cloudflare',
    tomlProjection: { command: 'npx', args: ['-y', '@cloudflare/mcp-server-cloudflare@latest'],
      env: { CLOUDFLARE_API_TOKEN: '${CLOUDFLARE_API_TOKEN}' } },
    enabledTools: ['list_workers', 'get_kv', 'list_r2_buckets'],
  },
  {
    key: 'aws-mcp', label: 'AWS',
    description: 'S3, Lambda, DynamoDB access.',
    useWhen: 'Repos using AWS.',
    adoption: 'Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.',
    trustLevel: 'low', transport: 'stdio', requiredAuth: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    serverName: 'aws',
    tomlProjection: { command: 'npx', args: ['-y', '@aws-samples/mcp-server-aws@latest'],
      env: { AWS_ACCESS_KEY_ID: '${AWS_ACCESS_KEY_ID}', AWS_SECRET_ACCESS_KEY: '${AWS_SECRET_ACCESS_KEY}', AWS_REGION: '${AWS_REGION}' } },
    enabledTools: ['list_buckets', 'list_functions', 'list_tables'],
  },
  {
    key: 'redis-mcp', label: 'Redis',
    description: 'Cache and session management.',
    useWhen: 'Repos using Redis.',
    adoption: 'Requires: REDIS_URL.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['REDIS_URL'],
    serverName: 'redis',
    tomlProjection: { command: 'npx', args: ['-y', 'redis-mcp-server@latest'],
      env: { REDIS_URL: '${REDIS_URL}' } },
    enabledTools: ['get', 'set', 'del', 'hget', 'hset'],
  },
  {
    key: 'mongodb-mcp', label: 'MongoDB',
    description: 'Document database access.',
    useWhen: 'Repos using MongoDB.',
    adoption: 'Requires: MONGODB_URI.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['MONGODB_URI'],
    serverName: 'mongodb',
    tomlProjection: { command: 'npx', args: ['-y', '@mongodb-js/mongodb-mcp-server@latest'],
      env: { MONGODB_URI: '${MONGODB_URI}' } },
    enabledTools: ['find', 'insertOne', 'updateOne', 'deleteOne'],
  },
  {
    key: 'twilio-mcp', label: 'Twilio',
    description: 'SMS, voice, and messaging.',
    useWhen: 'Repos using Twilio.',
    adoption: 'Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.',
    trustLevel: 'low', transport: 'stdio', requiredAuth: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    serverName: 'twilio',
    tomlProjection: { command: 'npx', args: ['-y', 'twilio-mcp-server@latest'],
      env: { TWILIO_ACCOUNT_SID: '${TWILIO_ACCOUNT_SID}', TWILIO_AUTH_TOKEN: '${TWILIO_AUTH_TOKEN}' } },
    enabledTools: ['send_sms', 'list_messages', 'list_calls'],
  },
  {
    key: 'sendgrid-mcp', label: 'SendGrid',
    description: 'Transactional email delivery.',
    useWhen: 'Repos using SendGrid.',
    adoption: 'Requires: SENDGRID_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['SENDGRID_API_KEY'],
    serverName: 'sendgrid',
    tomlProjection: { command: 'npx', args: ['-y', 'sendgrid-mcp-server@latest'],
      env: { SENDGRID_API_KEY: '${SENDGRID_API_KEY}' } },
    enabledTools: ['send_email', 'list_templates', 'get_stats'],
  },
  {
    key: 'algolia-mcp', label: 'Algolia Search',
    description: 'Search indexing via Algolia.',
    useWhen: 'Repos using Algolia.',
    adoption: 'Requires: ALGOLIA_APP_ID, ALGOLIA_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY'],
    serverName: 'algolia',
    tomlProjection: { command: 'npx', args: ['-y', 'algolia-mcp-server@latest'],
      env: { ALGOLIA_APP_ID: '${ALGOLIA_APP_ID}', ALGOLIA_API_KEY: '${ALGOLIA_API_KEY}' } },
    enabledTools: ['search', 'list_indices', 'get_index'],
  },
  {
    key: 'planetscale-mcp', label: 'PlanetScale',
    description: 'Serverless MySQL via PlanetScale.',
    useWhen: 'Repos on PlanetScale.',
    adoption: 'Requires: PLANETSCALE_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['PLANETSCALE_TOKEN'],
    serverName: 'planetscale',
    tomlProjection: { command: 'npx', args: ['-y', 'planetscale-mcp-server@latest'],
      env: { PLANETSCALE_TOKEN: '${PLANETSCALE_TOKEN}' } },
    enabledTools: ['list_databases', 'list_branches', 'execute_query'],
  },
  {
    key: 'neon-mcp', label: 'Neon Serverless Postgres',
    description: 'Serverless Postgres via Neon.',
    useWhen: 'Repos using Neon.',
    adoption: 'Requires: NEON_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['NEON_API_KEY'],
    serverName: 'neon',
    tomlProjection: { command: 'npx', args: ['-y', '@neondatabase/mcp-server-neon@latest'],
      env: { NEON_API_KEY: '${NEON_API_KEY}' } },
    enabledTools: ['list_projects', 'list_branches', 'execute_sql'],
  },
  {
    key: 'turso-mcp', label: 'Turso Edge SQLite',
    description: 'Edge SQLite via Turso.',
    useWhen: 'Repos using Turso.',
    adoption: 'Requires: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    serverName: 'turso',
    tomlProjection: { command: 'npx', args: ['-y', 'turso-mcp-server@latest'],
      env: { TURSO_DATABASE_URL: '${TURSO_DATABASE_URL}', TURSO_AUTH_TOKEN: '${TURSO_AUTH_TOKEN}' } },
    enabledTools: ['execute_query', 'list_tables'],
  },
  {
    key: 'upstash-mcp', label: 'Upstash Redis+Kafka',
    description: 'Serverless Redis and Kafka.',
    useWhen: 'Repos using Upstash.',
    adoption: 'Requires: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    serverName: 'upstash',
    tomlProjection: { command: 'npx', args: ['-y', '@upstash/mcp-server@latest'],
      env: { UPSTASH_REDIS_REST_URL: '${UPSTASH_REDIS_REST_URL}', UPSTASH_REDIS_REST_TOKEN: '${UPSTASH_REDIS_REST_TOKEN}' } },
    enabledTools: ['redis_get', 'redis_set', 'redis_del'],
  },
  {
    key: 'convex-mcp', label: 'Convex',
    description: 'Reactive backend via Convex.',
    useWhen: 'Repos using Convex.',
    adoption: 'Requires: CONVEX_DEPLOYMENT.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CONVEX_DEPLOYMENT'],
    serverName: 'convex',
    tomlProjection: { command: 'npx', args: ['-y', '@convex-dev/mcp-server@latest'],
      env: { CONVEX_DEPLOYMENT: '${CONVEX_DEPLOYMENT}' } },
    enabledTools: ['run_query', 'run_mutation', 'list_functions'],
  },
  {
    key: 'clerk-mcp', label: 'Clerk Authentication',
    description: 'User auth via Clerk.',
    useWhen: 'Repos using Clerk.',
    adoption: 'Requires: CLERK_SECRET_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CLERK_SECRET_KEY'],
    serverName: 'clerk',
    tomlProjection: { command: 'npx', args: ['-y', '@clerk/mcp-server@latest'],
      env: { CLERK_SECRET_KEY: '${CLERK_SECRET_KEY}' } },
    enabledTools: ['list_users', 'get_user', 'create_user'],
  },
  {
    key: 'resend-mcp', label: 'Resend Email',
    description: 'Transactional email via Resend.',
    useWhen: 'Repos using Resend.',
    adoption: 'Requires: RESEND_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['RESEND_API_KEY'],
    serverName: 'resend',
    tomlProjection: { command: 'npx', args: ['-y', 'resend-mcp-server@latest'],
      env: { RESEND_API_KEY: '${RESEND_API_KEY}' } },
    enabledTools: ['send_email', 'list_domains', 'get_email'],
  },
  {
    key: 'temporal-mcp', label: 'Temporal Workflow',
    description: 'Workflow orchestration via Temporal.',
    useWhen: 'Repos using Temporal.',
    adoption: 'Requires: TEMPORAL_ADDRESS.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['TEMPORAL_ADDRESS'],
    serverName: 'temporal',
    tomlProjection: { command: 'npx', args: ['-y', 'temporal-mcp-server@latest'],
      env: { TEMPORAL_ADDRESS: '${TEMPORAL_ADDRESS}' } },
    enabledTools: ['list_workflows', 'get_workflow', 'signal_workflow'],
  },
  {
    key: 'launchdarkly-mcp', label: 'LaunchDarkly',
    description: 'Feature flags via LaunchDarkly.',
    useWhen: 'Repos using LaunchDarkly.',
    adoption: 'Requires: LAUNCHDARKLY_ACCESS_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['LAUNCHDARKLY_ACCESS_TOKEN'],
    serverName: 'launchdarkly',
    tomlProjection: { command: 'npx', args: ['-y', 'launchdarkly-mcp-server@latest'],
      env: { LAUNCHDARKLY_ACCESS_TOKEN: '${LAUNCHDARKLY_ACCESS_TOKEN}' } },
    enabledTools: ['list_flags', 'get_flag', 'toggle_flag'],
  },
  {
    key: 'datadog-mcp', label: 'Datadog',
    description: 'Monitoring and APM via Datadog.',
    useWhen: 'Repos using Datadog.',
    adoption: 'Requires: DATADOG_API_KEY, DATADOG_APP_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    serverName: 'datadog',
    tomlProjection: { command: 'npx', args: ['-y', '@datadog/mcp-server@latest'],
      env: { DATADOG_API_KEY: '${DATADOG_API_KEY}', DATADOG_APP_KEY: '${DATADOG_APP_KEY}' } },
    enabledTools: ['query_metrics', 'list_monitors', 'search_logs'],
  },
  {
    key: 'grafana-mcp', label: 'Grafana',
    description: 'Dashboards via Grafana.',
    useWhen: 'Repos using Grafana.',
    adoption: 'Requires: GRAFANA_URL, GRAFANA_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['GRAFANA_URL', 'GRAFANA_API_KEY'],
    serverName: 'grafana',
    tomlProjection: { command: 'npx', args: ['-y', 'grafana-mcp-server@latest'],
      env: { GRAFANA_URL: '${GRAFANA_URL}', GRAFANA_API_KEY: '${GRAFANA_API_KEY}' } },
    enabledTools: ['list_dashboards', 'get_panel', 'query_datasource'],
  },
  {
    key: 'circleci-mcp', label: 'CircleCI',
    description: 'CI/CD via CircleCI.',
    useWhen: 'Repos using CircleCI.',
    adoption: 'Requires: CIRCLECI_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CIRCLECI_TOKEN'],
    serverName: 'circleci',
    tomlProjection: { command: 'npx', args: ['-y', 'circleci-mcp-server@latest'],
      env: { CIRCLECI_TOKEN: '${CIRCLECI_TOKEN}' } },
    enabledTools: ['list_pipelines', 'get_pipeline', 'list_jobs'],
  },
  {
    key: 'anthropic-mcp', label: 'Anthropic Claude API',
    description: 'Claude API for AI-powered apps.',
    useWhen: 'Repos building on Claude API.',
    adoption: 'Requires: ANTHROPIC_API_KEY.',
    trustLevel: 'high', transport: 'stdio', requiredAuth: ['ANTHROPIC_API_KEY'],
    serverName: 'anthropic',
    tomlProjection: { command: 'npx', args: ['-y', '@anthropic-ai/mcp-server@latest'],
      env: { ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}' } },
    enabledTools: ['create_message', 'list_models'],
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
  if (typeof ctx.projectDependencies === 'function') {
    return ctx.projectDependencies();
  }
  const pkg = ctx.jsonFile('package.json') || {};
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
}

function hasPostgresSignals(ctx, deps) {
  if (
    hasDependency(deps, 'pg') ||
    hasDependency(deps, 'postgres') ||
    hasDependency(deps, 'pg-promise') ||
    hasDependency(deps, 'slonik') ||
    hasDependency(deps, '@neondatabase/serverless') ||
    hasDependency(deps, '@vercel/postgres')
  ) {
    return true;
  }
  return (
    hasFileContentMatch(ctx, 'prisma/schema.prisma', /provider\s*=\s*["']postgresql["']/i) ||
    hasFileContentMatch(ctx, 'docker-compose.yml', /\bpostgres\b/i) ||
    hasFileContentMatch(ctx, 'docker-compose.yaml', /\bpostgres\b/i) ||
    hasFileContentMatch(ctx, '.env', /postgres(?:ql)?:\/\//i) ||
    hasFileContentMatch(ctx, '.env.example', /postgres(?:ql)?:\/\//i)
  );
}

// --- Core Functions ---

function getCodexMcpPack(key) {
  return CODEX_MCP_PACKS.find(pack => pack.key === key) || null;
}

function normalizeCodexMcpPackKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map(key => `${key}`.trim())
    .filter(Boolean))]
    .filter(key => !!getCodexMcpPack(key));
}

/**
 * Generate TOML string for a single MCP pack.
 */
function packToToml(pack) {
  const lines = [];
  lines.push(`[mcp_servers.${pack.serverName}]`);
  const proj = pack.tomlProjection;

  if (proj.command) {
    lines.push(`command = "${proj.command}"`);
  }
  if (proj.url) {
    lines.push(`url = "${proj.url}"`);
  }
  if (proj.args && proj.args.length > 0) {
    const argsStr = proj.args.map(a => `"${a}"`).join(', ');
    lines.push(`args = [${argsStr}]`);
  }
  if (proj.env) {
    const envPairs = Object.entries(proj.env)
      .map(([k, v]) => `${k} = "${v}"`)
      .join(', ');
    lines.push(`env = { ${envPairs} }`);
  }
  if (pack.enabledTools && pack.enabledTools.length > 0) {
    const toolsStr = pack.enabledTools.map(t => `"${t}"`).join(', ');
    lines.push(`enabled_tools = [${toolsStr}]`);
  }
  lines.push('enabled = true');
  lines.push('required = false');

  return lines.join('\n');
}

/**
 * Generate TOML for multiple packs.
 */
function packsToToml(packKeys = []) {
  return normalizeCodexMcpPackKeys(packKeys)
    .map(key => {
      const pack = getCodexMcpPack(key);
      return pack ? packToToml(pack) : null;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Detect which MCP packs to recommend for a Codex project.
 */
function recommendCodexMcpPacks(stacks = [], domainPacks = [], options = {}) {
  const recommended = new Set();
  const stackKeys = new Set(stacks.map(s => s.key));
  const ctx = options.ctx || null;
  const deps = getProjectDependencies(ctx);
  const domainKeys = new Set(domainPacks.map(p => p.key));

  // Context7 docs for any project with detected stacks
  if (stackKeys.size > 0) {
    recommended.add('context7-docs');
  }

  // GitHub for collaborative / governed repos
  if (domainKeys.has('enterprise-governed') || domainKeys.has('monorepo')) {
    recommended.add('github-mcp');
  }

  // Playwright for frontend repos
  if (
    domainKeys.has('frontend-ui') ||
    stackKeys.has('react') || stackKeys.has('nextjs') ||
    stackKeys.has('vue') || stackKeys.has('angular') || stackKeys.has('svelte')
  ) {
    recommended.add('playwright-mcp');
  }

  // Postgres when explicit signals exist
  if (
    (domainKeys.has('backend-api') || domainKeys.has('infra-platform')) &&
    hasPostgresSignals(ctx, deps)
  ) {
    recommended.add('postgres-mcp');
  }

  // Memory for complex / monorepo / long-lived projects
  if (domainKeys.has('monorepo') || domainKeys.has('enterprise-governed')) {
    recommended.add('memory-mcp');
  }

  // Sequential thinking for complex problem-solving
  if (domainKeys.has('enterprise-governed') || domainKeys.has('monorepo') || domainKeys.has('infra-platform')) {
    recommended.add('sequential-thinking');
  }

  // Filesystem for infra repos with reference docs
  if (domainKeys.has('infra-platform')) {
    recommended.add('filesystem-mcp');
  }

  // Fetch for repos with external API integrations
  if (domainKeys.has('backend-api') && ctx && (
    hasDependency(deps, 'axios') ||
    hasDependency(deps, 'node-fetch') ||
    hasDependency(deps, 'got') ||
    hasDependency(deps, 'ky') ||
    hasDependency(deps, 'undici')
  )) {
    recommended.add('fetch-mcp');
  }

  // Fallback: always recommend context7 if nothing else matched
  if (recommended.size === 0) {
    recommended.add('context7-docs');
  }

  return CODEX_MCP_PACKS
    .filter(pack => recommended.has(pack.key))
    .map(pack => clone(pack));
}

/**
 * Get required env vars for a set of pack keys.
 */
function getCodexMcpRequiredEnvVars(packKeys = []) {
  const required = new Set();
  for (const key of normalizeCodexMcpPackKeys(packKeys)) {
    const pack = getCodexMcpPack(key);
    if (!pack) continue;
    for (const envVar of pack.requiredAuth) {
      required.add(envVar);
    }
  }
  return [...required].sort();
}

/**
 * Trust preflight: check if packs are safe to install.
 */
function getCodexMcpPreflight(packKeys = [], env = process.env) {
  return normalizeCodexMcpPackKeys(packKeys)
    .map(key => {
      const pack = getCodexMcpPack(key);
      if (!pack) return null;
      const missingEnvVars = pack.requiredAuth.filter(envKey => {
        const value = env && Object.prototype.hasOwnProperty.call(env, envKey) ? env[envKey] : '';
        return !`${value || ''}`.trim();
      });
      return {
        key,
        label: pack.label,
        trustLevel: pack.trustLevel,
        requiredAuth: pack.requiredAuth,
        missingEnvVars,
        safe: missingEnvVars.length === 0,
        warning: missingEnvVars.length > 0
          ? `Missing env vars: ${missingEnvVars.join(', ')}. Pack will be included but may fail at runtime.`
          : null,
      };
    })
    .filter(Boolean);
}

/**
 * Merge TOML: generate safe TOML additions for new MCP packs.
 * Returns the TOML string to append (does not modify existing config).
 */
function mergeCodexMcpToml(existingConfigContent = '', packKeys = []) {
  const existingServers = new Set();

  // Parse existing [mcp_servers.*] sections to avoid duplicates
  const serverPattern = /\[mcp_servers\.([^\]]+)\]/g;
  let match;
  while ((match = serverPattern.exec(existingConfigContent)) !== null) {
    existingServers.add(match[1]);
  }

  const newPacks = normalizeCodexMcpPackKeys(packKeys)
    .map(key => getCodexMcpPack(key))
    .filter(pack => pack && !existingServers.has(pack.serverName));

  if (newPacks.length === 0) return '';

  const lines = [
    '',
    '# <!-- nerviq:mcp-packs:start -->',
    '# MCP packs added by nerviq',
  ];

  for (const pack of newPacks) {
    lines.push('');
    lines.push(packToToml(pack));
  }

  lines.push('');
  lines.push('# <!-- nerviq:mcp-packs:end -->');

  return lines.join('\n');
}

module.exports = {
  CODEX_MCP_PACKS,
  getCodexMcpPack,
  normalizeCodexMcpPackKeys,
  packToToml,
  packsToToml,
  recommendCodexMcpPacks,
  getCodexMcpRequiredEnvVars,
  getCodexMcpPreflight,
  mergeCodexMcpToml,
};
