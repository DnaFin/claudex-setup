/**
 * Gemini CLI Premium Operator UX
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain + MCP + policy + extension packs with dedup, conflict resolution, dependency ordering
 * 2. CI Template Library — 5 GitHub Actions workflow templates for Gemini CLI automation (using run-gemini-cli action)
 * 3. Adoption Signal Gate — activate features based on local usage telemetry (5 gates)
 */

const path = require('path');
const { GEMINI_DOMAIN_PACKS } = require('./domain-packs');
const { GEMINI_MCP_PACKS } = require('./mcp-packs');

// ---------------------------------------------------------------------------
// 1. Multi-Pack Composition Engine
// ---------------------------------------------------------------------------

/** Pack dependency order — earlier = more foundational */
const PACK_DEPENDENCY_ORDER = [
  'baseline-general',
  'backend-api',
  'frontend-ui',
  'infra-platform',
  'monorepo',
  'enterprise-governed',
];

/** Specificity rank: higher = more specific, wins conflicts */
const PACK_SPECIFICITY = {
  'baseline-general': 0,
  'backend-api': 2,
  'frontend-ui': 2,
  'infra-platform': 3,
  'monorepo': 3,
  'enterprise-governed': 4,
};

/** Policy pack definitions — Gemini-unique */
const POLICY_PACKS = [
  {
    key: 'policy-file-restrictions',
    label: 'File Restrictions',
    description: 'Protect sensitive files from unreviewed edits.',
    policyContent: {
      'file-restrictions': {
        deny_edit: ['.env', '.env.*', '*.pem', '*.key', 'credentials.*'],
        deny_delete: ['.env', '.env.*', '*.pem', '*.key', '*.lock'],
        read_only_dirs: ['.git', 'node_modules', '.gemini/policy'],
      },
    },
  },
  {
    key: 'policy-tool-restrictions',
    label: 'Tool Restrictions',
    description: 'Limit which tools the agent can invoke without approval.',
    policyContent: {
      'tool-restrictions': {
        deny_tools: ['shell_exec_unsafe', 'network_raw'],
        require_approval: ['file_delete', 'git_push', 'deploy'],
      },
    },
  },
  {
    key: 'policy-governance',
    label: 'Governance',
    description: 'Strict audit and escalation policies for enterprise use.',
    policyContent: {
      governance: {
        audit_trail: true,
        escalation_on_deny: true,
        max_auto_edits_per_session: 50,
        require_justification_for: ['security-override', 'policy-bypass'],
      },
    },
  },
];

/** Extension pack definitions — Gemini-unique */
const EXTENSION_PACKS = [
  {
    key: 'ext-code-review',
    label: 'Code Review Extension',
    description: 'Structured code review with severity ratings and inline suggestions.',
  },
  {
    key: 'ext-test-gen',
    label: 'Test Generation Extension',
    description: 'Auto-generate test stubs for new or modified files.',
  },
  {
    key: 'ext-docs-sync',
    label: 'Docs Sync Extension',
    description: 'Detect stale documentation and suggest updates.',
  },
];

const DEFAULT_SIZE_BUDGET = 16000; // characters for combined instruction content

function lookupDomainPack(key) {
  return GEMINI_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return GEMINI_MCP_PACKS.find(p => p.key === key) || null;
}

function lookupPolicyPack(key) {
  return POLICY_PACKS.find(p => p.key === key) || null;
}

function lookupExtensionPack(key) {
  return EXTENSION_PACKS.find(p => p.key === key) || null;
}

/**
 * Compose domain packs, MCP packs, policy packs, and extension packs into a unified,
 * deduplicated, ordered result.
 *
 * @param {string[]} domainPackKeys - Array of domain pack keys to compose
 * @param {string[]} mcpPackKeys - Array of MCP pack keys to compose
 * @param {object} [options]
 * @param {number} [options.sizeBudget] - Max characters for combined instructions (default 16000)
 * @param {string[]} [options.policyPackKeys] - Array of policy pack keys (Gemini-unique)
 * @param {string[]} [options.extensionPackKeys] - Array of extension pack keys (Gemini-unique)
 * @returns {object} Composition report
 */
