const { GEMINI_DOMAIN_PACKS } = require('./domain-packs');
const { GEMINI_MCP_PACKS } = require('./mcp-packs');

const GEMINI_PERMISSION_PROFILES = [
  {
    key: 'locked-down',
    label: 'Locked Down',
    risk: 'low',
    defaultSandbox: 'restricted',
    approvalPolicy: 'always-confirm',
    useWhen: 'First contact with a repo, security review, or regulated environments.',
    behavior: 'No writes, explicit confirmation for anything outside read-only operations.',
  },
  {
    key: 'normal',
    label: 'Normal',
    risk: 'medium',
    defaultSandbox: 'sandbox-enabled',
    approvalPolicy: 'prompt-on-write',
    useWhen: 'Default product work where Gemini CLI edits locally but risky commands still need review.',
    behavior: 'Balanced baseline for normal repo work with sandbox protection.',
  },
  {
    key: 'auto-edit',
    label: 'Auto Edit',
    risk: 'medium',
    defaultSandbox: 'sandbox-enabled',
    approvalPolicy: 'auto-approve-edits',
    useWhen: 'Trusted repos where file edits are pre-approved but shell commands still require confirmation.',
    behavior: 'Auto-approves file writes but prompts for shell execution and network access.',
  },
  {
    key: 'yolo',
    label: 'YOLO',
    risk: 'critical',
    defaultSandbox: 'disabled',
    approvalPolicy: 'never',
    useWhen: 'Exceptional internal debugging or fully sandboxed external environments only.',
    behavior: 'Bypasses ALL confirmation prompts. --yolo flag. Extremely dangerous in production repos. Should never be the product default.',
  },
  {
    key: 'sandboxed',
    label: 'Sandboxed',
    risk: 'low',
    defaultSandbox: 'strict-sandbox',
    approvalPolicy: 'prompt-on-escape',
    useWhen: 'Repos requiring strict filesystem isolation with explicit sandbox escape approval.',
    behavior: 'All operations run in sandbox. Any escape from sandbox requires explicit user approval.',
  },
  {
    key: 'ci-headless',
    label: 'CI Headless',
    risk: 'high',
    defaultSandbox: 'sandbox-enabled',
    approvalPolicy: 'never',
    useWhen: 'GitHub Actions, CI pipelines, or scheduled automation where the outer CI environment provides containment.',
    behavior: 'No prompts. Designed for CI contexts with CI_* environment variables. Requires GEMINI_API_KEY, not user credentials.',
  },
];

const GEMINI_HOOK_REGISTRY = [
  {
    key: 'before-tool',
    file: '.gemini/settings.json',
    triggerPoint: 'BeforeTool',
    matcher: 'tool events',
    purpose: 'Pre-flight validation before tool execution.',
    risk: 'medium',
  },
  {
    key: 'after-tool',
    file: '.gemini/settings.json',
    triggerPoint: 'AfterTool',
    matcher: 'tool events',
    purpose: 'Post-execution checks and guardrails after tool commands complete.',
    risk: 'medium',
  },
  {
    key: 'after-tool-scrub',
    file: '.gemini/settings.json',
    triggerPoint: 'AfterTool',
    matcher: 'sensitive output patterns',
    purpose: 'Scrub sensitive data (secrets, tokens, PII) from tool output before it reaches the model context. Gemini-unique hook variant.',
    risk: 'medium',
  },
  {
    key: 'session-start',
    file: '.gemini/settings.json',
    triggerPoint: 'SessionStart',
    matcher: null,
    purpose: 'Bootstrap local context, load policies, or set guardrails at session start.',
    risk: 'low',
  },
  {
    key: 'session-end',
    file: '.gemini/settings.json',
    triggerPoint: 'SessionEnd',
    matcher: null,
    purpose: 'Clean up resources, log session outcomes, or export metrics when Gemini CLI exits.',
    risk: 'low',
  },
  {
    key: 'user-prompt-submit',
    file: '.gemini/settings.json',
    triggerPoint: 'UserPromptSubmit',
    matcher: null,
    purpose: 'Validate or transform user prompts before they reach the model.',
    risk: 'low',
  },
  {
    key: 'policy-enforce',
    file: '.gemini/settings.json',
    triggerPoint: 'PolicyEnforce',
    matcher: 'policy rule violations',
    purpose: 'Enforce policy TOML rules before allowing operations. Gemini-unique hook for declarative governance.',
    risk: 'medium',
  },
];

