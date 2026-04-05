'use strict';
const fs = require('fs');

const NEW_PACKS_META = [
  { key:'supabase-mcp', label:'Supabase', serverName:'supabase', pkg:'@supabase/mcp-server-supabase@latest', auth:['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], trust:'medium', exclude:['delete_project','drop_table'], enabled:['list_tables','query','insert','update'], desc:'Database, auth, and storage for Supabase.', useWhen:'Repos using Supabase.' },
  { key:'prisma-mcp', label:'Prisma ORM', serverName:'prisma', pkg:'prisma-mcp-server@latest', auth:['DATABASE_URL'], trust:'medium', exclude:['drop_database'], enabled:['introspect_schema','list_models','query_raw'], desc:'Schema inspection and migrations via Prisma.', useWhen:'Repos with a Prisma schema.' },
  { key:'vercel-mcp', label:'Vercel', serverName:'vercel', pkg:'@vercel/mcp-server@latest', auth:['VERCEL_TOKEN'], trust:'medium', exclude:['delete_project','delete_deployment'], enabled:['list_projects','get_deployment','list_deployments'], desc:'Deployment management via Vercel.', useWhen:'Repos deployed on Vercel.' },
  { key:'cloudflare-mcp', label:'Cloudflare', serverName:'cloudflare', pkg:'@cloudflare/mcp-server-cloudflare@latest', auth:['CLOUDFLARE_API_TOKEN'], trust:'medium', exclude:['delete_worker','purge_cache'], enabled:['list_workers','get_kv','list_r2_buckets'], desc:'Workers, KV, R2, and D1 management.', useWhen:'Repos using Cloudflare edge.' },
  { key:'aws-mcp', label:'AWS', serverName:'aws', pkg:'@aws-samples/mcp-server-aws@latest', auth:['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_REGION'], trust:'low', exclude:['delete_stack','terminate_instances','delete_bucket'], enabled:['list_buckets','list_functions','list_tables'], desc:'S3, Lambda, DynamoDB access.', useWhen:'Repos using AWS.' },
  { key:'redis-mcp', label:'Redis', serverName:'redis', pkg:'redis-mcp-server@latest', auth:['REDIS_URL'], trust:'medium', exclude:['flushall','flushdb'], enabled:['get','set','del','hget','hset'], desc:'Cache and session management.', useWhen:'Repos using Redis.' },
  { key:'mongodb-mcp', label:'MongoDB', serverName:'mongodb', pkg:'@mongodb-js/mongodb-mcp-server@latest', auth:['MONGODB_URI'], trust:'medium', exclude:['drop_collection','drop_database'], enabled:['find','insertOne','updateOne','deleteOne'], desc:'Document database access.', useWhen:'Repos using MongoDB.' },
  { key:'twilio-mcp', label:'Twilio', serverName:'twilio', pkg:'twilio-mcp-server@latest', auth:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN'], trust:'low', exclude:['delete_message'], enabled:['send_sms','list_messages','list_calls'], desc:'SMS, voice, and messaging.', useWhen:'Repos using Twilio.' },
  { key:'sendgrid-mcp', label:'SendGrid', serverName:'sendgrid', pkg:'sendgrid-mcp-server@latest', auth:['SENDGRID_API_KEY'], trust:'medium', exclude:[], enabled:['send_email','list_templates','get_stats'], desc:'Transactional email delivery.', useWhen:'Repos using SendGrid.' },
  { key:'algolia-mcp', label:'Algolia Search', serverName:'algolia', pkg:'algolia-mcp-server@latest', auth:['ALGOLIA_APP_ID','ALGOLIA_API_KEY'], trust:'medium', exclude:['delete_index'], enabled:['search','list_indices','get_index'], desc:'Search indexing via Algolia.', useWhen:'Repos using Algolia.' },
  { key:'planetscale-mcp', label:'PlanetScale', serverName:'planetscale', pkg:'planetscale-mcp-server@latest', auth:['PLANETSCALE_TOKEN'], trust:'medium', exclude:['delete_database'], enabled:['list_databases','list_branches','execute_query'], desc:'Serverless MySQL via PlanetScale.', useWhen:'Repos on PlanetScale.' },
  { key:'neon-mcp', label:'Neon Serverless Postgres', serverName:'neon', pkg:'@neondatabase/mcp-server-neon@latest', auth:['NEON_API_KEY'], trust:'medium', exclude:['delete_project'], enabled:['list_projects','list_branches','execute_sql'], desc:'Serverless Postgres via Neon.', useWhen:'Repos using Neon.' },
  { key:'turso-mcp', label:'Turso Edge SQLite', serverName:'turso', pkg:'turso-mcp-server@latest', auth:['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN'], trust:'medium', exclude:['destroy_database'], enabled:['execute_query','list_tables'], desc:'Edge SQLite via Turso.', useWhen:'Repos using Turso.' },
  { key:'upstash-mcp', label:'Upstash Redis+Kafka', serverName:'upstash', pkg:'@upstash/mcp-server@latest', auth:['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'], trust:'medium', exclude:[], enabled:['redis_get','redis_set','redis_del'], desc:'Serverless Redis and Kafka.', useWhen:'Repos using Upstash.' },
  { key:'convex-mcp', label:'Convex', serverName:'convex', pkg:'@convex-dev/mcp-server@latest', auth:['CONVEX_DEPLOYMENT'], trust:'medium', exclude:['delete_deployment'], enabled:['run_query','run_mutation','list_functions'], desc:'Reactive backend via Convex.', useWhen:'Repos using Convex.' },
  { key:'clerk-mcp', label:'Clerk Authentication', serverName:'clerk', pkg:'@clerk/mcp-server@latest', auth:['CLERK_SECRET_KEY'], trust:'medium', exclude:['delete_user'], enabled:['list_users','get_user','create_user'], desc:'User auth via Clerk.', useWhen:'Repos using Clerk.' },
  { key:'resend-mcp', label:'Resend Email', serverName:'resend', pkg:'resend-mcp-server@latest', auth:['RESEND_API_KEY'], trust:'medium', exclude:[], enabled:['send_email','list_domains','get_email'], desc:'Transactional email via Resend.', useWhen:'Repos using Resend.' },
  { key:'temporal-mcp', label:'Temporal Workflow', serverName:'temporal', pkg:'temporal-mcp-server@latest', auth:['TEMPORAL_ADDRESS'], trust:'medium', exclude:['terminate_workflow'], enabled:['list_workflows','get_workflow','signal_workflow'], desc:'Workflow orchestration via Temporal.', useWhen:'Repos using Temporal.' },
  { key:'launchdarkly-mcp', label:'LaunchDarkly', serverName:'launchdarkly', pkg:'launchdarkly-mcp-server@latest', auth:['LAUNCHDARKLY_ACCESS_TOKEN'], trust:'medium', exclude:['delete_flag'], enabled:['list_flags','get_flag','toggle_flag'], desc:'Feature flags via LaunchDarkly.', useWhen:'Repos using LaunchDarkly.' },
  { key:'datadog-mcp', label:'Datadog', serverName:'datadog', pkg:'@datadog/mcp-server@latest', auth:['DATADOG_API_KEY','DATADOG_APP_KEY'], trust:'medium', exclude:['delete_monitor'], enabled:['query_metrics','list_monitors','search_logs'], desc:'Monitoring and APM via Datadog.', useWhen:'Repos using Datadog.' },
  { key:'grafana-mcp', label:'Grafana', serverName:'grafana', pkg:'grafana-mcp-server@latest', auth:['GRAFANA_URL','GRAFANA_API_KEY'], trust:'medium', exclude:['delete_dashboard'], enabled:['list_dashboards','get_panel','query_datasource'], desc:'Dashboards via Grafana.', useWhen:'Repos using Grafana.' },
  { key:'circleci-mcp', label:'CircleCI', serverName:'circleci', pkg:'circleci-mcp-server@latest', auth:['CIRCLECI_TOKEN'], trust:'medium', exclude:['cancel_pipeline'], enabled:['list_pipelines','get_pipeline','list_jobs'], desc:'CI/CD via CircleCI.', useWhen:'Repos using CircleCI.' },
  { key:'anthropic-mcp', label:'Anthropic Claude API', serverName:'anthropic', pkg:'@anthropic-ai/mcp-server@latest', auth:['ANTHROPIC_API_KEY'], trust:'high', exclude:[], enabled:['create_message','list_models'], desc:'Claude API for AI-powered apps.', useWhen:'Repos building on Claude API.' },
];

const REC_LOGIC = `  // ── 23 new packs recommendation logic ────────────────────────────────────
  if (ctx) {
    if (hasDependency(deps, '@supabase/supabase-js') || hasDependency(deps, '@supabase/auth-helpers-nextjs') || hasFileContentMatch(ctx, '.env', /SUPABASE/i) || hasFileContentMatch(ctx, '.env.example', /SUPABASE/i)) recommended.add('supabase-mcp');
    if (hasFileContentMatch(ctx, 'schema.prisma', /\\S/) || hasDependency(deps, '@prisma/client') || hasDependency(deps, 'prisma')) recommended.add('prisma-mcp');
    if (ctx.files.includes('vercel.json') || hasFileContentMatch(ctx, 'package.json', /"deploy":\\s*"vercel/i) || hasFileContentMatch(ctx, '.env', /VERCEL_TOKEN/i)) recommended.add('vercel-mcp');
    if (hasFileContentMatch(ctx, 'wrangler.toml', /\\S/) || hasDependency(deps, 'wrangler') || hasFileContentMatch(ctx, '.env', /CLOUDFLARE/i)) recommended.add('cloudflare-mcp');
    if (hasFileContentMatch(ctx, '.env', /AWS_ACCESS_KEY/i) || ctx.files.some(f => /serverless\\.yml|template\\.ya?ml|cdk\\.json/.test(f))) recommended.add('aws-mcp');
    if (hasDependency(deps, 'redis') || hasDependency(deps, 'ioredis') || hasDependency(deps, '@redis/client') || hasFileContentMatch(ctx, '.env', /REDIS_URL/i)) recommended.add('redis-mcp');
    if (hasDependency(deps, 'mongoose') || hasDependency(deps, 'mongodb') || hasFileContentMatch(ctx, '.env', /MONGODB_URI/i)) recommended.add('mongodb-mcp');
    if (hasDependency(deps, 'twilio') || hasFileContentMatch(ctx, '.env', /TWILIO_/i)) recommended.add('twilio-mcp');
    if (hasDependency(deps, '@sendgrid/mail') || hasFileContentMatch(ctx, '.env', /SENDGRID_API_KEY/i)) recommended.add('sendgrid-mcp');
    if (hasDependency(deps, 'algoliasearch') || hasDependency(deps, '@algolia/client-search') || hasFileContentMatch(ctx, '.env', /ALGOLIA_/i)) recommended.add('algolia-mcp');
    if (hasFileContentMatch(ctx, '.env', /PLANETSCALE_TOKEN/i)) recommended.add('planetscale-mcp');
    if (hasDependency(deps, '@neondatabase/serverless') || hasFileContentMatch(ctx, '.env', /NEON_/i)) recommended.add('neon-mcp');
    if (hasDependency(deps, '@libsql/client') || hasFileContentMatch(ctx, '.env', /TURSO_/i)) recommended.add('turso-mcp');
    if (hasDependency(deps, '@upstash/redis') || hasDependency(deps, '@upstash/kafka') || hasFileContentMatch(ctx, '.env', /UPSTASH_/i)) recommended.add('upstash-mcp');
    if (hasDependency(deps, 'convex') || hasFileContentMatch(ctx, 'convex.json', /\\S/) || hasFileContentMatch(ctx, '.env', /CONVEX_/i)) recommended.add('convex-mcp');
    if (hasDependency(deps, '@clerk/nextjs') || hasDependency(deps, '@clerk/backend') || hasFileContentMatch(ctx, '.env', /CLERK_/i)) recommended.add('clerk-mcp');
    if (hasDependency(deps, 'resend') || hasFileContentMatch(ctx, '.env', /RESEND_API_KEY/i)) recommended.add('resend-mcp');
    if (hasDependency(deps, '@temporalio/client') || hasFileContentMatch(ctx, '.env', /TEMPORAL_/i)) recommended.add('temporal-mcp');
    if (hasDependency(deps, '@launchdarkly/node-server-sdk') || hasFileContentMatch(ctx, '.env', /LAUNCHDARKLY_/i)) recommended.add('launchdarkly-mcp');
    if (hasDependency(deps, 'dd-trace') || hasFileContentMatch(ctx, '.env', /DATADOG_/i)) recommended.add('datadog-mcp');
    if (hasFileContentMatch(ctx, 'docker-compose.yml', /grafana/i) || hasFileContentMatch(ctx, '.env', /GRAFANA_/i)) recommended.add('grafana-mcp');
    if (ctx.files.some(f => /\\.circleci\\/config/.test(f)) || hasFileContentMatch(ctx, '.env', /CIRCLECI_/i)) recommended.add('circleci-mcp');
    if (hasDependency(deps, '@anthropic-ai/sdk') || hasDependency(deps, 'anthropic') || hasFileContentMatch(ctx, '.env', /ANTHROPIC_API_KEY/i)) recommended.add('anthropic-mcp');
  }
`;

function q(arr) { return arr.map(a => `'${a}'`).join(', '); }

function makeJsonPack(m, envKeyFmt) {
  const envEntries = m.auth.map(k => `${k}: '${envKeyFmt(k)}'`).join(', ');
  const envStr = m.auth.length ? `, env: { ${envEntries} }` : '';
  return `  {
    key: '${m.key}', label: '${m.label}',
    description: '${m.desc}',
    useWhen: '${m.useWhen}',
    adoption: '${m.auth.length ? 'Requires: ' + m.auth.join(', ') + '.' : 'No auth required.'}',
    trustLevel: '${m.trust}', transport: 'stdio', requiredAuth: [${q(m.auth)}],
    serverName: '${m.serverName}',
    jsonProjection: { command: 'npx', args: ['-y', '${m.pkg}']${envStr} },
    excludeTools: [${q(m.exclude)}],
  },`;
}

function makeTomlPack(m) {
  const envEntries = m.auth.map(k => `${k}: '\${${k}}'`).join(', ');
  const envStr = m.auth.length ? `,\n      env: { ${envEntries} }` : '';
  return `  {
    key: '${m.key}', label: '${m.label}',
    description: '${m.desc}',
    useWhen: '${m.useWhen}',
    adoption: '${m.auth.length ? 'Requires: ' + m.auth.join(', ') + '.' : 'No auth required.'}',
    trustLevel: '${m.trust}', transport: 'stdio', requiredAuth: [${q(m.auth)}],
    serverName: '${m.serverName}',
    tomlProjection: { command: 'npx', args: ['-y', '${m.pkg}']${envStr} },
    enabledTools: [${q(m.enabled)}],
  },`;
}

function makeJsoncPack(m) {
  const envEntries = m.auth.map(k => `${k}: '\${${k}}'`).join(', ');
  const envStr = m.auth.length ? `, environment: { ${envEntries} }` : '';
  return `  {
    key: '${m.key}', label: '${m.label}',
    description: '${m.desc}',
    useWhen: '${m.useWhen}',
    adoption: '${m.auth.length ? 'Requires: ' + m.auth.join(', ') + '.' : 'No auth required.'}',
    trustLevel: '${m.trust}', transport: 'stdio', requiredAuth: [${q(m.auth)}],
    serverName: '${m.serverName}',
    jsoncProjection: { command: ['npx', '-y', '${m.pkg}']${envStr} },
    enabledTools: [${q(m.enabled)}],
  },`;
}

function makeAiderPack(m) {
  return `  {
    key: '${m.key}', label: '${m.label}',
    description: '${m.desc} Use /web command or configure in your editor MCP bridge.',
    useWhen: '${m.useWhen}',
    adoption: 'Aider has no native MCP. Use /web URL or editor bridge.',
    trustLevel: '${m.trust}', transport: 'editor-bridge',
    requiredAuth: [${q(m.auth)}],
    serverName: '${m.serverName}', configProjection: null,
    recommendation: 'Configure ${m.serverName} in editor MCP extension and use /web for docs.',
  },`;
}

const HEADER = '\n  // ── 23 new packs ─────────────────────────────────────────────────────────\n';
const HEADER_AIDER = '\n  // ── 23 new packs (Aider editor-bridge format) ────────────────────────────\n';

// ── windsurf ──
{
  let c = fs.readFileSync('src/windsurf/mcp-packs.js', 'utf8');
  const newPacks = HEADER + NEW_PACKS_META.map(m => makeJsonPack(m, k => `\${env:${k}}`)).join('\n');
  c = c.replace("huggingface-mcp-server'], env: { HF_TOKEN: '${env:HF_TOKEN}' } },\n    excludeTools: [],\n  },\n];",
    "huggingface-mcp-server'], env: { HF_TOKEN: '${env:HF_TOKEN}' } },\n    excludeTools: [],\n  }," + newPacks + "\n];");
  c = c.replace(
    "  if (domainKeys.has('ai-ml')) recommended.add('huggingface-mcp');\n  if (domainKeys.has('design-system')) recommended.add('figma-mcp');\n  if (recommended.size >= 2) recommended.add('mcp-security');",
    "  if (domainKeys.has('ai-ml')) recommended.add('huggingface-mcp');\n  if (domainKeys.has('design-system')) recommended.add('figma-mcp');\n" + REC_LOGIC + "  if (recommended.size >= 2) recommended.add('mcp-security');"
  );
  fs.writeFileSync('src/windsurf/mcp-packs.js', c);
  console.log('windsurf done');
}

// ── gemini ──
{
  let c = fs.readFileSync('src/gemini/mcp-packs.js', 'utf8');
  const newPacks = HEADER + NEW_PACKS_META.map(m => makeJsonPack(m, k => `\${${k}}`)).join('\n');
  c = c.replace("huggingface-mcp-server'], env: { HF_TOKEN: '${HF_TOKEN}' } },\n    excludeTools: [],\n  },\n];",
    "huggingface-mcp-server'], env: { HF_TOKEN: '${HF_TOKEN}' } },\n    excludeTools: [],\n  }," + newPacks + "\n];");
  c = c.replace(
    "  // Note: Gemini CLI has built-in web search, so no separate search MCP pack is needed.\n\n  return GEMINI_MCP_PACKS",
    "  // Note: Gemini CLI has built-in web search, so no separate search MCP pack is needed.\n" + REC_LOGIC + "\n  return GEMINI_MCP_PACKS"
  );
  fs.writeFileSync('src/gemini/mcp-packs.js', c);
  console.log('gemini done');
}

// ── copilot ──
{
  let c = fs.readFileSync('src/copilot/mcp-packs.js', 'utf8');
  const newPacks = HEADER + NEW_PACKS_META.map(m => {
    const envEntries = m.auth.map(k => `${k}: '\${env:${k}}'`).join(', ');
    const envStr = m.auth.length ? `, env: { ${envEntries} }` : '';
    return `  {
    key: '${m.key}', label: '${m.label}',
    description: '${m.desc}',
    useWhen: '${m.useWhen}',
    adoption: '${m.auth.length ? 'Requires: ' + m.auth.join(', ') + '.' : 'No auth required.'}',
    trustLevel: '${m.trust}', transport: 'stdio', requiredAuth: [${q(m.auth)}],
    serverName: '${m.serverName}',
    jsonProjection: { command: 'npx', args: ['-y', '${m.pkg}']${envStr} },
    excludeTools: [${q(m.exclude)}],
    cloudAgentCompatible: true,
  },`;
  }).join('\n');
  c = c.replace("'huggingface-mcp'];\n  if (recommended.size >= 2)", "'huggingface-mcp'];\n" + REC_LOGIC + "  if (recommended.size >= 2)");
  // Find the last pack ending before ];
  const lastPackEnd = "cloudAgentCompatible: true,\n  },\n];";
  if (c.includes(lastPackEnd)) {
    c = c.replace(lastPackEnd, "cloudAgentCompatible: true,\n  }," + newPacks + "\n];");
  }
  fs.writeFileSync('src/copilot/mcp-packs.js', c);
  console.log('copilot done');
}

// ── codex ──
{
  let c = fs.readFileSync('src/codex/mcp-packs.js', 'utf8');
  const newPacks = HEADER + NEW_PACKS_META.map(makeTomlPack).join('\n');
  c = c.replace("huggingface-mcp-server'], env: { HF_TOKEN: '${HF_TOKEN}' } },\n    enabledTools: ['search_models', 'get_model_info', 'search_datasets'],\n  },\n];",
    "huggingface-mcp-server'], env: { HF_TOKEN: '${HF_TOKEN}' } },\n    enabledTools: ['search_models', 'get_model_info', 'search_datasets'],\n  }," + newPacks + "\n];");
  // Add rec logic before "Infisical" comment
  c = c.replace("  // Infisical", REC_LOGIC + "  // Infisical");
  fs.writeFileSync('src/codex/mcp-packs.js', c);
  console.log('codex done');
}

// ── opencode ──
{
  let c = fs.readFileSync('src/opencode/mcp-packs.js', 'utf8');
  const newPacks = HEADER + NEW_PACKS_META.map(makeJsoncPack).join('\n');
  c = c.replace("huggingface-mcp-server'], environment: { HF_TOKEN: '${HF_TOKEN}' } },\n    enabledTools: ['search_models', 'get_model_info', 'search_datasets'],\n  },\n];",
    "huggingface-mcp-server'], environment: { HF_TOKEN: '${HF_TOKEN}' } },\n    enabledTools: ['search_models', 'get_model_info', 'search_datasets'],\n  }," + newPacks + "\n];");
  // Add rec logic
  const ocTarget = "  // Infisical";
  if (c.includes(ocTarget)) {
    c = c.replace(ocTarget, REC_LOGIC + ocTarget);
  }
  fs.writeFileSync('src/opencode/mcp-packs.js', c);
  console.log('opencode done');
}

// ── aider ──
{
  let c = fs.readFileSync('src/aider/mcp-packs.js', 'utf8');
  const newPacks = HEADER_AIDER + NEW_PACKS_META.map(makeAiderPack).join('\n');
  c = c.replace(
    "    recommendation: 'Use /web <url> to pull documentation into the Aider chat context.',\n  },\n];",
    "    recommendation: 'Use /web <url> to pull documentation into the Aider chat context.',\n  }," + newPacks + "\n];"
  );
  fs.writeFileSync('src/aider/mcp-packs.js', c);
  console.log('aider done');
}

console.log('All platforms done!');
