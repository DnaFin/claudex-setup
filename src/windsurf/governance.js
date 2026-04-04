/**
 * Windsurf Governance Module
 *
 * 6 permission profiles, 7 hook equivalents, 5 policy packs.
 *
 * Windsurf-specific differences from Cursor:
 * - NO background agents (Cascade runs in foreground only)
 * - Cascade: autonomous agent with multi-file editing
 * - Memories: team-syncable persistent context
 * - Workflows: slash commands
 * - Steps: automation sequences
 * - .cascadeignore: gitignore-like for Cascade
 * - MCP with team whitelist
 * - 10K char rule limit per file
 * - 4 activation modes: Always, Auto, Agent-Requested, Manual
 */

const { WINDSURF_DOMAIN_PACKS } = require('./domain-packs');
const { WINDSURF_MCP_PACKS } = require('./mcp-packs');

const WINDSURF_PERMISSION_PROFILES = [
  {
    key: 'read-only',
    label: 'Read Only',
    risk: 'low',
    defaultSandbox: 'no-writes',
    approvalPolicy: 'always-confirm',
    useWhen: 'First contact with a repo, security review, or auditing.',
    behavior: 'Cascade can read and suggest, but all edits and terminal commands require explicit confirmation.',
    surfaces: ['foreground'],
  },
  {
    key: 'standard',
    label: 'Standard',
    risk: 'medium',
    defaultSandbox: 'user-approval',
    approvalPolicy: 'selective-approval',
    useWhen: 'Default product work where Cascade edits locally but risky commands need review.',
    behavior: 'Cascade proposes edits. Terminal commands require per-command approval.',
    surfaces: ['foreground'],
  },
  {
    key: 'cascade-agent',
    label: 'Cascade Agent',
    risk: 'medium',
    defaultSandbox: 'auto-run-trusted',
    approvalPolicy: 'auto-approve-safe',
    useWhen: 'Trusted repos where full Cascade agent mode is the primary workflow.',
    behavior: 'Full Cascade agent mode. Multi-file edits with auto-approval for safe operations.',
    surfaces: ['foreground'],
  },
  {
    key: 'steps-automation',
    label: 'Steps Automation',
    risk: 'medium',
    defaultSandbox: 'step-scoped',
    approvalPolicy: 'step-level-approval',
    useWhen: 'Complex multi-step tasks using Steps automation.',
    behavior: 'Cascade runs multi-step workflows. Each step can be reviewed before proceeding.',
    surfaces: ['foreground'],
  },
  {
    key: 'team-managed',
    label: 'Team Managed',
    risk: 'medium',
    defaultSandbox: 'team-policy',
    approvalPolicy: 'team-controlled',
    useWhen: 'Team environments with shared memories and MCP whitelist.',
    behavior: 'Team-level policies for MCP whitelist, memories sync, and workflow access.',
    surfaces: ['foreground'],
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    risk: 'low',
    defaultSandbox: 'org-policy-enforced',
    approvalPolicy: 'org-admin-controlled',
    useWhen: 'Enterprise tier with team sync, MCP whitelist, audit logs.',
    behavior: 'Admin-managed policies. MCP whitelist enforced. Audit logs and team sync policies.',
    surfaces: ['foreground'],
  },
];

const WINDSURF_HOOK_REGISTRY = [
  {
    key: 'always-rules',
    file: '.windsurf/rules/*.md',
    triggerPoint: 'trigger: always',
    matcher: 'every Cascade interaction',
    purpose: 'Inject core instructions into every Cascade interaction.',
    risk: 'low',
  },
  {
    key: 'auto-rules',
    file: '.windsurf/rules/*.md',
    triggerPoint: 'trigger: auto, globs match',
    matcher: 'file glob patterns',
    purpose: 'Inject context-specific rules when matching files are referenced.',
    risk: 'low',
  },
  {
    key: 'agent-requested-rules',
    file: '.windsurf/rules/*.md',
    triggerPoint: 'trigger: agent_requested',
    matcher: 'Cascade agent decision',
    purpose: 'Rules that Cascade can choose to apply based on description relevance.',
    risk: 'low',
  },
  {
    key: 'workflow-trigger',
    file: '.windsurf/workflows/*.md',
    triggerPoint: 'slash command invocation',
    matcher: 'user-triggered slash command',
    purpose: 'Execute predefined workflows via slash commands.',
    risk: 'medium',
  },
  {
    key: 'memory-load',
    file: '.windsurf/memories/',
    triggerPoint: 'session start',
    matcher: 'persistent context',
    purpose: 'Load team-syncable memories into Cascade context.',
    risk: 'low',
  },
  {
    key: 'cascadeignore-filter',
    file: '.cascadeignore',
    triggerPoint: 'file access',
    matcher: 'gitignore-style patterns',
    purpose: 'Prevent Cascade from accessing sensitive files.',
    risk: 'low',
  },
  {
    key: 'mcp-tool-access',
    file: '.windsurf/mcp.json',
    triggerPoint: 'MCP tool invocation',
    matcher: 'tool name/server + team whitelist',
    purpose: 'Control which MCP tools are available. Team whitelist for controlled environments.',
    risk: 'medium',
  },
];