function composePacks(domainPackKeys = [], mcpPackKeys = [], options = {}) {
  const sizeBudget = options.sizeBudget || DEFAULT_SIZE_BUDGET;
  const policyPackKeys = options.policyPackKeys || [];
  const extensionPackKeys = options.extensionPackKeys || [];
  const warnings = [];

  // --- Resolve domain packs ---
  const seenDomainKeys = new Set();
  const rawDomainPacks = [];
  for (const key of domainPackKeys) {
    if (seenDomainKeys.has(key)) continue;
    seenDomainKeys.add(key);
    const pack = lookupDomainPack(key);
    if (!pack) {
      warnings.push(`Domain pack "${key}" not found, skipped.`);
      continue;
    }
    rawDomainPacks.push(pack);
  }

  // Order by dependency (base -> framework -> tool-specific)
  rawDomainPacks.sort((a, b) => {
    const orderA = PACK_DEPENDENCY_ORDER.indexOf(a.key);
    const orderB = PACK_DEPENDENCY_ORDER.indexOf(b.key);
    return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
  });

  // Deduplicate overlapping recommendedModules; more specific pack wins
  const moduleOwner = new Map(); // module -> { key, specificity }
  for (const pack of rawDomainPacks) {
    const specificity = PACK_SPECIFICITY[pack.key] ?? 1;
    for (const mod of pack.recommendedModules || []) {
      const existing = moduleOwner.get(mod);
      if (!existing || specificity > existing.specificity) {
        moduleOwner.set(mod, { key: pack.key, specificity });
      }
    }
  }

  // Deduplicate surfaces
  const allSurfaces = new Set();
  for (const pack of rawDomainPacks) {
    for (const surface of pack.recommendedSurfaces || []) {
      allSurfaces.add(surface);
    }
  }

  // Deduplicate proposal families
  const allProposalFamilies = new Set();
  for (const pack of rawDomainPacks) {
    for (const family of pack.recommendedProposalFamilies || []) {
      allProposalFamilies.add(family);
    }
  }

  // --- Resolve MCP packs ---
  const seenMcpKeys = new Set();
  const resolvedMcpPacks = [];
  for (const key of mcpPackKeys) {
    if (seenMcpKeys.has(key)) continue;
    seenMcpKeys.add(key);
    const pack = lookupMcpPack(key);
    if (!pack) {
      warnings.push(`MCP pack "${key}" not found, skipped.`);
      continue;
    }
    resolvedMcpPacks.push(pack);
  }

  // Merge excludeTools across all MCP packs (union — Gemini uses deny-list, not allow-list)
  const mergedExcludeTools = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const tool of pack.excludeTools || []) {
      mergedExcludeTools.add(tool);
    }
  }

  // Collect required auth (union)
  const mergedRequiredAuth = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const auth of pack.requiredAuth || []) {
      mergedRequiredAuth.add(auth);
    }
  }

  // --- Resolve policy packs (Gemini-unique) ---
  const seenPolicyKeys = new Set();
  const resolvedPolicyPacks = [];
  const mergedPolicyContent = {};
  for (const key of policyPackKeys) {
    if (seenPolicyKeys.has(key)) continue;
    seenPolicyKeys.add(key);
    const pack = lookupPolicyPack(key);
    if (!pack) {
      warnings.push(`Policy pack "${key}" not found, skipped.`);
      continue;
    }
    resolvedPolicyPacks.push(pack);
    // Merge policy content sections
    if (pack.policyContent) {
      for (const [section, rules] of Object.entries(pack.policyContent)) {
        if (!mergedPolicyContent[section]) {
          mergedPolicyContent[section] = { ...rules };
        } else {
          // Merge arrays, overwrite scalars
          for (const [ruleKey, ruleValue] of Object.entries(rules)) {
            if (Array.isArray(ruleValue) && Array.isArray(mergedPolicyContent[section][ruleKey])) {
              const merged = new Set([...mergedPolicyContent[section][ruleKey], ...ruleValue]);
              mergedPolicyContent[section][ruleKey] = [...merged];
            } else {
              mergedPolicyContent[section][ruleKey] = ruleValue;
            }
          }
        }
      }
    }
  }

  // --- Resolve extension packs (Gemini-unique) ---
  const seenExtKeys = new Set();
  const resolvedExtensionPacks = [];
  for (const key of extensionPackKeys) {
    if (seenExtKeys.has(key)) continue;
    seenExtKeys.add(key);
    const pack = lookupExtensionPack(key);
    if (!pack) {
      warnings.push(`Extension pack "${key}" not found, skipped.`);
      continue;
    }
    resolvedExtensionPacks.push(pack);
  }

  // --- Size budget tracking ---
  const estimatedSize = estimateCompositionSize(rawDomainPacks, resolvedMcpPacks, resolvedPolicyPacks, resolvedExtensionPacks);
  const overBudget = estimatedSize > sizeBudget;
  if (overBudget) {
    warnings.push(
      `Combined instruction size (~${estimatedSize} chars) exceeds budget (${sizeBudget}). ` +
      `Consider removing lower-priority packs.`
    );
  }

  return {
    domainPacks: rawDomainPacks.map(p => ({
      key: p.key,
      label: p.label,
      modulesOwned: [...moduleOwner.entries()]
        .filter(([, owner]) => owner.key === p.key)
        .map(([mod]) => mod),
    })),
    mcpPacks: resolvedMcpPacks.map(p => ({
      key: p.key,
      label: p.label,
      serverName: p.serverName,
      trustLevel: p.trustLevel,
    })),
    policyPacks: resolvedPolicyPacks.map(p => ({
      key: p.key,
      label: p.label,
      description: p.description,
    })),
    extensionPacks: resolvedExtensionPacks.map(p => ({
      key: p.key,
      label: p.label,
      description: p.description,
    })),
    merged: {
      surfaces: [...allSurfaces],
      proposalFamilies: [...allProposalFamilies],
      modules: [...moduleOwner.entries()].map(([mod, owner]) => ({ module: mod, owner: owner.key })),
      excludeTools: [...mergedExcludeTools].sort(),
      requiredAuth: [...mergedRequiredAuth].sort(),
      policyContent: mergedPolicyContent,
    },
    budget: {
      estimatedSize,
      limit: sizeBudget,
      overBudget,
      utilization: Math.round((estimatedSize / sizeBudget) * 100),
    },
    warnings,
  };
}

