/**
 * Copilot Governance Module
 *
 * 6 permission profiles, 7 hook equivalents, 5 policy packs.
 *
 * Copilot-specific differences from Gemini/Codex:
 * - Org policies are admin-managed, not file-based
 * - 3 separate surfaces (VS Code, cloud, CLI) with different trust models
 * - Terminal sandbox is macOS/Linux/WSL2 only (NOT native Windows)
 * - Content exclusions are glob-based, NOT enforced on cloud agent
 */

const { COPILOT_DOMAIN_PACKS } = require('./domain-packs');
const { COPILOT_MCP_PACKS } = require('./mcp-packs');

const COPILOT_PERMISSION_PROFILES = [
  {
    key: 'locked-down',
    label: 'Locked Down',
    risk: 'low',
    defaultSandbox: 'terminal-sandbox-enabled',
    approvalPolicy: 'always-confirm',
    useWhen: 'First contact with a repo, security review, or regulated environments.',
    behavior: 'Terminal sandbox enabled, no auto-approval, content exclusions active. All tool calls require user confirmation.',
    surfaces: ['vscode'],
  },
  {
    key: 'standard',
    label: 'Standard',
    risk: 'medium',
    defaultSandbox: 'terminal-sandbox-enabled',
    approvalPolicy: 'selective-approval',
    useWhen: 'Default product work where Copilot edits locally but risky commands still need review.',
    behavior: 'Terminal sandbox enabled. Specific safe commands (test, lint) can be auto-approved. Edits require confirmation.',
    surfaces: ['vscode'],
  },
  {
    key: 'agent-mode',
    label: 'Agent Mode',
    risk: 'medium',
    defaultSandbox: 'terminal-sandbox-enabled',
    approvalPolicy: 'auto-approve-safe',
    useWhen: 'Trusted repos where Copilot agent mode is the primary workflow.',
    behavior: 'Full agent mode enabled. Auto-approval for safe terminal patterns. Terminal sandbox protects against escapes.',
    surfaces: ['vscode'],
  },
  {
    key: 'cloud-agent',
    label: 'Cloud Agent',
    risk: 'high',
    defaultSandbox: 'ephemeral-vm',
    approvalPolicy: 'pr-gate',
    useWhen: 'Cloud agent tasks assigned via GitHub Issues. Ephemeral VM provides containment.',
    behavior: 'Runs on GitHub Actions runner (Ubuntu). PRs created for review. Content exclusions NOT enforced. Cold-boot ~90 seconds.',
    surfaces: ['cloud'],
  },
  {
    key: 'enterprise-managed',
    label: 'Enterprise Managed',
    risk: 'low',
    defaultSandbox: 'org-policy-enforced',
    approvalPolicy: 'org-admin-controlled',
    useWhen: 'Enterprise tier with org-level policies, audit logs, and model access controls.',
    behavior: 'Admin-managed policies override individual settings. Audit logs enabled. MCP allowlist enforced. BYOK optional.',
    surfaces: ['vscode', 'cloud', 'cli'],
  },
  {
    key: 'no-sandbox-windows',
    label: 'No Sandbox (Windows)',
    risk: 'critical',
    defaultSandbox: 'none',
    approvalPolicy: 'always-confirm',
    useWhen: 'Native Windows environment where terminal sandbox is unavailable.',
    behavior: 'Terminal sandbox NOT available on native Windows. All terminal commands must be manually reviewed. Consider WSL2 for sandboxed execution.',
    surfaces: ['vscode'],
  },
];

const COPILOT_HOOK_REGISTRY = [
  {
    key: 'auto-approval-terminal',
    file: '.vscode/settings.json',
    triggerPoint: 'chat.agent.autoApproval.terminalCommands',
    matcher: 'terminal command patterns',
    purpose: 'Auto-approve specific terminal command patterns without user confirmation.',
    risk: 'high',
  },
  {
    key: 'auto-approval-tools',
    file: '.vscode/settings.json',
    triggerPoint: 'chat.agent.autoApproval.tools',
    matcher: 'tool name patterns',
    purpose: 'Auto-approve specific tool invocations in agent mode.',
    risk: 'high',
  },
  {
    key: 'review-instructions',
    file: '.vscode/settings.json',
    triggerPoint: 'github.copilot.chat.reviewSelection.instructions',
    matcher: 'code review context',
    purpose: 'Inject custom review instructions when Copilot reviews selected code.',
    risk: 'low',
  },
  {
    key: 'commit-message-instructions',
    file: '.vscode/settings.json',
    triggerPoint: 'github.copilot.chat.commitMessageGeneration.instructions',
    matcher: 'commit context',
    purpose: 'Guide commit message generation format and conventions.',
    risk: 'low',
  },
  {
    key: 'pr-description-instructions',
    file: '.vscode/settings.json',
    triggerPoint: 'github.copilot.chat.pullRequestDescriptionGeneration.instructions',
    matcher: 'PR context',
    purpose: 'Guide pull request description generation.',
    risk: 'low',
  },
  {
    key: 'content-exclusion',
    file: 'org-admin-settings',
    triggerPoint: 'content-exclusion-patterns',
    matcher: 'file glob patterns',
    purpose: 'Prevent Copilot from reading sensitive files. NOTE: Not enforced on cloud agent.',
    risk: 'medium',
  },
  {
    key: 'cloud-setup-steps',
    file: '.github/workflows/copilot-setup-steps.yml',
    triggerPoint: 'cloud-agent-boot',
    matcher: 'environment setup',
    purpose: 'Configure cloud agent environment: install dependencies, set env vars, prepare test commands.',
    risk: 'medium',
  },
];

