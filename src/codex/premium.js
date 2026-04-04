/**
 * Codex Premium Operator UX — CP-15
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain + MCP packs with dedup, conflict resolution, dependency ordering
 * 2. CI Template Library — 5 GitHub Actions workflow templates for Codex automation
 * 3. Adoption Signal Gate — activate features based on local usage telemetry
 */

const path = require('path');
const { CODEX_DOMAIN_PACKS } = require('./domain-packs');
const { CODEX_MCP_PACKS } = require('./mcp-packs');
const { getCodexHistory } = require('./activity');

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

const DEFAULT_SIZE_BUDGET = 16000; // characters for combined instruction content

function lookupDomainPack(key) {
  return CODEX_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return CODEX_MCP_PACKS.find(p => p.key === key) || null;
}

/**
 * Compose domain packs and MCP packs into a unified, deduplicated, ordered result.
 *
 * @param {string[]} domainPackKeys - Array of domain pack keys to compose
 * @param {string[]} mcpPackKeys - Array of MCP pack keys to compose
 * @param {object} [options]
 * @param {number} [options.sizeBudget] - Max characters for combined instructions (default 16000)
 * @returns {object} Composition report
 */
function composePacks(domainPackKeys = [], mcpPackKeys = [], options = {}) {
  const sizeBudget = options.sizeBudget || DEFAULT_SIZE_BUDGET;
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

  // Order by dependency (base → framework → tool-specific)
  rawDomainPacks.sort((a, b) => {
    const orderA = PACK_DEPENDENCY_ORDER.indexOf(a.key);
    const orderB = PACK_DEPENDENCY_ORDER.indexOf(b.key);
    return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
  });

  // Deduplicate overlapping recommendedModules; more specific pack wins
  const moduleOwner = new Map(); // module → { key, specificity }
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

  // Merge enabled_tools across all MCP packs (union, not replace)
  const mergedEnabledTools = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const tool of pack.enabledTools || []) {
      mergedEnabledTools.add(tool);
    }
  }

  // Collect required auth (union)
  const mergedRequiredAuth = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const auth of pack.requiredAuth || []) {
      mergedRequiredAuth.add(auth);
    }
  }

  // --- Size budget tracking ---
  const estimatedSize = estimateCompositionSize(rawDomainPacks, resolvedMcpPacks);
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
    merged: {
      surfaces: [...allSurfaces],
      proposalFamilies: [...allProposalFamilies],
      modules: [...moduleOwner.entries()].map(([mod, owner]) => ({ module: mod, owner: owner.key })),
      enabledTools: [...mergedEnabledTools].sort(),
      requiredAuth: [...mergedRequiredAuth].sort(),
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

function estimateCompositionSize(domainPacks, mcpPacks) {
  let size = 0;
  for (const pack of domainPacks) {
    size += (pack.label || '').length + (pack.useWhen || '').length + (pack.adoption || '').length;
    size += JSON.stringify(pack.recommendedModules || []).length;
    size += JSON.stringify(pack.benchmarkFocus || []).length;
  }
  for (const pack of mcpPacks) {
    size += (pack.label || '').length + (pack.description || '').length;
    size += JSON.stringify(pack.tomlProjection || {}).length;
    size += JSON.stringify(pack.enabledTools || []).length;
  }
  return size;
}

// ---------------------------------------------------------------------------
// 2. CI Template Library
// ---------------------------------------------------------------------------

const CI_TEMPLATES = [
  {
    key: 'codex-pr-review',
    label: 'Codex PR Review',
    filename: 'codex-pr-review.yml',
    description: 'Runs Codex review on pull request diffs.',
    trigger: 'pull_request',
  },
  {
    key: 'codex-issue-triage',
    label: 'Codex Issue Triage',
    filename: 'codex-issue-triage.yml',
    description: 'Classifies and labels new issues using Codex.',
    trigger: 'issues.opened',
  },
  {
    key: 'codex-scheduled-audit',
    label: 'Codex Scheduled Audit',
    filename: 'codex-scheduled-audit.yml',
    description: 'Weekly deep review of the codebase with Codex.',
    trigger: 'schedule (cron)',
  },
  {
    key: 'codex-test-gen',
    label: 'Codex Test Generation',
    filename: 'codex-test-gen.yml',
    description: 'Generates test stubs for newly added files.',
    trigger: 'pull_request',
  },
  {
    key: 'codex-docs-sync',
    label: 'Codex Docs Sync',
    filename: 'codex-docs-sync.yml',
    description: 'Checks for documentation staleness.',
    trigger: 'schedule (cron)',
  },
];

const TEMPLATE_CONTENT = {
  'codex-pr-review': `# Codex PR Review — generated by nerviq (CP-15)
# Runs Codex to review pull request diffs and post suggestions.
#
# CUSTOMIZE: Adjust the model, approval_policy, and timeout to match your team.

name: Codex PR Review

on:
  pull_request:
    types: [opened, synchronize]

# CUSTOMIZE: Add path filters if you only want reviews on certain directories
# paths: ['src/**', 'lib/**']

permissions:
  contents: read
  pull-requests: write

jobs:
  codex-review:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # CUSTOMIZE: Adjust timeout for your repo size
    env:
      CODEX_API_KEY: \${{ secrets.CODEX_API_KEY }}
      # CUSTOMIZE: Set DRY_RUN=true to preview without posting comments
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Codex CLI
        run: npm install -g @openai/codex

      - name: Run Codex Review
        run: |
          DIFF=$(git diff \${{ github.event.pull_request.base.sha }}..\${{ github.sha }})
          if [ "\$DRY_RUN" = "true" ]; then
            echo "DRY RUN — would review the following diff:"
            echo "\$DIFF" | head -100
            exit 0
          fi
          echo "\$DIFF" | codex review \\
            --approval-policy suggest \\
            --format github-pr-comment
`,

  'codex-issue-triage': `# Codex Issue Triage — generated by nerviq (CP-15)
# Classifies newly opened issues and applies labels.
#
# CUSTOMIZE: Edit the label mapping and classification prompt below.

name: Codex Issue Triage

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
      CODEX_API_KEY: \${{ secrets.CODEX_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Codex CLI
        run: npm install -g @openai/codex

      - name: Classify Issue
        run: |
          TITLE="\${{ github.event.issue.title }}"
          BODY="\${{ github.event.issue.body }}"
          if [ "\$DRY_RUN" = "true" ]; then
            echo "DRY RUN — would classify: \$TITLE"
            exit 0
          fi
          # CUSTOMIZE: Adjust the classification prompt and label set
          codex classify \\
            --approval-policy suggest \\
            --labels "bug,feature,question,docs,security" \\
            --title "\$TITLE" \\
            --body "\$BODY"
`,

  'codex-scheduled-audit': `# Codex Scheduled Audit — generated by nerviq (CP-15)
# Weekly deep review of the codebase.
#
# CUSTOMIZE: Adjust the cron schedule and audit scope.

name: Codex Scheduled Audit

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
      CODEX_API_KEY: \${{ secrets.CODEX_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Codex CLI
        run: npm install -g @openai/codex

      - name: Run Deep Audit
        run: |
          if [ "\$DRY_RUN" = "true" ]; then
            echo "DRY RUN — would run full audit"
            exit 0
          fi
          # CUSTOMIZE: Add --path filters for focused audits
          codex audit \\
            --approval-policy suggest \\
            --depth deep \\
            --format markdown > audit-report.md

      - name: Upload Report
        if: env.DRY_RUN != 'true'
        uses: actions/upload-artifact@v4
        with:
          name: codex-audit-report
          path: audit-report.md
          retention-days: 30
`,

  'codex-test-gen': `# Codex Test Generation — generated by nerviq (CP-15)
# Generates test stubs for new files in a pull request.
#
# CUSTOMIZE: Adjust file patterns, test framework, and output directory.

name: Codex Test Generation

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
      CODEX_API_KEY: \${{ secrets.CODEX_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Codex CLI
        run: npm install -g @openai/codex

      - name: Detect New Files
        id: new-files
        run: |
          FILES=$(git diff --name-only --diff-filter=A \${{ github.event.pull_request.base.sha }}..\${{ github.sha }})
          # CUSTOMIZE: Filter to source files only
          SRC_FILES=$(echo "\$FILES" | grep -E '\\.(js|ts|py|go|rs|java)$' || true)
          echo "files=\$SRC_FILES" >> \$GITHUB_OUTPUT

      - name: Generate Test Stubs
        if: steps.new-files.outputs.files != ''
        run: |
          if [ "\$DRY_RUN" = "true" ]; then
            echo "DRY RUN — would generate tests for:"
            echo "\${{ steps.new-files.outputs.files }}"
            exit 0
          fi
          echo "\${{ steps.new-files.outputs.files }}" | while read -r file; do
            [ -z "\$file" ] && continue
            codex generate-test \\
              --approval-policy suggest \\
              --file "\$file"
          done
`,

  'codex-docs-sync': `# Codex Docs Sync — generated by nerviq (CP-15)
# Checks for documentation staleness and opens issues for stale docs.
#
# CUSTOMIZE: Adjust the staleness threshold and doc paths.

name: Codex Docs Sync

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
      CODEX_API_KEY: \${{ secrets.CODEX_API_KEY }}
      DRY_RUN: \${{ inputs.dry_run || 'false' }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Codex CLI
        run: npm install -g @openai/codex

      - name: Check Doc Staleness
        run: |
          # CUSTOMIZE: Adjust paths and staleness threshold (days)
          STALE_THRESHOLD=30
          DOC_PATHS="README.md docs/ CONTRIBUTING.md"

          if [ "\$DRY_RUN" = "true" ]; then
            echo "DRY RUN — would check staleness for: \$DOC_PATHS"
            exit 0
          fi

          for doc_path in \$DOC_PATHS; do
            [ ! -e "\$doc_path" ] && continue
            LAST_MODIFIED=$(git log -1 --format="%ct" -- "\$doc_path" 2>/dev/null || echo 0)
            NOW=$(date +%s)
            DAYS_OLD=$(( (NOW - LAST_MODIFIED) / 86400 ))
            if [ "\$DAYS_OLD" -gt "\$STALE_THRESHOLD" ]; then
              echo "STALE: \$doc_path (\$DAYS_OLD days old)"
              codex check-docs \\
                --approval-policy suggest \\
                --file "\$doc_path" \\
                --staleness-days \$DAYS_OLD
            fi
          done
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
// 3. Adoption Signal Gate
// ---------------------------------------------------------------------------

/**
 * Gate thresholds: each gate defines a minimum usage signal before activation.
 * Values represent counts of relevant events in snapshot history.
 */
const GATE_THRESHOLDS = {
  'ci-templates': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate CI templates after 3+ successful audits.',
  },
  'mcp-advanced': {
    metric: 'auditCount',
    threshold: 5,
    description: 'Activate advanced MCP packs after 5+ audits.',
  },
  'multi-pack': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate multi-pack composition after 2+ audits.',
  },
  'trend-reports': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate trend reports after 3+ snapshots.',
  },
  'governance-upgrade': {
    metric: 'averageScore',
    threshold: 70,
    description: 'Suggest governance upgrade when average score exceeds 70.',
  },
};

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

  const history = getCodexHistory(dir, 100);
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
};
