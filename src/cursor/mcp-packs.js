/**
 * Cursor MCP Pack System
 *
 * 26 MCP packs with JSON-aware projection, detection,
 * recommendation, merge logic, and trust preflight.
 *
 * KEY DIFFERENCE: Cursor MCP uses .cursor/mcp.json format with
 * "mcpServers" wrapper (different from VS Code's .vscode/mcp.json "servers" wrapper).
 * Tool approval/auto-run model. Hard limit ~40 tools across all servers.
 *
 * .cursor/mcp.json format:
 * {
 *   "mcpServers": {
 *     "server-name": {
 *       "command": "npx",
 *       "args": [...],
 *       "env": { "KEY": "${env:MY_KEY}" }
 *     }
 *   }
 * }
 */

const CURSOR_MCP_PACKS = [
  {
    key: 'context7-docs',
    label: 'Context7 Docs',
    description: 'Live, current framework and library documentation during Cursor sessions.',
    useWhen: 'Repos that use any framework, library, or SDK and benefit from up-to-date docs.',
    adoption: 'Safe default docs pack for most application repos. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'context7',
    jsonProjection: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
    excludeTools: [],
    backgroundAgentCompatible: true,
  },
  {
    key: 'github-mcp',
    label: 'GitHub',
    description: 'Issue, PR, and repository context during Cursor sessions.',
    useWhen: 'Repos hosted on GitHub that benefit from issue, PR, and repo context.',
    adoption: 'Recommended for any GitHub-hosted project. Requires GITHUB_PERSONAL_ACCESS_TOKEN.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    serverName: 'github',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${env:GITHUB_PERSONAL_ACCESS_TOKEN}' } },
    excludeTools: ['create_repository', 'delete_file', 'push_files'],
    backgroundAgentCompatible: true,
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
    backgroundAgentCompatible: false, // Requires browser
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
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', '${env:DATABASE_URL}'] },
    excludeTools: ['execute_sql'],
    backgroundAgentCompatible: false, // Requires local DB
  },
  {
    key: 'memory-mcp',
    label: 'Memory / Knowledge Graph',
    description: 'Persistent entity and relationship tracking across Cursor sessions.',
    useWhen: 'Long-running or complex projects with many interconnected concepts.',
    adoption: 'Safe for any repo. Stores data locally. No auth required.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'memory',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
    excludeTools: [],
    backgroundAgentCompatible: false, // Ephemeral VM
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
    backgroundAgentCompatible: true,
  },
  {
    key: 'filesystem-mcp',
    label: 'Filesystem',
    description: 'Read-only filesystem access for documentation and reference files.',
    useWhen: 'Repos with reference files, docs, or config that Cursor needs to read.',
    adoption: 'Read-only default. Pass allowed directories as args.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'filesystem',
    jsonProjection: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
    excludeTools: ['write_file', 'create_directory', 'move_file'],
    backgroundAgentCompatible: true,
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
    backgroundAgentCompatible: true,
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
    backgroundAgentCompatible: false, // Requires local dev server
  },
  {
    key: 'docker-mcp',
    label: 'Docker',
    description: 'Container management during Cursor sessions.',
    useWhen: 'Repos with containerized workflows.',
    adoption: 'Requires Docker running locally.',
    trustLevel: 'medium',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'docker',
    jsonProjection: { command: 'npx', args: ['-y', '@hypnosis/docker-mcp-server'] },
    excludeTools: ['remove_container', 'remove_image'],
    backgroundAgentCompatible: false, // Requires local Docker
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
    jsonProjection: { command: 'npx', args: ['-y', '@notionhq/notion-mcp-server'], env: { NOTION_API_KEY: '${env:NOTION_API_KEY}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', '@mseep/linear-mcp'], env: { LINEAR_API_KEY: '${env:LINEAR_API_KEY}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', '@sentry/mcp-server'], env: { SENTRY_AUTH_TOKEN: '${env:SENTRY_AUTH_TOKEN}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'slack-mcp-server'], env: { SLACK_BOT_TOKEN: '${env:SLACK_BOT_TOKEN}' } },
    excludeTools: ['delete_message'],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', '@stripe/mcp'], env: { STRIPE_API_KEY: '${env:STRIPE_API_KEY}' } },
    excludeTools: ['create_charge', 'delete_customer'],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'claude-talk-to-figma-mcp'], env: { FIGMA_ACCESS_TOKEN: '${env:FIGMA_ACCESS_TOKEN}' } },
    excludeTools: [],
    backgroundAgentCompatible: false, // Requires OAuth
  },
  {
    key: 'mcp-security',
    label: 'MCP Security Scanner',
    description: 'Scan MCP servers for tool poisoning and prompt injection.',
    useWhen: 'Any repo with 2+ MCP servers.',
    adoption: 'Safety companion for multi-MCP setups. Critical given Cursor CVE history.',
    trustLevel: 'high',
    transport: 'stdio',
    requiredAuth: [],
    serverName: 'mcp-scan',
    jsonProjection: { command: 'npx', args: ['-y', 'mcp-scan@latest'] },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', '@composio/mcp'], env: { COMPOSIO_API_KEY: '${env:COMPOSIO_API_KEY}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'jira-mcp'], env: { ATLASSIAN_API_TOKEN: '${env:ATLASSIAN_API_TOKEN}', ATLASSIAN_EMAIL: '${env:ATLASSIAN_EMAIL}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'mcp-server-ga4'], env: { GA4_PROPERTY_ID: '${env:GA4_PROPERTY_ID}', GOOGLE_APPLICATION_CREDENTIALS: '${env:GOOGLE_APPLICATION_CREDENTIALS}' } },
    excludeTools: [],
    backgroundAgentCompatible: false, // Requires OAuth
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
    jsonProjection: { command: 'npx', args: ['-y', 'mcp-gsc@latest'], env: { GOOGLE_CLIENT_ID: '${env:GOOGLE_CLIENT_ID}', GOOGLE_CLIENT_SECRET: '${env:GOOGLE_CLIENT_SECRET}' } },
    excludeTools: [],
    backgroundAgentCompatible: false, // Requires OAuth
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
    jsonProjection: { command: 'npx', args: ['-y', 'n8n-mcp-server@latest'], env: { N8N_URL: '${env:N8N_URL}', N8N_API_KEY: '${env:N8N_API_KEY}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'zendesk-mcp'], env: { ZENDESK_API_TOKEN: '${env:ZENDESK_API_TOKEN}', ZENDESK_SUBDOMAIN: '${env:ZENDESK_SUBDOMAIN}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', '@infisical/mcp'], env: { INFISICAL_TOKEN: '${env:INFISICAL_TOKEN}' } },
    excludeTools: ['delete_secret', 'update_secret'],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'shopify-mcp'], env: { SHOPIFY_ACCESS_TOKEN: '${env:SHOPIFY_ACCESS_TOKEN}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
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
    jsonProjection: { command: 'npx', args: ['-y', 'huggingface-mcp-server'], env: { HF_TOKEN: '${env:HF_TOKEN}' } },
    excludeTools: [],
    backgroundAgentCompatible: true,
  },
  // ── 23 new packs ─────────────────────────────────────────────────────────
  {
    key: 'supabase-mcp', label: 'Supabase',
    description: 'Database, auth, and storage access for Supabase projects.',
    useWhen: 'Repos using Supabase for database, auth, or storage.',
    adoption: 'Recommended for full-stack Supabase repos. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    serverName: 'supabase',
    jsonProjection: { command: 'npx', args: ['-y', '@supabase/mcp-server-supabase@latest'], env: { SUPABASE_URL: '${env:SUPABASE_URL}', SUPABASE_SERVICE_ROLE_KEY: '${env:SUPABASE_SERVICE_ROLE_KEY}' } },
    excludeTools: ['delete_project', 'drop_table'], backgroundAgentCompatible: true,
  },
  {
    key: 'prisma-mcp', label: 'Prisma ORM',
    description: 'Schema inspection and migration management for Prisma.',
    useWhen: 'Repos using Prisma for database schema and migrations.',
    adoption: 'Recommended for any repo with a Prisma schema. Requires DATABASE_URL.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['DATABASE_URL'],
    serverName: 'prisma',
    jsonProjection: { command: 'npx', args: ['-y', 'prisma-mcp-server@latest'], env: { DATABASE_URL: '${env:DATABASE_URL}' } },
    excludeTools: ['drop_database'], backgroundAgentCompatible: false,
  },
  {
    key: 'vercel-mcp', label: 'Vercel',
    description: 'Deployment management and log access for Vercel projects.',
    useWhen: 'Repos deployed on Vercel.',
    adoption: 'Recommended for Vercel-hosted repos. Requires VERCEL_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['VERCEL_TOKEN'],
    serverName: 'vercel',
    jsonProjection: { command: 'npx', args: ['-y', '@vercel/mcp-server@latest'], env: { VERCEL_TOKEN: '${env:VERCEL_TOKEN}' } },
    excludeTools: ['delete_project', 'delete_deployment'], backgroundAgentCompatible: true,
  },
  {
    key: 'cloudflare-mcp', label: 'Cloudflare',
    description: 'Workers, KV, R2, and D1 management.',
    useWhen: 'Repos using Cloudflare Workers, KV, R2, or D1.',
    adoption: 'Recommended for edge-compute repos. Requires CLOUDFLARE_API_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CLOUDFLARE_API_TOKEN'],
    serverName: 'cloudflare',
    jsonProjection: { command: 'npx', args: ['-y', '@cloudflare/mcp-server-cloudflare@latest'], env: { CLOUDFLARE_API_TOKEN: '${env:CLOUDFLARE_API_TOKEN}' } },
    excludeTools: ['delete_worker', 'purge_cache'], backgroundAgentCompatible: true,
  },
  {
    key: 'aws-mcp', label: 'AWS',
    description: 'S3, Lambda, DynamoDB, and CloudFormation access.',
    useWhen: 'Repos using AWS cloud services.',
    adoption: 'Recommended for cloud-infra repos. Requires AWS credentials.',
    trustLevel: 'low', transport: 'stdio', requiredAuth: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    serverName: 'aws',
    jsonProjection: { command: 'npx', args: ['-y', '@aws-samples/mcp-server-aws@latest'], env: { AWS_ACCESS_KEY_ID: '${env:AWS_ACCESS_KEY_ID}', AWS_SECRET_ACCESS_KEY: '${env:AWS_SECRET_ACCESS_KEY}', AWS_REGION: '${env:AWS_REGION}' } },
    excludeTools: ['delete_stack', 'terminate_instances', 'delete_bucket'], backgroundAgentCompatible: true,
  },
  {
    key: 'redis-mcp', label: 'Redis',
    description: 'Cache and session management via Redis.',
    useWhen: 'Repos using Redis for caching or sessions.',
    adoption: 'Recommended for performance-critical repos. Requires REDIS_URL.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['REDIS_URL'],
    serverName: 'redis',
    jsonProjection: { command: 'npx', args: ['-y', 'redis-mcp-server@latest'], env: { REDIS_URL: '${env:REDIS_URL}' } },
    excludeTools: ['flushall', 'flushdb'], backgroundAgentCompatible: true,
  },
  {
    key: 'mongodb-mcp', label: 'MongoDB',
    description: 'Document database access for MongoDB.',
    useWhen: 'Repos using MongoDB.',
    adoption: 'Recommended for document-model repos. Requires MONGODB_URI.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['MONGODB_URI'],
    serverName: 'mongodb',
    jsonProjection: { command: 'npx', args: ['-y', '@mongodb-js/mongodb-mcp-server@latest'], env: { MONGODB_URI: '${env:MONGODB_URI}' } },
    excludeTools: ['drop_collection', 'drop_database'], backgroundAgentCompatible: false,
  },
  {
    key: 'twilio-mcp', label: 'Twilio',
    description: 'SMS, voice, and messaging via Twilio.',
    useWhen: 'Repos using Twilio for communications.',
    adoption: 'Recommended for communication-feature repos. Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    trustLevel: 'low', transport: 'stdio', requiredAuth: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    serverName: 'twilio',
    jsonProjection: { command: 'npx', args: ['-y', 'twilio-mcp-server@latest'], env: { TWILIO_ACCOUNT_SID: '${env:TWILIO_ACCOUNT_SID}', TWILIO_AUTH_TOKEN: '${env:TWILIO_AUTH_TOKEN}' } },
    excludeTools: ['delete_message'], backgroundAgentCompatible: true,
  },
  {
    key: 'sendgrid-mcp', label: 'SendGrid',
    description: 'Transactional and marketing email via SendGrid.',
    useWhen: 'Repos using SendGrid for email delivery.',
    adoption: 'Recommended for repos with email workflows. Requires SENDGRID_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['SENDGRID_API_KEY'],
    serverName: 'sendgrid',
    jsonProjection: { command: 'npx', args: ['-y', 'sendgrid-mcp-server@latest'], env: { SENDGRID_API_KEY: '${env:SENDGRID_API_KEY}' } },
    excludeTools: [], backgroundAgentCompatible: true,
  },
  {
    key: 'algolia-mcp', label: 'Algolia Search',
    description: 'Search indexing and query management via Algolia.',
    useWhen: 'Repos using Algolia for search.',
    adoption: 'Recommended for content-heavy and e-commerce repos. Requires ALGOLIA_APP_ID and ALGOLIA_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY'],
    serverName: 'algolia',
    jsonProjection: { command: 'npx', args: ['-y', 'algolia-mcp-server@latest'], env: { ALGOLIA_APP_ID: '${env:ALGOLIA_APP_ID}', ALGOLIA_API_KEY: '${env:ALGOLIA_API_KEY}' } },
    excludeTools: ['delete_index'], backgroundAgentCompatible: true,
  },
  {
    key: 'planetscale-mcp', label: 'PlanetScale',
    description: 'MySQL database management via PlanetScale.',
    useWhen: 'Repos using PlanetScale for serverless MySQL.',
    adoption: 'Recommended for MySQL-based repos on PlanetScale. Requires PLANETSCALE_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['PLANETSCALE_TOKEN'],
    serverName: 'planetscale',
    jsonProjection: { command: 'npx', args: ['-y', 'planetscale-mcp-server@latest'], env: { PLANETSCALE_TOKEN: '${env:PLANETSCALE_TOKEN}' } },
    excludeTools: ['delete_database'], backgroundAgentCompatible: true,
  },
  {
    key: 'neon-mcp', label: 'Neon Serverless Postgres',
    description: 'Serverless PostgreSQL management via Neon.',
    useWhen: 'Repos using Neon for serverless Postgres.',
    adoption: 'Recommended for serverless and edge Postgres repos. Requires NEON_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['NEON_API_KEY'],
    serverName: 'neon',
    jsonProjection: { command: 'npx', args: ['-y', '@neondatabase/mcp-server-neon@latest'], env: { NEON_API_KEY: '${env:NEON_API_KEY}' } },
    excludeTools: ['delete_project'], backgroundAgentCompatible: true,
  },
  {
    key: 'turso-mcp', label: 'Turso Edge SQLite',
    description: 'Distributed edge SQLite management via Turso.',
    useWhen: 'Repos using Turso for edge SQLite.',
    adoption: 'Recommended for edge and multi-region apps. Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    serverName: 'turso',
    jsonProjection: { command: 'npx', args: ['-y', 'turso-mcp-server@latest'], env: { TURSO_DATABASE_URL: '${env:TURSO_DATABASE_URL}', TURSO_AUTH_TOKEN: '${env:TURSO_AUTH_TOKEN}' } },
    excludeTools: ['destroy_database'], backgroundAgentCompatible: true,
  },
  {
    key: 'upstash-mcp', label: 'Upstash (Redis + Kafka)',
    description: 'Serverless Redis, Kafka, and QStash via Upstash.',
    useWhen: 'Repos using Upstash for serverless caching or messaging.',
    adoption: 'Recommended for serverless apps. Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    serverName: 'upstash',
    jsonProjection: { command: 'npx', args: ['-y', '@upstash/mcp-server@latest'], env: { UPSTASH_REDIS_REST_URL: '${env:UPSTASH_REDIS_REST_URL}', UPSTASH_REDIS_REST_TOKEN: '${env:UPSTASH_REDIS_REST_TOKEN}' } },
    excludeTools: [], backgroundAgentCompatible: true,
  },
  {
    key: 'convex-mcp', label: 'Convex',
    description: 'Reactive backend-as-a-service management via Convex.',
    useWhen: 'Repos using Convex as reactive backend.',
    adoption: 'Recommended for real-time full-stack repos. Requires CONVEX_DEPLOYMENT.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CONVEX_DEPLOYMENT'],
    serverName: 'convex',
    jsonProjection: { command: 'npx', args: ['-y', '@convex-dev/mcp-server@latest'], env: { CONVEX_DEPLOYMENT: '${env:CONVEX_DEPLOYMENT}' } },
    excludeTools: ['delete_deployment'], backgroundAgentCompatible: true,
  },
  {
    key: 'clerk-mcp', label: 'Clerk Authentication',
    description: 'User auth and session management via Clerk.',
    useWhen: 'Repos using Clerk for authentication.',
    adoption: 'Recommended for SaaS repos with Clerk. Requires CLERK_SECRET_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CLERK_SECRET_KEY'],
    serverName: 'clerk',
    jsonProjection: { command: 'npx', args: ['-y', '@clerk/mcp-server@latest'], env: { CLERK_SECRET_KEY: '${env:CLERK_SECRET_KEY}' } },
    excludeTools: ['delete_user'], backgroundAgentCompatible: true,
  },
  {
    key: 'resend-mcp', label: 'Resend Email',
    description: 'Developer-focused transactional email via Resend.',
    useWhen: 'Repos using Resend for email.',
    adoption: 'Recommended for modern full-stack repos. Requires RESEND_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['RESEND_API_KEY'],
    serverName: 'resend',
    jsonProjection: { command: 'npx', args: ['-y', 'resend-mcp-server@latest'], env: { RESEND_API_KEY: '${env:RESEND_API_KEY}' } },
    excludeTools: [], backgroundAgentCompatible: true,
  },
  {
    key: 'temporal-mcp', label: 'Temporal Workflow',
    description: 'Durable workflow orchestration via Temporal.',
    useWhen: 'Repos using Temporal for workflows.',
    adoption: 'Recommended for async-workflow and microservice repos. Requires TEMPORAL_ADDRESS.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['TEMPORAL_ADDRESS'],
    serverName: 'temporal',
    jsonProjection: { command: 'npx', args: ['-y', 'temporal-mcp-server@latest'], env: { TEMPORAL_ADDRESS: '${env:TEMPORAL_ADDRESS}' } },
    excludeTools: ['terminate_workflow'], backgroundAgentCompatible: true,
  },
  {
    key: 'launchdarkly-mcp', label: 'LaunchDarkly',
    description: 'Feature flags and experimentation via LaunchDarkly.',
    useWhen: 'Repos using LaunchDarkly for feature flags.',
    adoption: 'Recommended for feature-flag-driven development. Requires LAUNCHDARKLY_ACCESS_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['LAUNCHDARKLY_ACCESS_TOKEN'],
    serverName: 'launchdarkly',
    jsonProjection: { command: 'npx', args: ['-y', 'launchdarkly-mcp-server@latest'], env: { LAUNCHDARKLY_ACCESS_TOKEN: '${env:LAUNCHDARKLY_ACCESS_TOKEN}' } },
    excludeTools: ['delete_flag'], backgroundAgentCompatible: true,
  },
  {
    key: 'datadog-mcp', label: 'Datadog',
    description: 'Monitoring, APM, and log management via Datadog.',
    useWhen: 'Repos using Datadog for observability.',
    adoption: 'Recommended for production repos. Requires DATADOG_API_KEY and DATADOG_APP_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    serverName: 'datadog',
    jsonProjection: { command: 'npx', args: ['-y', '@datadog/mcp-server@latest'], env: { DATADOG_API_KEY: '${env:DATADOG_API_KEY}', DATADOG_APP_KEY: '${env:DATADOG_APP_KEY}' } },
    excludeTools: ['delete_monitor'], backgroundAgentCompatible: true,
  },
  {
    key: 'grafana-mcp', label: 'Grafana',
    description: 'Dashboard and observability access via Grafana.',
    useWhen: 'Repos using Grafana for dashboards.',
    adoption: 'Recommended for observability-focused repos. Requires GRAFANA_URL and GRAFANA_API_KEY.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['GRAFANA_URL', 'GRAFANA_API_KEY'],
    serverName: 'grafana',
    jsonProjection: { command: 'npx', args: ['-y', 'grafana-mcp-server@latest'], env: { GRAFANA_URL: '${env:GRAFANA_URL}', GRAFANA_API_KEY: '${env:GRAFANA_API_KEY}' } },
    excludeTools: ['delete_dashboard'], backgroundAgentCompatible: true,
  },
  {
    key: 'circleci-mcp', label: 'CircleCI',
    description: 'CI/CD pipeline access via CircleCI.',
    useWhen: 'Repos using CircleCI for CI/CD.',
    adoption: 'Recommended for CircleCI-powered projects. Requires CIRCLECI_TOKEN.',
    trustLevel: 'medium', transport: 'stdio', requiredAuth: ['CIRCLECI_TOKEN'],
    serverName: 'circleci',
    jsonProjection: { command: 'npx', args: ['-y', 'circleci-mcp-server@latest'], env: { CIRCLECI_TOKEN: '${env:CIRCLECI_TOKEN}' } },
    excludeTools: ['cancel_pipeline'], backgroundAgentCompatible: true,
  },
  {
    key: 'anthropic-mcp', label: 'Anthropic Claude API',
    description: 'Claude API access for AI-powered apps.',
    useWhen: 'Repos building on the Anthropic Claude API.',
    adoption: 'Recommended for AI-powered apps using Claude. Requires ANTHROPIC_API_KEY.',
    trustLevel: 'high', transport: 'stdio', requiredAuth: ['ANTHROPIC_API_KEY'],
    serverName: 'anthropic',
    jsonProjection: { command: 'npx', args: ['-y', '@anthropic-ai/mcp-server@latest'], env: { ANTHROPIC_API_KEY: '${env:ANTHROPIC_API_KEY}' } },
    excludeTools: [], backgroundAgentCompatible: true,
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

function getCursorMcpPack(key) {
  return CURSOR_MCP_PACKS.find(pack => pack.key === key) || null;
}

function normalizeCursorMcpPackKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map(key => `${key}`.trim())
    .filter(Boolean))]
    .filter(key => !!getCursorMcpPack(key));
}

