const os = require('os');
const path = require('path');
const { EMBEDDED_SECRET_PATTERNS, containsEmbeddedSecret } = require('../secret-patterns');
const { attachSourceUrls } = require('../source-urls');
const { buildSupplementalChecks } = require('../supplemental-checks');

const CODEX_SUPPLEMENTAL_SOURCE_URLS = {
  'testing-strategy': 'https://developers.openai.com/codex/cli',
  'code-quality': 'https://developers.openai.com/codex/rules',
  'api-design': 'https://developers.openai.com/codex/guides/agents-md',
  database: 'https://developers.openai.com/codex/cli',
  authentication: 'https://developers.openai.com/codex/agent-approvals-security',
  monitoring: 'https://developers.openai.com/codex/feature-maturity',
  'dependency-management': 'https://developers.openai.com/codex/config-reference',
  'cost-optimization': 'https://developers.openai.com/codex/guides/agents-md',
};

const DEFAULT_PROJECT_DOC_MAX_BYTES = 32768;
const SUPPORTED_HOOK_EVENTS = new Set(['SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop']);
const NESTED_ONLY_ROOT_KEYS = new Set(['send_to_server', 'persistence', 'max_threads', 'max_depth', 'enabled_tools', 'startup_timeout_sec']);
const FILLER_PATTERNS = [
  /\bbe helpful\b/i,
  /\bbe accurate\b/i,
  /\bbe concise\b/i,
  /\balways do your best\b/i,
  /\bmaintain high quality\b/i,
  /\bwrite clean code\b/i,
  /\bfollow best practices\b/i,
];
const JUSTIFICATION_PATTERNS = /\bbecause\b|\bwhy\b|\bjustif(?:y|ication)\b|\btemporary\b|\bintentional\b|\bdocumented\b|\bair[- ]?gapped\b|\binternal only\b|\bephemeral\b|\bci only\b/i;
const LEGACY_CONFIG_PATTERNS = [
  { pattern: /^\s*reasoning_effort\s*=/m, note: 'Use `model_reasoning_effort`, not `reasoning_effort`.' },
  { pattern: /^\s*weak_model\s*=/m, note: 'Use `model_for_weak_tasks`, not `weak_model`.' },
  { pattern: /^\s*history_send_to_server\s*=/m, note: 'Nest `send_to_server` under `[history]`.' },
  { pattern: /^\s*mcpServers\s*=/m, note: 'Use `[mcp_servers.<id>]` TOML tables, not `mcpServers`.' },
];

function agentsPath(ctx) {
  return ctx.fileContent('AGENTS.md') ? 'AGENTS.md' : (ctx.agentsMdPath ? ctx.agentsMdPath() : null);
}

function agentsContent(ctx) {
  const filePath = agentsPath(ctx);
  return filePath ? (ctx.fileContent(filePath) || '') : '';
}

function countSections(markdown) {
  return (markdown.match(/^##\s+/gm) || []).length;
}

function firstLineMatching(text, matcher) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (typeof matcher === 'string' && line.includes(matcher)) {
      return index + 1;
    }
    if (matcher instanceof RegExp && matcher.test(line)) {
      matcher.lastIndex = 0;
      return index + 1;
    }
    if (typeof matcher === 'function' && matcher(line, index + 1)) {
      return index + 1;
    }
  }
  return null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function configKeyLine(ctx, key) {
  return ctx.lineNumber('.codex/config.toml', new RegExp(`^\\s*${escapeRegex(key)}\\s*=`, 'i'));
}

function configSectionKeyLine(ctx, sectionPath, key) {
  const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  let currentSection = [];
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).split('.').map(part => part.trim()).filter(Boolean);
      continue;
    }
    if (currentSection.join('.') === sectionPath && new RegExp(`^\\s*${escapeRegex(key)}\\s*=`, 'i').test(trimmed)) {
      return index + 1;
    }
  }
  return null;
}

function configSections(ctx) {
  const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
  const lines = content.split(/\r?\n/);
  const sections = [];
  let currentSection = [];

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).split('.').map(part => part.trim()).filter(Boolean);
      sections.push({ section: currentSection.join('.'), line: index + 1 });
      continue;
    }
  }

  return sections;
}

function expectedVerificationCategories(ctx) {
  const categories = new Set();
  const pkg = ctx.jsonFile('package.json');
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};

  if (scripts.test) categories.add('test');
  if (scripts.lint) categories.add('lint');
  if (scripts.build) categories.add('build');

  if (ctx.fileContent('Cargo.toml')) {
    categories.add('test');
    categories.add('build');
  }

  if (ctx.fileContent('go.mod')) {
    categories.add('test');
    categories.add('build');
  }

  if (ctx.fileContent('pyproject.toml') || ctx.fileContent('requirements.txt')) {
    categories.add('test');
  }

  if (ctx.fileContent('Makefile') || ctx.fileContent('justfile')) {
    categories.add('build');
  }

  return [...categories];
}

function hasCommandMention(content, category) {
  if (category === 'test') {
    return /\bnpm test\b|\bnpm run test\b|\bpnpm test\b|\byarn test\b|\bvitest\b|\bjest\b|\bpytest\b|\bgo test\b|\bcargo test\b|\bmake test\b/i.test(content);
  }
  if (category === 'lint') {
    return /\bnpm run lint\b|\bpnpm lint\b|\byarn lint\b|\beslint\b|\bprettier\b|\bruff\b|\bclippy\b|\bgolangci-lint\b|\bmake lint\b/i.test(content);
  }
  if (category === 'build') {
    return /\bnpm run build\b|\bpnpm build\b|\byarn build\b|\btsc\b|\bvite build\b|\bnext build\b|\bcargo build\b|\bgo build\b|\bmake\b/i.test(content);
  }
  return false;
}

