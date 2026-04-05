/**
 * Aider MCP Pack System — Minimal
 *
 * Aider has NO native MCP support. This module provides:
 * - Recommendations for editor integrations that bridge MCP to Aider
 * - Awareness of the --browser and /web commands for documentation
 * - Future-proofing for when/if Aider adds MCP support
 *
 * Instead of MCP, Aider users should rely on:
 * - /web command for pulling in web documentation
 * - /read for adding files to context
 * - Editor extensions (VS Code, NeoVim) that may have MCP bridges
 */

const AIDER_MCP_PACKS = [
  {
    key: 'editor-bridge-vscode',
    label: 'VS Code Extension Bridge',
    description: 'Use the Aider VS Code extension for tighter editor integration.',
    useWhen: 'VS Code users who want in-editor Aider access.',
    adoption: 'Recommended for VS Code users. Install from marketplace.',
    trustLevel: 'high',
    transport: 'editor-extension',
    requiredAuth: [],
    serverName: null,
    configProjection: null,
    recommendation: 'Install aider-chat VS Code extension for in-editor chat.',
  },
  {
    key: 'editor-bridge-neovim',
    label: 'NeoVim Plugin Bridge',
    description: 'Use the Aider NeoVim plugin for terminal-native integration.',
    useWhen: 'NeoVim users who want in-editor Aider access.',
    adoption: 'Recommended for NeoVim users. Install via plugin manager.',
    trustLevel: 'high',
    transport: 'editor-plugin',
    requiredAuth: [],
    serverName: null,
    configProjection: null,
    recommendation: 'Install aider.nvim for NeoVim integration.',
  },
  {
    key: 'web-docs',
    label: 'Web Documentation (/web)',
    description: 'Use Aider\'s built-in /web command to scrape documentation into context.',
    useWhen: 'Any project where Aider needs live documentation context.',
    adoption: 'Built-in feature, no setup required.',
    trustLevel: 'high',
    transport: 'built-in',
    requiredAuth: [],
    serverName: null,
    configProjection: null,
    recommendation: 'Use /web <url> to pull documentation into the Aider chat context.',
  },
  // ── 23 new packs (Aider editor-bridge format) ────────────────────────────
  {
    key: 'supabase-mcp', label: 'Supabase',
    description: 'Database, auth, and storage for Supabase. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Supabase.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    serverName: 'supabase', configProjection: null,
    recommendation: 'Configure supabase in editor MCP extension and use /web for docs.',
  },
  {
    key: 'prisma-mcp', label: 'Prisma ORM',
    description: 'Schema inspection and migrations via Prisma. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos with a Prisma schema.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['DATABASE_URL'],
    serverName: 'prisma', configProjection: null,
    recommendation: 'Configure prisma in editor MCP extension and use /web for docs.',
  },
  {
    key: 'vercel-mcp', label: 'Vercel',
    description: 'Deployment management via Vercel. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos deployed on Vercel.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['VERCEL_TOKEN'],
    serverName: 'vercel', configProjection: null,
    recommendation: 'Configure vercel in editor MCP extension and use /web for docs.',
  },
  {
    key: 'cloudflare-mcp', label: 'Cloudflare',
    description: 'Workers, KV, R2, and D1 management. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Cloudflare edge.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['CLOUDFLARE_API_TOKEN'],
    serverName: 'cloudflare', configProjection: null,
    recommendation: 'Configure cloudflare in editor MCP extension and use /web for docs.',
  },
  {
    key: 'aws-mcp', label: 'AWS',
    description: 'S3, Lambda, DynamoDB access. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using AWS.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'low', transport: 'editor-bridge',
    requiredAuth: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    serverName: 'aws', configProjection: null,
    recommendation: 'Configure aws in editor MCP extension and use /web for docs.',
  },
  {
    key: 'redis-mcp', label: 'Redis',
    description: 'Cache and session management. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Redis.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['REDIS_URL'],
    serverName: 'redis', configProjection: null,
    recommendation: 'Configure redis in editor MCP extension and use /web for docs.',
  },
  {
    key: 'mongodb-mcp', label: 'MongoDB',
    description: 'Document database access. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using MongoDB.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['MONGODB_URI'],
    serverName: 'mongodb', configProjection: null,
    recommendation: 'Configure mongodb in editor MCP extension and use /web for docs.',
  },
  {
    key: 'twilio-mcp', label: 'Twilio',
    description: 'SMS, voice, and messaging. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Twilio.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'low', transport: 'editor-bridge',
    requiredAuth: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    serverName: 'twilio', configProjection: null,
    recommendation: 'Configure twilio in editor MCP extension and use /web for docs.',
  },
  {
    key: 'sendgrid-mcp', label: 'SendGrid',
    description: 'Transactional email delivery. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using SendGrid.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['SENDGRID_API_KEY'],
    serverName: 'sendgrid', configProjection: null,
    recommendation: 'Configure sendgrid in editor MCP extension and use /web for docs.',
  },
  {
    key: 'algolia-mcp', label: 'Algolia Search',
    description: 'Search indexing via Algolia. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Algolia.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY'],
    serverName: 'algolia', configProjection: null,
    recommendation: 'Configure algolia in editor MCP extension and use /web for docs.',
  },
  {
    key: 'planetscale-mcp', label: 'PlanetScale',
    description: 'Serverless MySQL via PlanetScale. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos on PlanetScale.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['PLANETSCALE_TOKEN'],
    serverName: 'planetscale', configProjection: null,
    recommendation: 'Configure planetscale in editor MCP extension and use /web for docs.',
  },
  {
    key: 'neon-mcp', label: 'Neon Serverless Postgres',
    description: 'Serverless Postgres via Neon. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Neon.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['NEON_API_KEY'],
    serverName: 'neon', configProjection: null,
    recommendation: 'Configure neon in editor MCP extension and use /web for docs.',
  },
  {
    key: 'turso-mcp', label: 'Turso Edge SQLite',
    description: 'Edge SQLite via Turso. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Turso.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    serverName: 'turso', configProjection: null,
    recommendation: 'Configure turso in editor MCP extension and use /web for docs.',
  },
  {
    key: 'upstash-mcp', label: 'Upstash Redis+Kafka',
    description: 'Serverless Redis and Kafka. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Upstash.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    serverName: 'upstash', configProjection: null,
    recommendation: 'Configure upstash in editor MCP extension and use /web for docs.',
  },
  {
    key: 'convex-mcp', label: 'Convex',
    description: 'Reactive backend via Convex. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Convex.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['CONVEX_DEPLOYMENT'],
    serverName: 'convex', configProjection: null,
    recommendation: 'Configure convex in editor MCP extension and use /web for docs.',
  },
  {
    key: 'clerk-mcp', label: 'Clerk Authentication',
    description: 'User auth via Clerk. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Clerk.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['CLERK_SECRET_KEY'],
    serverName: 'clerk', configProjection: null,
    recommendation: 'Configure clerk in editor MCP extension and use /web for docs.',
  },
  {
    key: 'resend-mcp', label: 'Resend Email',
    description: 'Transactional email via Resend. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Resend.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['RESEND_API_KEY'],
    serverName: 'resend', configProjection: null,
    recommendation: 'Configure resend in editor MCP extension and use /web for docs.',
  },
  {
    key: 'temporal-mcp', label: 'Temporal Workflow',
    description: 'Workflow orchestration via Temporal. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Temporal.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['TEMPORAL_ADDRESS'],
    serverName: 'temporal', configProjection: null,
    recommendation: 'Configure temporal in editor MCP extension and use /web for docs.',
  },
  {
    key: 'launchdarkly-mcp', label: 'LaunchDarkly',
    description: 'Feature flags via LaunchDarkly. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using LaunchDarkly.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['LAUNCHDARKLY_ACCESS_TOKEN'],
    serverName: 'launchdarkly', configProjection: null,
    recommendation: 'Configure launchdarkly in editor MCP extension and use /web for docs.',
  },
  {
    key: 'datadog-mcp', label: 'Datadog',
    description: 'Monitoring and APM via Datadog. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Datadog.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    serverName: 'datadog', configProjection: null,
    recommendation: 'Configure datadog in editor MCP extension and use /web for docs.',
  },
  {
    key: 'grafana-mcp', label: 'Grafana',
    description: 'Dashboards via Grafana. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using Grafana.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['GRAFANA_URL', 'GRAFANA_API_KEY'],
    serverName: 'grafana', configProjection: null,
    recommendation: 'Configure grafana in editor MCP extension and use /web for docs.',
  },
  {
    key: 'circleci-mcp', label: 'CircleCI',
    description: 'CI/CD via CircleCI. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos using CircleCI.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'medium', transport: 'editor-bridge',
    requiredAuth: ['CIRCLECI_TOKEN'],
    serverName: 'circleci', configProjection: null,
    recommendation: 'Configure circleci in editor MCP extension and use /web for docs.',
  },
  {
    key: 'anthropic-mcp', label: 'Anthropic Claude API',
    description: 'Claude API for AI-powered apps. Use /web command or configure in your editor MCP bridge.',
    useWhen: 'Repos building on Claude API.',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: 'high', transport: 'editor-bridge',
    requiredAuth: ['ANTHROPIC_API_KEY'],
    serverName: 'anthropic', configProjection: null,
    recommendation: 'Configure anthropic in editor MCP extension and use /web for docs.',
  },
];