/**
 * Generate .cursor/mcp.json entry for a single MCP pack.
 * Cursor uses .cursor/mcp.json with "mcpServers" wrapper.
 */
function packToJson(pack) {
  const entry = {};
  const proj = pack.jsonProjection;

  if (proj.command) entry.command = proj.command;
  if (proj.url) entry.url = proj.url;
  if (proj.args && proj.args.length > 0) entry.args = [...proj.args];
  if (proj.env && Object.keys(proj.env).length > 0) entry.env = { ...proj.env };

  return { [pack.serverName]: entry };
}

/**
 * Detect which MCP packs to recommend for a Cursor project.
 */
function recommendCursorMcpPacks(stacks = [], domainPacks = [], options = {}) {
  const recommended = new Set();
  const stackKeys = new Set(stacks.map(s => s.key));
  const ctx = options.ctx || null;
  const deps = getProjectDependencies(ctx);
  const domainKeys = new Set(domainPacks.map(p => p.key));
  const backgroundOnly = options.backgroundOnly === true;

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
  // ── 23 new packs recommendation logic ────────────────────────────────────
  if (ctx) {
    if (hasDependency(deps, '@supabase/supabase-js') || hasDependency(deps, '@supabase/auth-helpers-nextjs') || hasFileContentMatch(ctx, '.env', /SUPABASE/i) || hasFileContentMatch(ctx, '.env.example', /SUPABASE/i)) recommended.add('supabase-mcp');
    if (hasFileContentMatch(ctx, 'schema.prisma', /\S/) || hasDependency(deps, '@prisma/client') || hasDependency(deps, 'prisma')) recommended.add('prisma-mcp');
    if (ctx.files.includes('vercel.json') || hasFileContentMatch(ctx, 'package.json', /"deploy":\s*"vercel/i) || hasFileContentMatch(ctx, '.env', /VERCEL_TOKEN/i)) recommended.add('vercel-mcp');
    if (hasFileContentMatch(ctx, 'wrangler.toml', /\S/) || hasDependency(deps, 'wrangler') || hasFileContentMatch(ctx, '.env', /CLOUDFLARE/i)) recommended.add('cloudflare-mcp');
    if (hasFileContentMatch(ctx, '.env', /AWS_ACCESS_KEY/i) || ctx.files.some(f => /serverless\.yml|template\.ya?ml|cdk\.json/.test(f))) recommended.add('aws-mcp');
    if (hasDependency(deps, 'redis') || hasDependency(deps, 'ioredis') || hasDependency(deps, '@redis/client') || hasFileContentMatch(ctx, '.env', /REDIS_URL/i)) recommended.add('redis-mcp');
    if (hasDependency(deps, 'mongoose') || hasDependency(deps, 'mongodb') || hasFileContentMatch(ctx, '.env', /MONGODB_URI/i)) recommended.add('mongodb-mcp');
    if (hasDependency(deps, 'twilio') || hasFileContentMatch(ctx, '.env', /TWILIO_/i)) recommended.add('twilio-mcp');
    if (hasDependency(deps, '@sendgrid/mail') || hasFileContentMatch(ctx, '.env', /SENDGRID_API_KEY/i)) recommended.add('sendgrid-mcp');
    if (hasDependency(deps, 'algoliasearch') || hasDependency(deps, '@algolia/client-search') || hasFileContentMatch(ctx, '.env', /ALGOLIA_/i)) recommended.add('algolia-mcp');
    if (hasFileContentMatch(ctx, '.env', /PLANETSCALE_TOKEN/i)) recommended.add('planetscale-mcp');
    if (hasDependency(deps, '@neondatabase/serverless') || hasFileContentMatch(ctx, '.env', /NEON_/i)) recommended.add('neon-mcp');
    if (hasDependency(deps, '@libsql/client') || hasFileContentMatch(ctx, '.env', /TURSO_/i)) recommended.add('turso-mcp');
    if (hasDependency(deps, '@upstash/redis') || hasDependency(deps, '@upstash/kafka') || hasFileContentMatch(ctx, '.env', /UPSTASH_/i)) recommended.add('upstash-mcp');
    if (hasDependency(deps, 'convex') || hasFileContentMatch(ctx, 'convex.json', /\S/) || hasFileContentMatch(ctx, '.env', /CONVEX_/i)) recommended.add('convex-mcp');
    if (hasDependency(deps, '@clerk/nextjs') || hasDependency(deps, '@clerk/backend') || hasFileContentMatch(ctx, '.env', /CLERK_/i)) recommended.add('clerk-mcp');
    if (hasDependency(deps, 'resend') || hasFileContentMatch(ctx, '.env', /RESEND_API_KEY/i)) recommended.add('resend-mcp');
    if (hasDependency(deps, '@temporalio/client') || hasFileContentMatch(ctx, '.env', /TEMPORAL_/i)) recommended.add('temporal-mcp');
    if (hasDependency(deps, '@launchdarkly/node-server-sdk') || hasFileContentMatch(ctx, '.env', /LAUNCHDARKLY_/i)) recommended.add('launchdarkly-mcp');
    if (hasDependency(deps, 'dd-trace') || hasFileContentMatch(ctx, '.env', /DATADOG_/i)) recommended.add('datadog-mcp');
    if (hasFileContentMatch(ctx, 'docker-compose.yml', /grafana/i) || hasFileContentMatch(ctx, '.env', /GRAFANA_/i)) recommended.add('grafana-mcp');
    if (ctx.files.some(f => /\.circleci\/config/.test(f)) || hasFileContentMatch(ctx, '.env', /CIRCLECI_/i)) recommended.add('circleci-mcp');
    if (hasDependency(deps, '@anthropic-ai/sdk') || hasDependency(deps, 'anthropic') || hasFileContentMatch(ctx, '.env', /ANTHROPIC_API_KEY/i)) recommended.add('anthropic-mcp');
  }
  if (recommended.size >= 2) recommended.add('mcp-security');
  if (recommended.size === 0) recommended.add('context7-docs');

  let result = CURSOR_MCP_PACKS.filter(pack => recommended.has(pack.key)).map(pack => clone(pack));

  // Filter out background-incompatible packs if targeting background agents
  if (backgroundOnly) {
    result = result.filter(pack => pack.backgroundAgentCompatible !== false);
  }

  return result;
}

/**
 * Trust preflight: check if packs are safe to install.
 */
function getCursorMcpPreflight(packKeys = [], env = process.env) {
  return normalizeCursorMcpPackKeys(packKeys)
    .map(key => {
      const pack = getCursorMcpPack(key);
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
        backgroundAgentCompatible: pack.backgroundAgentCompatible,
        warning: missingEnvVars.length > 0
          ? `Missing env vars: ${missingEnvVars.join(', ')}. Pack will be included but may fail at runtime.`
          : null,
      };
    })
    .filter(Boolean);
}

/**
 * Merge MCP packs into existing .cursor/mcp.json content.
 * Uses "mcpServers" wrapper format (Cursor-specific).
 */
function mergeCursorMcpJson(existingContent = {}, packKeys = []) {
  let settings;
  if (typeof existingContent === 'string') {
    try { settings = JSON.parse(existingContent); } catch { settings = {}; }
  } else {
    settings = clone(existingContent);
  }

  if (!settings.mcpServers || typeof settings.mcpServers !== 'object') {
    settings.mcpServers = {};
  }

  const existingServers = new Set(Object.keys(settings.mcpServers));
  const newPacks = normalizeCursorMcpPackKeys(packKeys)
    .map(key => getCursorMcpPack(key))
    .filter(pack => pack && !existingServers.has(pack.serverName));

  for (const pack of newPacks) {
    const entry = packToJson(pack);
    const serverName = Object.keys(entry)[0];
    settings.mcpServers[serverName] = entry[serverName];
  }

  return settings;
}

module.exports = {
  CURSOR_MCP_PACKS,
  getCursorMcpPack,
  recommendCursorMcpPacks,
  getCursorMcpPreflight,
  mergeCursorMcpJson,
  packToJson,
};
