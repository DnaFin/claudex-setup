/**
 * OpenCode Governance — Permission profiles, policy packs, plugin governance
 *
 * OpenCode's unique permission engine with pattern matching creates
 * a richer governance surface than most platforms.
 */

const { OPENCODE_DOMAIN_PACKS } = require('./domain-packs');
const { OPENCODE_MCP_PACKS } = require('./mcp-packs');

const OPENCODE_PERMISSION_PROFILES = [
  {
    key: 'locked-down',
    label: 'Locked Down',
    risk: 'low',
    defaultPermissions: { bash: 'deny', edit: 'deny', task: 'deny', external_directory: 'deny' },
    useWhen: 'First contact with a repo, security review, or regulated environments.',
    behavior: 'Read-only access. No writes, no shell commands, explicit escalation for everything.',
  },
  {
    key: 'standard',
    label: 'Standard',
    risk: 'medium',
    defaultPermissions: { bash: 'ask', edit: 'ask', task: 'ask', read: 'allow', glob: 'allow', grep: 'allow' },
    useWhen: 'Default product work where OpenCode edits locally but risky commands need review.',
    behavior: 'Balanced baseline. Agent asks before running shell commands or editing files.',
  },
  {
    key: 'power-user',
    label: 'Power User',
    risk: 'high',
    defaultPermissions: { bash: 'allow', edit: 'allow', task: 'allow', read: 'allow', external_directory: 'ask' },
    useWhen: 'Experienced users with strong repo guardrails and version control.',
    behavior: 'Full automation with external directory check. Suitable for trusted environments.',
  },
  {
    key: 'ci-automation',
    label: 'CI Automation',
    risk: 'high',
    defaultPermissions: { bash: 'allow', edit: 'allow', task: 'allow', read: 'allow', external_directory: 'deny' },
    useWhen: 'GitHub Actions, `opencode run`, or scheduled automation with pre-configured permissions.',
    behavior: 'No prompts. All permissions pre-set. OPENCODE_DISABLE_AUTOUPDATE=1 required.',
  },
  {
    key: 'unrestricted',
    label: 'Unrestricted',
    risk: 'critical',
    defaultPermissions: { '*': 'allow' },
    useWhen: 'Exceptional internal debugging only.',
    behavior: 'Bypasses all permission boundaries. Never use in production or shared environments.',
  },
];

const OPENCODE_PLUGIN_GOVERNANCE = [
  {
    key: 'plugin-review',
    purpose: 'Review and approve all plugins before deployment.',
    risk: 'high',
    guidance: 'Plugins run in-process. Every plugin has full access to the agent runtime.',
  },
  {
    key: 'plugin-pinning',
    purpose: 'Pin npm plugin versions to prevent supply chain attacks.',
    risk: 'high',
    guidance: 'Never use @latest or version ranges for plugins. Pin exact versions.',
  },
  {
    key: 'hook-gap-awareness',
    purpose: 'Document known hook bypass bugs (#5894, #2319, #6396).',
    risk: 'medium',
    guidance: 'tool.execute.before does not intercept subagent/MCP calls. Document this limitation.',
  },
  {
    key: 'plugin-event-audit',
    purpose: 'Audit plugin event handlers for security implications.',
    risk: 'medium',
    guidance: 'Check which events each plugin listens to and what data it accesses.',
  },
];

const OPENCODE_POLICY_PACKS = [
  {
    key: 'baseline-safe',
    label: 'Baseline Safe',
    modules: ['AGENTS.md baseline', 'standard permission profile', 'explicit bash permissions'],
    useWhen: 'Default local OpenCode rollout.',
  },
  {
    key: 'automation-reviewed',
    label: 'Automation Reviewed',
    modules: ['CI permission pre-config', 'OPENCODE_DISABLE_AUTOUPDATE', 'JSON output format'],
    useWhen: 'Repos adding OpenCode workflows in CI or scheduled automation.',
  },
  {
    key: 'plugin-governed',
    label: 'Plugin Governed',
    modules: ['plugin review process', 'version pinning', 'hook gap documentation'],
    useWhen: 'Teams using OpenCode plugins that need security governance.',
  },
  {
    key: 'enterprise-strict',
    label: 'Enterprise Strict',
    modules: ['locked-down permission profile', 'audit trail', 'compliance-safe settings'],
    useWhen: 'Regulated or compliance-sensitive repos.',
  },
  {
    key: 'multi-agent',
    label: 'Multi-Agent',
    modules: ['AGENTS.md/CLAUDE.md separation', 'per-agent permissions', 'instruction array validation'],
    useWhen: 'Repos using both OpenCode and Claude Code or other agents.',
  },
];

const OPENCODE_PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Start with audit and setup on one trusted repo before enabling automation.',
    'Keep AGENTS.md and opencode.json in version control for reviewable behavior.',
    'Pre-configure all permissions for CI to avoid interactive prompt hangs.',
  ],
  approvals: [
    'Engineering owner approves permission profile and tool access.',
    'Security owner approves any plugin deployments and CI automation.',
    'Pilot owner records before/after audit deltas and rollback expectations.',
  ],
  successMetrics: [
    'Audit score delta',
    'Permission explicitness delta',
    'Time to first useful OpenCode task',
    'No-overwrite rate on existing repo files',
  ],
  rollbackExpectations: [
    'Every OpenCode setup/apply write path emits a rollback artifact.',
    'Plugin removal requires re-audit to confirm no residual effects.',
    'Re-run audit after rollback to confirm repo returned to expected state.',
  ],
};

function getOpenCodeGovernanceSummary() {
  return {
    platform: 'opencode',
    platformLabel: 'OpenCode',
    permissionProfiles: OPENCODE_PERMISSION_PROFILES,
    pluginGovernance: OPENCODE_PLUGIN_GOVERNANCE,
    policyPacks: OPENCODE_POLICY_PACKS,
    domainPacks: OPENCODE_DOMAIN_PACKS,
    mcpPacks: OPENCODE_MCP_PACKS,
    pilotRolloutKit: OPENCODE_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      'Plugin hooks do not intercept subagent or MCP tool calls (#5894, #2319).',
      'Agent deny permissions can be bypassed via SDK (#6396).',
      'Permission prompts in CI cause hangs unless pre-configured (#10411).',
      '6-level config merge hierarchy can produce unexpected overrides.',
    ],
  };
}

module.exports = {
  getOpenCodeGovernanceSummary,
};
