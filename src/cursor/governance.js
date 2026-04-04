/**
 * Cursor Governance Module
 *
 * 6 permission profiles, 7 hook equivalents, 5 policy packs.
 *
 * Cursor-specific differences from Copilot/Gemini:
 * - 3 execution surfaces: foreground (IDE), background (cloud VM), automations (event-driven)
 * - Privacy Mode OFF by default (code sent to model providers)
 * - No terminal sandbox (unlike Copilot's VS Code sandbox)
 * - Settings stored in SQLite (state.vscdb), NOT JSON
 * - Automations run without approval — trigger misconfiguration = runaway agents
 * - MCP hard limit ~40 tools, silent drop beyond
 * - Background agent has full home directory read access (security finding Nov 2025)
 */

const { CURSOR_DOMAIN_PACKS } = require('./domain-packs');
const { CURSOR_MCP_PACKS } = require('./mcp-packs');

const CURSOR_PERMISSION_PROFILES = [
  {
    key: 'read-only',
    label: 'Read Only',
    risk: 'low',
    defaultSandbox: 'no-writes',
    approvalPolicy: 'always-confirm',
    useWhen: 'First contact with a repo, security review, or auditing.',
    behavior: 'Agent can read and suggest, but all edits and terminal commands require explicit confirmation.',
    surfaces: ['foreground'],
  },
  {
    key: 'standard',
    label: 'Standard',
    risk: 'medium',
    defaultSandbox: 'user-approval',
    approvalPolicy: 'selective-approval',
    useWhen: 'Default product work where agent edits locally but risky commands need review.',
    behavior: 'Agent proposes edits. Terminal commands require per-command approval unless auto-run enabled.',
    surfaces: ['foreground'],
  },
  {
    key: 'agent-mode',
    label: 'Agent Mode',
    risk: 'medium',
    defaultSandbox: 'auto-run-trusted',
    approvalPolicy: 'auto-approve-safe',
    useWhen: 'Trusted repos where full agent mode is the primary workflow.',
    behavior: 'Full agent mode. Auto-run for trusted commands. YOLO mode available but discouraged.',
    surfaces: ['foreground'],
  },
  {
    key: 'background-agent',
    label: 'Background Agent',
    risk: 'high',
    defaultSandbox: 'ephemeral-vm',
    approvalPolicy: 'pr-gate',
    useWhen: 'Async tasks that create branches and PRs. Privacy Mode must be disabled.',
    behavior: 'Runs on ephemeral Ubuntu VM. Auto-approved terminal. Creates branch + PR. Full home directory readable (security finding). No max tool call limit.',
    surfaces: ['background'],
  },
  {
    key: 'automation',
    label: 'Automation',
    risk: 'high',
    defaultSandbox: 'ephemeral-vm',
    approvalPolicy: 'event-triggered',
    useWhen: 'Event-driven triggers (push, PR, Slack, timer). No human approval before execution.',
    behavior: 'Cloud VM per run. 30-minute cap. Diffs staged for review. Secrets via vault only. Can run hundreds per hour.',
    surfaces: ['automations'],
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    risk: 'low',
    defaultSandbox: 'org-policy-enforced',
    approvalPolicy: 'org-admin-controlled',
    useWhen: 'Enterprise tier with SSO, SCIM, audit logs, MCP/model allowlists.',
    behavior: 'Admin-managed policies. Privacy Mode enforced org-wide. Audit logs and AI code tracking APIs. BugBot for automated PR review.',
    surfaces: ['foreground', 'background', 'automations'],
  },
];

const CURSOR_HOOK_REGISTRY = [
  {
    key: 'always-apply-rules',
    file: '.cursor/rules/*.mdc',
    triggerPoint: 'alwaysApply: true',
    matcher: 'every chat and agent message',
    purpose: 'Inject core instructions into every agent interaction.',
    risk: 'low',
  },
  {
    key: 'auto-attached-rules',
    file: '.cursor/rules/*.mdc',
    triggerPoint: 'globs match',
    matcher: 'file glob patterns',
    purpose: 'Inject context-specific rules when matching files are open or referenced.',
    risk: 'low',
  },
  {
    key: 'auto-run-terminal',
    file: 'Cursor Settings (SQLite)',
    triggerPoint: 'terminal command execution',
    matcher: 'terminal command patterns',
    purpose: 'Auto-approve terminal commands without user confirmation (YOLO mode).',
    risk: 'critical',
  },
  {
    key: 'automation-trigger',
    file: '.cursor/automations/*.yaml',
    triggerPoint: 'event (push, PR, Slack, timer, webhook)',
    matcher: 'event configuration',
    purpose: 'Trigger cloud agent execution on specified events. Runs WITHOUT approval.',
    risk: 'high',
  },
  {
    key: 'bugbot-review',
    file: 'BugBot config (per-repo)',
    triggerPoint: 'PR opened/updated',
    matcher: 'PR diff',
    purpose: 'Automated code review on PRs. Can spawn cloud agent for auto-fixes.',
    risk: 'medium',
  },
  {
    key: 'environment-setup',
    file: '.cursor/environment.json',
    triggerPoint: 'background agent boot',
    matcher: 'VM configuration',
    purpose: 'Configure background agent VM: base image, env vars, persisted dirs, processes.',
    risk: 'medium',
  },
  {
    key: 'mcp-tool-approval',
    file: '.cursor/mcp.json',
    triggerPoint: 'MCP tool invocation',
    matcher: 'tool name/server',
    purpose: 'Control which MCP tools are available. Auto-run model for approved tools.',
    risk: 'medium',
  },
];

