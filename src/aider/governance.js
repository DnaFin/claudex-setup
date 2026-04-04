/**
 * Aider Governance — permission profiles, policy packs, pilot rollout
 *
 * Aider governance is fundamentally simpler than IDE platforms:
 * - Git is the ONLY safety mechanism (commits before changes)
 * - No hooks, no sandbox modes, no approval policies
 * - Safety comes from: auto-commits, git history, CI gates, code review
 * - 3 model roles provide implicit trust levels
 */

const { AIDER_DOMAIN_PACKS } = require('./domain-packs');
const { AIDER_MCP_PACKS } = require('./mcp-packs');

/**
 * Aider permission profiles are git-based.
 * Since Aider has no sandbox/approval system, profiles map to
 * recommended git workflow patterns.
 */
const AIDER_PERMISSION_PROFILES = [
  {
    key: 'review-first',
    label: 'Review First',
    risk: 'low',
    defaultAutoCommits: true,
    approvalPolicy: 'manual-review',
    useWhen: 'First contact with a repo, security-sensitive work, or regulated environments.',
    behavior: 'Auto-commits enabled but all changes require manual git review before push. Use `git diff` and `git log` after each session.',
  },
  {
    key: 'standard',
    label: 'Standard',
    risk: 'medium',
    defaultAutoCommits: true,
    approvalPolicy: 'trust-with-tests',
    useWhen: 'Normal development with test and lint verification loops.',
    behavior: 'Auto-commits + auto-test + auto-lint. Changes verified automatically, manual review for complex work.',
  },
  {
    key: 'autonomous',
    label: 'Autonomous',
    risk: 'high',
    defaultAutoCommits: true,
    approvalPolicy: 'ci-gated',
    useWhen: 'Automated batch processing with CI gates for quality control.',
    behavior: 'Aider runs with --yes flag in CI. All changes go through CI pipeline before merge.',
  },
  {
    key: 'ci-headless',
    label: 'CI Headless',
    risk: 'high',
    defaultAutoCommits: true,
    approvalPolicy: 'pipeline-only',
    useWhen: 'GitHub Actions or CI automation where Aider generates PRs.',
    behavior: 'No human interaction. Changes submitted as PRs with required reviews.',
  },
];

/**
 * Git-based safety registry — Aider's safety comes from git, not hooks.
 */
const AIDER_SAFETY_REGISTRY = [
  {
    key: 'auto-commits',
    mechanism: 'git',
    purpose: 'Every Aider change creates a git commit — the primary undo mechanism.',
    risk: 'critical-if-disabled',
    configKey: 'auto-commits',
  },
  {
    key: 'dirty-commits',
    mechanism: 'git',
    purpose: 'Allow Aider to commit even with a dirty working tree.',
    risk: 'low',
    configKey: 'dirty-commits',
  },
  {
    key: 'attribute-author',
    mechanism: 'git-metadata',
    purpose: 'Tag AI-authored commits with distinct author for traceability.',
    risk: 'none',
    configKey: 'attribute-author',
  },
  {
    key: 'commit-prefix',
    mechanism: 'git-metadata',
    purpose: 'Prefix AI commits for easy filtering in git log.',
    risk: 'none',
    configKey: 'aider-commit-prefix',
  },
  {
    key: 'pre-commit-hooks',
    mechanism: 'git-hooks',
    purpose: 'Git pre-commit hooks run on Aider commits too — lint, format, etc.',
    risk: 'medium',
    configKey: null,
  },
  {
    key: 'undo-command',
    mechanism: 'git-reset',
    purpose: '/undo command reverts the last Aider commit via git.',
    risk: 'none',
    configKey: null,
  },
];

/**
 * Aider policy packs — recommended policy configurations.
 */