function estimateCompositionSize(domainPacks, mcpPacks, policyPacks = [], extensionPacks = []) {
  let size = 0;
  for (const pack of domainPacks) {
    size += (pack.label || '').length + (pack.useWhen || '').length + (pack.adoption || '').length;
    size += JSON.stringify(pack.recommendedModules || []).length;
    size += JSON.stringify(pack.benchmarkFocus || []).length;
  }
  for (const pack of mcpPacks) {
    size += (pack.label || '').length + (pack.description || '').length;
    size += JSON.stringify(pack.jsonProjection || {}).length;
    size += JSON.stringify(pack.excludeTools || []).length;
  }
  for (const pack of policyPacks) {
    size += (pack.label || '').length + (pack.description || '').length;
    size += JSON.stringify(pack.policyContent || {}).length;
  }
  for (const pack of extensionPacks) {
    size += (pack.label || '').length + (pack.description || '').length;
  }
  return size;
}

// ---------------------------------------------------------------------------
// 2. CI Template Library (5 templates using run-gemini-cli action)
// ---------------------------------------------------------------------------

const CI_TEMPLATES = [
  {
    key: 'gemini-pr-review',
    label: 'Gemini PR Review',
    filename: 'gemini-pr-review.yml',
    description: 'Runs Gemini CLI review on pull request diffs.',
    trigger: 'pull_request',
  },
  {
    key: 'gemini-issue-triage',
    label: 'Gemini Issue Triage',
    filename: 'gemini-issue-triage.yml',
    description: 'Classifies and labels new issues using Gemini CLI.',
    trigger: 'issues.opened',
  },
  {
    key: 'gemini-scheduled-audit',
    label: 'Gemini Scheduled Audit',
    filename: 'gemini-scheduled-audit.yml',
    description: 'Weekly deep review of the codebase with Gemini CLI.',
    trigger: 'schedule (cron)',
  },
  {
    key: 'gemini-test-gen',
    label: 'Gemini Test Generation',
    filename: 'gemini-test-gen.yml',
    description: 'Generates test stubs for newly added files using Gemini CLI.',
    trigger: 'pull_request',
  },
  {
    key: 'gemini-docs-sync',
    label: 'Gemini Docs Sync',
    filename: 'gemini-docs-sync.yml',
    description: 'Checks for documentation staleness using Gemini CLI.',
    trigger: 'schedule (cron)',
  },
];