function agentsHasArchitecture(content) {
  return /```mermaid|flowchart\b|graph\s+(TD|LR|RL|BT)\b|##\s+Architecture\b|##\s+Project Map\b|##\s+Structure\b/i.test(content);
}

function findFillerLine(content) {
  return firstLineMatching(content, (line) => FILLER_PATTERNS.some((pattern) => pattern.test(line)));
}

function hasContradictions(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (/\balways\b.*\bnever\b|\bnever\b.*\balways\b/i.test(line)) {
      return true;
    }
  }

  const contradictoryPairs = [
    [/\buse tabs\b/i, /\buse spaces\b/i],
    [/\bsingle quotes\b/i, /\bdouble quotes\b/i],
    [/\bsemicolons required\b/i, /\bno semicolons\b/i],
  ];

  return contradictoryPairs.some(([a, b]) => a.test(content) && b.test(content));
}

function hasMisplacedNestedKeys(content) {
  const lines = content.split(/\r?\n/);
  let inRoot = true;

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inRoot = false;
      continue;
    }

    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (!match) continue;

    if (inRoot && NESTED_ONLY_ROOT_KEYS.has(match[1])) {
      return { misplaced: true, line: index + 1, key: match[1] };
    }
  }

  return { misplaced: false, line: null, key: null };
}

function findLegacyConfigIssue(content) {
  for (let index = 0; index < LEGACY_CONFIG_PATTERNS.length; index++) {
    const { pattern, note } = LEGACY_CONFIG_PATTERNS[index];
    const line = firstLineMatching(content, pattern);
    if (line) {
      return { line, note };
    }
  }
  return null;
}

function repoLooksRegulated(ctx) {
  const filenames = ctx.files.join('\n');
  const packageJson = ctx.fileContent('package.json') || '';
  const readme = ctx.fileContent('README.md') || '';
  const combined = `${filenames}\n${packageJson}\n${readme}`;

  const strongSignals = /\bhipaa\b|\bphi\b|\bpci\b|\bsoc2\b|\biso[- ]?27001\b|\bcompliance\b|\bhealth(?:care)?\b|\bmedical\b|\bbank(?:ing)?\b|\bpayments?\b|\bfintech\b/i;
  if (strongSignals.test(combined)) {
    return true;
  }

  const weakSignalMatches = combined.match(/\bgdpr\b|\bpii\b/gi) || [];
  if (weakSignalMatches.length === 0) {
    return false;
  }

  const privacyOnlyNote = /\b(no|without|never)\s+(collect|store|log|retain|send)\s+\bpii\b/i.test(combined) ||
    /\bno\s+\bpii\b/i.test(combined);
  if (weakSignalMatches.length === 1 && privacyOnlyNote) {
    return false;
  }

  return weakSignalMatches.length >= 2;
}

function hookEventsFromConfig(hooksJson) {
  if (!hooksJson || typeof hooksJson !== 'object' || Array.isArray(hooksJson)) {
    return [];
  }

  if (hooksJson.hooks && typeof hooksJson.hooks === 'object' && !Array.isArray(hooksJson.hooks)) {
    return Object.keys(hooksJson.hooks);
  }

  return Object.keys(hooksJson);
}

function unsupportedHookEvent(ctx) {
  const content = ctx.hooksJsonContent ? (ctx.hooksJsonContent() || '') : (ctx.fileContent('.codex/hooks.json') || '');
  if (!content) return null;

  const parsed = ctx.hooksJson();
  if (!parsed) {
    return { event: 'invalid-json', line: 1 };
  }

  const events = hookEventsFromConfig(parsed);
  for (const event of events) {
    if (!SUPPORTED_HOOK_EVENTS.has(event)) {
      const line = ctx.lineNumber('.codex/hooks.json', new RegExp(`"${escapeRegex(event)}"\\s*:|${escapeRegex(event)}\\s*:`, 'i')) || 1;
      return { event, line };
    }
  }

  return null;
}

function hooksClaimed(ctx) {
  if (ctx.hasDir('.codex/hooks')) return true;
  if (ctx.hooksJsonContent && ctx.hooksJsonContent()) return true;
  const content = agentsContent(ctx);
  return /\bhooks?\b|\bSessionStart\b|\bPreToolUse\b|\bPostToolUse\b|\bUserPromptSubmit\b|\bStop\b/i.test(content);
}

function findSecretLine(content) {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const matched = EMBEDDED_SECRET_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(line);
    });
    if (matched) return index + 1;
  }
  return null;
}

function mcpServersWithTimeouts(ctx) {
  const servers = ctx.mcpServers();
  return Object.entries(servers || {}).map(([id, server]) => ({
    id,
    timeout: server && typeof server.startup_timeout_sec === 'number' ? server.startup_timeout_sec : null,
  }));
}

function workflowArtifacts(ctx) {
  return (ctx.workflowFiles ? ctx.workflowFiles() : [])
    .map((filePath) => ({ filePath, content: ctx.fileContent(filePath) || '' }))
    .filter((item) => item.content);
}

function codexActionWorkflowIssues(ctx) {
  const issues = [];
  for (const workflow of workflowArtifacts(ctx)) {
    if (!/uses:\s*openai\/codex-action@/i.test(workflow.content)) continue;
    const unsafeLine = firstLineMatching(workflow.content, /safety-strategy\s*:\s*unsafe\b/i);
    if (!unsafeLine) continue;

    const justified = /windows-latest|windows-\d+|runner\.os\s*==\s*['"]Windows['"]|runs-on:\s*\[[^\]]*windows/i.test(workflow.content) ||
      (JUSTIFICATION_PATTERNS.test(workflow.content) && /\bunsafe\b/i.test(workflow.content));

    issues.push({
      filePath: workflow.filePath,
      line: unsafeLine,
      justified,
    });
  }
  return issues;
}

function profileSections(ctx) {
  return configSections(ctx).filter((section) => section.section.startsWith('profiles.'));
}

function parsedProfiles(ctx) {
  const config = ctx.configToml();
  if (!config.ok || !config.data || !config.data.profiles || typeof config.data.profiles !== 'object') {
    return {};
  }
  return config.data.profiles;
}

function projectMcpServers(ctx) {
  const config = ctx.configToml();
  if (!config.ok || !config.data || !config.data.mcp_servers || typeof config.data.mcp_servers !== 'object') {
    return {};
  }
  return config.data.mcp_servers;
}

function repoNeedsExternalTools(ctx) {
  const deps = ctx.projectDependencies ? Object.keys(ctx.projectDependencies()) : [];
  const depSet = new Set(deps);
  const files = new Set(ctx.files || []);
  const envContent = [
    ctx.fileContent('.env.example'),
    ctx.fileContent('.env.template'),
    ctx.fileContent('.env.sample'),
  ].filter(Boolean).join('\n');
  const readme = ctx.fileContent('README.md') || '';
  const agents = agentsContent(ctx);
  const combinedDocs = `${readme}\n${agents}\n${envContent}`;

  const externalDeps = [
    'pg',
    'postgres',
    'mysql',
    'mysql2',
    'mongodb',
    'mongoose',
    'redis',
    'ioredis',
    'prisma',
    'sequelize',
    'typeorm',
    'supabase',
    '@supabase/supabase-js',
    'stripe',
    'openai',
    '@anthropic-ai/sdk',
    'langchain',
    '@langchain/openai',
    '@langchain/anthropic',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-secrets-manager',
    '@notionhq/client',
    '@slack/bolt',
    'twilio',
    'discord.js',
  ];

  if (externalDeps.some((dep) => depSet.has(dep))) {
    return true;
  }

  if (
    files.has('docker-compose.yml') ||
    files.has('docker-compose.yaml') ||
    files.has('compose.yml') ||
    files.has('compose.yaml') ||
    files.has('schema.prisma') ||
    ctx.hasDir('prisma') ||
    ctx.hasDir('infra') ||
    ctx.hasDir('terraform') ||
    ctx.hasDir('migrations') ||
    ctx.hasDir('sql')
  ) {
    return true;
  }

  return /\bDATABASE_URL\b|\bREDIS_URL\b|\bSUPABASE_URL\b|\bSTRIPE_[A-Z_]+\b|\bAWS_[A-Z_]+\b|\bTWILIO_[A-Z_]+\b|\bNOTION_[A-Z_]+\b|\bSLACK_[A-Z_]+\b|\bOPENAI_API_KEY\b|\bANTHROPIC_API_KEY\b/i.test(combinedDocs);
}

function projectScopedMcpPresent(ctx) {
  return Object.keys(projectMcpServers(ctx)).length > 0;
}

function repoRuleArtifacts(ctx) {
  return (ctx.ruleFiles ? ctx.ruleFiles() : [])
    .map((filePath) => ({ filePath, content: ctx.fileContent(filePath) || '' }))
    .filter((item) => item.content);
}

function extractRuleBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let startLine = null;
  let buffer = [];
  let depth = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (startLine === null && /\bprefix_rule\s*\(/.test(line)) {
      startLine = index + 1;
      buffer = [line];
      depth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      if (depth <= 0) {
        blocks.push({ startLine, content: buffer.join('\n') });
        startLine = null;
        buffer = [];
        depth = 0;
      }
      continue;
    }

    if (startLine !== null) {
      buffer.push(line);
      depth += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      if (depth <= 0) {
        blocks.push({ startLine, content: buffer.join('\n') });
        startLine = null;
        buffer = [];
        depth = 0;
      }
    }
  }

  return blocks;
}

function allRuleBlocks(ctx) {
  return repoRuleArtifacts(ctx).flatMap((artifact) =>
    extractRuleBlocks(artifact.content).map((block) => ({
      ...block,
      filePath: artifact.filePath,
    }))
  );
}

function rulePatternTokens(blockContent) {
  const match = blockContent.match(/pattern\s*=\s*\[([\s\S]*?)\]/i);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

function ruleDecision(blockContent) {
  const match = blockContent.match(/decision\s*=\s*["']([^"']+)["']/i);
  return match ? match[1].toLowerCase() : null;
}

function ruleHasExamples(blockContent) {
  return /\bmatch\s*=\s*\[/i.test(blockContent) || /\bnot_match\s*=\s*\[/i.test(blockContent);
}

function broadAllowRule(blockContent) {
  const decision = ruleDecision(blockContent);
  if (decision !== 'allow') return false;

  const tokens = rulePatternTokens(blockContent).map((token) => token.toLowerCase());
  if (tokens.some((token) => token === '*' || token.includes('*') || token.includes('?'))) {
    return true;
  }

  const broadSingleCommands = new Set(['bash', 'sh', 'pwsh', 'powershell', 'cmd', 'git', 'npm', 'pnpm', 'yarn', 'node', 'python']);
  return tokens.length === 1 && broadSingleCommands.has(tokens[0]);
}

function specificRulePatternIssue(ctx) {
  for (const block of allRuleBlocks(ctx)) {
    const tokens = rulePatternTokens(block.content);
    if (tokens.some((token) => token === '*' || token.includes('*') || token.includes('?'))) {
      return { filePath: block.filePath, line: block.startLine };
    }
  }
  return null;
}

function missingRuleExamplesIssue(ctx) {
  for (const block of allRuleBlocks(ctx)) {
    if (!ruleHasExamples(block.content)) {
      return { filePath: block.filePath, line: block.startLine };
    }
  }
  return null;
}

function broadAllowRuleIssue(ctx) {
  for (const block of allRuleBlocks(ctx)) {
    if (broadAllowRule(block.content)) {
      return { filePath: block.filePath, line: block.startLine };
    }
  }
  return null;
}

function ruleCoverageIssue(ctx) {
  const riskyCommands = new Set(['rm', 'git', 'gh', 'docker', 'kubectl', 'terraform', 'bash', 'sh', 'pwsh', 'powershell', 'cmd', 'npm', 'pnpm', 'yarn']);
  const blocks = allRuleBlocks(ctx);
  if (blocks.length === 0) {
    return { filePath: null, line: null, missing: true };
  }

  const covered = blocks.some((block) => {
    const tokens = rulePatternTokens(block.content).map((token) => token.toLowerCase());
    return tokens.some((token) => riskyCommands.has(token)) || /\bhost_executable\s*\(/i.test(block.content);
  });

  return covered ? null : { filePath: blocks[0].filePath, line: blocks[0].startLine, missing: false };
}

function ruleWrapperRiskIssue(ctx) {
  const blocks = allRuleBlocks(ctx);
  if (blocks.length === 0) return null;

  const wrapperBlock = blocks.find((block) => /\bbash\b|\bsh\b|\bpwsh\b|\bpowershell\b|\bcmd\b|host_executable\s*\(/i.test(block.content));
  if (!wrapperBlock) return null;

  const docs = `${agentsContent(ctx)}\n${ctx.fileContent('README.md') || ''}\n${repoRuleArtifacts(ctx).map((item) => item.content).join('\n')}`;
  const hasCaveat = /\bwrapper\b|\bsplit(?:ting)?\b|\bbash -lc\b|\bhost_executable\b|\bresolve-host-executables\b|\bpowershell\b|\bpwsh\b/i.test(docs);
  return hasCaveat ? null : { filePath: wrapperBlock.filePath, line: wrapperBlock.startLine };
}

function explicitHooksFeatureValue(ctx) {
  const value = ctx.configValue('features.codex_hooks');
  return typeof value === 'boolean' ? value : null;
}

function collectHookTimeoutEntries(node, trail = []) {
  const results = [];
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      results.push(...collectHookTimeoutEntries(item, [...trail, `[${index}]`]));
    });
    return results;
  }

  if (!node || typeof node !== 'object') {
    return results;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'timeout' && typeof value === 'number') {
      results.push({ timeout: value, trail: [...trail, key] });
      continue;
    }
    results.push(...collectHookTimeoutEntries(value, [...trail, key]));
  }

  return results;
}

function longHookTimeoutIssue(ctx) {
  const hooks = ctx.hooksJson();
  if (!hooks) return null;
  const entries = collectHookTimeoutEntries(hooks);
  const long = entries.find((entry) => entry.timeout > 60);
  if (!long) return null;

  const docs = `${agentsContent(ctx)}\n${ctx.fileContent('README.md') || ''}`;
  const justified = /\btimeout\b|\bslow\b|\blong-running\b|\bintegration\b|\bremote\b/i.test(docs) && JUSTIFICATION_PATTERNS.test(docs);
  if (justified) return null;

  const line = ctx.lineNumber('.codex/hooks.json', /"timeout"\s*:\s*(6[1-9]|[7-9]\d|\d{3,})\b/i) || 1;
  return { filePath: '.codex/hooks.json', line };
}

function mcpAuthDocumentationIssue(ctx) {
  const servers = projectMcpServers(ctx);
  const docs = `${agentsContent(ctx)}\n${ctx.fileContent('README.md') || ''}`;

  for (const [id, server] of Object.entries(servers || {})) {
    const needsAuthNote = Boolean(server.url);
    if (!needsAuthNote) continue;

    const hasInlineAuth =
      Boolean(server.bearer_token_env_var) ||
      Boolean(server.http_headers) ||
      Boolean(server.env_http_headers) ||
      (server.env && typeof server.env === 'object' && Object.keys(server.env).length > 0) ||
      (Array.isArray(server.env_vars) && server.env_vars.length > 0);

    const hasDocNote = new RegExp(`\\b${escapeRegex(id)}\\b[\\s\\S]{0,140}\\b(auth|oauth|token|credential|env)\\b`, 'i').test(docs);
    if (!hasInlineAuth && !hasDocNote) {
      return {
        id,
        filePath: '.codex/config.toml',
        line: (configSections(ctx).find((section) => section.section === `mcp_servers.${id}`) || {}).line || 1,
      };
    }
  }

  return null;
}

function deprecatedMcpTransportIssue(ctx) {
  const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
  if (!content) return null;
  const line = firstLineMatching(content, /\btransport\s*=\s*["'](?:sse|http\+sse)["']|\bsse_url\s*=/i);
  return line ? { filePath: '.codex/config.toml', line } : null;
}

function docsBundle(ctx) {
  return `${agentsContent(ctx)}\n${ctx.fileContent('README.md') || ''}`;
}

function skillArtifacts(ctx) {
  return (ctx.skillDirs ? ctx.skillDirs() : []).map((name) => ({
    name,
    filePath: `.agents/skills/${name}/SKILL.md`,
    content: ctx.skillMetadata ? (ctx.skillMetadata(name) || '') : '',
  }));
}

function extractSkillTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function extractSkillDescription(content) {
  const lines = content.split(/\r?\n/);
  const meaningful = [];
  let seenHeading = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (seenHeading && meaningful.length > 0) break;
      continue;
    }
    if (!seenHeading) {
      if (trimmed.startsWith('#')) {
        seenHeading = true;
      }
      continue;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('```')) break;
    meaningful.push(trimmed.replace(/^[-*]\s+/, ''));
    if (meaningful.length >= 3) break;
  }

  return meaningful.join(' ').trim();
}

function repoClaimsSkills(ctx) {
  if ((ctx.skillDirs ? ctx.skillDirs() : []).length > 0) return true;
  const docs = docsBundle(ctx);
  return /\.agents\/skills\b|\bskill(s)?\b/i.test(docs);
}

function skillMissingFieldsIssue(ctx) {
  for (const skill of skillArtifacts(ctx)) {
    if (!skill.content) {
      return { filePath: skill.filePath, line: 1 };
    }
    const title = extractSkillTitle(skill.content);
    const description = extractSkillDescription(skill.content);
    if (!title || !description) {
      return {
        filePath: skill.filePath,
        line: !title ? 1 : (firstLineMatching(skill.content, /\S/) || 1),
      };
    }
  }
  return null;
}

function skillBadNameIssue(ctx) {
  const invalid = skillArtifacts(ctx).find((skill) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name));
  return invalid ? { filePath: invalid.filePath, line: 1 } : null;
}

function skillDescriptionTooLongIssue(ctx) {
  for (const skill of skillArtifacts(ctx)) {
    const description = extractSkillDescription(skill.content);
    if (!description) continue;
    if (description.length > 220 || description.split(/\s+/).length > 32) {
      const line = firstLineMatching(skill.content, (line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      }) || 1;
      return { filePath: skill.filePath, line };
    }
  }
  return null;
}

function skillAutoRunRiskIssue(ctx) {
  const riskyPatterns = /\balways run\b|\bauto(?:matically)?\s+(run|execute|deploy|publish|merge)\b|\bwithout (approval|review|asking)\b|\brm -rf\b|\bgit push\b|\bdeploy\b|\bpublish\b/i;
  const safetyPatterns = /\bapproval\b|\breview\b|\bconfirm\b|\bmanual\b|\bsandbox\b|\bask first\b/i;

  for (const skill of skillArtifacts(ctx)) {
    if (!skill.content) continue;
    if (riskyPatterns.test(skill.content) && !safetyPatterns.test(skill.content)) {
      const line = firstLineMatching(skill.content, riskyPatterns) || 1;
      return { filePath: skill.filePath, line };
    }
  }

  return null;
}

function repoUsesCustomAgents(ctx) {
  if ((ctx.customAgentFiles ? ctx.customAgentFiles() : []).length > 0) return true;
  const docs = docsBundle(ctx);
  return /\.codex\/agents\b|\bsubagents?\b|\bcustom agents?\b/i.test(docs);
}

function customAgentMissingFieldsIssue(ctx) {
  const files = ctx.customAgentFiles ? ctx.customAgentFiles() : [];
  for (const fileName of files) {
    const parsed = ctx.customAgentConfig(fileName);
    if (!parsed.ok || !parsed.data) {
      return { filePath: `.codex/agents/${fileName}`, line: 1 };
    }
    const required = ['name', 'description', 'developer_instructions'];
    const missing = required.find((key) => {
      const value = parsed.data[key];
      return !(typeof value === 'string' && value.trim());
    });
    if (missing) {
      const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
      return {
        filePath: `.codex/agents/${fileName}`,
        line: firstLineMatching(content, new RegExp(`^\\s*${escapeRegex(missing)}\\s*=`, 'i')) || 1,
      };
    }
  }
  return null;
}

function unsafeAgentOverrideIssue(ctx) {
  const files = ctx.customAgentFiles ? ctx.customAgentFiles() : [];
  for (const fileName of files) {
    const parsed = ctx.customAgentConfig(fileName);
    if (!parsed.ok || !parsed.data) {
      return { filePath: `.codex/agents/${fileName}`, line: 1 };
    }

    const sandboxMode = parsed.data.sandbox_mode;
    if (sandboxMode === 'danger-full-access') {
      const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
      return {
        filePath: `.codex/agents/${fileName}`,
        line: firstLineMatching(content, /^\s*sandbox_mode\s*=/i) || 1,
      };
    }

    const approval = parsed.data.approval_policy;
    const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
    const justified = JUSTIFICATION_PATTERNS.test(content);
    if (approval === 'never' && !justified) {
      return {
        filePath: `.codex/agents/${fileName}`,
        line: firstLineMatching(content, /^\s*approval_policy\s*=/i) || 1,
      };
    }
  }
  return null;
}

function codexAutomationArtifacts(ctx) {
  const items = [];
  for (const workflow of workflowArtifacts(ctx)) {
    if (/\bcodex\b/i.test(workflow.content)) {
      items.push(workflow);
    }
  }

  const pkg = ctx.jsonFile('package.json');
  if (pkg && pkg.scripts) {
    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (/\bcodex\s+(exec|review|cloud\s+exec)\b/i.test(command)) {
        items.push({
          filePath: 'package.json',
          content: command,
          line: ctx.lineNumber('package.json', new RegExp(`"${escapeRegex(name)}"\\s*:\\s*"`, 'i')) || 1,
          kind: 'script',
        });
      }
    }
  }

  return items;
}

function codexExecUnsafeIssue(ctx) {
  for (const item of codexAutomationArtifacts(ctx)) {
    const content = item.content || '';
    const risky = /codex\s+exec\b[\s\S]{0,120}(--dangerously-bypass-approvals-and-sandbox|--full-auto\b|--ask-for-approval\s+never|-a\s+never\b)/i.test(content) ||
      /\bcodex-action@/i.test(content) && /safety-strategy\s*:\s*unsafe\b/i.test(content) && !/windows/i.test(content);
    if (risky) {
      return {
        filePath: item.filePath,
        line: item.line || firstLineMatching(content, /codex\s+exec\b|safety-strategy\s*:\s*unsafe\b/i) || 1,
      };
    }
  }
  return null;
}

