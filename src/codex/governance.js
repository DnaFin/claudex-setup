const { CODEX_DOMAIN_PACKS } = require('./domain-packs');
const { CODEX_MCP_PACKS } = require('./mcp-packs');

const CODEX_PERMISSION_PROFILES = [
  {
    key: 'locked-down',
    label: 'Locked Down',
    risk: 'low',
    defaultSandbox: 'read-only',
    approvalPolicy: 'untrusted',
    useWhen: 'First contact with a repo, security review, or regulated environments.',
    behavior: 'No writes, explicit escalation for anything outside trusted commands.',
  },
  {
    key: 'standard',
    label: 'Standard',
    risk: 'medium',
    defaultSandbox: 'workspace-write',
    approvalPolicy: 'on-request',
    useWhen: 'Default product work where Codex edits locally but risky commands still need review.',
    behavior: 'Balanced baseline for normal repo work.',
  },
  {
    key: 'full-auto',
    label: 'Full Auto',
    risk: 'high',
    defaultSandbox: 'workspace-write',
    approvalPolicy: 'never',
    useWhen: 'Externally sandboxed automation only, with strong repo guardrails.',
    behavior: 'No approval prompts. Suitable only when the outer environment is controlled.',
  },
  {
    key: 'unrestricted',
    label: 'Unrestricted',
    risk: 'critical',
    defaultSandbox: 'danger-full-access',
    approvalPolicy: 'never',
    useWhen: 'Exceptional internal debugging only.',
    behavior: 'Bypasses core safety boundaries and should never be the product default.',
  },
  // CP-10: New profile for CI/automation
  {
    key: 'ci-automation',
    label: 'CI Automation',
    risk: 'high',
    defaultSandbox: 'workspace-write',
    approvalPolicy: 'never',
    useWhen: 'GitHub Actions, `codex exec`, or scheduled automation where the outer CI environment provides containment.',
    behavior: 'No prompts. Designed for `codex exec` and GitHub Action contexts. Requires CODEX_API_KEY, not user credentials.',
  },
];

const CODEX_HOOK_REGISTRY = [
  {
    key: 'session-start',
    file: '.codex/hooks.json',
    triggerPoint: 'SessionStart',
    matcher: null,
    purpose: 'Bootstrap local context or guardrails at session start when hooks are supported.',
    risk: 'low',
  },
  {
    key: 'pre-tool-use',
    file: '.codex/hooks.json',
    triggerPoint: 'PreToolUse',
    matcher: 'shell or tool events',
    purpose: 'Pre-flight validation before risky work.',
    risk: 'medium',
  },
  {
    key: 'post-tool-use',
    file: '.codex/hooks.json',
    triggerPoint: 'PostToolUse',
    matcher: 'shell or tool events',
    purpose: 'Post-edit checks and guardrails after commands complete.',
    risk: 'medium',
  },
  // CP-10: Expanded hook registry
  {
    key: 'user-prompt-submit',
    file: '.codex/hooks.json',
    triggerPoint: 'UserPromptSubmit',
    matcher: null,
    purpose: 'Validate or transform user prompts before they reach the model.',
    risk: 'low',
  },
  {
    key: 'stop',
    file: '.codex/hooks.json',
    triggerPoint: 'Stop',
    matcher: null,
    purpose: 'Clean up resources or log session outcomes when Codex exits.',
    risk: 'low',
  },
  // Parity hooks to match Claude's 7
  {
    key: 'injection-defense',
    file: '.codex/hooks.json',
    triggerPoint: 'PreToolUse',
    matcher: 'fetch or web events',
    purpose: 'Validate external content for prompt injection before processing.',
    risk: 'medium',
  },
  {
    key: 'trust-drift-check',
    file: '.codex/hooks.json',
    triggerPoint: 'PostToolUse',
    matcher: 'config or agents file changes',
    purpose: 'Detect config/instruction drift after tool edits that touch trust surfaces.',
    risk: 'medium',
  },
];

const CODEX_POLICY_PACKS = [
  {
    key: 'baseline-safe',
    label: 'Baseline Safe',
    modules: ['AGENTS.md baseline', 'safe profile', 'network explicit', 'history explicit'],
    useWhen: 'Default local Codex rollout.',
  },
  {
    key: 'automation-reviewed',
    label: 'Automation Reviewed',
    modules: ['safe GitHub Action strategy', 'managed CODEX_API_KEY', 'manual test note'],
    useWhen: 'Repos adding Codex workflows in CI or scheduled automation.',
  },
  {
    key: 'skills-and-subagents',
    label: 'Skills + Subagents',
    modules: ['repo-local skills', 'custom agent field validation', 'fanout limits'],
    useWhen: 'Teams that want structured Codex specialization without losing governance.',
  },
  // CP-10: New policy packs
  {
    key: 'cloud-automation',
    label: 'Cloud Automation',
    modules: ['ci-automation profile', 'CODEX_API_KEY auth', 'exec safety review', 'cloud trust boundary'],
    useWhen: 'Repos deploying Codex in CI/CD, cloud tasks, or scheduled automation.',
  },
  {
    key: 'enterprise-strict',
    label: 'Enterprise Strict',
    modules: ['locked-down profile', 'audit trail', 'explicit governance export', 'compliance-safe history settings'],
    useWhen: 'Regulated or compliance-sensitive repos where every Codex action must be auditable.',
  },
];

const CODEX_PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Start with audit and setup on one trusted repo before enabling automation.',
    'Keep AGENTS.md and config.toml in version control so Codex behavior is reviewable.',
    'Use workflow_dispatch or manual dry runs before schedules or cloud tasks.',
  ],
  approvals: [
    'Engineering owner approves approval_policy and sandbox_mode.',
    'Security owner approves any CI, cloud, or full-auto posture.',
    'Pilot owner records before/after audit deltas and rollback expectations.',
  ],
  successMetrics: [
    'Audit score delta',
    'Config explicitness delta',
    'Time to first useful Codex task',
    'No-overwrite rate on existing repo files',
  ],
  rollbackExpectations: [
    'Every Codex setup/apply write path should emit a rollback artifact.',
    'Treat hooks on Windows as unsupported and move enforcement to CI.',
    'Re-run audit after rollback to confirm the repo returned to the expected state.',
  ],
};

function getCodexGovernanceSummary() {
  return {
    platform: 'codex',
    platformLabel: 'Codex',
    permissionProfiles: CODEX_PERMISSION_PROFILES,
    hookRegistry: CODEX_HOOK_REGISTRY,
    policyPacks: CODEX_POLICY_PACKS,
    domainPacks: CODEX_DOMAIN_PACKS,
    mcpPacks: CODEX_MCP_PACKS,
    pilotRolloutKit: CODEX_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      'Hooks are not enforced on Windows today.',
      'agents.max_threads defaults high enough to deserve an explicit cap.',
      'Cloud tasks have a different trust class than local CLI work.',
    ],
  };
}

module.exports = {
  getCodexGovernanceSummary,
};