const WINDSURF_POLICY_PACKS = [
  {
    key: 'baseline-safe',
    label: 'Baseline Safe',
    modules: ['.windsurf/rules/ with trigger: always', 'no .windsurfrules', '.cascadeignore configured', 'no secrets in rules'],
    useWhen: 'Default local Windsurf rollout.',
  },
  {
    key: 'cascade-safe',
    label: 'Cascade Safe',
    modules: ['cascadeignore for secrets', 'PR review gate', 'multi-file review before commit', 'Steps scoped'],
    useWhen: 'Repos using Cascade for autonomous multi-file editing.',
  },
  {
    key: 'team-safe',
    label: 'Team Safe',
    modules: ['MCP team whitelist', 'memories no secrets', 'shared workflows reviewed', 'sync policies documented'],
    useWhen: 'Team environments with shared Windsurf configuration.',
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    modules: ['MCP whitelist enforced', 'audit logs enabled', 'team sync policies', 'model access policy'],
    useWhen: 'Enterprise tier repos with strict governance requirements.',
  },
  {
    key: 'security-first',
    label: 'Security First',
    modules: ['.cascadeignore comprehensive', 'no secrets in any Windsurf config', 'MCP env vars secured', 'memories reviewed for PII'],
    useWhen: 'Repos handling sensitive data where security is paramount.',
  },
];

const WINDSURF_PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Start with audit and setup on one trusted repo.',
    'Keep .windsurf/rules/ and .windsurf/mcp.json in version control.',
    'Configure .cascadeignore before enabling Cascade on sensitive repos.',
    'Migrate .windsurfrules to .windsurf/rules/*.md before relying on Cascade.',
    'Review team-synced memories for secrets or PII before sharing.',
    'Test workflows on non-critical repos first.',
  ],
  approvals: [
    'Engineering owner approves Cascade usage scope and MCP whitelist.',
    'Security owner approves .cascadeignore and memory sync policies.',
    'Pilot owner records before/after audit deltas and rollback expectations.',
    'Team lead approves shared workflow definitions.',
  ],
  successMetrics: [
    'Audit score delta',
    'Surface coverage (rules + workflows + memories)',
    'Time to first useful Cascade task',
    'No-overwrite rate on existing repo files',
    'Legacy .windsurfrules migration completion',
    'MCP server whitelist compliance',
  ],
  rollbackExpectations: [
    'Every Windsurf setup/apply write path should emit a rollback artifact.',
    'Re-run audit after rollback to confirm the repo returned to expected state.',
    'Cascade can be limited by removing .windsurf/rules/ or configuring .cascadeignore.',
    'Team sync can be disabled by removing .windsurf/memories/.',
  ],
};

function getWindsurfGovernanceSummary() {
  return {
    platform: 'windsurf',
    platformLabel: 'Windsurf (Cascade)',
    permissionProfiles: WINDSURF_PERMISSION_PROFILES,
    hookRegistry: WINDSURF_HOOK_REGISTRY,
    policyPacks: WINDSURF_POLICY_PACKS,
    domainPacks: WINDSURF_DOMAIN_PACKS,
    mcpPacks: WINDSURF_MCP_PACKS,
    pilotRolloutKit: WINDSURF_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      { id: 'windsurfrules-legacy', severity: 'high', message: '.windsurfrules is legacy format — migrate to .windsurf/rules/*.md with YAML frontmatter.' },
      { id: 'no-background-agents', severity: 'info', message: 'Windsurf has NO background agents (unlike Cursor). All Cascade runs are foreground.' },
      { id: 'rule-char-limit', severity: 'medium', message: 'Windsurf enforces a 10K character limit per rule file.' },
      { id: 'memories-team-sync', severity: 'high', message: 'Memories sync across team members — never put secrets or PII in memory files.' },
      { id: 'mcp-team-whitelist', severity: 'medium', message: 'MCP servers can be whitelisted at team level. Ensure only approved servers are listed.' },
      { id: 'cascadeignore-important', severity: 'high', message: 'Use .cascadeignore to prevent Cascade from accessing sensitive files (similar to .gitignore).' },
      { id: 'cascade-multi-file', severity: 'medium', message: 'Cascade performs multi-file edits. Review all changed files before committing.' },
    ],
  };
}

module.exports = {
  getWindsurfGovernanceSummary,
};
