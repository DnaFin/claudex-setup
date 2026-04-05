const MCP_PACKS = [
  {
    key: 'context7-docs',
    label: 'Context7 Docs',
    useWhen: 'Repos that benefit from live, current framework and library documentation during Claude sessions.',
    adoption: 'Safe default docs pack for most application repos.',
    servers: {
      context7: {
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp@latest'],
      },
    },
  },
  {
    key: 'next-devtools',
    label: 'Next.js Devtools',
    useWhen: 'Next.js repos that need runtime-aware debugging and framework-specific tooling.',
    adoption: 'Useful companion pack for frontend-ui repos running Next.js.',
    servers: {
      'next-devtools': {
        command: 'npx',
        args: ['-y', 'next-devtools-mcp@latest'],
      },
    },
  },
  {
    key: 'github-mcp',
    label: 'GitHub',
    useWhen: 'Repos hosted on GitHub that benefit from issue, PR, and repository context during Claude sessions.',
    adoption: 'Recommended for any GitHub-hosted project. Requires GITHUB_PERSONAL_ACCESS_TOKEN env var.',
    servers: {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' },
      },
    },
  },
  {
    key: 'postgres-mcp',
    label: 'PostgreSQL',
    useWhen: 'Repos with PostgreSQL databases that benefit from schema inspection and query assistance.',
    adoption: 'Useful for backend-api and data-pipeline repos. Pass connection string as CLI argument.',
    servers: {
      postgres: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
      },
    },
  },
  {
    key: 'memory-mcp',
    label: 'Memory / Knowledge Graph',
    useWhen: 'Long-running projects that benefit from persistent entity and relationship tracking across sessions.',
    adoption: 'Useful for complex projects with many interconnected concepts. Stores data locally.',
    servers: {
      memory: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
    },
  },
  {
    key: 'playwright-mcp',
    label: 'Playwright Browser',
    useWhen: 'Frontend repos that need browser automation, E2E testing, or visual QA during Claude sessions.',
    adoption: 'Recommended for frontend-ui repos with E2E tests. No auth required.',
    servers: {
      playwright: {
        command: 'npx',
        args: ['-y', '@playwright/mcp@latest'],
      },
    },
  },
  {
    key: 'docker-mcp',
    label: 'Docker',
    useWhen: 'Repos with containerized workflows that benefit from container management during Claude sessions.',
    adoption: 'Community Docker MCP server. Requires Docker running locally. Note: community-maintained package.',
    servers: {
      docker: {
        command: 'npx',
        args: ['-y', '@hypnosis/docker-mcp-server'],
      },
    },
  },
  {
    key: 'notion-mcp',
    label: 'Notion',
    useWhen: 'Teams using Notion for documentation, wikis, or knowledge bases that Claude should reference.',
    adoption: 'Useful for teams with Notion-based docs. Requires NOTION_API_KEY env var.',
    servers: {
      notion: {
        command: 'npx',
        args: ['-y', '@notionhq/notion-mcp-server'],
        env: { NOTION_API_KEY: '${NOTION_API_KEY}' },
      },
    },
  },
  {
    key: 'linear-mcp',
    label: 'Linear',
    useWhen: 'Teams using Linear for issue tracking that want Claude to read and create issues.',
    adoption: 'Useful for teams managing sprints in Linear. Requires LINEAR_API_KEY env var.',
    servers: {
      linear: {
        command: 'npx',
        args: ['-y', '@mseep/linear-mcp'],
        env: { LINEAR_API_KEY: '${LINEAR_API_KEY}' },
      },
    },
  },
  {
    key: 'sentry-mcp',
    label: 'Sentry',
    useWhen: 'Repos with Sentry error tracking that benefit from error context during debugging sessions.',
    adoption: 'Useful for production repos. Requires SENTRY_AUTH_TOKEN env var.',
    servers: {
      sentry: {
        command: 'npx',
        args: ['-y', '@sentry/mcp-server'],
        env: { SENTRY_AUTH_TOKEN: '${SENTRY_AUTH_TOKEN}' },
      },
    },
  },
  {
    key: 'slack-mcp',
    label: 'Slack',
    useWhen: 'Teams using Slack that want Claude to draft, preview, or post messages.',
    adoption: 'Community Slack MCP server (supports OAuth and stealth mode). Requires SLACK_BOT_TOKEN or SLACK_COOKIES env var.',
    servers: {
      slack: {
        command: 'npx',
        args: ['-y', 'slack-mcp-server'],
        env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}' },
      },
    },
  },
  {
    key: 'stripe-mcp',
    label: 'Stripe',
    useWhen: 'Repos with Stripe integration for payments, subscriptions, or billing workflows.',
    adoption: 'Useful for e-commerce and SaaS repos. Requires STRIPE_API_KEY env var.',
    servers: {
      stripe: {
        command: 'npx',
        args: ['-y', '@stripe/mcp'],
        env: { STRIPE_API_KEY: '${STRIPE_API_KEY}' },
      },
    },
  },
  {
    key: 'figma-mcp',
    label: 'Figma',
    useWhen: 'Design-heavy repos where Claude needs access to Figma designs and components.',
    adoption: 'Community Figma MCP server. Requires FIGMA_ACCESS_TOKEN env var. Note: community-maintained package.',
    servers: {
      figma: {
        command: 'npx',
        args: ['-y', 'claude-talk-to-figma-mcp'],
        env: { FIGMA_ACCESS_TOKEN: '${FIGMA_ACCESS_TOKEN}' },
      },
    },
  },
  {
    key: 'mcp-security',
    label: 'MCP Security Scanner',
    useWhen: 'Any repo using MCP servers that should be scanned for tool poisoning and prompt injection.',
    adoption: 'Recommended as a safety companion for any repo with 2+ MCP servers.',
    servers: {
      'mcp-scan': {
        command: 'npx',
        args: ['-y', 'mcp-scan@latest'],
      },
    },
  },
  {
    key: 'composio-mcp',
    label: 'Composio Universal',
    useWhen: 'Teams needing 500+ integrations through a single MCP gateway with centralized OAuth.',
    adoption: 'Useful for enterprise or integration-heavy repos. Requires COMPOSIO_API_KEY env var.',
    servers: {
      composio: {
        command: 'npx',
        args: ['-y', '@composio/mcp'],
        env: { COMPOSIO_API_KEY: '${COMPOSIO_API_KEY}' },
      },
    },
  },
  {
    key: 'sequential-thinking',
    label: 'Sequential Thinking',
    useWhen: 'Complex problem-solving sessions that benefit from structured step-by-step reasoning.',
    adoption: 'Safe default for any repo. No auth required.',
    servers: {
      'sequential-thinking': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
    },
  },
  {
    key: 'jira-confluence',
    label: 'Jira',
    useWhen: 'Teams using Atlassian Jira for issue tracking and project management.',
    adoption: 'Requires ATLASSIAN_API_TOKEN and ATLASSIAN_EMAIL env vars.',
    servers: {
      jira: {
        command: 'npx',
        args: ['-y', 'jira-mcp'],
        env: { ATLASSIAN_API_TOKEN: '${ATLASSIAN_API_TOKEN}', ATLASSIAN_EMAIL: '${ATLASSIAN_EMAIL}' },
      },
    },
  },
  {
    key: 'ga4-analytics',
    label: 'Google Analytics 4',
    useWhen: 'Repos with web analytics needs — live GA4 data, attribution, and audience insights.',
    adoption: 'Requires GA4_PROPERTY_ID and either GOOGLE_APPLICATION_CREDENTIALS or ADC for auth.',
    servers: {
      ga4: {
        command: 'npx',
        args: ['-y', 'mcp-server-ga4'],
        env: { GA4_PROPERTY_ID: '${GA4_PROPERTY_ID}', GOOGLE_APPLICATION_CREDENTIALS: '${GOOGLE_APPLICATION_CREDENTIALS}' },
      },
    },
  },
  {
    key: 'search-console',
    label: 'Google Search Console',
    useWhen: 'SEO-focused repos that need search performance data, indexing status, and sitemap insights.',
    adoption: 'Requires Google OAuth client credentials (client ID + secret). Uses OAuth consent flow.',
    servers: {
      gsc: {
        command: 'npx',
        args: ['-y', 'mcp-gsc@latest'],
        env: { GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}', GOOGLE_CLIENT_SECRET: '${GOOGLE_CLIENT_SECRET}' },
      },
    },
  },
  {
    key: 'n8n-workflows',
    label: 'n8n Workflow Automation',
    useWhen: 'Teams using n8n for workflow automation with 1,396 integration nodes.',
    adoption: 'Requires n8n instance URL and API key.',
    servers: {
      n8n: {
        command: 'npx',
        args: ['-y', 'n8n-mcp-server@latest'],
        env: { N8N_URL: '${N8N_URL}', N8N_API_KEY: '${N8N_API_KEY}' },
      },
    },
  },
  {
    key: 'zendesk-mcp',
    label: 'Zendesk',
    useWhen: 'Support teams using Zendesk for ticket management and help center content.',
    adoption: 'Requires ZENDESK_API_TOKEN and ZENDESK_SUBDOMAIN env vars.',
    servers: {
      zendesk: {
        command: 'npx',
        args: ['-y', 'zendesk-mcp'],
        env: { ZENDESK_API_TOKEN: '${ZENDESK_API_TOKEN}', ZENDESK_SUBDOMAIN: '${ZENDESK_SUBDOMAIN}' },
      },
    },
  },
  {
    key: 'infisical-secrets',
    label: 'Infisical Secrets',
    useWhen: 'Repos using Infisical for secrets management with auto-rotation.',
    adoption: 'Requires INFISICAL_TOKEN env var.',
    servers: {
      infisical: {
        command: 'npx',
        args: ['-y', '@infisical/mcp'],
        env: { INFISICAL_TOKEN: '${INFISICAL_TOKEN}' },
      },
    },
  },
  {
    key: 'shopify-mcp',
    label: 'Shopify',
    useWhen: 'Shopify stores and apps that need API schema access and deployment tooling.',
    adoption: 'Community Shopify MCP server for GraphQL API access. Requires SHOPIFY_ACCESS_TOKEN env var.',
    servers: {
      shopify: {
        command: 'npx',
        args: ['-y', 'shopify-mcp'],
        env: { SHOPIFY_ACCESS_TOKEN: '${SHOPIFY_ACCESS_TOKEN}' },
      },
    },
  },
  {
    key: 'huggingface-mcp',
    label: 'Hugging Face',
    useWhen: 'AI/ML repos that need model search, dataset discovery, and Spaces integration.',
    adoption: 'Useful for ai-ml domain repos. Requires HF_TOKEN env var.',
    servers: {
      huggingface: {
        command: 'npx',
        args: ['-y', 'huggingface-mcp-server'],
        env: { HF_TOKEN: '${HF_TOKEN}' },
      },
    },
  },
  {
    key: 'blender-mcp',
    label: 'Blender 3D',
    useWhen: '3D modeling, animation, or rendering repos that use Blender.',
    adoption: 'Requires Blender installed locally. Python bridge.',
    servers: {
      blender: {
        command: 'npx',
        args: ['-y', '@glutamateapp/blender-mcp-ts'],
      },
    },
  },
  {
    key: 'wordpress-mcp',
    label: 'WordPress',
    useWhen: 'WordPress sites needing content management, site ops, and plugin workflows.',
    adoption: 'Requires WP_URL and WP_AUTH_TOKEN env vars.',
    servers: {
      wordpress: {
        command: 'npx',
        args: ['-y', 'wordpress-mcp-server@latest'],
        env: { WP_URL: '${WP_URL}', WP_AUTH_TOKEN: '${WP_AUTH_TOKEN}' },
      },
    },
  },
  // ── 24 new packs ─────────────────────────────────────────────────────────
  {
    key: 'supabase-mcp',
    label: 'Supabase',
    useWhen: 'Repos using Supabase for database, auth, or storage.',
    adoption: 'Recommended for full-stack repos using Supabase. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    servers: { supabase: { command: 'npx', args: ['-y', '@supabase/mcp-server-supabase@latest'], env: { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_SERVICE_ROLE_KEY: '${SUPABASE_SERVICE_ROLE_KEY}' } } },
  },
  {
    key: 'prisma-mcp',
    label: 'Prisma ORM',
    useWhen: 'Repos using Prisma for database schema management and migrations.',
    adoption: 'Recommended for any repo with a Prisma schema. No auth required beyond DATABASE_URL.',
    servers: { prisma: { command: 'npx', args: ['-y', 'prisma-mcp-server@latest'], env: { DATABASE_URL: '${DATABASE_URL}' } } },
  },
  {
    key: 'vercel-mcp',
    label: 'Vercel',
    useWhen: 'Repos deployed on Vercel that benefit from deployment management and log access.',
    adoption: 'Recommended for Next.js and other Vercel-hosted repos. Requires VERCEL_TOKEN.',
    servers: { vercel: { command: 'npx', args: ['-y', '@vercel/mcp-server@latest'], env: { VERCEL_TOKEN: '${VERCEL_TOKEN}' } } },
  },
  {
    key: 'cloudflare-mcp',
    label: 'Cloudflare',
    useWhen: 'Repos using Cloudflare Workers, KV, R2, or D1.',
    adoption: 'Recommended for edge-compute repos. Requires CLOUDFLARE_API_TOKEN.',
    servers: { cloudflare: { command: 'npx', args: ['-y', '@cloudflare/mcp-server-cloudflare@latest'], env: { CLOUDFLARE_API_TOKEN: '${CLOUDFLARE_API_TOKEN}' } } },
  },
  {
    key: 'aws-mcp',
    label: 'AWS (S3, Lambda, DynamoDB)',
    useWhen: 'Repos using AWS services — S3, Lambda, DynamoDB, or CloudFormation.',
    adoption: 'Recommended for cloud-infra repos. Requires AWS credentials.',
    servers: { aws: { command: 'npx', args: ['-y', '@aws-samples/mcp-server-aws@latest'], env: { AWS_ACCESS_KEY_ID: '${AWS_ACCESS_KEY_ID}', AWS_SECRET_ACCESS_KEY: '${AWS_SECRET_ACCESS_KEY}', AWS_REGION: '${AWS_REGION}' } } },
  },
  {
    key: 'redis-mcp',
    label: 'Redis',
    useWhen: 'Repos using Redis for caching, sessions, or pub/sub.',
    adoption: 'Recommended for performance-critical repos with Redis. Requires REDIS_URL.',
    servers: { redis: { command: 'npx', args: ['-y', 'redis-mcp-server@latest'], env: { REDIS_URL: '${REDIS_URL}' } } },
  },
  {
    key: 'mongodb-mcp',
    label: 'MongoDB',
    useWhen: 'Repos using MongoDB as document database.',
    adoption: 'Recommended for document-model repos. Requires MONGODB_URI.',
    servers: { mongodb: { command: 'npx', args: ['-y', '@mongodb-js/mongodb-mcp-server@latest'], env: { MONGODB_URI: '${MONGODB_URI}' } } },
  },
  {
    key: 'twilio-mcp',
    label: 'Twilio',
    useWhen: 'Repos integrating SMS, voice, or messaging via Twilio.',
    adoption: 'Recommended for communication-feature repos. Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    servers: { twilio: { command: 'npx', args: ['-y', 'twilio-mcp-server@latest'], env: { TWILIO_ACCOUNT_SID: '${TWILIO_ACCOUNT_SID}', TWILIO_AUTH_TOKEN: '${TWILIO_AUTH_TOKEN}' } } },
  },
  {
    key: 'sendgrid-mcp',
    label: 'SendGrid',
    useWhen: 'Repos using SendGrid for transactional or marketing email.',
    adoption: 'Recommended for repos with email delivery workflows. Requires SENDGRID_API_KEY.',
    servers: { sendgrid: { command: 'npx', args: ['-y', 'sendgrid-mcp-server@latest'], env: { SENDGRID_API_KEY: '${SENDGRID_API_KEY}' } } },
  },
  {
    key: 'algolia-mcp',
    label: 'Algolia Search',
    useWhen: 'Repos using Algolia for search indexing and discovery.',
    adoption: 'Recommended for e-commerce and content-heavy repos. Requires ALGOLIA_APP_ID and ALGOLIA_API_KEY.',
    servers: { algolia: { command: 'npx', args: ['-y', 'algolia-mcp-server@latest'], env: { ALGOLIA_APP_ID: '${ALGOLIA_APP_ID}', ALGOLIA_API_KEY: '${ALGOLIA_API_KEY}' } } },
  },
  {
    key: 'planetscale-mcp',
    label: 'PlanetScale',
    useWhen: 'Repos using PlanetScale serverless MySQL database.',
    adoption: 'Recommended for MySQL-based repos on PlanetScale. Requires PLANETSCALE_TOKEN.',
    servers: { planetscale: { command: 'npx', args: ['-y', 'planetscale-mcp-server@latest'], env: { PLANETSCALE_TOKEN: '${PLANETSCALE_TOKEN}' } } },
  },
  {
    key: 'neon-mcp',
    label: 'Neon Serverless Postgres',
    useWhen: 'Repos using Neon for serverless PostgreSQL.',
    adoption: 'Recommended for serverless and edge Postgres repos. Requires NEON_API_KEY.',
    servers: { neon: { command: 'npx', args: ['-y', '@neondatabase/mcp-server-neon@latest'], env: { NEON_API_KEY: '${NEON_API_KEY}' } } },
  },
  {
    key: 'turso-mcp',
    label: 'Turso Edge SQLite',
    useWhen: 'Repos using Turso for distributed edge SQLite.',
    adoption: 'Recommended for edge and multi-region apps. Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.',
    servers: { turso: { command: 'npx', args: ['-y', 'turso-mcp-server@latest'], env: { TURSO_DATABASE_URL: '${TURSO_DATABASE_URL}', TURSO_AUTH_TOKEN: '${TURSO_AUTH_TOKEN}' } } },
  },
  {
    key: 'upstash-mcp',
    label: 'Upstash (Redis + Kafka)',
    useWhen: 'Repos using Upstash for serverless Redis, Kafka, or QStash.',
    adoption: 'Recommended for serverless caching and messaging. Requires UPSTASH_REDIS_REST_URL.',
    servers: { upstash: { command: 'npx', args: ['-y', '@upstash/mcp-server@latest'], env: { UPSTASH_REDIS_REST_URL: '${UPSTASH_REDIS_REST_URL}', UPSTASH_REDIS_REST_TOKEN: '${UPSTASH_REDIS_REST_TOKEN}' } } },
  },
  {
    key: 'convex-mcp',
    label: 'Convex',
    useWhen: 'Repos using Convex as reactive backend-as-a-service.',
    adoption: 'Recommended for real-time full-stack repos on Convex. Requires CONVEX_DEPLOYMENT.',
    servers: { convex: { command: 'npx', args: ['-y', '@convex-dev/mcp-server@latest'], env: { CONVEX_DEPLOYMENT: '${CONVEX_DEPLOYMENT}' } } },
  },
  {
    key: 'clerk-mcp',
    label: 'Clerk Authentication',
    useWhen: 'Repos using Clerk for user authentication and session management.',
    adoption: 'Recommended for SaaS repos with Clerk auth. Requires CLERK_SECRET_KEY.',
    servers: { clerk: { command: 'npx', args: ['-y', '@clerk/mcp-server@latest'], env: { CLERK_SECRET_KEY: '${CLERK_SECRET_KEY}' } } },
  },
  {
    key: 'resend-mcp',
    label: 'Resend Email',
    useWhen: 'Repos using Resend for developer-focused transactional email.',
    adoption: 'Recommended for modern full-stack repos using Resend. Requires RESEND_API_KEY.',
    servers: { resend: { command: 'npx', args: ['-y', 'resend-mcp-server@latest'], env: { RESEND_API_KEY: '${RESEND_API_KEY}' } } },
  },
  {
    key: 'temporal-mcp',
    label: 'Temporal Workflow',
    useWhen: 'Repos using Temporal for durable workflow orchestration.',
    adoption: 'Recommended for async-workflow and microservice repos. Requires TEMPORAL_ADDRESS.',
    servers: { temporal: { command: 'npx', args: ['-y', 'temporal-mcp-server@latest'], env: { TEMPORAL_ADDRESS: '${TEMPORAL_ADDRESS}' } } },
  },
  {
    key: 'launchdarkly-mcp',
    label: 'LaunchDarkly Feature Flags',
    useWhen: 'Repos using LaunchDarkly for feature flags and experimentation.',
    adoption: 'Recommended for feature-flag-driven development. Requires LAUNCHDARKLY_ACCESS_TOKEN.',
    servers: { launchdarkly: { command: 'npx', args: ['-y', 'launchdarkly-mcp-server@latest'], env: { LAUNCHDARKLY_ACCESS_TOKEN: '${LAUNCHDARKLY_ACCESS_TOKEN}' } } },
  },
  {
    key: 'datadog-mcp',
    label: 'Datadog',
    useWhen: 'Repos using Datadog for monitoring, APM, and log management.',
    adoption: 'Recommended for production repos with Datadog observability. Requires DATADOG_API_KEY.',
    servers: { datadog: { command: 'npx', args: ['-y', '@datadog/mcp-server@latest'], env: { DATADOG_API_KEY: '${DATADOG_API_KEY}', DATADOG_APP_KEY: '${DATADOG_APP_KEY}' } } },
  },
  {
    key: 'grafana-mcp',
    label: 'Grafana',
    useWhen: 'Repos using Grafana for dashboards and observability.',
    adoption: 'Recommended for observability-focused repos. Requires GRAFANA_URL and GRAFANA_API_KEY.',
    servers: { grafana: { command: 'npx', args: ['-y', 'grafana-mcp-server@latest'], env: { GRAFANA_URL: '${GRAFANA_URL}', GRAFANA_API_KEY: '${GRAFANA_API_KEY}' } } },
  },
  {
    key: 'circleci-mcp',
    label: 'CircleCI',
    useWhen: 'Repos using CircleCI for CI/CD pipelines.',
    adoption: 'Recommended for CircleCI-powered projects. Requires CIRCLECI_TOKEN.',
    servers: { circleci: { command: 'npx', args: ['-y', 'circleci-mcp-server@latest'], env: { CIRCLECI_TOKEN: '${CIRCLECI_TOKEN}' } } },
  },
  {
    key: 'anthropic-mcp',
    label: 'Anthropic Claude API',
    useWhen: 'Repos that build on or integrate the Anthropic Claude API.',
    adoption: 'Recommended for AI-powered apps using Claude. Requires ANTHROPIC_API_KEY.',
    servers: { anthropic: { command: 'npx', args: ['-y', '@anthropic-ai/mcp-server@latest'], env: { ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}' } } },
  },
];

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

function hasPostgresSignals(ctx, deps = {}) {
  if (
    hasDependency(deps, 'pg') ||
    hasDependency(deps, 'postgres') ||
    hasDependency(deps, 'pg-promise') ||
    hasDependency(deps, 'postgres.js') ||
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
    hasFileContentMatch(ctx, 'compose.yml', /\bpostgres\b/i) ||
    hasFileContentMatch(ctx, 'compose.yaml', /\bpostgres\b/i) ||
    hasFileContentMatch(ctx, '.env', /postgres(?:ql)?:\/\//i) ||
    hasFileContentMatch(ctx, '.env.local', /postgres(?:ql)?:\/\//i) ||
    hasFileContentMatch(ctx, '.env.example', /postgres(?:ql)?:\/\//i)
  );
}

function hasObservabilitySignals(ctx, deps = {}) {
  if (
    hasDependency(deps, '@sentry/nextjs') ||
    hasDependency(deps, '@sentry/node') ||
    hasDependency(deps, '@sentry/react') ||
    hasDependency(deps, '@sentry/vue') ||
    hasDependency(deps, '@sentry/browser')
  ) {
    return true;
  }

  return (
    hasFileContentMatch(ctx, 'sentry.client.config.js', /\S/) ||
    hasFileContentMatch(ctx, 'sentry.client.config.ts', /\S/) ||
    hasFileContentMatch(ctx, 'sentry.server.config.js', /\S/) ||
    hasFileContentMatch(ctx, 'sentry.server.config.ts', /\S/) ||
    hasFileContentMatch(ctx, 'instrumentation.ts', /sentry/i) ||
    hasFileContentMatch(ctx, 'instrumentation.js', /sentry/i)
  );
}

function getMcpPack(key) {
  return MCP_PACKS.find(pack => pack.key === key) || null;
}

function normalizeMcpPackKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map(key => `${key}`.trim())
    .filter(Boolean))]
    .filter(key => !!getMcpPack(key));
}

function mergeMcpServers(existing = {}, packKeys = []) {
  const merged = clone(existing || {});
  for (const key of normalizeMcpPackKeys(packKeys)) {
    const pack = getMcpPack(key);
    if (!pack) continue;
    for (const [serverName, serverConfig] of Object.entries(pack.servers || {})) {
      if (!merged[serverName]) {
        merged[serverName] = clone(serverConfig);
      }
    }
  }
  return merged;
}

function getRequiredEnvVars(packKeys = []) {
  const required = new Set();
  for (const key of normalizeMcpPackKeys(packKeys)) {
    const pack = getMcpPack(key);
    if (!pack) continue;
    for (const serverConfig of Object.values(pack.servers || {})) {
      for (const envKey of Object.keys(serverConfig.env || {})) {
        required.add(envKey);
      }
    }
  }
  return [...required].sort();
}

function getMcpPackPreflight(packKeys = [], env = process.env) {
  return normalizeMcpPackKeys(packKeys)
    .map((key) => {
      const pack = getMcpPack(key);
      if (!pack) return null;
      const requiredEnvVars = getRequiredEnvVars([key]);
      if (requiredEnvVars.length === 0) return null;
      const missingEnvVars = requiredEnvVars.filter((envKey) => {
        const value = env && Object.prototype.hasOwnProperty.call(env, envKey) ? env[envKey] : '';
        return !`${value || ''}`.trim();
      });
      return {
        key,
        label: pack.label,
        requiredEnvVars,
        missingEnvVars,
      };
    })
    .filter(Boolean);
}

function recommendMcpPacks(stacks = [], domainPacks = [], options = {}) {
  const recommended = new Set();
  const stackKeys = new Set(stacks.map(stack => stack.key));
  const ctx = options.ctx || null;
  const deps = getProjectDependencies(ctx);

  for (const pack of domainPacks) {
    for (const key of pack.recommendedMcpPacks || []) {
      recommended.add(key);
    }
  }

  if (stackKeys.has('nextjs')) {
    recommended.add('next-devtools');
  }
  if (stackKeys.size > 0) {
    recommended.add('context7-docs');
  }

  const domainKeys = new Set(domainPacks.map(p => p.key));

  // GitHub MCP for collaborative repos
  if (domainKeys.has('oss-library') || domainKeys.has('enterprise-governed') || domainKeys.has('monorepo')) {
    recommended.add('github-mcp');
  }

  // Postgres MCP only when there are explicit Postgres signals
  if ((domainKeys.has('data-pipeline') || domainKeys.has('backend-api')) && hasPostgresSignals(ctx, deps)) {
    recommended.add('postgres-mcp');
  }

  // Memory MCP for complex projects
  if (domainKeys.has('monorepo') || domainKeys.has('enterprise-governed')) {
    recommended.add('memory-mcp');
  }

  // Playwright for frontend repos
  if (domainKeys.has('frontend-ui') || stackKeys.has('react') || stackKeys.has('vue') || stackKeys.has('angular') || stackKeys.has('svelte')) {
    recommended.add('playwright-mcp');
  }

  // Docker for infra repos
  if (domainKeys.has('infra-platform') || stackKeys.has('docker')) {
    recommended.add('docker-mcp');
  }

  // Sentry when the repo already shows observability signals or has stricter operational needs
  if (
    (domainKeys.has('backend-api') || domainKeys.has('frontend-ui')) &&
    (
      hasObservabilitySignals(ctx, deps) ||
      domainKeys.has('enterprise-governed') ||
      domainKeys.has('security-focused') ||
      domainKeys.has('ecommerce')
    )
  ) {
    recommended.add('sentry-mcp');
  }

  // Figma only when design-system signals are present
  if (domainKeys.has('design-system')) {
    recommended.add('figma-mcp');
  }

  // Stripe for e-commerce
  if (domainKeys.has('ecommerce')) {
    recommended.add('stripe-mcp');
  }

  // Jira for enterprise teams
  if (domainKeys.has('enterprise-governed')) {
    recommended.add('jira-confluence');
  }

  // Analytics for ecommerce (docs-content repos rarely need GA4/GSC)
  if (domainKeys.has('ecommerce')) {
    recommended.add('ga4-analytics');
    recommended.add('search-console');
  }

  // Shopify only when Shopify signals are present
  if (domainKeys.has('ecommerce') && ctx && (
    hasDependency(deps, 'shopify') || hasDependency(deps, '@shopify/shopify-api') ||
    hasFileContentMatch(ctx, '.env', /shopify/i) || hasFileContentMatch(ctx, '.env.example', /shopify/i)
  )) {
    recommended.add('shopify-mcp');
  }

  // HuggingFace for AI/ML
  if (domainKeys.has('ai-ml')) {
    recommended.add('huggingface-mcp');
    recommended.add('sequential-thinking');
    if (
      hasDependency(deps, 'langgraph') ||
      hasDependency(deps, 'langchain') ||
      hasDependency(deps, '@langchain/core') ||
      hasDependency(deps, 'chromadb') ||
      hasDependency(deps, 'qdrant-client') ||
      hasFileContentMatch(ctx, 'langgraph.json', /\S/) ||
      ctx?.hasDir('rag') ||
      ctx?.hasDir('retrievers')
    ) {
      recommended.add('memory-mcp');
    }
  }

  // Zendesk only when Zendesk signals are present
  if (domainKeys.has('enterprise-governed') && ctx && (
    hasDependency(deps, 'zendesk') || hasDependency(deps, 'node-zendesk') ||
    hasFileContentMatch(ctx, '.env', /zendesk/i) || hasFileContentMatch(ctx, '.env.example', /zendesk/i)
  )) {
    recommended.add('zendesk-mcp');
  }

  // Infisical for security-focused
  if (domainKeys.has('security-focused') || domainKeys.has('regulated-lite')) {
    recommended.add('infisical-secrets');
  }

  // ── New 24 packs recommendation logic ──────────────────────────────────────
  if (ctx && (hasDependency(deps, '@supabase/supabase-js') || hasDependency(deps, '@supabase/auth-helpers-nextjs') || hasFileContentMatch(ctx, '.env', /SUPABASE/i) || hasFileContentMatch(ctx, '.env.example', /SUPABASE/i))) {
    recommended.add('supabase-mcp');
  }
  if (ctx && (hasFileContentMatch(ctx, 'schema.prisma', /\S/) || hasDependency(deps, '@prisma/client') || hasDependency(deps, 'prisma'))) {
    recommended.add('prisma-mcp');
  }
  if (ctx && (ctx.files.includes('vercel.json') || ctx.files.includes('.vercel') || hasFileContentMatch(ctx, 'package.json', /"deploy":\s*"vercel/i) || hasFileContentMatch(ctx, '.env', /VERCEL_TOKEN/i))) {
    recommended.add('vercel-mcp');
  }
  if (ctx && (hasFileContentMatch(ctx, 'wrangler.toml', /\S/) || hasFileContentMatch(ctx, 'wrangler.json', /\S/) || hasDependency(deps, 'wrangler') || hasFileContentMatch(ctx, '.env', /CLOUDFLARE/i))) {
    recommended.add('cloudflare-mcp');
  }
  if (ctx && (hasFileContentMatch(ctx, '.env', /AWS_ACCESS_KEY/i) || hasFileContentMatch(ctx, '.env.example', /AWS_/i) || ctx.files.some(f => /serverless\.yml|template\.ya?ml|cdk\.json/.test(f)))) {
    recommended.add('aws-mcp');
  }
  if (ctx && (hasDependency(deps, 'redis') || hasDependency(deps, 'ioredis') || hasDependency(deps, '@redis/client') || hasFileContentMatch(ctx, '.env', /REDIS_URL/i))) {
    recommended.add('redis-mcp');
  }
  if (ctx && (hasDependency(deps, 'mongoose') || hasDependency(deps, 'mongodb') || hasFileContentMatch(ctx, '.env', /MONGODB_URI/i) || hasFileContentMatch(ctx, '.env.example', /MONGO/i))) {
    recommended.add('mongodb-mcp');
  }
  if (ctx && (hasDependency(deps, 'twilio') || hasFileContentMatch(ctx, '.env', /TWILIO_/i) || hasFileContentMatch(ctx, '.env.example', /TWILIO_/i))) {
    recommended.add('twilio-mcp');
  }
  if (ctx && (hasDependency(deps, '@sendgrid/mail') || hasDependency(deps, 'sendgrid') || hasFileContentMatch(ctx, '.env', /SENDGRID_API_KEY/i))) {
    recommended.add('sendgrid-mcp');
  }
  if (ctx && (hasDependency(deps, 'algoliasearch') || hasDependency(deps, '@algolia/client-search') || hasFileContentMatch(ctx, '.env', /ALGOLIA_/i))) {
    recommended.add('algolia-mcp');
  }
  if (ctx && (hasFileContentMatch(ctx, '.env', /PLANETSCALE_TOKEN/i) || hasFileContentMatch(ctx, '.env.example', /PLANETSCALE/i))) {
    recommended.add('planetscale-mcp');
  }
  if (ctx && (hasDependency(deps, '@neondatabase/serverless') || hasFileContentMatch(ctx, '.env', /NEON_/i) || hasFileContentMatch(ctx, '.env.example', /NEON_/i))) {
    recommended.add('neon-mcp');
  }
  if (ctx && (hasDependency(deps, '@libsql/client') || hasFileContentMatch(ctx, '.env', /TURSO_/i) || hasFileContentMatch(ctx, '.env.example', /TURSO_/i))) {
    recommended.add('turso-mcp');
  }
  if (ctx && (hasDependency(deps, '@upstash/redis') || hasDependency(deps, '@upstash/kafka') || hasFileContentMatch(ctx, '.env', /UPSTASH_/i))) {
    recommended.add('upstash-mcp');
  }
  if (ctx && (hasDependency(deps, 'convex') || hasDependency(deps, 'convex-dev') || hasFileContentMatch(ctx, 'convex.json', /\S/) || hasFileContentMatch(ctx, '.env', /CONVEX_/i))) {
    recommended.add('convex-mcp');
  }
  if (ctx && (hasDependency(deps, '@clerk/nextjs') || hasDependency(deps, '@clerk/clerk-sdk-node') || hasDependency(deps, '@clerk/backend') || hasFileContentMatch(ctx, '.env', /CLERK_/i))) {
    recommended.add('clerk-mcp');
  }
  if (ctx && (hasDependency(deps, 'resend') || hasFileContentMatch(ctx, '.env', /RESEND_API_KEY/i) || hasFileContentMatch(ctx, '.env.example', /RESEND_/i))) {
    recommended.add('resend-mcp');
  }
  if (ctx && (hasDependency(deps, '@temporalio/client') || hasDependency(deps, '@temporalio/worker') || hasFileContentMatch(ctx, '.env', /TEMPORAL_/i))) {
    recommended.add('temporal-mcp');
  }
  if (ctx && (hasDependency(deps, '@launchdarkly/node-server-sdk') || hasDependency(deps, 'launchdarkly-js-client-sdk') || hasFileContentMatch(ctx, '.env', /LAUNCHDARKLY_/i))) {
    recommended.add('launchdarkly-mcp');
  }
  if (ctx && (hasDependency(deps, 'dd-trace') || hasDependency(deps, 'datadog-metrics') || hasFileContentMatch(ctx, '.env', /DATADOG_/i))) {
    recommended.add('datadog-mcp');
  }
  if (ctx && (hasFileContentMatch(ctx, 'docker-compose.yml', /grafana/i) || hasFileContentMatch(ctx, '.env', /GRAFANA_/i) || ctx.files.some(f => /grafana/.test(f)))) {
    recommended.add('grafana-mcp');
  }
  if (ctx && (ctx.files.some(f => /\.circleci\/config/.test(f)) || hasFileContentMatch(ctx, '.env', /CIRCLECI_/i))) {
    recommended.add('circleci-mcp');
  }
  if (ctx && (hasDependency(deps, '@anthropic-ai/sdk') || hasDependency(deps, 'anthropic') || hasFileContentMatch(ctx, '.env', /ANTHROPIC_API_KEY/i) || hasFileContentMatch(ctx, '.env.example', /ANTHROPIC_/i))) {
    recommended.add('anthropic-mcp');
  }

  return MCP_PACKS
    .filter(pack => recommended.has(pack.key))
    .map(pack => clone(pack));
}

module.exports = {
  MCP_PACKS,
  getMcpPack,
  normalizeMcpPackKeys,
  mergeMcpServers,
  getRequiredEnvVars,
  getMcpPackPreflight,
  recommendMcpPacks,
};
