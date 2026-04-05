/**
 * Windsurf Premium Operator UX
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain + MCP packs with dedup, conflict resolution
 * 2. CI Template Library — 5 GitHub Actions workflow templates for Windsurf
 * 3. Adoption Signal Gate — activate features based on local usage telemetry (5 gates)
 */

const path = require('path');
const { WINDSURF_DOMAIN_PACKS } = require('./domain-packs');
const { WINDSURF_MCP_PACKS } = require('./mcp-packs');
const { resolveProjectStateReadPath } = require('../state-paths');

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

const DEFAULT_SIZE_BUDGET = 10000; // Windsurf 10K char limit per rule

function lookupDomainPack(key) {
  return WINDSURF_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return WINDSURF_MCP_PACKS.find(p => p.key === key) || null;
}

/**
 * Compose domain packs and MCP packs into a unified, deduplicated, ordered result.
 * Windsurf-specific: tracks 10K char limit and rule type distribution.
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

  const estimatedSize = estimateCompositionSize(rawDomainPacks, resolvedMcpPacks);
  const overBudget = estimatedSize > sizeBudget;
  if (overBudget) {
    warnings.push(`Combined instruction size (~${estimatedSize} chars) exceeds Windsurf 10K char budget (${sizeBudget}).`);
  }

  // Windsurf-specific: recommend rule type distribution
  const ruleGuidance = {
    alwaysCount: 1, // Core rules only
    autoCount: rawDomainPacks.length > 1 ? rawDomainPacks.length : 1,
    agentRequestedCount: rawDomainPacks.some(p => p.key === 'enterprise-governed') ? 2 : 0,
    recommendation: 'Keep trigger: always to 1-2 rules. Use trigger: auto for stack-specific rules. Agent-Requested for optional guides.',
    charLimitNote: 'Each rule file must be under 10,000 characters.',
  };

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
      excludeTools: [...mergedExcludeTools].sort(),
      requiredAuth: [...mergedRequiredAuth].sort(),
    },
    budget: {
      estimatedSize,
      limit: sizeBudget,
      overBudget,
      utilization: Math.round((estimatedSize / sizeBudget) * 100),
    },
    ruleGuidance,
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
// 2. CI Template Library (5 templates)
// ---------------------------------------------------------------------------

const CI_TEMPLATES = [
  {
    key: 'windsurf-pr-audit',
    label: 'Windsurf PR Audit',
    filename: 'windsurf-pr-audit.yml',
    description: 'Runs nerviq audit on pull request diffs.',
    trigger: 'pull_request',
  },
  {
    key: 'windsurf-cascade-review',
    label: 'Windsurf Cascade Review',
    filename: 'windsurf-cascade-review.yml',
    description: 'Validates Cascade configuration on pull requests.',
    trigger: 'pull_request',
  },
  {
    key: 'windsurf-scheduled-audit',
    label: 'Windsurf Scheduled Audit',
    filename: 'windsurf-scheduled-audit.yml',
    description: 'Weekly Windsurf audit of configuration health.',
    trigger: 'schedule (cron)',
  },
  {
    key: 'windsurf-rules-lint',
    label: 'Windsurf Rules Lint',
    filename: 'windsurf-rules-lint.yml',
    description: 'Validates YAML frontmatter in .windsurf/rules/ on change.',
    trigger: 'push (path filter)',
  },
  {
    key: 'windsurf-mcp-security',
    label: 'Windsurf MCP Security Check',
    filename: 'windsurf-mcp-security.yml',
    description: 'Checks MCP config for hardcoded secrets.',
    trigger: 'push (path filter)',
  },
];

const TEMPLATE_CONTENT = {
  'windsurf-pr-audit': `# Windsurf PR Audit — generated by nerviq
name: Windsurf PR Audit

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  windsurf-audit:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - name: Run nerviq Windsurf audit
        run: npx nerviq --platform windsurf --json > audit-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: windsurf-audit-report
          path: audit-report.json
          retention-days: 30
`,

  'windsurf-cascade-review': `# Windsurf Cascade Review — generated by nerviq
name: Windsurf Cascade Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read

jobs:
  cascade-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify Windsurf Configuration
        run: |
          echo "Checking Windsurf configuration..."
          if [ -f .windsurfrules ]; then
            echo "WARNING: .windsurfrules is legacy format. Migrate to .windsurf/rules/*.md"
          fi
          for file in .windsurf/rules/*.md; do
            [ ! -f "$file" ] && continue
            CHARS=$(wc -c < "$file")
            if [ "$CHARS" -gt 10000 ]; then
              echo "ERROR: $file exceeds 10K char limit ($CHARS chars)"
              exit 1
            fi
          done
          echo "Windsurf configuration check passed."
`,

  'windsurf-scheduled-audit': `# Windsurf Scheduled Audit — generated by nerviq
name: Windsurf Scheduled Audit

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
        run: npx nerviq --platform windsurf --json > audit-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: windsurf-audit-report
          path: audit-report.json
          retention-days: 30
`,

  'windsurf-rules-lint': `# Windsurf Rules Lint — generated by nerviq
name: Windsurf Rules Lint

on:
  push:
    paths:
      - '.windsurf/rules/**'
      - '.windsurfrules'

permissions:
  contents: read

jobs:
  lint-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check YAML frontmatter and char limits
        run: |
          ERRORS=0
          for file in .windsurf/rules/*.md; do
            [ ! -f "$file" ] && continue
            if ! head -1 "$file" | grep -q "^---"; then
              echo "ERROR: $file missing YAML frontmatter (---)"
              ERRORS=$((ERRORS + 1))
            fi
            CHARS=$(wc -c < "$file")
            if [ "$CHARS" -gt 10000 ]; then
              echo "ERROR: $file exceeds 10K char limit ($CHARS chars)"
              ERRORS=$((ERRORS + 1))
            fi
          done
          if [ -f .windsurfrules ]; then
            echo "WARNING: .windsurfrules exists — this is the legacy format!"
            echo "Migrate to .windsurf/rules/*.md with proper YAML frontmatter."
          fi
          exit $ERRORS
`,

  'windsurf-mcp-security': `# Windsurf MCP Security Check — generated by nerviq
name: Windsurf MCP Security Check

on:
  push:
    paths:
      - '.windsurf/mcp.json'

permissions:
  contents: read

jobs:
  mcp-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for hardcoded secrets
        run: |
          if [ ! -f .windsurf/mcp.json ]; then exit 0; fi
          if grep -P '"(key|token|secret|password|api)"\\s*:\\s*"(?!\\$\\{env:)' .windsurf/mcp.json; then
            echo "ERROR: Hardcoded secrets detected in .windsurf/mcp.json"
            echo "Use environment variables instead."
            exit 1
          fi
          echo "MCP config security check passed."
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
  'team-sync': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate team sync features after 2+ audits.',
  },
  'multi-pack': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate multi-pack composition after 2+ audits.',
  },
  'workflows': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate workflow templates after 3+ audits.',
  },
  'governance-upgrade': {
    metric: 'averageScore',
    threshold: 70,
    description: 'Suggest governance upgrade when average score exceeds 70.',
  },
};

function getWindsurfHistory(dir, limit = 20) {
  const fs = require('fs');
  const snapshotDir = resolveProjectStateReadPath(dir, 'snapshots');
  try {
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .slice(-limit);

    return files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(snapshotDir, f), 'utf8'));
        if (data.platform === 'windsurf' || data.summary?.platform === 'windsurf') return data;
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

  const history = getWindsurfHistory(dir, 100);
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