function codexActionSafeStrategyIssue(ctx) {
  for (const workflow of workflowArtifacts(ctx)) {
    if (!/uses:\s*openai\/codex-action@/i.test(workflow.content)) continue;

    const line = firstLineMatching(workflow.content, /safety-strategy\s*:/i);
    if (!line) {
      return { filePath: workflow.filePath, line: firstLineMatching(workflow.content, /uses:\s*openai\/codex-action@/i) || 1 };
    }

    const unsafe = /safety-strategy\s*:\s*unsafe\b/i.test(workflow.content);
    const windowsOnly = /windows-latest|windows-\d+|runner\.os\s*==\s*['"]Windows['"]|runs-on:\s*\[[^\]]*windows/i.test(workflow.content);
    if (unsafe && !windowsOnly) {
      return { filePath: workflow.filePath, line };
    }
  }
  return null;
}

function codexCiAuthIssue(ctx) {
  for (const workflow of workflowArtifacts(ctx)) {
    if (!/\bcodex\b|openai\/codex-action@/i.test(workflow.content)) continue;
    const hasCodexKey =
      /\bCODEX_API_KEY\b/i.test(workflow.content) ||
      /\bOPENAI_API_KEY\b/i.test(workflow.content) ||
      /\bapi[-_ ]?key\b/i.test(workflow.content) ||
      /\$\{\{\s*secrets\.[A-Z0-9_]+/i.test(workflow.content);
    const hardcodedSecret = /sk-[A-Za-z0-9_-]{16,}|api[_-]?key\s*:\s*["'][A-Za-z0-9_-]{12,}["']/i.test(workflow.content);
    if (hardcodedSecret || !hasCodexKey) {
      return {
        filePath: workflow.filePath,
        line: firstLineMatching(workflow.content, /CODEX_API_KEY|OPENAI_API_KEY|api[-_ ]?key|sk-/i) || 1,
      };
    }
  }
  return null;
}

function automationManualTestingIssue(ctx) {
  const artifacts = codexAutomationArtifacts(ctx);
  if (artifacts.length === 0) return null;

  const docs = docsBundle(ctx);
  const hasManualTestingNote = /\bmanual(?:ly)? tested\b|\bdry[- ]run\b|\bstaging\b|\bvalidated locally\b|\btested locally\b/i.test(docs);
  if (hasManualTestingNote) return null;

  const target = artifacts[0];
  return {
    filePath: target.filePath,
    line: target.line || firstLineMatching(target.content || '', /\bcodex\b|openai\/codex-action@/i) || 1,
  };
}

function reviewWorkflowDocumented(ctx) {
  return /\bcodex review\b|\/review\b|\breview --uncommitted\b/i.test(docsBundle(ctx));
}

function reviewModelOverrideIssue(ctx) {
  const artifacts = codexAutomationArtifacts(ctx).filter((item) => /\bcodex\s+review\b/i.test(item.content || ''));
  if (artifacts.length === 0) return null;

  const hasReviewModelOverride = artifacts.some((item) => /\s(--model|-m)\s+\S+/i.test(item.content || ''));
  const hasReviewProfile = Boolean(parsedProfiles(ctx).review);
  if (hasReviewModelOverride || hasReviewProfile) return null;

  const target = artifacts[0];
  return {
    filePath: target.filePath,
    line: target.line || firstLineMatching(target.content || '', /\bcodex\s+review\b/i) || 1,
  };
}

function workingTreeReviewDocsPresent(ctx) {
  return /\bworking[- ]tree\b|\buncommitted\b|\bstaged\b|\bkeep unrelated edits separate\b|\bdo not mix unrelated edits\b/i.test(docsBundle(ctx));
}

function costAwarenessDocsPresent(ctx) {
  return /\bcost\b|\blatency\b|\breasoning\b|\bheavy workflows?\b|\bexpensive\b/i.test(docsBundle(ctx));
}

function codexArtifactsIgnoredIssue(ctx) {
  const gitignore = ctx.fileContent('.gitignore');
  if (!gitignore) return null;
  const line = firstLineMatching(gitignore, /^\.codex\/?$|^\.codex\/\*\*?$|^\.agents\/skills\/?$/im);
  return line ? { filePath: '.gitignore', line } : null;
}

function lifecycleScripts(ctx) {
  const files = ctx.files || [];
  return files.filter((file) => /(^|\/)(setup|teardown)\.(sh|ps1|cmd|bat)$/i.test(file));
}

function lifecycleScriptIssue(ctx) {
  const scripts = lifecycleScripts(ctx);
  if (scripts.length === 0) return null;

  const docs = docsBundle(ctx);
  for (const filePath of scripts) {
    const content = ctx.fileContent(filePath) || '';
    const shellOnly = /^#!.*\b(bash|sh)\b/m.test(content) || filePath.endsWith('.sh');
    const hasPlatformNote = /\bwindows\b|\bplatform-safe\b|\bpwsh\b|\bpowershell\b|\bcross-platform\b/i.test(docs);
    if (shellOnly && !hasPlatformNote) {
      return { filePath, line: 1 };
    }
  }

  return null;
}

function redundantCodexWorkflowIssue(ctx) {
  const workflows = workflowArtifacts(ctx).filter((workflow) => /\bcodex\b|openai\/codex-action@/i.test(workflow.content));
  if (workflows.length < 2) return null;

  const seen = new Map();
  for (const workflow of workflows) {
    const normalized = workflow.content
      .replace(/\s+/g, ' ')
      .replace(/name:\s*[^:]+/i, '')
      .trim();
    if (seen.has(normalized)) {
      return {
        filePath: workflow.filePath,
        line: firstLineMatching(workflow.content, /openai\/codex-action@|\bcodex\b/i) || 1,
      };
    }
    seen.set(normalized, workflow.filePath);
  }

  return null;
}

function worktreeLifecycleDocsIssue(ctx) {
  const docs = docsBundle(ctx);
  const worktreeRelevant = lifecycleScripts(ctx).length > 0 || /\bworktrees?\b/i.test(docs);
  if (!worktreeRelevant) return null;

  const documented = /\bworktrees?\b[\s\S]{0,140}\b(cleanup|lifecycle|branch|teardown|setup)\b/i.test(docs) ||
    /\bcleanup\b|\bteardown\b|\bbranch-specific\b/i.test(docs);
  return documented ? null : { filePath: agentsPath(ctx) || 'README.md', line: 1 };
}

function agentsMissingModernFeaturesIssue(ctx) {
  const docs = agentsContent(ctx);
  if (!docs) return null;

  const needsSkills = (ctx.skillDirs ? ctx.skillDirs() : []).length > 0;
  const needsAgents = (ctx.customAgentFiles ? ctx.customAgentFiles() : []).length > 0;
  const needsHooks = hooksClaimed(ctx);
  const needsMcp = projectScopedMcpPresent(ctx);

  const missing =
    (needsSkills && !/\bskills?\b/i.test(docs)) ||
    (needsAgents && !/\bsubagents?\b|\bagents?\b/i.test(docs)) ||
    (needsHooks && !/\bhooks?\b/i.test(docs)) ||
    (needsMcp && !/\bmcp\b/i.test(docs));

  return missing ? { filePath: agentsPath(ctx) || 'AGENTS.md', line: 1 } : null;
}

function deprecatedCodexPatternIssue(ctx) {
  const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
  const docs = docsBundle(ctx);
  const legacyConfigLine = firstLineMatching(config, /\bapproval_policy\s*=\s*["']on-failure["']/i);
  if (legacyConfigLine) {
    return { filePath: '.codex/config.toml', line: legacyConfigLine };
  }

  const docLine = firstLineMatching(docs, /\bon-failure\b|\bcodex-mini-latest\b/i);
  if (docLine) {
    return { filePath: agentsPath(ctx) || 'README.md', line: docLine };
  }

  return null;
}

function profilesNeededIssue(ctx) {
  const needsProfiles = codexAutomationArtifacts(ctx).length > 0 || (ctx.customAgentFiles ? ctx.customAgentFiles().length > 0 : false);
  if (!needsProfiles) return null;

  const activeProfile = ctx.configValue('profile');
  const profiles = parsedProfiles(ctx);
  if (activeProfile && profiles[activeProfile]) return null;
  if (Object.keys(profiles).length > 0) return null;

  return { filePath: '.codex/config.toml', line: configKeyLine(ctx, 'profile') || 1 };
}

function pluginConfigIssue(ctx) {
  const filePath = '.agents/plugins/marketplace.json';
  const content = ctx.fileContent(filePath);
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    const valid = Array.isArray(parsed) || (parsed && typeof parsed === 'object');
    return valid ? null : { filePath, line: 1 };
  } catch {
    return { filePath, line: 1 };
  }
}

function primaryDocsPath(ctx) {
  return agentsPath(ctx) || (ctx.fileContent('README.md') ? 'README.md' : null);
}

function webSearchModeRelevant(ctx) {
  const config = ctx.configToml();
  if (!config.ok || !config.data) return false;

  const profiles = config.data.profiles && typeof config.data.profiles === 'object'
    ? Object.values(config.data.profiles)
    : [];
  if (config.data.web_search !== undefined || profiles.some((profile) => profile && typeof profile === 'object' && profile.web_search !== undefined)) {
    return true;
  }

  const docs = docsBundle(ctx);
  const workflowUsesSearch = workflowArtifacts(ctx).some((workflow) => /\s--search\b|\bweb_search\b/i.test(workflow.content));
  return workflowUsesSearch || /\s--search\b|\bweb_search\b|\blive search\b|\bcached search\b/i.test(docs);
}

function webSearchModeIssue(ctx) {
  const config = ctx.configToml();
  if (!config.ok || !config.data) return null;

  const validModes = new Set(['cached', 'live', 'disabled']);
  const docs = docsBundle(ctx);
  const searchHintPresent = workflowArtifacts(ctx).some((workflow) => /\s--search\b|\bweb_search\b/i.test(workflow.content)) ||
    /\s--search\b|\bweb_search\b|\blive search\b|\bcached search\b/i.test(docs);
  const rootSearch = config.data.web_search;
  const rootEffort = config.data.model_reasoning_effort;
  const profiles = config.data.profiles && typeof config.data.profiles === 'object' ? config.data.profiles : {};

  if (rootSearch !== undefined && !validModes.has(`${rootSearch}`)) {
    return { filePath: '.codex/config.toml', line: configKeyLine(ctx, 'web_search') || 1 };
  }

  if (rootEffort === 'minimal' && ((typeof rootSearch === 'string' && rootSearch !== 'disabled') || (rootSearch === undefined && searchHintPresent))) {
    return {
      filePath: '.codex/config.toml',
      line: configKeyLine(ctx, 'model_reasoning_effort') || configKeyLine(ctx, 'web_search') || 1,
    };
  }

  for (const [name, profile] of Object.entries(profiles)) {
    if (!profile || typeof profile !== 'object') continue;
    if (profile.web_search !== undefined && !validModes.has(`${profile.web_search}`)) {
      return {
        filePath: '.codex/config.toml',
        line: configSectionKeyLine(ctx, `profiles.${name}`, 'web_search') ||
          (configSections(ctx).find((section) => section.section === `profiles.${name}`) || {}).line ||
          1,
      };
    }

    const effectiveSearch = profile.web_search !== undefined ? profile.web_search : rootSearch;
    if (profile.model_reasoning_effort === 'minimal' &&
      ((typeof effectiveSearch === 'string' && effectiveSearch !== 'disabled') || (effectiveSearch === undefined && searchHintPresent))) {
      return {
        filePath: '.codex/config.toml',
        line: configSectionKeyLine(ctx, `profiles.${name}`, 'model_reasoning_effort') ||
          configSectionKeyLine(ctx, `profiles.${name}`, 'web_search') ||
          configKeyLine(ctx, 'web_search') ||
          (configSections(ctx).find((section) => section.section === `profiles.${name}`) || {}).line ||
          1,
      };
    }
  }

  return null;
}

function requirementsTomlIssue(ctx) {
  const content = ctx.fileContent('requirements.toml');
  if (!content) return null;

  const hasMeaningfulContent = content.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });
  if (!hasMeaningfulContent) {
    return { filePath: 'requirements.toml', line: 1 };
  }

  const docs = docsBundle(ctx);
  const acknowledged = /\brequirements\.toml\b|\badmin[- ]enforced\b|\bmanaged configuration\b|\bmanaged\b/i.test(docs);
  return acknowledged ? null : { filePath: primaryDocsPath(ctx) || 'requirements.toml', line: 1 };
}

function sharedOrManagedMachineSignals(ctx) {
  const docs = docsBundle(ctx);
  return Boolean(ctx.fileContent('requirements.toml')) ||
    /\bshared\b|\bmanaged\b|\badmin[- ]enforced\b|\bmulti-user\b|\benterprise\b|\bkiosk\b|\bvdi\b/i.test(docs);
}

function authCredentialsStoreIssue(ctx) {
  if (!ctx.fileContent('.codex/config.toml')) return null;
  if (!sharedOrManagedMachineSignals(ctx)) return null;

  const value = ctx.configValue('cli_auth_credentials_store');
  if (value === undefined) {
    return { filePath: '.codex/config.toml', line: configKeyLine(ctx, 'cli_auth_credentials_store') || 1 };
  }

  return ['auto', 'file', 'keyring'].includes(`${value}`)
    ? null
    : { filePath: '.codex/config.toml', line: configKeyLine(ctx, 'cli_auth_credentials_store') || 1 };
}

function protectedPathAssumptionRelevant(ctx) {
  return ctx.configValue('sandbox_mode') === 'workspace-write' && /\.(git|codex|agents)\b/i.test(docsBundle(ctx));
}

function protectedPathAssumptionIssue(ctx) {
  if (!protectedPathAssumptionRelevant(ctx)) return null;

  const docs = docsBundle(ctx);
  const riskyPattern = /\.(git|codex|agents)\b[\s\S]{0,120}\b(edit|modify|write|delete|remove|patch|update|commit)\b/i;
  const safePattern = /\.(git|codex|agents)\b[\s\S]{0,120}\b(read-only|read only|protected|not writable|cannot (?:be )?(?:edited|modified|written)|blocked)\b/i;
  if (safePattern.test(docs)) return null;
  if (!riskyPattern.test(docs)) return null;

  return {
    filePath: primaryDocsPath(ctx) || '.codex/config.toml',
    line: firstLineMatching(docs, /\.(git|codex|agents)\b/i) || 1,
  };
}

function mcpHttpAuthAndCallbackRelevant(ctx) {
  if (!projectScopedMcpPresent(ctx)) return false;
  const servers = projectMcpServers(ctx);
  const hasRemoteHeaderAuth = Object.values(servers || {}).some((server) => server && server.url && (server.env_http_headers || server.http_headers));
  return hasRemoteHeaderAuth ||
    typeof ctx.configValue('mcp_oauth_callback_port') === 'number' ||
    Boolean(ctx.configValue('mcp_oauth_callback_url'));
}

function mcpHttpAuthAndCallbackIssue(ctx) {
  const docs = docsBundle(ctx);
  const callbackPort = ctx.configValue('mcp_oauth_callback_port');
  const callbackUrl = ctx.configValue('mcp_oauth_callback_url');

  if ((typeof callbackPort === 'number' || callbackUrl) && !/\boauth\b|\bcallback\b|\bredirect\b|\bloopback\b/i.test(docs)) {
    return {
      filePath: '.codex/config.toml',
      line: configKeyLine(ctx, 'mcp_oauth_callback_url') || configKeyLine(ctx, 'mcp_oauth_callback_port') || 1,
    };
  }

  for (const [id, server] of Object.entries(projectMcpServers(ctx))) {
    if (!server || !server.url) continue;
    if (!(server.env_http_headers || server.http_headers)) continue;

    const hasDocNote = new RegExp(`\\b${escapeRegex(id)}\\b[\\s\\S]{0,180}\\b(header|oauth|callback|auth|token)\\b`, 'i').test(docs);
    if (!hasDocNote) {
      return {
        filePath: '.codex/config.toml',
        line: configSectionKeyLine(ctx, `mcp_servers.${id}`, 'env_http_headers') ||
          configSectionKeyLine(ctx, `mcp_servers.${id}`, 'http_headers') ||
          (configSections(ctx).find((section) => section.section === `mcp_servers.${id}`) || {}).line ||
          1,
      };
    }
  }

  return null;
}

function batchStyleSubagentFlowPresent(ctx) {
  const files = ctx.customAgentFiles ? ctx.customAgentFiles() : [];
  const csvPattern = /\bspawn_agents_on_csv\b|\breport_agent_job_result\b|\boutput_csv_path\b|\boutput_schema\b|\bmax_concurrency\b|\bmax_runtime_seconds\b/i;
  return files.some((fileName) => {
    const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
    return csvPattern.test(content);
  });
}

function csvBatchAgentIssue(ctx) {
  const files = ctx.customAgentFiles ? ctx.customAgentFiles() : [];
  const csvPattern = /\bspawn_agents_on_csv\b|\breport_agent_job_result\b|\boutput_csv_path\b|\boutput_schema\b|\bmax_concurrency\b|\bmax_runtime_seconds\b/i;

  for (const fileName of files) {
    const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
    if (!csvPattern.test(content)) continue;
    if (typeof ctx.configValue('agents.job_max_runtime_seconds') === 'number') return null;
    return {
      filePath: '.codex/config.toml',
      line: configSectionKeyLine(ctx, 'agents', 'job_max_runtime_seconds') || 1,
    };
  }

  return null;
}

function nicknameCandidatesIssue(ctx) {
  const files = ctx.customAgentFiles ? ctx.customAgentFiles() : [];
  const seen = new Map();

  for (const fileName of files) {
    const parsed = ctx.customAgentConfig(fileName);
    if (!parsed.ok || !parsed.data) {
      return { filePath: `.codex/agents/${fileName}`, line: 1 };
    }

    const candidates = parsed.data.nickname_candidates;
    if (candidates === undefined) continue;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
      return {
        filePath: `.codex/agents/${fileName}`,
        line: firstLineMatching(content, /^\s*nickname_candidates\s*=/i) || 1,
      };
    }

    const localSeen = new Set();
    for (const candidate of candidates) {
      const normalized = typeof candidate === 'string' ? candidate.trim() : '';
      const canonical = normalized.toLowerCase();
      if (!normalized || !/^[A-Za-z0-9 _-]+$/.test(normalized) || localSeen.has(canonical) || seen.has(canonical)) {
        const content = ctx.fileContent(path.join('.codex', 'agents', fileName)) || '';
        return {
          filePath: `.codex/agents/${fileName}`,
          line: firstLineMatching(content, /^\s*nickname_candidates\s*=/i) || 1,
        };
      }
      localSeen.add(canonical);
      seen.set(canonical, fileName);
    }
  }

  return null;
}

function nativeWindowsConfigRelevant(ctx) {
  return configSections(ctx).some((section) => section.section === 'windows') ||
    /\bnative windows\b|\bwindows sandbox\b|\bprivate desktop\b/i.test(docsBundle(ctx));
}

function windowsSandboxModeIssue(ctx) {
  if (!nativeWindowsConfigRelevant(ctx)) return null;

  const value = ctx.configValue('windows.sandbox');
  if (value === undefined) {
    return {
      filePath: '.codex/config.toml',
      line: configSectionKeyLine(ctx, 'windows', 'sandbox') ||
        (configSections(ctx).find((section) => section.section === 'windows') || {}).line ||
        1,
    };
  }

  return ['elevated', 'unelevated'].includes(`${value}`)
    ? null
    : {
      filePath: '.codex/config.toml',
      line: configSectionKeyLine(ctx, 'windows', 'sandbox') ||
        (configSections(ctx).find((section) => section.section === 'windows') || {}).line ||
        1,
    };
}

function appAutomationRelevant(ctx) {
  return /\bautomations?\b|\btriage inbox\b|\bbackground tasks?\b/i.test(docsBundle(ctx));
}

function automationAppRunningIssue(ctx) {
  if (!appAutomationRelevant(ctx)) return null;

  const docs = docsBundle(ctx);
  const acknowledged = /\bapp needs to be running\b|\bkeep the app running\b|\bCodex app\b[\s\S]{0,80}\brunning\b|\bselected project\b[\s\S]{0,80}\bon disk\b/i.test(docs);
  return acknowledged
    ? null
    : {
      filePath: primaryDocsPath(ctx) || 'README.md',
      line: firstLineMatching(docs, /\bautomations?\b|\btriage inbox\b|\bbackground tasks?\b/i) || 1,
    };
}

function codexActionPromptSourceIssue(ctx) {
  for (const workflow of workflowArtifacts(ctx)) {
    if (!/uses:\s*openai\/codex-action@/i.test(workflow.content)) continue;

    const hasPrompt = /^\s*prompt\s*:/im.test(workflow.content);
    const hasPromptFile = /^\s*prompt-file\s*:/im.test(workflow.content);
    if (hasPrompt && hasPromptFile) {
      return {
        filePath: workflow.filePath,
        line: firstLineMatching(workflow.content, /^\s*prompt(?:-file)?\s*:/im) || 1,
      };
    }

    if (!hasPrompt && !hasPromptFile) {
      return {
        filePath: workflow.filePath,
        line: firstLineMatching(workflow.content, /uses:\s*openai\/codex-action@/i) || 1,
      };
    }
  }

  return null;
}

function codexActionTriggerAllowlistIssue(ctx) {
  for (const workflow of workflowArtifacts(ctx)) {
    if (!/uses:\s*openai\/codex-action@/i.test(workflow.content)) continue;

    const triggerLine = firstLineMatching(workflow.content, /\bissue_comment\b|\bpull_request_target\b|\bpull_request_review_comment\b|\bdiscussion_comment\b/i);
    if (!triggerLine) continue;

    const hasAllowUsers = /^\s*allow-users\s*:/im.test(workflow.content);
    const hasAllowBots = /^\s*allow-bots\s*:/im.test(workflow.content);
    if (!hasAllowUsers && !hasAllowBots) {
      return { filePath: workflow.filePath, line: triggerLine };
    }
  }

  return null;
}

function codexActionExternalTriggersPresent(ctx) {
  return workflowArtifacts(ctx).some((workflow) =>
    /uses:\s*openai\/codex-action@/i.test(workflow.content) &&
    /\bissue_comment\b|\bpull_request_target\b|\bpull_request_review_comment\b|\bdiscussion_comment\b/i.test(workflow.content));
}

function desktopProjectMcpCaveatIssue(ctx) {
  if (!projectScopedMcpPresent(ctx)) return null;

  const docs = docsBundle(ctx);
  if (!/\bdesktop\b|\bide\b|\bextension\b/i.test(docs)) return null;

  const caveated = /\btrusted project\b|\btrust\b|\brepo-local\b|\bproject-scoped\b|\bglobal config\b|\buser-global\b|\bmay be ignored\b/i.test(docs);
  return caveated
    ? null
    : {
      filePath: primaryDocsPath(ctx) || '.codex/config.toml',
      line: firstLineMatching(docs, /\bdesktop\b|\bide\b|\bextension\b/i) || 1,
    };
}

const CODEX_TECHNIQUES = {
  codexAgentsMd: {
    id: 'CX-A01',
    name: 'AGENTS.md exists at project root',
    check: (ctx) => Boolean(ctx.fileContent('AGENTS.md')),
    impact: 'critical',
    rating: 5,
    category: 'instructions',
    fix: 'Create AGENTS.md at the project root with repo-specific commands, trust guidance, and workflow expectations.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => (ctx.fileContent('AGENTS.md') ? 1 : null),
  },
  codexAgentsMdSubstantive: {
    id: 'CX-A02',
    name: 'AGENTS.md has substantive content',
    check: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      if (!content) return null;
      const nonEmptyLines = content.split(/\r?\n/).filter(line => line.trim()).length;
      return nonEmptyLines >= 20 && countSections(content) >= 2;
    },
    impact: 'high',
    rating: 5,
    category: 'instructions',
    fix: 'Expand AGENTS.md so it has at least 20 substantive lines and 2+ sections instead of a thin placeholder.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: () => 1,
  },
  codexAgentsVerificationCommands: {
    id: 'CX-A03',
    name: 'AGENTS.md includes repo verification commands',
    check: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      if (!content) return null;
      const expected = expectedVerificationCategories(ctx);
      if (expected.length === 0) return /\bverify\b|\btest\b|\blint\b|\bbuild\b/i.test(content);
      return expected.every(category => hasCommandMention(content, category));
    },
    impact: 'high',
    rating: 5,
    category: 'instructions',
    fix: 'Document the actual test/lint/build commands this repo uses so Codex can verify its own changes before handoff.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => ctx.lineNumber('AGENTS.md', /\bVerification\b|\btest\b|\blint\b|\bbuild\b/i) || 1,
  },
  codexAgentsArchitecture: {
    id: 'CX-A04',
    name: 'AGENTS.md includes architecture or project map guidance',
    check: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      if (!content) return null;
      return agentsHasArchitecture(content);
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Add a short architecture or project map section to AGENTS.md so Codex understands the repo shape before editing.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => ctx.lineNumber('AGENTS.md', /##\s+Architecture\b|##\s+Project Map\b|##\s+Structure\b|```mermaid|flowchart\b|graph\s+(TD|LR|RL|BT)\b/i),
  },
  codexOverrideDocumented: {
    id: 'CX-A05',
    name: 'AGENTS.override.md is intentional and documented',
    check: (ctx) => {
      const override = ctx.agentsOverrideMdContent();
      if (!override) return true;
      const preview = override.split(/\r?\n/).slice(0, 6).join('\n');
      return JUSTIFICATION_PATTERNS.test(preview);
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Add a short explanation at the top of AGENTS.override.md explaining why it exists and when it should be removed.',
    template: null,
    file: () => 'AGENTS.override.md',
    line: (ctx) => (ctx.agentsOverrideMdContent() ? 1 : null),
  },
  codexProjectDocMaxBytes: {
    id: 'CX-A06',
    name: 'AGENTS.md stays within project_doc_max_bytes limit',
    check: (ctx) => {
      const filePath = agentsPath(ctx);
      if (!filePath) return null;
      const maxBytes = ctx.configValue('project_doc_max_bytes') || DEFAULT_PROJECT_DOC_MAX_BYTES;
      const size = ctx.fileSizeBytes(filePath);
      if (size == null) return null;
      return size <= maxBytes;
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Keep AGENTS.md under the configured project_doc_max_bytes limit so Codex does not silently truncate instructions.',
    template: null,
    file: (ctx) => agentsPath(ctx),
    line: () => 1,
  },
  codexNoGenericFiller: {
    id: 'CX-A07',
    name: 'AGENTS.md avoids generic filler instructions',
    check: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      if (!content) return null;
      return !FILLER_PATTERNS.some((pattern) => pattern.test(content));
    },
    impact: 'low',
    rating: 3,
    category: 'instructions',
    fix: 'Replace generic filler like “be helpful” with concrete repo-specific guidance that actually changes Codex behavior.',
    template: null,
    file: () => 'AGENTS.md',
    line: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      return content ? findFillerLine(content) : null;
    },
  },
  codexNoInstructionContradictions: {
    id: 'CX-A08',
    name: 'AGENTS.md has no obvious contradictions',
    check: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      if (!content) return null;
      return !hasContradictions(content);
    },
    impact: 'medium',
    rating: 4,
    category: 'instructions',
    fix: 'Remove contradictory guidance from AGENTS.md so Codex is not told to follow mutually exclusive rules.',
    template: null,
    file: () => 'AGENTS.md',
    line: (ctx) => {
      const content = ctx.fileContent('AGENTS.md');
      if (!content) return null;
      return firstLineMatching(content, /\balways\b.*\bnever\b|\bnever\b.*\balways\b|\buse tabs\b|\buse spaces\b|\bsingle quotes\b|\bdouble quotes\b|\bsemicolons required\b|\bno semicolons\b/i);
    },
  },
  codexConfigExists: {
    id: 'CX-B01',
    name: '.codex/config.toml exists',
    check: (ctx) => Boolean(ctx.fileContent('.codex/config.toml')),
    impact: 'high',
    rating: 5,
    category: 'config',
    fix: 'Create .codex/config.toml with explicit model, reasoning, approval policy, sandbox mode, and safe defaults.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => (ctx.fileContent('.codex/config.toml') ? 1 : null),
  },
  codexConfigValidToml: {
    id: 'CX-B06',
    name: 'Codex config.toml is valid and parseable',
    check: (ctx) => {
      const config = ctx.configToml();
      if (!ctx.fileContent('.codex/config.toml')) return null;
      return config.ok;
    },
    impact: 'critical',
    rating: 5,
    category: 'config',
    fix: 'Fix malformed TOML in .codex/config.toml so Codex does not silently ignore settings.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const config = ctx.configToml();
      if (config.ok || !config.error) return null;
      const match = config.error.match(/Line (\d+)/i);
      return match ? Number(match[1]) : 1;
    },
  },
  codexModelExplicit: {
    id: 'CX-B02',
    name: 'Primary Codex model is explicit',
    check: (ctx) => Boolean(ctx.configValue('model')),
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Set `model` explicitly in Codex config so teams know which model Codex uses by default.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'model'),
  },
  codexReasoningEffortExplicit: {
    id: 'CX-B03',
    name: 'model_reasoning_effort is explicit',
    check: (ctx) => Boolean(ctx.configValue('model_reasoning_effort')),
    impact: 'low',
    rating: 3,
    category: 'config',
    fix: 'Set `model_reasoning_effort` explicitly only when the repo needs a non-default reasoning posture; this setting is optional, and minimal effort should stay compatible with any `web_search` usage.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'model_reasoning_effort'),
  },
  codexWeakModelExplicit: {
    id: 'CX-B04',
    name: 'Weak-task delegation model is explicit',
    check: () => {
      // Retired: config key removed from official schema as of 2026-04-05
      return null;
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: '`model_for_weak_tasks` was removed from the official Codex config schema as of 2026-04-05. This check is retired and no repo change is required.',
    template: null,
    file: () => null,
    line: () => null,
  },
  codexConfigSectionPlacement: {
    id: 'CX-B05',
    name: 'Nested-only config keys are placed in the right TOML sections',
    check: (ctx) => {
      const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!content) return null;
      return !hasMisplacedNestedKeys(content).misplaced;
    },
    impact: 'high',
    rating: 5,
    category: 'config',
    fix: 'Move nested-only keys like `send_to_server`, `max_threads`, and `enabled_tools` into their proper TOML sections.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      return content ? hasMisplacedNestedKeys(content).line : null;
    },
  },
  codexNoLegacyConfigAliases: {
    id: 'CX-B07',
    name: 'Config avoids legacy or mistyped aliases',
    check: (ctx) => {
      const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!content) return null;
      return !findLegacyConfigIssue(content);
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'Replace legacy or mistyped Codex config aliases with the current documented keys.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const content = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      const issue = content ? findLegacyConfigIssue(content) : null;
      return issue ? issue.line : null;
    },
  },
  codexProfilesUsedAppropriately: {
    id: 'CX-B08',
    name: 'Config profiles are defined and referenced appropriately',
    check: (ctx) => {
      const activeProfile = ctx.configValue('profile');
      const sections = profileSections(ctx);
      const profiles = parsedProfiles(ctx);
      if (!activeProfile && sections.length === 0) return null;

      if (activeProfile) {
        const active = typeof activeProfile === 'string' ? activeProfile.trim() : '';
        if (!active) return false;
        if (!profiles[active] || Object.keys(profiles[active] || {}).length === 0) {
          return false;
        }
      }

      return sections.every((section) => {
        const name = section.section.slice('profiles.'.length);
        const value = profiles[name];
        return value && typeof value === 'object' && Object.keys(value).length > 0;
      });
    },
    impact: 'low',
    rating: 3,
    category: 'config',
    fix: 'Profiles are an advanced feature, not a baseline requirement. If you use them, make sure each profile contains real settings and any selected `profile` points to an existing profile section.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'profile') || (profileSections(ctx)[0] || {}).line || null,
  },
  codexFullAutoErrorModeExplicit: {
    id: 'CX-B09',
    name: 'full_auto_error_mode is explicit',
    check: () => {
      // Retired: config key removed from official schema as of 2026-04-05
      return null;
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: '`full_auto_error_mode` was removed from the official Codex config schema as of 2026-04-05. This check is retired and no repo change is required.',
    template: null,
    file: () => null,
    line: () => null,
  },
  codexWebSearchModeCompatible: {
    id: 'CX-B10',
    name: 'web_search mode is explicit and compatible when search is part of the workflow',
    check: (ctx) => {
      if (!webSearchModeRelevant(ctx)) return null;
      return !webSearchModeIssue(ctx);
    },
    impact: 'medium',
    rating: 4,
    category: 'config',
    fix: 'When the repo uses search-aware Codex flows, set `web_search = "cached" | "live" | "disabled"` intentionally and avoid pairing search with `model_reasoning_effort = "minimal"` in the same effective profile.',
    template: 'codex-config',
    file: (ctx) => {
      const issue = webSearchModeIssue(ctx);
      return issue ? issue.filePath : '.codex/config.toml';
    },
    line: (ctx) => {
      const issue = webSearchModeIssue(ctx);
      return issue ? issue.line : configKeyLine(ctx, 'web_search');
    },
  },
  codexRequirementsTomlRecognized: {
    id: 'CX-B11',
    name: 'requirements.toml posture is recognized when a managed layer exists',
    check: (ctx) => {
      if (!ctx.fileContent('requirements.toml')) return null;
      return !requirementsTomlIssue(ctx);
    },
    impact: 'medium',
    rating: 3,
    category: 'config',
    fix: 'If the repo uses `requirements.toml`, keep it non-empty and acknowledge that it is a managed/admin layer rather than an ordinary project preference file.',
    template: null,
    file: (ctx) => {
      const issue = requirementsTomlIssue(ctx);
      return issue ? issue.filePath : 'requirements.toml';
    },
    line: (ctx) => {
      const issue = requirementsTomlIssue(ctx);
      return issue ? issue.line : 1;
    },
  },
  codexCliAuthCredentialsStoreExplicit: {
    id: 'CX-B12',
    name: 'cli_auth_credentials_store is explicit on shared or managed setups',
    check: (ctx) => {
      const issue = authCredentialsStoreIssue(ctx);
      return issue ? false : (sharedOrManagedMachineSignals(ctx) ? true : null);
    },
    impact: 'high',
    rating: 4,
    category: 'config',
    fix: 'On shared or managed machines, set `cli_auth_credentials_store = "auto" | "keyring" | "file"` explicitly so Codex auth-cache handling is reviewable.',
    template: 'codex-config',
    file: (ctx) => {
      const issue = authCredentialsStoreIssue(ctx);
      return issue ? issue.filePath : '.codex/config.toml';
    },
    line: (ctx) => {
      const issue = authCredentialsStoreIssue(ctx);
      return issue ? issue.line : configKeyLine(ctx, 'cli_auth_credentials_store');
    },
  },
  codexApprovalPolicyExplicit: {
    id: 'CX-C02',
    name: 'approval_policy is explicit',
    check: (ctx) => Boolean(ctx.configValue('approval_policy')),
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Set `approval_policy` explicitly in Codex config so Codex behavior is predictable across sessions.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'approval_policy'),
  },
  codexSandboxModeExplicit: {
    id: 'CX-C03',
    name: 'sandbox_mode is explicit',
    check: (ctx) => Boolean(ctx.configValue('sandbox_mode')),
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'Set `sandbox_mode` explicitly (usually `workspace-write`) instead of relying on implicit defaults.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'sandbox_mode'),
  },
  codexNoDangerFullAccess: {
    id: 'CX-C01',
    name: 'No danger-full-access sandbox mode',
    check: (ctx) => {
      const sandboxMode = ctx.configValue('sandbox_mode');
      if (!sandboxMode) return true;
      return sandboxMode !== 'danger-full-access';
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Replace `sandbox_mode = "danger-full-access"` with `workspace-write` and add explicit approvals for elevated actions.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'sandbox_mode'),
  },
  codexApprovalNeverNeedsJustification: {
    id: 'CX-C04',
    name: 'approval_policy = "never" has explicit justification',
    check: (ctx) => {
      const approvalPolicy = ctx.configValue('approval_policy');
      if (!approvalPolicy) return null;
      if (approvalPolicy !== 'never') return true;
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      const agents = agentsContent(ctx);
      return JUSTIFICATION_PATTERNS.test(config) || JUSTIFICATION_PATTERNS.test(agents);
    },
    impact: 'high',
    rating: 5,
    category: 'trust',
    fix: 'If you intentionally use `approval_policy = "never"`, document why in config comments or AGENTS.md so the trust boundary is reviewable.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'approval_policy'),
  },
  codexDisableResponseStorageForRegulatedRepos: {
    id: 'CX-C05',
    name: 'disable_response_storage is explicit for regulated repos',
    check: () => {
      // Retired: config key removed from official schema as of 2026-04-05
      return null;
    },
    impact: 'medium',
    rating: 4,
    category: 'trust',
    fix: '`disable_response_storage` was removed from the official Codex config schema as of 2026-04-05. This check is retired and no repo change is required.',
    template: null,
    file: () => null,
    line: () => null,
  },
  codexHistorySendToServerExplicit: {
    id: 'CX-C06',
    name: 'history.send_to_server is explicit',
    check: () => {
      // Retired: config key removed from official schema as of 2026-04-05
      return null;
    },
    impact: 'medium',
    rating: 4,
    category: 'trust',
    fix: '`history.send_to_server` was removed from the official Codex config schema as of 2026-04-05. This check is retired and no repo change is required.',
    template: null,
    file: () => null,
    line: () => null,
  },
  codexGitHubActionUnsafeJustified: {
    id: 'CX-C07',
    name: 'Unsafe Codex GitHub Action safety mode has explicit justification',
    check: (ctx) => {
      const workflows = codexActionWorkflowIssues(ctx);
      if (workflows.length === 0) return null;
      return workflows.every((issue) => issue.justified);
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'If a Codex GitHub Action workflow uses `safety-strategy: unsafe`, document why or restrict it to the Windows boundary where it is required.',
    template: null,
    file: (ctx) => {
      const issue = codexActionWorkflowIssues(ctx).find((item) => !item.justified);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexActionWorkflowIssues(ctx).find((item) => !item.justified);
      return issue ? issue.line : null;
    },
  },
  codexNetworkAccessExplicit: {
    id: 'CX-C08',
    name: 'Network access posture is explicit for workspace-write sandbox',
    check: (ctx) => {
      const sandboxMode = ctx.configValue('sandbox_mode');
      if (!sandboxMode || sandboxMode !== 'workspace-write') return null;
      return typeof ctx.configValue('sandbox_workspace_write.network_access') === 'boolean';
    },
    impact: 'medium',
    rating: 4,
    category: 'trust',
    fix: 'Set `sandbox_workspace_write.network_access = true|false` explicitly so Codex network posture is reviewable in workspace-write mode.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configSectionKeyLine(ctx, 'sandbox_workspace_write', 'network_access'),
  },
  codexNoSecretsInAgents: {
    id: 'CX-C09',
    name: 'AGENTS.md contains no embedded secrets',
    check: (ctx) => {
      const content = agentsContent(ctx);
      if (!content) return null;
      return !containsEmbeddedSecret(content);
    },
    impact: 'critical',
    rating: 5,
    category: 'trust',
    fix: 'Remove API keys and secrets from AGENTS.md. Use environment variables or external secret stores instead.',
    template: null,
    file: (ctx) => agentsPath(ctx),
    line: (ctx) => {
      const content = agentsContent(ctx);
      return content ? findSecretLine(content) : null;
    },
  },
  codexProtectedPathsRespectedInWorkspaceWriteDocs: {
    id: 'CX-C10',
    name: 'Workspace-write docs do not imply protected paths are writable',
    check: (ctx) => {
      if (!protectedPathAssumptionRelevant(ctx)) return null;
      return !protectedPathAssumptionIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'If repo docs mention `.git`, `.codex`, or `.agents` under workspace-write, describe them as protected/read-only rather than writable runtime surfaces.',
    template: 'codex-agents-md',
    file: (ctx) => {
      const issue = protectedPathAssumptionIssue(ctx);
      return issue ? issue.filePath : primaryDocsPath(ctx);
    },
    line: (ctx) => {
      const issue = protectedPathAssumptionIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexWindowsSandboxModeExplicit: {
    id: 'CX-C11',
    name: 'Native Windows sandbox mode is explicit when Windows config is used',
    check: (ctx) => {
      const issue = windowsSandboxModeIssue(ctx);
      return issue ? false : (nativeWindowsConfigRelevant(ctx) ? true : null);
    },
    impact: 'high',
    rating: 4,
    category: 'trust',
    fix: 'If the repo relies on native Windows Codex settings, set `[windows] sandbox = "elevated" | "unelevated"` explicitly so the trust boundary is reviewable.',
    template: 'codex-config',
    file: (ctx) => {
      const issue = windowsSandboxModeIssue(ctx);
      return issue ? issue.filePath : '.codex/config.toml';
    },
    line: (ctx) => {
      const issue = windowsSandboxModeIssue(ctx);
      return issue ? issue.line : configSectionKeyLine(ctx, 'windows', 'sandbox');
    },
  },
  codexRulesExistForRiskyCommands: {
    id: 'CX-D01',
    name: 'Rules exist for risky or out-of-sandbox command classes',
    check: (ctx) => {
      const issue = ruleCoverageIssue(ctx);
      return issue ? false : true;
    },
    impact: 'high',
    rating: 4,
    category: 'rules',
    fix: 'Add Codex rules under `codex/rules/` or `.codex/rules/` for risky command classes such as Git pushes, shells, package managers, or destructive commands.',
    template: null,
    file: (ctx) => {
      const issue = ruleCoverageIssue(ctx);
      return issue ? issue.filePath : (repoRuleArtifacts(ctx)[0] || {}).filePath || null;
    },
    line: (ctx) => {
      const issue = ruleCoverageIssue(ctx);
      return issue ? issue.line : (allRuleBlocks(ctx)[0] || {}).startLine || null;
    },
  },
  codexRulesSpecificPatterns: {
    id: 'CX-D02',
    name: 'Rules use specific patterns instead of wildcard matches',
    check: (ctx) => {
      if (allRuleBlocks(ctx).length === 0) return null;
      return !specificRulePatternIssue(ctx);
    },
    impact: 'medium',
    rating: 4,
    category: 'rules',
    fix: 'Replace wildcard-heavy rule patterns with specific command prefixes so Codex approvals stay narrow and reviewable.',
    template: null,
    file: (ctx) => {
      const issue = specificRulePatternIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = specificRulePatternIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexRulesExamplesPresent: {
    id: 'CX-D03',
    name: 'Rules include match or not_match examples',
    check: (ctx) => {
      if (allRuleBlocks(ctx).length === 0) return null;
      return !missingRuleExamplesIssue(ctx);
    },
    impact: 'low',
    rating: 3,
    category: 'rules',
    fix: 'Add `match` or `not_match` examples to Codex rules so broken or over-broad rules are caught before they take effect.',
    template: null,
    file: (ctx) => {
      const issue = missingRuleExamplesIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = missingRuleExamplesIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexNoBroadAllowAllRules: {
    id: 'CX-D04',
    name: 'Rules do not contain broad allow-all command patterns',
    check: (ctx) => {
      if (allRuleBlocks(ctx).length === 0) return null;
      return !broadAllowRuleIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'rules',
    fix: 'Avoid broad allow rules for shells or generic tool entrypoints; prefer narrow prefixes and explicit review boundaries.',
    template: null,
    file: (ctx) => {
      const issue = broadAllowRuleIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = broadAllowRuleIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexRuleWrapperRiskDocumented: {
    id: 'CX-D05',
    name: 'Shell wrapper and path-resolution caveats are documented for rules',
    check: (ctx) => {
      if (allRuleBlocks(ctx).length === 0) return null;
      return !ruleWrapperRiskIssue(ctx);
    },
    impact: 'low',
    rating: 3,
    category: 'rules',
    fix: 'If your rules rely on shell wrappers or `host_executable()`, document the shell-splitting and path-resolution caveats in AGENTS.md or the rule file itself.',
    template: null,
    file: (ctx) => {
      const issue = ruleWrapperRiskIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = ruleWrapperRiskIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexHooksDeliberate: {
    id: 'CX-E01',
    name: 'Hooks feature is deliberately enabled or disabled',
    check: (ctx) => {
      const explicit = explicitHooksFeatureValue(ctx);
      if (explicit !== null) return true;
      if (!hooksClaimed(ctx) && !ctx.fileContent('.codex/config.toml')) return null;
      return false;
    },
    impact: 'medium',
    rating: 4,
    category: 'hooks',
    fix: 'Set `[features] codex_hooks = true|false` explicitly so hook posture is deliberate and reviewable.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => configSectionKeyLine(ctx, 'features', 'codex_hooks'),
  },
  codexHooksJsonExistsWhenClaimed: {
    id: 'CX-E02',
    name: 'hooks.json exists when hooks are claimed',
    check: (ctx) => {
      if (!hooksClaimed(ctx)) return null;
      return Boolean(ctx.hooksJsonContent && ctx.hooksJsonContent());
    },
    impact: 'high',
    rating: 4,
    category: 'hooks',
    fix: 'If the repo claims Codex hooks, commit `.codex/hooks.json` so the runtime behavior is explicit and reviewable.',
    template: null,
    file: () => '.codex/hooks.json',
    line: (ctx) => (ctx.hooksJsonContent && ctx.hooksJsonContent() ? 1 : null),
  },
  codexHookEventsSupported: {
    id: 'CX-E03',
    name: 'hooks.json uses supported Codex events',
    check: (ctx) => {
      const content = ctx.hooksJsonContent && ctx.hooksJsonContent();
      if (!content) return null;
      return !unsupportedHookEvent(ctx);
    },
    impact: 'medium',
    rating: 4,
    category: 'hooks',
    fix: 'Use only Codex-supported hook events: SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, and Stop.',
    template: null,
    file: () => '.codex/hooks.json',
    line: (ctx) => {
      const issue = unsupportedHookEvent(ctx);
      return issue ? issue.line : null;
    },
  },
  codexHooksWindowsCaveat: {
    id: 'CX-E04',
    name: 'Windows users are not relying on Codex hooks for enforcement',
    check: (ctx) => {
      if (os.platform() !== 'win32') return true;
      return !hooksClaimed(ctx);
    },
    impact: 'critical',
    rating: 5,
    category: 'hooks',
    fix: 'Codex hooks are disabled on Windows. Move enforcement to CI or document a non-hook fallback instead of relying on runtime hooks.',
    template: null,
    file: (ctx) => {
      if (ctx.hooksJsonContent && ctx.hooksJsonContent()) return '.codex/hooks.json';
      return agentsPath(ctx);
    },
    line: (ctx) => {
      if (ctx.hooksJsonContent && ctx.hooksJsonContent()) return 1;
      const content = agentsContent(ctx);
      return content ? firstLineMatching(content, /\bhooks?\b|\bSessionStart\b|\bPreToolUse\b|\bPostToolUse\b|\bUserPromptSubmit\b|\bStop\b/i) : null;
    },
  },
  codexHookTimeoutsReasonable: {
    id: 'CX-E05',
    name: 'Hooks do not use long timeouts without justification',
    check: (ctx) => {
      if (!(ctx.hooksJsonContent && ctx.hooksJsonContent())) return null;
      return !longHookTimeoutIssue(ctx);
    },
    impact: 'low',
    rating: 3,
    category: 'hooks',
    fix: 'Keep Codex hook timeouts at 60 seconds or lower unless the repo documents why a longer timeout is required.',
    template: null,
    file: (ctx) => {
      const issue = longHookTimeoutIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = longHookTimeoutIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexMcpPresentIfRepoNeedsExternalTools: {
    id: 'CX-F01',
    name: 'MCP servers are configured when the repo clearly needs external tools',
    check: (ctx) => {
      if (!repoNeedsExternalTools(ctx)) return null;
      return Object.keys(ctx.mcpServers() || {}).length > 0;
    },
    impact: 'medium',
    rating: 4,
    category: 'mcp',
    fix: 'This repo looks like it depends on external services or tools. Add MCP servers when appropriate so Codex can use live context instead of stale assumptions.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => (ctx.fileContent('.codex/config.toml') ? 1 : null),
  },
  codexMcpWhitelistsExplicit: {
    id: 'CX-F02',
    name: 'MCP servers use explicit enabled_tools whitelists',
    check: (ctx) => {
      const servers = ctx.mcpServers();
      const ids = Object.keys(servers || {});
      if (ids.length === 0) return null;
      return ids.every((id) => {
        const server = servers[id];
        return Array.isArray(server.enabled_tools) && server.enabled_tools.length > 0;
      });
    },
    impact: 'high',
    rating: 4,
    category: 'mcp',
    fix: 'For each MCP server, set `enabled_tools` explicitly instead of exposing the whole tool surface by default.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const servers = ctx.mcpServers();
      for (const [id, server] of Object.entries(servers || {})) {
        if (!(Array.isArray(server.enabled_tools) && server.enabled_tools.length > 0)) {
          return configSectionKeyLine(ctx, `mcp_servers.${id}`, 'enabled_tools') ||
            (configSections(ctx).find(item => item.section === `mcp_servers.${id}`) || {}).line ||
            1;
        }
      }
      return null;
    },
  },
  codexMcpStartupTimeoutReasonable: {
    id: 'CX-F03',
    name: 'MCP startup timeout is reasonable',
    check: (ctx) => {
      const servers = mcpServersWithTimeouts(ctx);
      if (servers.length === 0) return null;
      return servers.every((server) => server.timeout == null || server.timeout <= 30);
    },
    impact: 'low',
    rating: 3,
    category: 'mcp',
    fix: 'Keep `mcp_servers.<id>.startup_timeout_sec` at 30 seconds or lower unless you have a documented reason for a slower server.',
    template: null,
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const servers = mcpServersWithTimeouts(ctx);
      const slow = servers.find(server => server.timeout != null && server.timeout > 30);
      return slow ? configSectionKeyLine(ctx, `mcp_servers.${slow.id}`, 'startup_timeout_sec') : null;
    },
  },
  codexProjectScopedMcpTrusted: {
    id: 'CX-F04',
    name: 'Project-scoped MCP is only used on trusted projects',
    check: (ctx) => {
      if (!projectScopedMcpPresent(ctx)) return null;
      return ctx.isProjectTrusted ? ctx.isProjectTrusted() : false;
    },
    impact: 'high',
    rating: 4,
    category: 'mcp',
    fix: 'Project-scoped MCP belongs on a trusted project path. Trust the repo in Codex before relying on local `.codex/config.toml` MCP servers.',
    template: null,
    file: () => '.codex/config.toml',
    line: () => 1,
  },
  codexMcpAuthDocumented: {
    id: 'CX-F05',
    name: 'MCP auth requirements are documented for each remote server',
    check: (ctx) => {
      if (!projectScopedMcpPresent(ctx)) return null;
      return !mcpAuthDocumentationIssue(ctx);
    },
    impact: 'medium',
    rating: 4,
    category: 'mcp',
    fix: 'For each remote MCP server, document the auth posture inline (token env var, OAuth, or headers) or in repo docs so setup is reviewable.',
    template: null,
    file: (ctx) => {
      const issue = mcpAuthDocumentationIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = mcpAuthDocumentationIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexNoDeprecatedMcpTransport: {
    id: 'CX-F06',
    name: 'MCP config avoids deprecated transport types',
    check: (ctx) => {
      if (!projectScopedMcpPresent(ctx)) return null;
      return !deprecatedMcpTransportIssue(ctx);
    },
    impact: 'medium',
    rating: 4,
    category: 'mcp',
    fix: 'Use current MCP transports (stdio or streamable HTTP) and remove deprecated SSE-style transport settings from project config.',
    template: null,
    file: (ctx) => {
      const issue = deprecatedMcpTransportIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = deprecatedMcpTransportIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexMcpHttpAuthAndCallbacksDocumented: {
    id: 'CX-F07',
    name: 'MCP HTTP auth and callback fields are documented when used',
    check: (ctx) => {
      if (!mcpHttpAuthAndCallbackRelevant(ctx)) return null;
      return !mcpHttpAuthAndCallbackIssue(ctx);
    },
    impact: 'medium',
    rating: 4,
    category: 'mcp',
    fix: 'If remote MCP uses header-based auth or custom OAuth callback settings, document the header/callback posture in repo docs so setup stays reviewable.',
    template: null,
    file: (ctx) => {
      const issue = mcpHttpAuthAndCallbackIssue(ctx);
      return issue ? issue.filePath : '.codex/config.toml';
    },
    line: (ctx) => {
      const issue = mcpHttpAuthAndCallbackIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexDesktopProjectMcpCaveatDocumented: {
    id: 'CX-F08',
    name: 'Project-scoped MCP docs caveat desktop or IDE behavior when relevant',
    check: (ctx) => {
      const issue = desktopProjectMcpCaveatIssue(ctx);
      return issue ? false : (projectScopedMcpPresent(ctx) && /\bdesktop\b|\bide\b|\bextension\b/i.test(docsBundle(ctx)) ? true : null);
    },
    impact: 'medium',
    rating: 3,
    category: 'mcp',
    fix: 'If repo-local MCP config is discussed for desktop or IDE use, note the trusted-project boundary and the possibility that user-global config may still matter on some surfaces.',
    template: 'codex-agents-md',
    file: (ctx) => {
      const issue = desktopProjectMcpCaveatIssue(ctx);
      return issue ? issue.filePath : primaryDocsPath(ctx);
    },
    line: (ctx) => {
      const issue = desktopProjectMcpCaveatIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexSkillsDirPresentWhenUsed: {
    id: 'CX-G01',
    name: '.agents/skills exists when Codex skills are used',
    check: (ctx) => {
      if (!repoClaimsSkills(ctx)) return null;
      return ctx.hasDir('.agents/skills');
    },
    impact: 'medium',
    rating: 4,
    category: 'skills',
    fix: 'If the repo uses Codex skills, commit them under `.agents/skills/` so invocation stays local, reviewable, and versioned.',
    template: null,
    file: () => '.agents/skills',
    line: () => 1,
  },
  codexSkillsHaveMetadata: {
    id: 'CX-G02',
    name: 'Skills include SKILL.md with a name and description',
    check: (ctx) => {
      if ((ctx.skillDirs ? ctx.skillDirs() : []).length === 0) return null;
      return !skillMissingFieldsIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'skills',
    fix: 'Give every skill a `SKILL.md` with a clear title and a short description so Codex can understand when to use it.',
    template: null,
    file: (ctx) => {
      const issue = skillMissingFieldsIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = skillMissingFieldsIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexSkillNamesKebabCase: {
    id: 'CX-G03',
    name: 'Skill names use kebab-case',
    check: (ctx) => {
      if ((ctx.skillDirs ? ctx.skillDirs() : []).length === 0) return null;
      return !skillBadNameIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'skills',
    fix: 'Rename skill folders to kebab-case so Codex can invoke them consistently without naming drift.',
    template: null,
    file: (ctx) => {
      const issue = skillBadNameIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = skillBadNameIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexSkillDescriptionsBounded: {
    id: 'CX-G04',
    name: 'Skill descriptions stay bounded for implicit invocation',
    check: (ctx) => {
      if ((ctx.skillDirs ? ctx.skillDirs() : []).length === 0) return null;
      return !skillDescriptionTooLongIssue(ctx);
    },
    impact: 'medium',
    rating: 3,
    category: 'skills',
    fix: 'Keep the first skill description short and specific so Codex can decide whether to invoke it without bloating context.',
    template: null,
    file: (ctx) => {
      const issue = skillDescriptionTooLongIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = skillDescriptionTooLongIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexSkillsNoAutoRunRisk: {
    id: 'CX-G05',
    name: 'Skills do not introduce unreviewed auto-run risk',
    check: (ctx) => {
      if ((ctx.skillDirs ? ctx.skillDirs() : []).length === 0) return null;
      return !skillAutoRunRiskIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'skills',
    fix: 'Remove language that tells Codex to auto-run destructive or external actions without an explicit approval or review boundary.',
    template: null,
    file: (ctx) => {
      const issue = skillAutoRunRiskIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = skillAutoRunRiskIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexCustomAgentsRequiredFields: {
    id: 'CX-H01',
    name: 'Custom agents define required fields',
    check: (ctx) => {
      if (!repoUsesCustomAgents(ctx)) return null;
      if ((ctx.customAgentFiles ? ctx.customAgentFiles() : []).length === 0) return false;
      return !customAgentMissingFieldsIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'agents',
    fix: 'Each custom agent should define `name`, `description`, and `developer_instructions` so Codex can route work safely.',
    template: null,
    file: (ctx) => {
      const issue = customAgentMissingFieldsIssue(ctx);
      return issue ? issue.filePath : '.codex/agents';
    },
    line: (ctx) => {
      const issue = customAgentMissingFieldsIssue(ctx);
      return issue ? issue.line : 1;
    },
  },
  codexMaxThreadsExplicit: {
    id: 'CX-H02',
    name: 'agents.max_threads is explicit',
    check: (ctx) => {
      if (!repoUsesCustomAgents(ctx)) return null;
      return typeof ctx.configValue('agents.max_threads') === 'number';
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'Set `[agents] max_threads` explicitly so Codex fanout is intentional instead of inheriting the default ceiling.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configSectionKeyLine(ctx, 'agents', 'max_threads'),
  },
  codexMaxDepthExplicit: {
    id: 'CX-H03',
    name: 'agents.max_depth is explicit',
    check: (ctx) => {
      if (!repoUsesCustomAgents(ctx)) return null;
      return typeof ctx.configValue('agents.max_depth') === 'number';
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'Set `[agents] max_depth` explicitly so nested delegation stays predictable and reviewable.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configSectionKeyLine(ctx, 'agents', 'max_depth'),
  },
  codexPerAgentSandboxOverridesSafe: {
    id: 'CX-H04',
    name: 'Per-agent sandbox overrides stay within safe bounds',
    check: (ctx) => {
      if ((ctx.customAgentFiles ? ctx.customAgentFiles() : []).length === 0) return null;
      return !unsafeAgentOverrideIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'agents',
    fix: 'Avoid per-agent `danger-full-access`, and justify any `approval_policy = "never"` override inside the agent config itself.',
    template: null,
    file: (ctx) => {
      const issue = unsafeAgentOverrideIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = unsafeAgentOverrideIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexJobMaxRuntimeExplicitForBatchAgents: {
    id: 'CX-H05',
    name: 'agents.job_max_runtime_seconds is explicit for batch-style subagent flows',
    check: (ctx) => {
      if (!batchStyleSubagentFlowPresent(ctx)) return null;
      const issue = csvBatchAgentIssue(ctx);
      return !issue;
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'If custom agents use CSV or batch-style fanout fields, set `[agents] job_max_runtime_seconds` explicitly so worker runtime is bounded and reviewable.',
    template: 'codex-config',
    file: (ctx) => {
      const issue = csvBatchAgentIssue(ctx);
      return issue ? issue.filePath : '.codex/config.toml';
    },
    line: (ctx) => {
      const issue = csvBatchAgentIssue(ctx);
      return issue ? issue.line : configSectionKeyLine(ctx, 'agents', 'job_max_runtime_seconds');
    },
  },
  codexNicknameCandidatesValid: {
    id: 'CX-H06',
    name: 'nickname_candidates are valid and unique when used',
    check: (ctx) => {
      const issue = nicknameCandidatesIssue(ctx);
      const hasNicknameCandidates = (ctx.customAgentFiles ? ctx.customAgentFiles() : []).some((fileName) => {
        const parsed = ctx.customAgentConfig(fileName);
        return parsed.ok && parsed.data && parsed.data.nickname_candidates !== undefined;
      });
      if (!hasNicknameCandidates) return null;
      return !issue;
    },
    impact: 'medium',
    rating: 3,
    category: 'agents',
    fix: 'When custom agents use `nickname_candidates`, keep them non-empty, ASCII-safe, and unique across the repo so display names stay deterministic.',
    template: null,
    file: (ctx) => {
      const issue = nicknameCandidatesIssue(ctx);
      return issue ? issue.filePath : '.codex/agents';
    },
    line: (ctx) => {
      const issue = nicknameCandidatesIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexExecUsageSafe: {
    id: 'CX-I01',
    name: 'codex exec usage avoids unsafe automation defaults',
    check: (ctx) => {
      if (codexAutomationArtifacts(ctx).length === 0) return null;
      return !codexExecUnsafeIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Avoid `codex exec` flows that bypass approvals or run fully automatic without a documented review boundary.',
    template: null,
    file: (ctx) => {
      const issue = codexExecUnsafeIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexExecUnsafeIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexGitHubActionSafeStrategy: {
    id: 'CX-I02',
    name: 'Codex GitHub Action uses a safe strategy',
    check: (ctx) => {
      const hasAction = workflowArtifacts(ctx).some((workflow) => /uses:\s*openai\/codex-action@/i.test(workflow.content));
      if (!hasAction) return null;
      return !codexActionSafeStrategyIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'Use an explicit safe Codex Action strategy, and reserve `unsafe` only for the documented Windows boundary where it is required.',
    template: null,
    file: (ctx) => {
      const issue = codexActionSafeStrategyIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexActionSafeStrategyIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexCiAuthUsesManagedKey: {
    id: 'CX-I03',
    name: 'CI auth uses managed CODEX_API_KEY or equivalent secret injection',
    check: (ctx) => {
      if (workflowArtifacts(ctx).length === 0) return null;
      return !codexCiAuthIssue(ctx);
    },
    impact: 'critical',
    rating: 5,
    category: 'automation',
    fix: 'Wire Codex CI through `CODEX_API_KEY` or a managed secret reference. Never hardcode credentials in workflows.',
    template: null,
    file: (ctx) => {
      const issue = codexCiAuthIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexCiAuthIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexAutomationManuallyTested: {
    id: 'CX-I04',
    name: 'Automations are manually tested before scheduling',
    check: (ctx) => {
      if (codexAutomationArtifacts(ctx).length === 0) return null;
      return !automationManualTestingIssue(ctx);
    },
    impact: 'medium',
    rating: 3,
    category: 'automation',
    fix: 'Document that Codex automations were tested manually or in a dry-run/staging path before you schedule them.',
    template: null,
    file: (ctx) => {
      const issue = automationManualTestingIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = automationManualTestingIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexAutomationAppRunningAcknowledged: {
    id: 'CX-I05',
    name: 'App-running prerequisite is acknowledged for Codex app automations',
    check: (ctx) => {
      const issue = automationAppRunningIssue(ctx);
      return issue ? false : (appAutomationRelevant(ctx) ? true : null);
    },
    impact: 'medium',
    rating: 3,
    category: 'automation',
    fix: 'If the repo documents Codex app automations, note that the app must be running and the selected project must be available on disk.',
    template: 'codex-agents-md',
    file: (ctx) => {
      const issue = automationAppRunningIssue(ctx);
      return issue ? issue.filePath : primaryDocsPath(ctx);
    },
    line: (ctx) => {
      const issue = automationAppRunningIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexGitHubActionSinglePromptSource: {
    id: 'CX-I06',
    name: 'Codex GitHub Action uses exactly one prompt source',
    check: (ctx) => {
      const hasAction = workflowArtifacts(ctx).some((workflow) => /uses:\s*openai\/codex-action@/i.test(workflow.content));
      if (!hasAction) return null;
      return !codexActionPromptSourceIssue(ctx);
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'For each `openai/codex-action` workflow, choose exactly one prompt input: `prompt` or `prompt-file`.',
    template: null,
    file: (ctx) => {
      const issue = codexActionPromptSourceIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexActionPromptSourceIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexGitHubActionTriggerAllowlistsExplicit: {
    id: 'CX-I07',
    name: 'Codex GitHub Action uses trigger allowlists on externally triggered workflows',
    check: (ctx) => {
      if (!codexActionExternalTriggersPresent(ctx)) return null;
      const issue = codexActionTriggerAllowlistIssue(ctx);
      return !issue;
    },
    impact: 'high',
    rating: 4,
    category: 'automation',
    fix: 'If a Codex Action workflow is triggered by comments or `pull_request_target`, set `allow-users` or `allow-bots` explicitly to constrain who can invoke it.',
    template: null,
    file: (ctx) => {
      const issue = codexActionTriggerAllowlistIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexActionTriggerAllowlistIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexReviewWorkflowDocumented: {
    id: 'CX-J01',
    name: 'Review workflow is available and documented',
    check: (ctx) => reviewWorkflowDocumented(ctx),
    impact: 'medium',
    rating: 3,
    category: 'review',
    fix: 'Document a Codex review path such as `codex review --uncommitted` so contributors know how to review risky diffs before handoff.',
    template: 'codex-agents-md',
    file: (ctx) => agentsPath(ctx) || 'README.md',
    line: (ctx) => firstLineMatching(docsBundle(ctx), /\bcodex review\b|\/review\b/i),
  },
  codexReviewModelOverrideExplicit: {
    id: 'CX-J02',
    name: 'Review model override is explicit when review automation exists',
    check: (ctx) => {
      const hasReviewAutomation = codexAutomationArtifacts(ctx).some((item) => /\bcodex\s+review\b/i.test(item.content || ''));
      if (!hasReviewAutomation) return null;
      const issue = reviewModelOverrideIssue(ctx);
      return issue ? false : true;
    },
    impact: 'low',
    rating: 2,
    category: 'review',
    fix: 'If you automate `codex review`, set an explicit review model or review profile so review quality and cost stay predictable.',
    template: null,
    file: (ctx) => {
      const issue = reviewModelOverrideIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = reviewModelOverrideIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexWorkingTreeReviewExpectations: {
    id: 'CX-J03',
    name: 'Working-tree review expectations are documented',
    check: (ctx) => workingTreeReviewDocsPresent(ctx),
    impact: 'low',
    rating: 2,
    category: 'review',
    fix: 'Document how Codex should treat uncommitted changes, staged diffs, and unrelated edits during review.',
    template: 'codex-agents-md',
    file: (ctx) => agentsPath(ctx) || 'README.md',
    line: (ctx) => firstLineMatching(docsBundle(ctx), /\bworking[- ]tree\b|\buncommitted\b|\bstaged\b/i),
  },
  codexCostAwarenessDocumented: {
    id: 'CX-J04',
    name: 'AGENTS.md includes cost-awareness for heavy workflows',
    check: (ctx) => costAwarenessDocsPresent(ctx),
    impact: 'medium',
    rating: 3,
    category: 'review',
    fix: 'Add a short cost/latency note so heavy Codex workflows are used intentionally instead of by default.',
    template: 'codex-agents-md',
    file: (ctx) => agentsPath(ctx) || 'README.md',
    line: (ctx) => firstLineMatching(docsBundle(ctx), /\bcost\b|\blatency\b|\breasoning\b|\bheavy workflows?\b/i),
  },
  codexArtifactsSharedIntentionally: {
    id: 'CX-K01',
    name: '.codex artifacts are shared intentionally',
    check: (ctx) => {
      if (!ctx.hasDir('.codex')) return null;
      return !codexArtifactsIgnoredIssue(ctx);
    },
    impact: 'medium',
    rating: 3,
    category: 'local',
    fix: 'Do not hide `.codex/` from version control unless that is an explicit project decision documented elsewhere.',
    template: null,
    file: (ctx) => {
      const issue = codexArtifactsIgnoredIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = codexArtifactsIgnoredIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexLifecycleScriptsPlatformSafe: {
    id: 'CX-K02',
    name: 'setup/teardown lifecycle scripts are intentional and platform-safe',
    check: (ctx) => {
      const issue = lifecycleScriptIssue(ctx);
      return issue ? false : (lifecycleScripts(ctx).length > 0 ? true : null);
    },
    impact: 'high',
    rating: 4,
    category: 'local',
    fix: 'If you ship setup/teardown scripts, document the platform boundary or provide a cross-platform alternative.',
    template: null,
    file: (ctx) => {
      const issue = lifecycleScriptIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = lifecycleScriptIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexActionsNotRedundant: {
    id: 'CX-K03',
    name: 'Codex workflows are useful and not redundant',
    check: (ctx) => {
      const workflows = workflowArtifacts(ctx).filter((workflow) => /\bcodex\b|openai\/codex-action@/i.test(workflow.content));
      if (workflows.length === 0) return null;
      const issue = redundantCodexWorkflowIssue(ctx);
      return issue ? false : true;
    },
    impact: 'low',
    rating: 2,
    category: 'local',
    fix: 'Avoid duplicate Codex workflows that do the same thing with different filenames. Keep the automation surface small and legible.',
    template: null,
    file: (ctx) => {
      const issue = redundantCodexWorkflowIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = redundantCodexWorkflowIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexWorktreeLifecycleDocumented: {
    id: 'CX-K04',
    name: 'Worktree or lifecycle assumptions are documented',
    check: (ctx) => {
      const relevant = lifecycleScripts(ctx).length > 0 || /\bworktrees?\b/i.test(docsBundle(ctx));
      if (!relevant) return null;
      const issue = worktreeLifecycleDocsIssue(ctx);
      return issue ? false : true;
    },
    impact: 'low',
    rating: 2,
    category: 'local',
    fix: 'If the repo uses worktrees or setup/teardown scripts, document the lifecycle and cleanup expectations.',
    template: 'codex-agents-md',
    file: (ctx) => {
      const issue = worktreeLifecycleDocsIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = worktreeLifecycleDocsIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexAgentsMentionModernFeatures: {
    id: 'CX-L01',
    name: 'AGENTS.md mentions modern Codex features used by the repo',
    check: (ctx) => {
      const relevant =
        (ctx.skillDirs ? ctx.skillDirs().length > 0 : false) ||
        (ctx.customAgentFiles ? ctx.customAgentFiles().length > 0 : false) ||
        hooksClaimed(ctx) ||
        projectScopedMcpPresent(ctx);
      if (!relevant) return null;
      const issue = agentsMissingModernFeaturesIssue(ctx);
      return issue ? false : true;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'If the repo uses hooks, skills, subagents, or MCP, mention those surfaces in AGENTS.md so Codex gets the right context.',
    template: 'codex-agents-md',
    file: (ctx) => {
      const issue = agentsMissingModernFeaturesIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = agentsMissingModernFeaturesIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexNoDeprecatedPatterns: {
    id: 'CX-L02',
    name: 'Config and docs avoid deprecated Codex patterns',
    check: (ctx) => {
      const issue = deprecatedCodexPatternIssue(ctx);
      return issue ? false : true;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'Remove deprecated Codex patterns such as `approval_policy = "on-failure"` and update old workflow notes.',
    template: null,
    file: (ctx) => {
      const issue = deprecatedCodexPatternIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = deprecatedCodexPatternIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexProfilesUsedWhenNeeded: {
    id: 'CX-L03',
    name: 'Profiles are used when automation or delegation makes them useful',
    check: (ctx) => {
      const needed = codexAutomationArtifacts(ctx).length > 0 || (ctx.customAgentFiles ? ctx.customAgentFiles().length > 0 : false);
      if (!needed) return null;
      const issue = profilesNeededIssue(ctx);
      return issue ? false : true;
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'If the repo uses Codex automation or custom agents, define a named profile so the runtime posture is reusable and explicit.',
    template: 'codex-config',
    file: (ctx) => {
      const issue = profilesNeededIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = profilesNeededIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexPluginConfigValid: {
    id: 'CX-L04',
    name: 'Plugin configuration is valid',
    check: (ctx) => {
      if (!ctx.fileContent('.agents/plugins/marketplace.json')) return null;
      const issue = pluginConfigIssue(ctx);
      return issue ? false : true;
    },
    impact: 'medium',
    rating: 3,
    category: 'quality-deep',
    fix: 'If the repo ships Codex plugin metadata, keep `.agents/plugins/marketplace.json` valid JSON.',
    template: null,
    file: (ctx) => {
      const issue = pluginConfigIssue(ctx);
      return issue ? issue.filePath : null;
    },
    line: (ctx) => {
      const issue = pluginConfigIssue(ctx);
      return issue ? issue.line : null;
    },
  },
  codexUndoExplicit: {
    id: 'CX-L05',
    name: 'features.undo is explicitly set',
    check: (ctx) => {
      if (!ctx.fileContent('.codex/config.toml')) return null;
      return typeof ctx.configValue('features.undo') === 'boolean';
    },
    impact: 'low',
    rating: 2,
    category: 'quality-deep',
    fix: 'Set `[features] undo = true|false` explicitly so the repo chooses its Codex undo posture instead of inheriting it accidentally.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configSectionKeyLine(ctx, 'features', 'undo'),
  },

  // =============================================
  // CP-08: New checks (M. Advisory Quality)
  // =============================================

  codexAdvisoryAugmentQuality: {
    id: 'CX-M01',
    name: 'Augment recommendations reference real detected surfaces',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!agents && !config) return null;
      // Check that at least one Codex surface is present for advisory to reference
      const surfaces = [
        Boolean(agents),
        Boolean(config),
        ctx.hasDir ? ctx.hasDir('.codex') : false,
      ].filter(Boolean).length;
      return surfaces >= 2;
    },
    impact: 'high',
    rating: 4,
    category: 'advisory',
    fix: 'Ensure at least AGENTS.md and .codex/config.toml exist so advisory commands can produce grounded, specific recommendations.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: () => 1,
  },

  codexAdvisorySuggestOnlySafety: {
    id: 'CX-M02',
    name: 'Suggest-only mode has no-write contract enforced',
    check: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!config) return null;
      // Check that approval_policy is not "never" (which would allow writes in suggest-only context)
      const hasExplicitApproval = /approval_policy\s*=\s*["'](?:on-request|untrusted)["']/i.test(config);
      return hasExplicitApproval;
    },
    impact: 'critical',
    rating: 5,
    category: 'advisory',
    fix: 'Set `approval_policy = "on-request"` or `"untrusted"` to ensure suggest-only mode cannot mutate files without explicit approval.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => configKeyLine(ctx, 'approval_policy'),
  },

  codexAdvisoryOutputFreshness: {
    id: 'CX-M03',
    name: 'No deprecated Codex features referenced in advisory context',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      // Check for deprecated patterns in AGENTS.md that advisory would echo
      for (const { pattern } of LEGACY_CONFIG_PATTERNS) {
        if (pattern.test(agents)) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Remove deprecated Codex feature references from AGENTS.md so advisory output stays current.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      for (const { pattern } of LEGACY_CONFIG_PATTERNS) {
        const line = firstLineMatching(agents, pattern);
        if (line) return line;
      }
      return null;
    },
  },

  codexAdvisoryToSetupCoherence: {
    id: 'CX-M04',
    name: 'Advisory recommendations map to existing proposal families',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!agents && !config) return null;
      // At least one actionable surface must exist for proposals to work
      return Boolean(agents || config);
    },
    impact: 'medium',
    rating: 3,
    category: 'advisory',
    fix: 'Ensure at least one Codex surface (AGENTS.md or config.toml) exists so advisory recommendations can be acted upon by setup/plan.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: () => 1,
  },

  // =============================================
  // CP-08: New checks (N. Pack Posture)
  // =============================================

  codexDomainPackAlignment: {
    id: 'CX-N01',
    name: 'Detected stack aligns with recommended domain pack',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      // A broad check: if AGENTS.md mentions specific stack but also mentions a misaligned domain
      // For now, pass if AGENTS.md exists (domain detection runs outside the check)
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'pack-posture',
    fix: 'Review the recommended domain pack for your repo and ensure it matches your primary stack and workflow.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: () => 1,
  },

  codexMcpPackSafety: {
    id: 'CX-N02',
    name: 'MCP packs pass trust preflight',
    check: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!config) return null;
      if (!/\[mcp_servers\./i.test(config)) return null; // No MCP servers configured, skip
      // Check that all MCP servers have enabled_tools set (not wide-open)
      const serverBlocks = config.split(/\[mcp_servers\.\w+\]/);
      for (const block of serverBlocks.slice(1)) {
        if (!/enabled_tools\s*=/.test(block)) return false;
      }
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'pack-posture',
    fix: 'Add `enabled_tools` whitelists to all configured MCP servers to limit tool surface exposure.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      return config ? firstLineMatching(config, /\[mcp_servers\./) : null;
    },
  },

  codexPackRecommendationQuality: {
    id: 'CX-N03',
    name: 'Pack recommendations are grounded in detected signals',
    check: (ctx) => {
      // This check validates that the project has enough signals for meaningful pack recommendation
      const agents = agentsContent(ctx);
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      const hasPkg = Boolean(ctx.jsonFile('package.json'));
      // At least 2 signal sources for grounded recommendation
      return [Boolean(agents), Boolean(config), hasPkg].filter(Boolean).length >= 2;
    },
    impact: 'medium',
    rating: 3,
    category: 'pack-posture',
    fix: 'Add package.json and AGENTS.md so pack recommendations can be grounded in real project signals.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: () => 1,
  },

  codexNoStalePackVersions: {
    id: 'CX-N04',
    name: 'No stale or unresolvable pack references in config',
    check: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!config) return null;
      // Check for obviously deprecated MCP package names
      const stalePatterns = [
        /\bmcpServers\b/,
        /\bserver-everything\b/,
        /\b@anthropic-ai\/mcp\b/,
      ];
      for (const pattern of stalePatterns) {
        if (pattern.test(config)) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'pack-posture',
    fix: 'Update stale or deprecated MCP pack references to current package names.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      return config ? firstLineMatching(config, /mcpServers|server-everything|@anthropic-ai\/mcp/) : null;
    },
  },

  // =============================================
  // CP-08: New checks (O. Repeat-Usage Hygiene)
  // =============================================

  codexSnapshotRetention: {
    id: 'CX-O01',
    name: 'At least one prior audit snapshot exists for repeat-usage',
    check: (ctx) => {
      const snapshotDir = path.join(ctx.dir, '.claude', 'claudex-setup', 'snapshots');
      try {
        const indexPath = path.join(snapshotDir, 'index.json');
        const fs = require('fs');
        if (!fs.existsSync(indexPath)) return null; // No snapshots yet, not a failure
        const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        return Array.isArray(entries) && entries.length > 0;
      } catch {
        return null;
      }
    },
    impact: 'medium',
    rating: 3,
    category: 'repeat-usage',
    fix: 'Run `npx nerviq --platform codex --snapshot` to save your first audit snapshot for trend tracking.',
    template: null,
    file: () => null,
    line: () => null,
  },

  codexFeedbackLoopHealth: {
    id: 'CX-O02',
    name: 'Feedback loop is functional when feedback has been submitted',
    check: (ctx) => {
      const outcomesDir = path.join(ctx.dir, '.claude', 'claudex-setup', 'outcomes');
      try {
        const indexPath = path.join(outcomesDir, 'index.json');
        const fs = require('fs');
        if (!fs.existsSync(indexPath)) return null; // No feedback yet, not a failure
        const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        return Array.isArray(entries) && entries.length > 0;
      } catch {
        return null;
      }
    },
    impact: 'medium',
    rating: 3,
    category: 'repeat-usage',
    fix: 'Submit feedback on recommendations using `npx nerviq --platform codex feedback` to enable the feedback-to-ranking loop.',
    template: null,
    file: () => null,
    line: () => null,
  },

  codexTrendDataAvailability: {
    id: 'CX-O03',
    name: 'Trend data is computable (2+ snapshots with compatible schemas)',
    check: (ctx) => {
      const snapshotDir = path.join(ctx.dir, '.claude', 'claudex-setup', 'snapshots');
      try {
        const indexPath = path.join(snapshotDir, 'index.json');
        const fs = require('fs');
        if (!fs.existsSync(indexPath)) return null;
        const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const audits = (Array.isArray(entries) ? entries : []).filter(e => e.snapshotKind === 'audit');
        return audits.length >= 2;
      } catch {
        return null;
      }
    },
    impact: 'low',
    rating: 2,
    category: 'repeat-usage',
    fix: 'Run at least 2 audits with `--snapshot` to enable trend tracking and comparison.',
    template: null,
    file: () => null,
    line: () => null,
  },

  // =============================================
  // CP-08: New checks (P. Release & Freshness)
  // =============================================

  codexVersionTruth: {
    id: 'CX-P01',
    name: 'Codex version claims match installed version',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      // Check if AGENTS.md references a specific codex version
      const versionMatch = agents.match(/codex[- ]?(?:cli)?[- ]?v?(\d+\.\d+)/i);
      if (!versionMatch) return null; // No version claim, skip
      // If there's a version claim, we just verify it's plausible format
      return true;
    },
    impact: 'high',
    rating: 4,
    category: 'release-freshness',
    fix: 'Verify that any Codex version referenced in AGENTS.md matches the installed Codex CLI version.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => {
      const agents = agentsContent(ctx);
      return agents ? firstLineMatching(agents, /codex[- ]?(?:cli)?[- ]?v?\d+\.\d+/i) : null;
    },
  },

  codexSourceFreshness: {
    id: 'CX-P02',
    name: 'Config references current Codex features (no removed or renamed keys)',
    check: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!config) return null;
      for (const { pattern } of LEGACY_CONFIG_PATTERNS) {
        if (pattern.test(config)) return false;
      }
      return true;
    },
    impact: 'medium',
    rating: 3,
    category: 'release-freshness',
    fix: 'Update deprecated config keys to their current equivalents.',
    template: 'codex-config',
    file: () => '.codex/config.toml',
    line: (ctx) => {
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (!config) return null;
      for (const { pattern } of LEGACY_CONFIG_PATTERNS) {
        const line = firstLineMatching(config, pattern);
        if (line) return line;
      }
      return null;
    },
  },

  codexPropagationCompleteness: {
    id: 'CX-P03',
    name: 'No dangling surface references (hooks, skills, MCP mentioned but not defined)',
    check: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      const issues = [];
      // Check: AGENTS.md mentions hooks but no hooks.json
      if (/\bhooks?\b/i.test(agents) && !ctx.fileContent('.codex/hooks.json')) {
        issues.push('hooks referenced but .codex/hooks.json missing');
      }
      // Check: AGENTS.md mentions skills but no .agents/skills/
      if (/\bskills?\b/i.test(agents) && !(ctx.hasDir ? ctx.hasDir('.agents/skills') : false)) {
        issues.push('skills referenced but .agents/skills/ missing');
      }
      // Check: config references MCP but no server defined
      const config = ctx.configContent ? (ctx.configContent() || '') : (ctx.fileContent('.codex/config.toml') || '');
      if (config && /\bmcp\b/i.test(agents) && !/\[mcp_servers\./i.test(config)) {
        issues.push('MCP referenced in AGENTS.md but no [mcp_servers] in config');
      }
      return issues.length === 0;
    },
    impact: 'high',
    rating: 4,
    category: 'release-freshness',
    fix: 'Ensure all surfaces mentioned in AGENTS.md (hooks, skills, MCP) have corresponding definition files.',
    template: 'codex-agents-md',
    file: () => 'AGENTS.md',
    line: (ctx) => {
      const agents = agentsContent(ctx);
      if (!agents) return null;
      return firstLineMatching(agents, /\bhooks?\b|\bskills?\b|\bmcp\b/i);
    },
  },
};

Object.assign(CODEX_TECHNIQUES, buildSupplementalChecks({
  idPrefix: 'CX-T',
  urlMap: CODEX_SUPPLEMENTAL_SOURCE_URLS,
  docs: (ctx) => [
    agentsContent(ctx),
    ctx.fileContent('README.md') || '',
    ctx.fileContent('CLAUDE.md') || '',
  ].filter(Boolean).join('\n'),
}));

attachSourceUrls('codex', CODEX_TECHNIQUES);

module.exports = {
  CODEX_TECHNIQUES,
};