const TEMPLATE_CONTENT = {
  'gemini-pr-review': `# Gemini PR Review — generated by nerviq
# Runs Gemini CLI to review pull request diffs and post suggestions.
#
# CUSTOMIZE: Adjust the model, sandbox, and timeout to match your team.

name: Gemini PR Review

on:
  pull_request:
    types: [opened, synchronize]

# CUSTOMIZE: Add path filters if you only want reviews on certain directories
# paths: ['src/**', 'lib/**']

permissions:
  contents: read
  pull-requests: write

jobs:
  gemini-review:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # CUSTOMIZE: Adjust timeout for your repo size
    env:
      GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
      # CUSTOMIZE: Set DRY_RUN=true to preview without posting comments
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gemini CLI Review
        uses: google/run-gemini-cli@v1
        with:
          prompt: |
            Review the following pull request diff for issues, improvements, and best practices.
            Focus on security, performance, and correctness.
          sandbox: docker
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
`,

  'gemini-issue-triage': `# Gemini Issue Triage — generated by nerviq
# Classifies newly opened issues and applies labels using Gemini CLI.
#
# CUSTOMIZE: Edit the label mapping and classification prompt below.

name: Gemini Issue Triage

on:
  issues:
    types: [opened]

permissions:
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    timeout-minutes: 5 # CUSTOMIZE: Issues are small; 5 min is usually enough
    env:
      GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4

      - name: Classify Issue with Gemini
        uses: google/run-gemini-cli@v1
        with:
          prompt: |
            Classify this issue and suggest labels from: bug, feature, question, docs, security.
            Title: \${{ github.event.issue.title }}
            Body: \${{ github.event.issue.body }}
          sandbox: docker
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
`,

  'gemini-scheduled-audit': `# Gemini Scheduled Audit — generated by nerviq
# Weekly deep review of the codebase using Gemini CLI.
#
# CUSTOMIZE: Adjust the cron schedule and audit scope.

name: Gemini Scheduled Audit

on:
  schedule:
    - cron: '0 9 * * 1' # CUSTOMIZE: Every Monday at 09:00 UTC
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run in dry-run mode (no changes)'
        required: false
        default: 'false'

permissions:
  contents: read
  issues: write

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30 # CUSTOMIZE: Deep audits may need more time
    env:
      GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Deep Audit with Gemini
        uses: google/run-gemini-cli@v1
        with:
          prompt: |
            Perform a deep audit of this codebase. Check for:
            - Security vulnerabilities
            - Performance issues
            - Code quality concerns
            - Dependency health
            Output a structured markdown report.
          sandbox: docker
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}

      - name: Upload Report
        if: env.DRY_RUN != 'true'
        uses: actions/upload-artifact@v4
        with:
          name: gemini-audit-report
          path: audit-report.md
          retention-days: 30
`,

  'gemini-test-gen': `# Gemini Test Generation — generated by nerviq
# Generates test stubs for new files in a pull request using Gemini CLI.
#
# CUSTOMIZE: Adjust file patterns, test framework, and output directory.

name: Gemini Test Generation

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  test-gen:
    runs-on: ubuntu-latest
    timeout-minutes: 10 # CUSTOMIZE: Adjust for repo size
    env:
      GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect New Files
        id: new-files
        run: |
          FILES=$(git diff --name-only --diff-filter=A \${{ github.event.pull_request.base.sha }}..\${{ github.sha }})
          # CUSTOMIZE: Filter to source files only
          SRC_FILES=$(echo "$FILES" | grep -E '\\.(js|ts|py|go|rs|java)$' || true)
          echo "files=$SRC_FILES" >> $GITHUB_OUTPUT

      - name: Generate Test Stubs with Gemini
        if: steps.new-files.outputs.files != ''
        uses: google/run-gemini-cli@v1
        with:
          prompt: |
            Generate test stubs for the following new files:
            \${{ steps.new-files.outputs.files }}
            Use the project's existing test framework and conventions.
          sandbox: docker
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
`,

  'gemini-docs-sync': `# Gemini Docs Sync — generated by nerviq
# Checks for documentation staleness and suggests updates using Gemini CLI.
#
# CUSTOMIZE: Adjust the staleness threshold and doc paths.

name: Gemini Docs Sync

on:
  schedule:
    - cron: '0 10 * * 3' # CUSTOMIZE: Every Wednesday at 10:00 UTC
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run in dry-run mode (no changes)'
        required: false
        default: 'false'

permissions:
  contents: read
  issues: write

jobs:
  docs-check:
    runs-on: ubuntu-latest
    timeout-minutes: 10 # CUSTOMIZE: Usually fast
    env:
      GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check Doc Staleness
        run: |
          # CUSTOMIZE: Adjust paths and staleness threshold (days)
          STALE_THRESHOLD=30
          DOC_PATHS="README.md docs/ CONTRIBUTING.md"

          for doc_path in $DOC_PATHS; do
            [ ! -e "$doc_path" ] && continue
            LAST_MODIFIED=$(git log -1 --format="%ct" -- "$doc_path" 2>/dev/null || echo 0)
            NOW=$(date +%s)
            DAYS_OLD=$(( (NOW - LAST_MODIFIED) / 86400 ))
            if [ "$DAYS_OLD" -gt "$STALE_THRESHOLD" ]; then
              echo "STALE: $doc_path ($DAYS_OLD days old)"
            fi
          done

      - name: Suggest Doc Updates with Gemini
        uses: google/run-gemini-cli@v1
        with:
          prompt: |
            Review the project documentation for staleness and accuracy.
            Compare docs against the current codebase and suggest updates.
            Focus on README.md, CONTRIBUTING.md, and files in docs/.
          sandbox: docker
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
`,
};

