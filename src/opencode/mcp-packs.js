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
  // ── 23 new packs ─────────────────────────────────────────────────────────
  {
    key: 'supabase-mcp', label: 'Supabase',
    description: 'Database, auth, and storage for Supabase.',
    useWhen: 'Repos using Supabase.',
    adoption: 'Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    serverName: 'supabase',
    jsoncProjection: { command: ['npx', '-y', '@supabase/mcp-server-supabase@latest'], environment: { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_SERVICE_ROLE_KEY: '${SUPABASE_SERVICE_ROLE_KEY}' } },
    enabledTools: ['list_tables', 'query', 'insert', 'update'],
  },
  {
    key: 'prisma-mcp', label: 'Prisma ORM',
    description: 'Schema inspection and migrations via Prisma.',
    useWhen: 'Repos with a Prisma schema.',
    adoption: 'Requires: DATABASE_URL.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['DATABASE_URL'],
    serverName: 'prisma',
    jsoncProjection: { command: ['npx', '-y', 'prisma-mcp-server@latest'], environment: { DATABASE_URL: '${DATABASE_URL}' } },
    enabledTools: ['introspect_schema', 'list_models', 'query_raw'],
  },
  {
    key: 'vercel-mcp', label: 'Vercel',
    description: 'Deployment management via Vercel.',
    useWhen: 'Repos deployed on Vercel.',
    adoption: 'Requires: VERCEL_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['VERCEL_TOKEN'],
    serverName: 'vercel',
    jsoncProjection: { command: ['npx', '-y', '@vercel/mcp-server@latest'], environment: { VERCEL_TOKEN: '${VERCEL_TOKEN}' } },
    enabledTools: ['list_projects', 'get_deployment', 'list_deployments'],
  },
  {
    key: 'cloudflare-mcp', label: 'Cloudflare',
    description: 'Workers, KV, R2, and D1 management.',
    useWhen: 'Repos using Cloudflare edge.',
    adoption: 'Requires: CLOUDFLARE_API_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CLOUDFLARE_API_TOKEN'],
    serverName: 'cloudflare',
    jsoncProjection: { command: ['npx', '-y', '@cloudflare/mcp-server-cloudflare@latest'], environment: { CLOUDFLARE_API_TOKEN: '${CLOUDFLARE_API_TOKEN}' } },
    enabledTools: ['list_workers', 'get_kv', 'list_r2_buckets'],
  },
  {
    key: 'aws-mcp', label: 'AWS',
    description: 'S3, Lambda, DynamoDB access.',
    useWhen: 'Repos using AWS.',
    adoption: 'Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.',
    trustLevel: 'low', transport: 'stdio', requiredAuth: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    serverName: 'aws',
    jsoncProjection: { command: ['npx', '-y', '@aws-samples/mcp-server-aws@latest'], environment: { AWS_ACCESS_KEY_ID: '${AWS_ACCESS_KEY_ID}', AWS_SECRET_ACCESS_KEY: '${AWS_SECRET_ACCESS_KEY}', AWS_REGION: '${AWS_REGION}' } },
    enabledTools: ['list_buckets', 'list_functions', 'list_tables'],
  },
  {
    key: 'redis-mcp', label: 'Redis',
    description: 'Cache and session management.',
    useWhen: 'Repos using Redis.',
    adoption: 'Requires: REDIS_URL.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['REDIS_URL'],
    serverName: 'redis',
    jsoncProjection: { command: ['npx', '-y', 'redis-mcp-server@latest'], environment: { REDIS_URL: '${REDIS_URL}' } },
    enabledTools: ['get', 'set', 'del', 'hget', 'hset'],
  },
  {
    key: 'mongodb-mcp', label: 'MongoDB',
    description: 'Document database access.',
    useWhen: 'Repos using MongoDB.',
    adoption: 'Requires: MONGODB_URI.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['MONGODB_URI'],
    serverName: 'mongodb',
    jsoncProjection: { command: ['npx', '-y', '@mongodb-js/mongodb-mcp-server@latest'], environment: { MONGODB_URI: '${MONGODB_URI}' } },
    enabledTools: ['find', 'insertOne', 'updateOne', 'deleteOne'],
  },
  {
    key: 'twilio-mcp', label: 'Twilio',
    description: 'SMS, voice, and messaging.',
    useWhen: 'Repos using Twilio.',
    adoption: 'Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.',
    trustLevel: 'low', transport: 'stdio', requiredAuth: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    serverName: 'twilio',
    jsoncProjection: { command: ['npx', '-y', 'twilio-mcp-server@latest'], environment: { TWILIO_ACCOUNT_SID: '${TWILIO_ACCOUNT_SID}', TWILIO_AUTH_TOKEN: '${TWILIO_AUTH_TOKEN}' } },
    enabledTools: ['send_sms', 'list_messages', 'list_calls'],
  },
  {
    key: 'sendgrid-mcp', label: 'SendGrid',
    description: 'Transactional email delivery.',
    useWhen: 'Repos using SendGrid.',
    adoption: 'Requires: SENDGRID_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['SENDGRID_API_KEY'],
    serverName: 'sendgrid',
    jsoncProjection: { command: ['npx', '-y', 'sendgrid-mcp-server@latest'], environment: { SENDGRID_API_KEY: '${SENDGRID_API_KEY}' } },
    enabledTools: ['send_email', 'list_templates', 'get_stats'],
  },
  {
    key: 'algolia-mcp', label: 'Algolia Search',
    description: 'Search indexing via Algolia.',
    useWhen: 'Repos using Algolia.',
    adoption: 'Requires: ALGOLIA_APP_ID, ALGOLIA_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY'],
    serverName: 'algolia',
    jsoncProjection: { command: ['npx', '-y', 'algolia-mcp-server@latest'], environment: { ALGOLIA_APP_ID: '${ALGOLIA_APP_ID}', ALGOLIA_API_KEY: '${ALGOLIA_API_KEY}' } },
    enabledTools: ['search', 'list_indices', 'get_index'],
  },
  {
    key: 'planetscale-mcp', label: 'PlanetScale',
    description: 'Serverless MySQL via PlanetScale.',
    useWhen: 'Repos on PlanetScale.',
    adoption: 'Requires: PLANETSCALE_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['PLANETSCALE_TOKEN'],
    serverName: 'planetscale',
    jsoncProjection: { command: ['npx', '-y', 'planetscale-mcp-server@latest'], environment: { PLANETSCALE_TOKEN: '${PLANETSCALE_TOKEN}' } },
    enabledTools: ['list_databases', 'list_branches', 'execute_query'],
  },
  {
    key: 'neon-mcp', label: 'Neon Serverless Postgres',
    description: 'Serverless Postgres via Neon.',
    useWhen: 'Repos using Neon.',
    adoption: 'Requires: NEON_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['NEON_API_KEY'],
    serverName: 'neon',
    jsoncProjection: { command: ['npx', '-y', '@neondatabase/mcp-server-neon@latest'], environment: { NEON_API_KEY: '${NEON_API_KEY}' } },
    enabledTools: ['list_projects', 'list_branches', 'execute_sql'],
  },
  {
    key: 'turso-mcp', label: 'Turso Edge SQLite',
    description: 'Edge SQLite via Turso.',
    useWhen: 'Repos using Turso.',
    adoption: 'Requires: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    serverName: 'turso',
    jsoncProjection: { command: ['npx', '-y', 'turso-mcp-server@latest'], environment: { TURSO_DATABASE_URL: '${TURSO_DATABASE_URL}', TURSO_AUTH_TOKEN: '${TURSO_AUTH_TOKEN}' } },
    enabledTools: ['execute_query', 'list_tables'],
  },
  {
    key: 'upstash-mcp', label: 'Upstash Redis+Kafka',
    description: 'Serverless Redis and Kafka.',
    useWhen: 'Repos using Upstash.',
    adoption: 'Requires: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    serverName: 'upstash',
    jsoncProjection: { command: ['npx', '-y', '@upstash/mcp-server@latest'], environment: { UPSTASH_REDIS_REST_URL: '${UPSTASH_REDIS_REST_URL}', UPSTASH_REDIS_REST_TOKEN: '${UPSTASH_REDIS_REST_TOKEN}' } },
    enabledTools: ['redis_get', 'redis_set', 'redis_del'],
  },
  {
    key: 'convex-mcp', label: 'Convex',
    description: 'Reactive backend via Convex.',
    useWhen: 'Repos using Convex.',
    adoption: 'Requires: CONVEX_DEPLOYMENT.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CONVEX_DEPLOYMENT'],
    serverName: 'convex',
    jsoncProjection: { command: ['npx', '-y', '@convex-dev/mcp-server@latest'], environment: { CONVEX_DEPLOYMENT: '${CONVEX_DEPLOYMENT}' } },
    enabledTools: ['run_query', 'run_mutation', 'list_functions'],
  },
  {
    key: 'clerk-mcp', label: 'Clerk Authentication',
    description: 'User auth via Clerk.',
    useWhen: 'Repos using Clerk.',
    adoption: 'Requires: CLERK_SECRET_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CLERK_SECRET_KEY'],
    serverName: 'clerk',
    jsoncProjection: { command: ['npx', '-y', '@clerk/mcp-server@latest'], environment: { CLERK_SECRET_KEY: '${CLERK_SECRET_KEY}' } },
    enabledTools: ['list_users', 'get_user', 'create_user'],
  },
  {
    key: 'resend-mcp', label: 'Resend Email',
    description: 'Transactional email via Resend.',
    useWhen: 'Repos using Resend.',
    adoption: 'Requires: RESEND_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['RESEND_API_KEY'],
    serverName: 'resend',
    jsoncProjection: { command: ['npx', '-y', 'resend-mcp-server@latest'], environment: { RESEND_API_KEY: '${RESEND_API_KEY}' } },
    enabledTools: ['send_email', 'list_domains', 'get_email'],
  },
  {
    key: 'temporal-mcp', label: 'Temporal Workflow',
    description: 'Workflow orchestration via Temporal.',
    useWhen: 'Repos using Temporal.',
    adoption: 'Requires: TEMPORAL_ADDRESS.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['TEMPORAL_ADDRESS'],
    serverName: 'temporal',
    jsoncProjection: { command: ['npx', '-y', 'temporal-mcp-server@latest'], environment: { TEMPORAL_ADDRESS: '${TEMPORAL_ADDRESS}' } },
    enabledTools: ['list_workflows', 'get_workflow', 'signal_workflow'],
  },
  {
    key: 'launchdarkly-mcp', label: 'LaunchDarkly',
    description: 'Feature flags via LaunchDarkly.',
    useWhen: 'Repos using LaunchDarkly.',
    adoption: 'Requires: LAUNCHDARKLY_ACCESS_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['LAUNCHDARKLY_ACCESS_TOKEN'],
    serverName: 'launchdarkly',
    jsoncProjection: { command: ['npx', '-y', 'launchdarkly-mcp-server@latest'], environment: { LAUNCHDARKLY_ACCESS_TOKEN: '${LAUNCHDARKLY_ACCESS_TOKEN}' } },
    enabledTools: ['list_flags', 'get_flag', 'toggle_flag'],
  },
  {
    key: 'datadog-mcp', label: 'Datadog',
    description: 'Monitoring and APM via Datadog.',
    useWhen: 'Repos using Datadog.',
    adoption: 'Requires: DATADOG_API_KEY, DATADOG_APP_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    serverName: 'datadog',
    jsoncProjection: { command: ['npx', '-y', '@datadog/mcp-server@latest'], environment: { DATADOG_API_KEY: '${DATADOG_API_KEY}', DATADOG_APP_KEY: '${DATADOG_APP_KEY}' } },
    enabledTools: ['query_metrics', 'list_monitors', 'search_logs'],
  },
  {
    key: 'grafana-mcp', label: 'Grafana',
    description: 'Dashboards via Grafana.',
    useWhen: 'Repos using Grafana.',
    adoption: 'Requires: GRAFANA_URL, GRAFANA_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['GRAFANA_URL', 'GRAFANA_API_KEY'],
    serverName: 'grafana',
    jsoncProjection: { command: ['npx', '-y', 'grafana-mcp-server@latest'], environment: { GRAFANA_URL: '${GRAFANA_URL}', GRAFANA_API_KEY: '${GRAFANA_API_KEY}' } },
    enabledTools: ['list_dashboards', 'get_panel', 'query_datasource'],
  },
  {
    key: 'circleci-mcp', label: 'CircleCI',
    description: 'CI/CD via CircleCI.',
    useWhen: 'Repos using CircleCI.',
    adoption: 'Requires: CIRCLECI_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CIRCLECI_TOKEN'],
    serverName: 'circleci',
    jsoncProjection: { command: ['npx', '-y', 'circleci-mcp-server@latest'], environment: { CIRCLECI_TOKEN: '${CIRCLECI_TOKEN}' } },
    enabledTools: ['list_pipelines', 'get_pipeline', 'list_jobs'],
  },
  {
    key: 'anthropic-mcp', label: 'Anthropic Claude API',
    description: 'Claude API for AI-powered apps.',
    useWhen: 'Repos building on Claude API.',
    adoption: 'Requires: ANTHROPIC_API_KEY.',
    trustLevel: 'high', transport: 'stdio', requiredAuth: ['ANTHROPIC_API_KEY'],
    serverName: 'anthropic',
    jsoncProjection: { command: ['npx', '-y', '@anthropic-ai/mcp-server@latest'], environment: { ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}' } },
    enabledTools: ['create_message', 'list_models'],
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