/**
 * Recommend MCP-equivalent integrations for Aider.
 * Since Aider has no native MCP, these are editor/workflow recommendations.
 */
function recommendAiderMcpPacks(ctx) {
  const recommendations = [];

  // Always recommend /web for docs
  recommendations.push(AIDER_MCP_PACKS.find(p => p.key === 'web-docs'));

  // Detect editor signals
  const hasVscode = ctx.files.some(f => /\.vscode\//i.test(f));
  const hasNvim = ctx.fileContent('.nvimrc') || ctx.fileContent('init.lua');

  if (hasVscode) {
    recommendations.push(AIDER_MCP_PACKS.find(p => p.key === 'editor-bridge-vscode'));
  }

  if (hasNvim) {
    recommendations.push(AIDER_MCP_PACKS.find(p => p.key === 'editor-bridge-neovim'));
  }

  return recommendations.filter(Boolean);
}

/**
 * Get preflight warnings for Aider MCP integration (minimal).
 */
function getAiderMcpPreflight() {
  return {
    warnings: [
      'Aider has no native MCP support. Use /web command and editor extensions instead.',
    ],
    ready: true,
  };
}

module.exports = {
  AIDER_MCP_PACKS,
  recommendAiderMcpPacks,
  getAiderMcpPreflight,
};