const AIDER_POLICY_PACKS = [
  {
    key: 'solo-dev',
    label: 'Solo Developer',
    useWhen: 'Single developer working with Aider on personal projects.',
    config: {
      'auto-commits': true,
      'auto-lint': true,
      'auto-test': true,
      'show-diffs': true,
      'attribute-author': true,
    },
    conventions: ['Document key commands (/undo, /add, /drop)', 'Set up lint and test commands'],
  },
  {
    key: 'team-standard',
    label: 'Team Standard',
    useWhen: 'Team development where Aider changes go through code review.',
    config: {
      'auto-commits': true,
      'auto-lint': true,
      'auto-test': true,
      'show-diffs': true,
      'attribute-author': true,
      'attribute-committer': true,
      'aider-commit-prefix': '"aider: "',
    },
    conventions: ['Require PR review for Aider branches', 'CI must pass before merge', 'Tag AI-authored commits'],
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    useWhen: 'Enterprise environment with compliance requirements.',
    config: {
      'auto-commits': true,
      'auto-lint': true,
      'auto-test': true,
      'show-diffs': true,
      'attribute-author': true,
      'attribute-committer': true,
      'aider-commit-prefix': '"aider: "',
    },
    conventions: [
      'All AI changes require human review',
      'CI pipeline mandatory before merge',
      'Audit trail via git log with commit prefix',
      'Convention file must include security guidelines',
      'Regular review of Aider convention file',
    ],
  },
  {
    key: 'ci-automation',
    label: 'CI Automation',
    useWhen: 'Aider running in CI/CD pipelines (headless mode).',
    config: {
      'auto-commits': true,
      'yes': true,
      'no-auto-lint': false,
      'auto-test': true,
      'attribute-author': true,
      'aider-commit-prefix': '"aider-ci: "',
    },
    conventions: [
      'All changes submitted as PRs',
      'Required reviewer approvals',
      'CI gates must pass',
      'No direct push to main',
    ],
  },
];

/**
 * Pilot rollout kit for Aider adoption.
 */
const AIDER_PILOT_ROLLOUT_KIT = {
  phasedRollout: [
    {
      phase: 1,
      label: 'Single Developer Trial',
      duration: '1-2 weeks',
      actions: [
        'Install Aider, create .aider.conf.yml',
        'Create CONVENTIONS.md with project basics',
        'Enable auto-commits and show-diffs',
        'Use on low-risk tasks first',
      ],
    },
    {
      phase: 2,
      label: 'Team Pilot',
      duration: '2-4 weeks',
      actions: [
        'Share .aider.conf.yml and CONVENTIONS.md in repo',
        'Enable auto-lint and auto-test loops',
        'Add commit prefix for AI traceability',
        'Require PR review for Aider branches',
      ],
    },
    {
      phase: 3,
      label: 'Full Adoption',
      duration: 'Ongoing',
      actions: [
        'Standardize Aider config across repos',
        'Integrate Aider into CI pipelines (optional)',
        'Regular convention file reviews',
        'Monitor AI-authored code quality metrics',
      ],
    },
  ],
  successMetrics: [
    'Time-to-resolution for Aider-assisted tasks',
    'Test pass rate on Aider-generated code',
    'Developer satisfaction scores',
    'No-overwrite rate on existing repo files',
  ],
  rollbackExpectations: [
    'Every Aider change can be undone with /undo or git revert.',
    'Convention files can be removed without breaking anything.',
    'Config file removal returns Aider to CLI-flag-only mode.',
  ],
};

function getAiderGovernanceSummary() {
  return {
    platform: 'aider',
    platformLabel: 'Aider',
    permissionProfiles: AIDER_PERMISSION_PROFILES,
    safetyRegistry: AIDER_SAFETY_REGISTRY,
    policyPacks: AIDER_POLICY_PACKS,
    domainPacks: AIDER_DOMAIN_PACKS,
    mcpPacks: AIDER_MCP_PACKS,
    pilotRolloutKit: AIDER_PILOT_ROLLOUT_KIT,
    platformCaveats: [
      'Git is the ONLY safety mechanism — do not disable auto-commits.',
      'No native MCP, hooks, or agent system.',
      'Convention files must be explicitly passed (no auto-discovery).',
      '4-level config precedence: env vars > CLI args > .aider.conf.yml > defaults.',
    ],
  };
}

module.exports = {
  getAiderGovernanceSummary,
};
