const { DOMAIN_PACKS } = require('./domain-packs');
const { MCP_PACKS, mergeMcpServers, normalizeMcpPackKeys } = require('./mcp-packs');

const PERMISSION_PROFILES = [
  {
    key: 'read-only',
    label: 'Read-Only',
    risk: 'low',
    defaultMode: 'plan',
    useWhen: 'Security review, discovery, and first contact with a mature repo.',
    behavior: 'No file writes. Safe for audits, workshops, and approval flows.',
    deny: ['Write(**)', 'Edit(**)', 'MultiEdit(**)', 'Bash(rm -rf *)', 'Bash(git reset --hard *)'],
  },
  {
    key: 'suggest-only',
    label: 'Suggest-Only',
    risk: 'low',
    defaultMode: 'acceptEdits',
    useWhen: 'Teams want structured proposals and exported plans without automatic apply.',
    behavior: 'Generates plans and proposal bundles, but no source changes are applied.',
    deny: ['Bash(rm -rf *)', 'Bash(git reset --hard *)', 'Bash(git clean *)', 'Read(./.env*)'],
  },
  {
    key: 'safe-write',
    label: 'Safe-Write',
    risk: 'medium',
    defaultMode: 'acceptEdits',
    useWhen: 'Starter repos or tightly scoped apply flows with visible rollback.',
    behavior: 'Allows creation of missing Claude artifacts while preserving existing files.',
    deny: ['Read(./.env*)', 'Read(./secrets/**)', 'Bash(rm -rf *)', 'Bash(git push --force *)'],
  },
  {
    key: 'power-user',
    label: 'Power-User',
    risk: 'medium',
    defaultMode: 'acceptEdits',
    useWhen: 'Experienced maintainers who understand the repo and want faster iteration.',
    behavior: 'Broader local automation with fewer prompts, still without bypass defaults.',
    deny: ['Read(./.env*)', 'Bash(rm -rf *)'],
  },
  {
    key: 'internal-research',
    label: 'Internal-Research',
    risk: 'high',
    defaultMode: 'bypassPermissions',
    useWhen: 'Internal experiments only, never as a product-facing default.',
    behavior: 'Maximum autonomy for research workflows, suitable only with explicit human oversight.',
    deny: [],
  },
];

const HOOK_REGISTRY = [
  {
    key: 'protect-secrets',
    file: '.claude/hooks/protect-secrets.sh',
    triggerPoint: 'PreToolUse',
    matcher: 'Read|Write|Edit',
    purpose: 'Blocks direct access to secret or credential files before a tool runs.',
    filesTouched: [],
    sideEffects: ['Stops the action and returns a block decision when a secret path is targeted.'],
    risk: 'low',
    dryRunExample: 'Attempt to read `.env` and confirm the hook blocks the request.',
    rollbackPath: 'Remove the PreToolUse registration from settings.json.',
  },
  {
    key: 'on-edit-lint',
    file: '.claude/hooks/on-edit-lint.sh',
    triggerPoint: 'PostToolUse',
    matcher: 'Write|Edit',
    purpose: 'Runs the repo linter or formatter after file edits when tooling is available.',
    filesTouched: ['Working tree files targeted by eslint/ruff fixes'],
    sideEffects: ['May auto-fix formatting or lint issues.', 'Can modify the same files that were just edited.'],
    risk: 'medium',
    dryRunExample: 'Edit a JS or Python file and inspect whether eslint or ruff would run.',
    rollbackPath: 'Remove the PostToolUse hook entry or delete the script.',
  },
  {
    key: 'log-changes',
    file: '.claude/hooks/log-changes.sh',
    triggerPoint: 'PostToolUse',
    matcher: 'Write|Edit',
    purpose: 'Appends a durable file-change log under `.claude/logs/` for later review.',
    filesTouched: ['.claude/logs/file-changes.log'],
    sideEffects: ['Creates the logs directory on first use.', 'Adds a timestamped audit line per file change.'],
    risk: 'low',
    dryRunExample: 'Edit one file and verify the log entry is appended.',
    rollbackPath: 'Remove the PostToolUse hook entry and delete the log file if desired.',
  },
];

