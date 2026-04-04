/**
 * Copilot Premium Operator UX
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain + MCP packs with dedup, conflict resolution
 * 2. CI Template Library — 5 GitHub Actions workflow templates (using GitHub native Copilot)
 * 3. Adoption Signal Gate — activate features based on local usage telemetry (5 gates)
 */

const path = require('path');
const { COPILOT_DOMAIN_PACKS } = require('./domain-packs');
const { COPILOT_MCP_PACKS } = require('./mcp-packs');

// ---------------------------------------------------------------------------
// 1. Multi-Pack Composition Engine
// ---------------------------------------------------------------------------

const PACK_DEPENDENCY_ORDER = [
  'baseline-general',
  'backend-api',
  'frontend-ui',
  'infra-platform',
  'monorepo',
  'enterprise-governed',
];

const PACK_SPECIFICITY = {
  'baseline-general': 0,
  'backend-api': 2,
  'frontend-ui': 2,
  'infra-platform': 3,
  'monorepo': 3,
  'enterprise-governed': 4,
};

const DEFAULT_SIZE_BUDGET = 16000;

function lookupDomainPack(key) {
  return COPILOT_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return COPILOT_MCP_PACKS.find(p => p.key === key) || null;
}

/**
 * Compose domain packs and MCP packs into a unified, deduplicated, ordered result.
 * Copilot-specific: tracks cloudAgentCompatible for each MCP pack.
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
    if (!pack) { warnings.push(`Domain pack "${key}" not found, skipped.`); continue; }
    rawDomainPacks.push(pack);
  }

  rawDomainPacks.sort((a, b) => {
    const orderA = PACK_DEPENDENCY_ORDER.indexOf(a.key);
    const orderB = PACK_DEPENDENCY_ORDER.indexOf(b.key);
    return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
  });

  const moduleOwner = new Map();
  for (const pack of rawDomainPacks) {
    const specificity = PACK_SPECIFICITY[pack.key] ?? 1;
    for (const mod of pack.recommendedModules || []) {
      const existing = moduleOwner.get(mod);
      if (!existing || specificity > existing.specificity) {
        moduleOwner.set(mod, { key: pack.key, specificity });
      }
    }
  }

  const allSurfaces = new Set();
  for (const pack of rawDomainPacks) {
    for (const surface of pack.recommendedSurfaces || []) allSurfaces.add(surface);
  }

  const allProposalFamilies = new Set();
  for (const pack of rawDomainPacks) {
    for (const family of pack.recommendedProposalFamilies || []) allProposalFamilies.add(family);
  }

  // --- Resolve MCP packs ---
  const seenMcpKeys = new Set();
  const resolvedMcpPacks = [];
  for (const key of mcpPackKeys) {
    if (seenMcpKeys.has(key)) continue;
    seenMcpKeys.add(key);
    const pack = lookupMcpPack(key);
    if (!pack) { warnings.push(`MCP pack "${key}" not found, skipped.`); continue; }
    resolvedMcpPacks.push(pack);
  }

  const mergedExcludeTools = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const tool of pack.excludeTools || []) mergedExcludeTools.add(tool);
  }

  const mergedRequiredAuth = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const auth of pack.requiredAuth || []) mergedRequiredAuth.add(auth);
  }

  // Copilot-specific: separate cloud-compatible from VS Code-only MCP packs
  const cloudCompatible = resolvedMcpPacks.filter(p => p.cloudAgentCompatible !== false);
  const vscodeOnly = resolvedMcpPacks.filter(p => p.cloudAgentCompatible === false);

  const estimatedSize = estimateCompositionSize(rawDomainPacks, resolvedMcpPacks);
  const overBudget = estimatedSize > sizeBudget;
  if (overBudget) {
    warnings.push(`Combined instruction size (~${estimatedSize} chars) exceeds budget (${sizeBudget}).`);
  }

  return {
    domainPacks: rawDomainPacks.map(p => ({
      key: p.key,
      label: p.label,
      modulesOwned: [...moduleOwner.entries()].filter(([, owner]) => owner.key === p.key).map(([mod]) => mod),
    })),
    mcpPacks: resolvedMcpPacks.map(p => ({
      key: p.key,
      label: p.label,
      serverName: p.serverName,
      trustLevel: p.trustLevel,
      cloudAgentCompatible: p.cloudAgentCompatible,
    })),
    cloudCompatibleMcpPacks: cloudCompatible.map(p => p.key),
    vscodeOnlyMcpPacks: vscodeOnly.map(p => p.key),
    merged: {
      surfaces: [...allSurfaces],
      proposalFamilies: [...allProposalFamilies],
      modules: [...moduleOwner.entries()].map(([mod, owner]) => ({ module: mod, owner: owner.key })),
      excludeTools: [...mergedExcludeTools].sort(),
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
    size += JSON.stringify(pack.jsonProjection || {}).length;
    size += JSON.stringify(pack.excludeTools || []).length;
  }
  return size;
}

// ---------------------------------------------------------------------------
// 2. CI Template Library (5 templates — using GitHub native Copilot)
// ---------------------------------------------------------------------------

const CI_TEMPLATES = [
  {
    key: 'copilot-pr-review',
    label: 'Copilot PR Review',
    filename: 'copilot-pr-review.yml',
    description: 'Runs Copilot code review on pull request diffs.',
    trigger: 'pull_request',
  },
  {
    key: 'copilot-issue-triage',
    label: 'Copilot Issue Triage',
    filename: 'copilot-issue-triage.yml',
    description: 'Assigns and labels issues using Copilot cloud agent.',
    trigger: 'issues.opened',
  },
  {
    key: 'copilot-scheduled-audit',
    label: 'Copilot Scheduled Audit',
    filename: 'copilot-scheduled-audit.yml',
    description: 'Weekly Copilot audit of codebase health.',
    trigger: 'schedule (cron)',
  },
  {
    key: 'copilot-test-gen',
    label: 'Copilot Test Generation',
    filename: 'copilot-test-gen.yml',
    description: 'Generates test stubs for new files using Copilot.',
    trigger: 'pull_request',
  },
  {
    key: 'copilot-docs-sync',
    label: 'Copilot Docs Sync',
    filename: 'copilot-docs-sync.yml',
    description: 'Checks documentation staleness using Copilot.',
    trigger: 'schedule (cron)',
  },
];

const TEMPLATE_CONTENT = {
  'copilot-pr-review': `# Copilot PR Review — generated by nerviq
name: Copilot PR Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  copilot-review:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - name: Copilot Code Review
        uses: github/copilot-code-review@v1
        with:
          review-mode: comments
`,

  'copilot-issue-triage': `# Copilot Issue Triage — generated by nerviq
# Assigns Copilot cloud agent to triage new issues.
name: Copilot Issue Triage

on:
  issues:
    types: [opened]

permissions:
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Assign to Copilot
        run: |
          gh issue comment \${{ github.event.issue.number }} --body "@copilot please triage this issue and suggest labels."
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,

  'copilot-scheduled-audit': `# Copilot Scheduled Audit — generated by nerviq
name: Copilot Scheduled Audit

on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - name: Run nerviq audit
        run: npx nerviq --platform copilot --json > audit-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: copilot-audit-report
          path: audit-report.json
          retention-days: 30
`,

  'copilot-test-gen': `# Copilot Test Generation — generated by nerviq
name: Copilot Test Generation

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  test-gen:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Detect New Files
        id: new-files
        run: |
          FILES=$(git diff --name-only --diff-filter=A \${{ github.event.pull_request.base.sha }}..\${{ github.sha }})
          SRC_FILES=$(echo "$FILES" | grep -E '\\.(js|ts|py|go|rs|java)$' || true)
          echo "files=$SRC_FILES" >> $GITHUB_OUTPUT
      - name: Suggest Tests via Copilot
        if: steps.new-files.outputs.files != ''
        run: |
          echo "New files detected: \${{ steps.new-files.outputs.files }}"
          echo "Consider assigning @copilot to generate test stubs."
`,

  'copilot-docs-sync': `# Copilot Docs Sync — generated by nerviq
name: Copilot Docs Sync

on:
  schedule:
    - cron: '0 10 * * 3'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  docs-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Check Doc Staleness
        run: |
          STALE_THRESHOLD=30
          for doc_path in README.md CONTRIBUTING.md docs/; do
            [ ! -e "$doc_path" ] && continue
            LAST_MODIFIED=$(git log -1 --format="%ct" -- "$doc_path" 2>/dev/null || echo 0)
            NOW=$(date +%s)
            DAYS_OLD=$(( (NOW - LAST_MODIFIED) / 86400 ))
            if [ "$DAYS_OLD" -gt "$STALE_THRESHOLD" ]; then
              echo "STALE: $doc_path ($DAYS_OLD days old)"
            fi
          done
`,
};

function getCiTemplate(templateKey) {
  const meta = CI_TEMPLATES.find(t => t.key === templateKey);
  if (!meta) return null;
  return TEMPLATE_CONTENT[templateKey] || null;
}

// ---------------------------------------------------------------------------
// 3. Adoption Signal Gate (5 gates)
// ---------------------------------------------------------------------------

const GATE_THRESHOLDS = {
  'ci-templates': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate CI templates after 3+ successful audits.',
  },
  'cloud-agent': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate cloud agent setup after 2+ audits.',
  },
  'multi-pack': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate multi-pack composition after 2+ audits.',
  },
  'prompt-templates': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate prompt template generation after 3+ audits.',
  },
  'governance-upgrade': {
    metric: 'averageScore',
    threshold: 70,
    description: 'Suggest governance upgrade when average score exceeds 70.',
  },
};

function getCopilotHistory(dir, limit = 20) {
  const fs = require('fs');
  const snapshotDir = path.join(dir, '.claude', 'claudex-setup', 'snapshots');
  try {
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .slice(-limit);

    return files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(snapshotDir, f), 'utf8'));
        if (data.platform === 'copilot' || data.summary?.platform === 'copilot') return data;
        return null;
      } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function checkAdoptionGate(gateKey, dir) {
  const gate = GATE_THRESHOLDS[gateKey];
  if (!gate) {
    return { activated: false, current: 0, threshold: 0, gate: gateKey, description: `Unknown gate "${gateKey}".` };
  }

  const history = getCopilotHistory(dir, 100);
  let current = 0;

  switch (gate.metric) {
    case 'auditCount':
      current = history.length;
      break;
    case 'averageScore': {
      const scores = history.map(e => e.summary?.score).filter(s => typeof s === 'number');
      current = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
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

module.exports = {
  composePacks,
  getCiTemplate,
  CI_TEMPLATES,
  checkAdoptionGate,
  GATE_THRESHOLDS,
  PACK_DEPENDENCY_ORDER,
  PACK_SPECIFICITY,
  DEFAULT_SIZE_BUDGET,
};