const GEMINI_POLICY_PACKS = [
  {
    key: 'baseline-safe',
    label: 'Baseline Safe',
    modules: ['GEMINI.md baseline', 'safe settings.json', 'sandbox enabled', 'yolo disabled'],
    useWhen: 'Default local Gemini CLI rollout.',
  },
  {
    key: 'sandbox-enforced',
    label: 'Sandbox Enforced',
    modules: ['strict sandbox mode', 'filesystem isolation', 'escape approval required', 'blocked paths list'],
    useWhen: 'Repos requiring strict filesystem boundaries with no implicit sandbox escapes. Gemini-unique policy pack.',
  },
  {
    key: 'policy-governed',
    label: 'Policy Governed',
    modules: ['policy TOML files active', 'PolicyEnforce hook enabled', 'declarative rule engine', 'audit trail for violations'],
    useWhen: 'Repos using Gemini CLI declarative policy system for governance. Gemini-unique policy pack.',
  },
  {
    key: 'automation-reviewed',
    label: 'Automation Reviewed',
    modules: ['safe GitHub Action strategy', 'managed GEMINI_API_KEY', 'CI_* env detection', 'manual test note'],
    useWhen: 'Repos adding Gemini CLI workflows in CI or scheduled automation.',
  },
  {
    key: 'enterprise-strict',
    label: 'Enterprise Strict',
    modules: ['locked-down profile', 'audit trail', 'explicit governance export', 'compliance-safe settings', 'policy-governed enforcement'],
    useWhen: 'Regulated or compliance-sensitive repos where every Gemini CLI action must be auditable.',
  },
];

const GEMINI_PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Start with audit and setup on one trusted repo before enabling automation.',
    'Keep GEMINI.md and settings.json in version control so Gemini CLI behavior is reviewable.',
    'Use workflow_dispatch or manual dry runs before schedules or CI tasks.',
    'Never use --yolo in production without external sandbox containment.',
  ],
  approvals: [
    'Engineering owner approves sandbox mode and approval policy.',
    'Security owner approves any CI, automation, or --yolo posture.',
    'Pilot owner records before/after audit deltas and rollback expectations.',
    'Policy files (.gemini/policy/) require review like code changes.',
  ],
  successMetrics: [
    'Audit score delta',
    'Settings explicitness delta',
    'Time to first useful Gemini CLI task',
    'No-overwrite rate on existing repo files',
    'Policy violation detection rate',
  ],
  rollbackExpectations: [
    'Every Gemini CLI setup/apply write path should emit a rollback artifact.',
    'Re-run audit after rollback to confirm the repo returned to the expected state.',
    'Policy files can be removed to revert governance without affecting other config.',
  ],
};

function getGeminiGovernanceSummary() {
  return {
    platform: 'gemini',
    platformLabel: 'Gemini CLI',
    permissionProfiles: GEMINI_PERMISSION_PROFILES,
    hookRegistry: GEMINI_HOOK_REGISTRY,
    policyPacks: GEMINI_POLICY_PACKS,
    domainPacks: GEMINI_DOMAIN_PACKS,
    mcpPacks: GEMINI_MCP_PACKS,
    pilotRolloutKit: GEMINI_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      'The --yolo flag bypasses ALL confirmation prompts and is a critical risk if used outside a fully sandboxed environment.',
      'Code deletion bug: Gemini CLI may delete files unexpectedly during refactors — always review diffs before confirming.',
      'Rate limiting: Gemini API has per-minute and per-day rate limits that can interrupt long automation chains.',
      'CI_* environment variables change Gemini CLI behavior — ensure CI contexts use ci-headless profile explicitly.',
    ],
  };
}

module.exports = {
  getGeminiGovernanceSummary,
};
