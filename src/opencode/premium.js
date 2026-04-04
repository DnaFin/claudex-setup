/**
 * OpenCode Premium Operator UX
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain + MCP packs with dedup, conflict resolution
 * 2. CI Template Library — 5 GitHub Actions workflow templates for OpenCode automation
 * 3. Adoption Signal Gate — activate features based on local usage telemetry
 */

const path = require('path');
const { OPENCODE_DOMAIN_PACKS } = require('./domain-packs');
const { OPENCODE_MCP_PACKS } = require('./mcp-packs');
const { getOpenCodeHistory } = require('./activity');

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
  return OPENCODE_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return OPENCODE_MCP_PACKS.find(p => p.key === key) || null;
}

function composePacks(domainPackKeys = [], mcpPackKeys = [], options = {}) {
  const sizeBudget = options.sizeBudget || DEFAULT_SIZE_BUDGET;
  const warnings = [];

  // Resolve domain packs
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

  // Resolve MCP packs
  const seenMcpKeys = new Set();
  const resolvedMcpPacks = [];
  for (const key of mcpPackKeys) {
    if (seenMcpKeys.has(key)) continue;
    seenMcpKeys.add(key);
    const pack = lookupMcpPack(key);
    if (!pack) { warnings.push(`MCP pack "${key}" not found, skipped.`); continue; }
    resolvedMcpPacks.push(pack);
  }

  const mergedEnabledTools = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const tool of pack.enabledTools || []) mergedEnabledTools.add(tool);
  }

  const mergedRequiredAuth = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const auth of pack.requiredAuth || []) mergedRequiredAuth.add(auth);
  }

  const estimatedSize = estimateCompositionSize(rawDomainPacks, resolvedMcpPacks);
  const overBudget = estimatedSize > sizeBudget;
  if (overBudget) {
    warnings.push(`Combined size (~${estimatedSize} chars) exceeds budget (${sizeBudget}). Consider removing lower-priority packs.`);
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
    })),
    merged: {
      surfaces: [...allSurfaces],
      proposalFamilies: [...allProposalFamilies],
      modules: [...moduleOwner.entries()].map(([mod, owner]) => ({ module: mod, owner: owner.key })),
      enabledTools: [...mergedEnabledTools].sort(),
      requiredAuth: [...mergedRequiredAuth].sort(),
    },
    budget: { estimatedSize, limit: sizeBudget, overBudget, utilization: Math.round((estimatedSize / sizeBudget) * 100) },
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
    size += JSON.stringify(pack.jsoncProjection || {}).length;
    size += JSON.stringify(pack.enabledTools || []).length;
  }
  return size;
}

// ---------------------------------------------------------------------------
// 2. CI Template Library
// ---------------------------------------------------------------------------

const CI_TEMPLATES = [
  {
    key: 'opencode-pr-review',
    label: 'OpenCode PR Review',
    filename: 'opencode-pr-review.yml',
    description: 'Runs OpenCode review on pull request diffs.',
    trigger: 'pull_request',
  },
  {
    key: 'opencode-issue-triage',
    label: 'OpenCode Issue Triage',
    filename: 'opencode-issue-triage.yml',
    description: 'Classifies and labels new issues using OpenCode.',
    trigger: 'issues.opened',
  },
  {
    key: 'opencode-scheduled-audit',
    label: 'OpenCode Scheduled Audit',
    filename: 'opencode-scheduled-audit.yml',
    description: 'Weekly deep review of the codebase with OpenCode.',
    trigger: 'schedule (cron)',
  },
  {
    key: 'opencode-test-gen',
    label: 'OpenCode Test Generation',
    filename: 'opencode-test-gen.yml',
    description: 'Generates test stubs for newly added files.',
    trigger: 'pull_request',
  },
  {
    key: 'opencode-docs-sync',
    label: 'OpenCode Docs Sync',
    filename: 'opencode-docs-sync.yml',
    description: 'Checks for documentation staleness.',
    trigger: 'schedule (cron)',
  },
];

