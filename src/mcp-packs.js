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
    adoption: 'Useful for backend-api and data-pipeline repos. Requires DATABASE_URL env var.',
    servers: {
      postgres: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: '${DATABASE_URL}' },
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
    adoption: 'Useful for infra-platform and backend repos. Requires Docker running locally.',
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
    adoption: 'Useful for team workflows. Requires SLACK_BOT_TOKEN env var.',
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
    adoption: 'Useful for frontend-ui repos with design systems. Requires FIGMA_ACCESS_TOKEN env var.',
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
    label: 'Jira + Confluence',
    useWhen: 'Teams using Atlassian for issue tracking and documentation.',
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
    adoption: 'Requires GA4 credentials. 1,641 stars.',
    servers: {
      ga4: {
        command: 'npx',
        args: ['-y', 'mcp-server-ga4'],
        env: { GA4_PROPERTY_ID: '${GA4_PROPERTY_ID}' },
      },
    },
  },
  {
    key: 'search-console',
    label: 'Google Search Console',
    useWhen: 'SEO-focused repos that need search performance data, indexing status, and sitemap insights.',
    adoption: 'Requires GSC credentials. 595 stars.',
    servers: {
      gsc: {
        command: 'npx',
        args: ['-y', 'mcp-gsc@latest'],
        env: { GSC_CREDENTIALS: '${GSC_CREDENTIALS}' },
      },
    },
  },
  {
    key: 'n8n-workflows',
    label: 'n8n Workflow Automation',
    useWhen: 'Teams using n8n for workflow automation with 1,396 integration nodes.',
    adoption: 'Requires n8n instance URL. 17,092 stars.',
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
    adoption: 'Requires ZENDESK_API_TOKEN env var. 79 stars.',
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
    adoption: 'Requires INFISICAL_TOKEN env var. 25,629 stars.',
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
    adoption: 'Official Shopify dev MCP. Requires SHOPIFY_ACCESS_TOKEN env var.',
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
    useWhen: '3D modeling, animation, or rendering repos that use Blender. 18,219 stars.',
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
    adoption: 'Requires WP_URL and WP_AUTH_TOKEN env vars. 115 stars.',
    servers: {
      wordpress: {
        command: 'npx',
        args: ['-y', 'wordpress-mcp-server@latest'],
        env: { WP_URL: '${WP_URL}', WP_AUTH_TOKEN: '${WP_AUTH_TOKEN}' },
      },
    },
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

  // Analytics for ecommerce and marketing
  if (domainKeys.has('ecommerce') || domainKeys.has('docs-content')) {
    recommended.add('ga4-analytics');
    recommended.add('search-console');
  }

  // Shopify for ecommerce
  if (domainKeys.has('ecommerce')) {
    recommended.add('shopify-mcp');
  }

  // HuggingFace for AI/ML
  if (domainKeys.has('ai-ml')) {
    recommended.add('huggingface-mcp');
  }

  // Zendesk for support
  if (domainKeys.has('enterprise-governed')) {
    recommended.add('zendesk-mcp');
  }

  // Infisical for security-focused
  if (domainKeys.has('security-focused') || domainKeys.has('regulated-lite')) {
    recommended.add('infisical-secrets');
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