/**
 * Get a CI template by key.
 *
 * @param {string} templateKey - One of the CI_TEMPLATES keys
 * @returns {string|null} Template content string or null if not found
 */
function getCiTemplate(templateKey) {
  const meta = CI_TEMPLATES.find(t => t.key === templateKey);
  if (!meta) return null;
  return TEMPLATE_CONTENT[templateKey] || null;
}

// ---------------------------------------------------------------------------
// 3. Adoption Signal Gate (5 gates)
// ---------------------------------------------------------------------------

/**
 * Gate thresholds: each gate defines a minimum usage signal before activation.
 * Uses local snapshot history for privacy-preserving telemetry.
 */
const GATE_THRESHOLDS = {
  'ci-templates': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate CI templates after 3+ successful audits.',
  },
  'policy-engine': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate policy engine packs after 2+ audits.',
  },
  'multi-pack': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate multi-pack composition after 2+ audits.',
  },
  'extension-marketplace': {
    metric: 'auditCount',
    threshold: 5,
    description: 'Activate extension marketplace recommendations after 5+ audits.',
  },
  'governance-upgrade': {
    metric: 'averageScore',
    threshold: 70,
    description: 'Suggest governance upgrade when average score exceeds 70.',
  },
};

/**
 * Read Gemini audit snapshot history from the local .gemini/.claudex/ directory.
 * @param {string} dir - Project directory
 * @param {number} limit - Max snapshots to read
 * @returns {object[]} Array of snapshot objects
 */
function getGeminiHistory(dir, limit = 20) {
  const fs = require('fs');
  const snapshotDir = path.join(dir, '.gemini', '.claudex', 'snapshots');
  try {
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .slice(-limit);

    return files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(snapshotDir, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if an adoption gate should be activated based on local telemetry.
 *
 * @param {string} gateKey - Key from GATE_THRESHOLDS
 * @param {string} dir - Project directory to read snapshots from
 * @returns {{ activated: boolean, current: number, threshold: number, gate: string, description: string }}
 */
function checkAdoptionGate(gateKey, dir) {
  const gate = GATE_THRESHOLDS[gateKey];
  if (!gate) {
    return {
      activated: false,
      current: 0,
      threshold: 0,
      gate: gateKey,
      description: `Unknown gate "${gateKey}".`,
    };
  }

  const history = getGeminiHistory(dir, 100);
  let current = 0;

  switch (gate.metric) {
    case 'auditCount':
      current = history.length;
      break;
    case 'averageScore': {
      const scores = history
        .map(e => e.summary?.score)
        .filter(s => typeof s === 'number');
      current = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      break;
    }
    default:
      current = 0;
  }

  return {
    activated: current >= gate.threshold,
    current,
    threshold: gate.threshold,
    gate: gateKey,
    description: gate.description,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  composePacks,
  getCiTemplate,
  CI_TEMPLATES,
  checkAdoptionGate,
  // Internals exposed for testing
  GATE_THRESHOLDS,
  PACK_DEPENDENCY_ORDER,
  PACK_SPECIFICITY,
  DEFAULT_SIZE_BUDGET,
  POLICY_PACKS,
  EXTENSION_PACKS,
};