const TEMPLATE_CONTENT = {
  'opencode-pr-review': `# OpenCode PR Review — generated by nerviq
name: OpenCode PR Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

env:
  OPENCODE_DISABLE_AUTOUPDATE: "1"

jobs:
  opencode-review:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Install OpenCode
        run: npm install -g opencode
      - name: Run Review
        run: |
          DIFF=$(git diff \${{ github.event.pull_request.base.sha }}..\${{ github.sha }})
          echo "$DIFF" | opencode run --format json "Review this diff"
`,

  'opencode-issue-triage': `# OpenCode Issue Triage — generated by nerviq
name: OpenCode Issue Triage

on:
  issues:
    types: [opened]

permissions:
  issues: write

env:
  OPENCODE_DISABLE_AUTOUPDATE: "1"

jobs:
  triage:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    env:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - name: Install OpenCode
        run: npm install -g opencode
      - name: Classify Issue
        run: |
          opencode run --format json "Classify this issue: \${{ github.event.issue.title }}"
`,

  'opencode-scheduled-audit': `# OpenCode Scheduled Audit — generated by nerviq
name: OpenCode Scheduled Audit

on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch: {}

permissions:
  contents: read
  issues: write

env:
  OPENCODE_DISABLE_AUTOUPDATE: "1"

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Install OpenCode
        run: npm install -g opencode
      - name: Run Audit
        run: opencode run --format json "Run a deep code quality audit"
`,

  'opencode-test-gen': `# OpenCode Test Generation — generated by nerviq
name: OpenCode Test Generation

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

env:
  OPENCODE_DISABLE_AUTOUPDATE: "1"

jobs:
  test-gen:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Install OpenCode
        run: npm install -g opencode
      - name: Generate Tests
        run: |
          FILES=$(git diff --name-only --diff-filter=A \${{ github.event.pull_request.base.sha }}..\${{ github.sha }})
          for file in $FILES; do
            opencode run --format json "Generate tests for $file"
          done
`,

  'opencode-docs-sync': `# OpenCode Docs Sync — generated by nerviq
name: OpenCode Docs Sync

on:
  schedule:
    - cron: '0 10 * * 3'
  workflow_dispatch: {}

permissions:
  contents: read
  issues: write

env:
  OPENCODE_DISABLE_AUTOUPDATE: "1"

jobs:
  docs-check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Install OpenCode
        run: npm install -g opencode
      - name: Check Staleness
        run: opencode run --format json "Check documentation freshness for README.md and docs/"
`,
};

function getCiTemplate(templateKey) {
  const meta = CI_TEMPLATES.find(t => t.key === templateKey);
  if (!meta) return null;
  return TEMPLATE_CONTENT[templateKey] || null;
}

// ---------------------------------------------------------------------------
// 3. Adoption Signal Gate
// ---------------------------------------------------------------------------

const GATE_THRESHOLDS = {
  'ci-templates': { metric: 'auditCount', threshold: 3, description: 'Activate CI templates after 3+ audits.' },
  'mcp-advanced': { metric: 'auditCount', threshold: 5, description: 'Activate advanced MCP packs after 5+ audits.' },
  'multi-pack': { metric: 'auditCount', threshold: 2, description: 'Activate multi-pack composition after 2+ audits.' },
  'trend-reports': { metric: 'auditCount', threshold: 3, description: 'Activate trend reports after 3+ snapshots.' },
  'governance-upgrade': { metric: 'averageScore', threshold: 70, description: 'Suggest governance upgrade when average score > 70.' },
};

function checkAdoptionGate(gateKey, dir) {
  const gate = GATE_THRESHOLDS[gateKey];
  if (!gate) {
    return { activated: false, current: 0, threshold: 0, gate: gateKey, description: `Unknown gate "${gateKey}".` };
  }

  const history = getOpenCodeHistory(dir, 100);
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