const POLICY_PACKS = [
  {
    key: 'baseline-engineering',
    label: 'Baseline Engineering',
    modules: ['CLAUDE.md baseline', 'commands', 'rules', 'safe-write profile'],
    useWhen: 'General product teams that want a pragmatic default.',
  },
  {
    key: 'security-sensitive',
    label: 'Security-Sensitive',
    modules: ['read-only profile', 'suggest-only mode', 'protect-secrets hook', 'approval checklist'],
    useWhen: 'Auth, payments, customer data, or regulated surfaces.',
  },
  {
    key: 'oss-friendly',
    label: 'OSS-Friendly',
    modules: ['suggest-only profile', 'minimal commands', 'light rules', 'manual merge expectations'],
    useWhen: 'Open-source repos with many external contributors.',
  },
  {
    key: 'regulated-lite',
    label: 'Regulated-Lite',
    modules: ['suggest-only or safe-write profile', 'activity artifacts', 'rollback manifests', 'benchmark evidence'],
    useWhen: 'Teams that need auditable change paths before broader adoption.',
  },
];

const PILOT_ROLLOUT_KIT = {
  recommendedScope: [
    'Pick 1-2 repos with active maintainers and low blast radius.',
    'Run discover and suggest-only first; avoid direct writes on mature repos.',
    'Choose one permission profile before any pilot starts.',
    'Define success metrics before the first benchmark run.',
  ],
  approvals: [
    'Engineering owner approves scope and rollback expectations.',
    'Security owner approves the selected permission profile and hooks.',
    'Pilot owner records the benchmark baseline and acceptance criteria.',
  ],
  successMetrics: [
    'Score delta and organic score delta',
    'Number of recommendations accepted',
    'Time to first useful Claude workflow',
    'Rollback-free apply rate',
  ],
  rollbackExpectations: [
    'Every apply batch must emit a rollback artifact.',
    'If a created artifact is rejected, delete the files listed in the rollback manifest.',
    'Record the rollback event in the activity log for auditability.',
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeUnique(existing = [], additions = []) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), ...additions])];
}

function mergeHooks(existingHooks = {}, nextHooks = {}) {
  const merged = clone(existingHooks || {});

  for (const [stage, blocks] of Object.entries(nextHooks)) {
    const targetBlocks = Array.isArray(merged[stage]) ? clone(merged[stage]) : [];
    for (const incoming of blocks) {
      const index = targetBlocks.findIndex(block => block.matcher === incoming.matcher);
      if (index === -1) {
        targetBlocks.push(clone(incoming));
        continue;
      }

      const current = targetBlocks[index];
      const existingCommands = new Set((current.hooks || []).map(hook => `${hook.type}:${hook.command}:${hook.timeout || ''}`));
      const mergedHooks = [...(current.hooks || [])];
      for (const hook of incoming.hooks || []) {
        const signature = `${hook.type}:${hook.command}:${hook.timeout || ''}`;
        if (!existingCommands.has(signature)) {
          mergedHooks.push(clone(hook));
          existingCommands.add(signature);
        }
      }
      targetBlocks[index] = { ...current, hooks: mergedHooks };
    }
    merged[stage] = targetBlocks;
  }

  return merged;
}

function getPermissionProfile(key = 'safe-write') {
  return PERMISSION_PROFILES.find(profile => profile.key === key) ||
    PERMISSION_PROFILES.find(profile => profile.key === 'safe-write');
}

function isWritableProfile(key = 'safe-write') {
  return ['safe-write', 'power-user', 'internal-research'].includes(getPermissionProfile(key).key);
}

function ensureWritableProfile(key = 'safe-write', commandName = 'apply', dryRun = false) {
  const profile = getPermissionProfile(key);
  if (!dryRun && !isWritableProfile(profile.key)) {
    throw new Error(`${commandName} requires a writable profile. Use --profile safe-write or --dry-run.`);
  }
  return profile;
}