const CURSOR_POLICY_PACKS = [
  {
    key: 'baseline-safe',
    label: 'Baseline Safe',
    modules: ['.cursor/rules/ with alwaysApply', 'no .cursorrules', 'Privacy Mode awareness', 'no secrets in rules'],
    useWhen: 'Default local Cursor rollout.',
  },
  {
    key: 'background-agent-safe',
    label: 'Background Agent Safe',
    modules: ['environment.json configured', 'PR review gate', 'KMS secrets only', 'no direct push to main'],
    useWhen: 'Repos using background agents for async tasks.',
  },
  {
    key: 'automation-safe',
    label: 'Automation Safe',
    modules: ['scoped triggers (no wildcards)', 'debounce on frequent events', 'error notification', 'rate limits documented'],
    useWhen: 'Repos using event-driven automations.',
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    modules: ['SSO configured', 'audit logs enabled', 'MCP allowlist', 'Privacy Mode enforced', 'model access policy'],
    useWhen: 'Enterprise tier repos with strict governance requirements.',
  },
  {
    key: 'privacy-first',
    label: 'Privacy First',
    modules: ['Privacy Mode enabled', 'no secrets in any Cursor config', 'MCP env vars use ${env:} syntax', 'background agent home dir exposure documented'],
    useWhen: 'Repos handling sensitive data where Privacy Mode and data protection are paramount.',
  },
];

const CURSOR_PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Start with audit and setup on one trusted repo before enabling background agents.',
    'Keep .cursor/rules/ and .cursor/mcp.json in version control.',
    'Enable Privacy Mode before using with sensitive code.',
    'Migrate .cursorrules to .cursor/rules/*.mdc before relying on agent mode.',
    'Test background agents on a non-critical repo first.',
    'If using automations, start with manual triggers before event-driven.',
  ],
  approvals: [
    'Engineering owner approves auto-run terminal policy and background agent usage.',
    'Security owner approves Privacy Mode status and MCP server allowlist.',
    'Pilot owner records before/after audit deltas and rollback expectations.',
    'Org admin approves automation trigger scope and model access policy.',
  ],
  successMetrics: [
    'Audit score delta',
    'Surface coverage (foreground + background + automations)',
    'Time to first useful agent task',
    'No-overwrite rate on existing repo files',
    'Legacy .cursorrules migration completion',
    'MCP tool count within 40-tool limit',
  ],
  rollbackExpectations: [
    'Every Cursor setup/apply write path should emit a rollback artifact.',
    'Re-run audit after rollback to confirm the repo returned to expected state.',
    'Background agents can be disabled by removing .cursor/environment.json.',
    'Automations can be disabled by removing .cursor/automations/ directory.',
  ],
};

function getCursorGovernanceSummary() {
  return {
    platform: 'cursor',
    platformLabel: 'Cursor AI',
    permissionProfiles: CURSOR_PERMISSION_PROFILES,
    hookRegistry: CURSOR_HOOK_REGISTRY,
    policyPacks: CURSOR_POLICY_PACKS,
    domainPacks: CURSOR_DOMAIN_PACKS,
    mcpPacks: CURSOR_MCP_PACKS,
    pilotRolloutKit: CURSOR_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      { id: 'cursorrules-ignored', severity: 'critical', message: 'Agent mode ignores .cursorrules — only .cursor/rules/*.mdc files work.' },
      { id: 'privacy-off', severity: 'high', message: 'Privacy Mode OFF by default — code sent to model providers without zero-retention.' },
      { id: 'mcp-tool-limit', severity: 'medium', message: 'MCP hard limit ~40 tools. Exceeding silently drops tools without warning.' },
      { id: 'code-reversion', severity: 'critical', message: 'Code reversion risk from agent review + format-on-save + cloud sync conflict.' },
      { id: 'no-terminal-sandbox', severity: 'high', message: 'No terminal sandbox equivalent (unlike Copilot). All terminal commands execute directly.' },
      { id: 'bg-agent-home-dir', severity: 'critical', message: 'Background agents have full read access to home directory (~/.ssh/, ~/.aws/credentials, ~/.npmrc).' },
      { id: 'automation-no-approval', severity: 'high', message: 'Automations run without human approval. Misconfigured triggers = uncontrolled execution.' },
    ],
  };
}

module.exports = {
  getCursorGovernanceSummary,
};