const COPILOT_POLICY_PACKS = [
  {
    key: 'baseline-safe',
    label: 'Baseline Safe',
    modules: ['copilot-instructions.md baseline', 'sandbox enabled', 'no wildcard auto-approval', 'content exclusions for .env'],
    useWhen: 'Default local Copilot rollout.',
  },
  {
    key: 'cloud-agent-safe',
    label: 'Cloud Agent Safe',
    modules: ['copilot-setup-steps.yml configured', 'PR review gate', 'content exclusion gap documented', 'signed commits enabled'],
    useWhen: 'Repos using the Copilot cloud agent for automated tasks.',
  },
  {
    key: 'multi-surface-consistent',
    label: 'Multi-Surface Consistent',
    modules: ['instructions consistent across surfaces', 'MCP aligned across surfaces', 'security posture consistent'],
    useWhen: 'Repos using both VS Code agent and cloud agent.',
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    modules: ['org policies configured', 'audit logs enabled', 'MCP allowlist', 'model access policy', 'data training opt-out'],
    useWhen: 'Enterprise/Business tier repos with strict governance requirements.',
  },
  {
    key: 'privacy-first',
    label: 'Privacy First',
    modules: ['content exclusions active', 'data training opt-out', 'no secrets in instructions', 'cloud gap documented'],
    useWhen: 'Repos handling sensitive data (PII, PHI, financial) where data privacy is paramount.',
  },
];

const COPILOT_PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Start with audit and setup on one trusted repo before enabling cloud agent.',
    'Keep copilot-instructions.md and .vscode/settings.json in version control.',
    'Test cloud agent on a non-critical repo first (90s cold-boot per task).',
    'Document content exclusion limitations for the team.',
    'If on Windows, document that terminal sandbox is unavailable.',
  ],
  approvals: [
    'Engineering owner approves sandbox mode and auto-approval patterns.',
    'Security owner approves content exclusion configuration and cloud agent usage.',
    'Pilot owner records before/after audit deltas and rollback expectations.',
    'Org admin approves third-party agent policy and MCP allowlist.',
  ],
  successMetrics: [
    'Audit score delta',
    'Surface coverage (VS Code + cloud + CLI)',
    'Time to first useful Copilot agent task',
    'No-overwrite rate on existing repo files',
    'Content exclusion coverage for sensitive paths',
  ],
  rollbackExpectations: [
    'Every Copilot setup/apply write path should emit a rollback artifact.',
    'Re-run audit after rollback to confirm the repo returned to the expected state.',
    'Cloud agent can be disabled via org settings without affecting VS Code config.',
  ],
};

function getCopilotGovernanceSummary() {
  return {
    platform: 'copilot',
    platformLabel: 'GitHub Copilot',
    permissionProfiles: COPILOT_PERMISSION_PROFILES,
    hookRegistry: COPILOT_HOOK_REGISTRY,
    policyPacks: COPILOT_POLICY_PACKS,
    domainPacks: COPILOT_DOMAIN_PACKS,
    mcpPacks: COPILOT_MCP_PACKS,
    pilotRolloutKit: COPILOT_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      { id: 'cloud-content-exclusion', severity: 'critical', message: 'Content exclusions are NOT enforced on the cloud agent.' },
      { id: 'cold-boot', severity: 'medium', message: 'Cloud agent cold-boot takes ~90 seconds per task.' },
      { id: 'no-windows-sandbox', severity: 'high', message: 'Terminal sandbox is unavailable on native Windows. macOS/Linux/WSL2 only.' },
      { id: 'data-training', severity: 'medium', message: 'Interaction data used for training since April 24, 2026 (opt-out required on Free/Pro/Pro+).' },
      { id: 'agents-md-off', severity: 'high', message: 'AGENTS.md support is off by default in VS Code — must be explicitly enabled.' },
      { id: 'deprecated-codegen', severity: 'medium', message: 'codeGeneration.instructions is deprecated since VS Code 1.102 — silently ignored.' },
    ],
  };
}

module.exports = {
  getCopilotGovernanceSummary,
};