function buildHookConfig(hookFiles, profileKey) {
  const profile = getPermissionProfile(profileKey);
  if (!isWritableProfile(profile.key)) {
    return {};
  }

  const uniqueFiles = [...new Set(hookFiles)].sort();
  if (uniqueFiles.length === 0) {
    return {};
  }

  const hookConfig = {
    PostToolUse: [{
      matcher: 'Write|Edit',
      hooks: uniqueFiles
        .filter(file => file !== 'protect-secrets.sh' && file !== 'session-start.sh')
        .map(file => ({
          type: 'command',
          command: `bash .claude/hooks/${file}`,
          timeout: 10,
        })),
    }],
  };

  if (uniqueFiles.includes('protect-secrets.sh')) {
    hookConfig.PreToolUse = [{
      matcher: 'Read|Write|Edit',
      hooks: [{
        type: 'command',
        command: 'bash .claude/hooks/protect-secrets.sh',
        timeout: 5,
      }],
    }];
  }

  if (uniqueFiles.includes('session-start.sh')) {
    hookConfig.SessionStart = [{
      matcher: '*',
      hooks: [{
        type: 'command',
        command: 'bash .claude/hooks/session-start.sh',
        timeout: 5,
      }],
    }];
  }

  if ((hookConfig.PostToolUse[0].hooks || []).length === 0) {
    delete hookConfig.PostToolUse;
  }

  return hookConfig;
}

function buildSettingsForProfile({ profileKey = 'safe-write', hookFiles = [], existingSettings = null, mcpPackKeys = [] } = {}) {
  const profile = getPermissionProfile(profileKey);
  const base = existingSettings ? clone(existingSettings) : {};
  const selectedMcpPacks = normalizeMcpPackKeys(mcpPackKeys);
  base.permissions = base.permissions || {};
  base.permissions.defaultMode = profile.defaultMode;
  base.permissions.deny = mergeUnique(base.permissions.deny, profile.deny);

  const hookConfig = buildHookConfig(hookFiles, profile.key);
  if (Object.keys(hookConfig).length > 0) {
    base.hooks = mergeHooks(base.hooks, hookConfig);
  }

  if (selectedMcpPacks.length > 0) {
    base.mcpServers = mergeMcpServers(base.mcpServers, selectedMcpPacks);
  }

  base.claudexSetup = {
    ...(base.claudexSetup || {}),
    profile: profile.key,
    mcpPacks: selectedMcpPacks,
  };

  return base;
}

function getGovernanceSummary() {
  return {
    permissionProfiles: PERMISSION_PROFILES,
    hookRegistry: HOOK_REGISTRY,
    policyPacks: POLICY_PACKS,
    domainPacks: DOMAIN_PACKS,
    mcpPacks: MCP_PACKS,
    pilotRolloutKit: PILOT_ROLLOUT_KIT,
  };
}

function printGovernanceSummary(summary, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('');
  console.log('  claudex-setup governance');
  console.log('  ═══════════════════════════════════════');
  console.log('  Safe defaults, hook transparency, and pilot guidance.');
  console.log('');

  console.log('  Permission Profiles');
  for (const profile of summary.permissionProfiles) {
    console.log(`  - ${profile.label} [${profile.risk}]`);
    console.log(`    ${profile.useWhen}`);
    console.log(`    defaultMode=${profile.defaultMode}`);
  }
  console.log('');

  console.log('  Hook Registry');
  for (const hook of summary.hookRegistry) {
    console.log(`  - ${hook.file}`);
    console.log(`    ${hook.triggerPoint} ${hook.matcher} -> ${hook.purpose}`);
  }
  console.log('');

  console.log('  Policy Packs');
  for (const pack of summary.policyPacks) {
    console.log(`  - ${pack.label}: ${pack.modules.join(', ')}`);
  }
  console.log('');

  console.log('  Domain Packs');
  for (const pack of summary.domainPacks) {
    console.log(`  - ${pack.label}: ${pack.useWhen}`);
  }
  console.log('');

  console.log('  MCP Packs');
  for (const pack of summary.mcpPacks) {
    console.log(`  - ${pack.label}: ${Object.keys(pack.servers).join(', ')}`);
  }
  console.log('');

  console.log('  Pilot Rollout Kit');
  for (const item of summary.pilotRolloutKit.recommendedScope) {
    console.log(`  - ${item}`);
  }
  console.log('');
}

module.exports = {
  PERMISSION_PROFILES,
  getPermissionProfile,
  isWritableProfile,
  ensureWritableProfile,
  buildSettingsForProfile,
  getGovernanceSummary,
  printGovernanceSummary,
};
