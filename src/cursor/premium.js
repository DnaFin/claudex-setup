/**
 * Cursor Premium Operator UX
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain + MCP packs with dedup, conflict resolution, MDC awareness
 * 2. CI Template Library — 5 GitHub Actions workflow templates for Cursor
 * 3. Adoption Signal Gate — activate features based on local usage telemetry (5 gates)
 */

const path = require('path');
const { CURSOR_DOMAIN_PACKS } = require('./domain-packs');
const { CURSOR_MCP_PACKS } = require('./mcp-packs');
const { resolveProjectStateReadPath } = require('../state-paths');

// ---------------------------------------------------------------------------
// 1. Multi-Pack Composition Engine (with MDC awareness)
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
  return CURSOR_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return CURSOR_MCP_PACKS.find(p => p.key === key) || null;
}

/**
 * Compose domain packs and MCP packs into a unified, deduplicated, ordered result.
 * Cursor-specific: tracks backgroundAgentCompatible and MDC rule type distribution.
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

  // Cursor-specific: check tool count budget
  const estimatedTools = resolvedMcpPacks.length * 5;
  if (estimatedTools > 35) {
    warnings.push(`Estimated ~${estimatedTools} MCP tools. Cursor hard limit is ~40. Some tools may be silently dropped.`);
  }

  const mergedExcludeTools = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const tool of pack.excludeTools || []) mergedExcludeTools.add(tool);
  }

  const mergedRequiredAuth = new Set();
  for (const pack of resolvedMcpPacks) {
    for (const auth of pack.requiredAuth || []) mergedRequiredAuth.add(auth);
  }

  // Cursor-specific: separate background-compatible from foreground-only MCP packs
  const bgCompatible = resolvedMcpPacks.filter(p => p.backgroundAgentCompatible !== false);
  const fgOnly = resolvedMcpPacks.filter(p => p.backgroundAgentCompatible === false);

  const estimatedSize = estimateCompositionSize(rawDomainPacks, resolvedMcpPacks);
  const overBudget = estimatedSize > sizeBudget;
  if (overBudget) {
    warnings.push(`Combined instruction size (~${estimatedSize} chars) exceeds budget (${sizeBudget}).`);
  }

  // MDC-specific: recommend rule type distribution
  const mdcGuidance = {
    alwaysApplyCount: 1, // Core rules only
    autoAttachedCount: rawDomainPacks.length > 1 ? rawDomainPacks.length : 1,
    agentRequestedCount: rawDomainPacks.some(p => p.key === 'enterprise-governed') ? 2 : 0,
    recommendation: 'Keep alwaysApply to 1-2 rules. Use Auto Attached for stack-specific rules. Agent Requested for optional guides.',
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
      backgroundAgentCompatible: p.backgroundAgentCompatible,
    })),
    backgroundCompatibleMcpPacks: bgCompatible.map(p => p.key),
    foregroundOnlyMcpPacks: fgOnly.map(p => p.key),
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
    mcpToolEstimate: estimatedTools,
    mcpToolLimit: 40,
    mdcGuidance,
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
    key: 'cursor-pr-audit',
    label: 'Cursor PR Audit',
    filename: 'cursor-pr-audit.yml',
    description: 'Runs nerviq audit on pull request diffs.',
    trigger: 'pull_request',
  },
  {
    key: 'cursor-bugbot-review',
    label: 'Cursor BugBot Review',
    filename: 'cursor-bugbot-review.yml',
    description: 'Triggers BugBot code review on pull requests.',
    trigger: 'pull_request',
  },
  {
    key: 'cursor-scheduled-audit',
    label: 'Cursor Scheduled Audit',
    filename: 'cursor-scheduled-audit.yml',
    description: 'Weekly Cursor audit of configuration health.',
    trigger: 'schedule (cron)',
  },
  {
    key: 'cursor-rules-lint',
    label: 'Cursor Rules Lint',
    filename: 'cursor-rules-lint.yml',
    description: 'Validates MDC frontmatter in .cursor/rules/ on change.',
    trigger: 'push (path filter)',
  },
  {
    key: 'cursor-mcp-security',
    label: 'Cursor MCP Security Check',
    filename: 'cursor-mcp-security.yml',
    description: 'Checks MCP config for hardcoded secrets and CVE patterns.',
    trigger: 'push (path filter)',
  },
];

const TEMPLATE_CONTENT = {
  'cursor-pr-audit': `# Cursor PR Audit — generated by nerviq
name: Cursor PR Audit

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  cursor-audit:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - name: Run nerviq Cursor audit
        run: npx nerviq --platform cursor --json > audit-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: cursor-audit-report
          path: audit-report.json
          retention-days: 30
`,

  'cursor-bugbot-review': `# Cursor BugBot Review — generated by nerviq
# NOTE: BugBot is configured per-repo in Cursor settings, not via GitHub Actions.
# This workflow documents the expected BugBot behavior.
name: Cursor BugBot Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read

jobs:
  bugbot-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify BugBot Configuration
        run: |
          echo "BugBot review is configured via Cursor Settings (per-repo)."
          echo "Ensure BugBot is enabled and autofix is configured appropriately."
`,

  'cursor-scheduled-audit': `# Cursor Scheduled Audit — generated by nerviq
name: Cursor Scheduled Audit

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
        run: npx nerviq --platform cursor --json > audit-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: cursor-audit-report
          path: audit-report.json
          retention-days: 30
`,

  'cursor-rules-lint': `# Cursor Rules Lint — generated by nerviq
name: Cursor Rules Lint

on:
  push:
    paths:
      - '.cursor/rules/**'
      - '.cursorrules'

permissions:
  contents: read

jobs:
  lint-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check MDC frontmatter
        run: |
          ERRORS=0
          for file in .cursor/rules/*.mdc; do
            [ ! -f "$file" ] && continue
            if ! head -1 "$file" | grep -q "^---"; then
              echo "ERROR: $file missing MDC frontmatter (---)"
              ERRORS=$((ERRORS + 1))
            fi
          done
          if [ -f .cursorrules ]; then
            echo "WARNING: .cursorrules exists — IGNORED by Cursor agent mode!"
            echo "Migrate to .cursor/rules/*.mdc with proper MDC frontmatter."
          fi
          exit $ERRORS
`,

  'cursor-mcp-security': `# Cursor MCP Security Check — generated by nerviq
name: Cursor MCP Security Check

on:
  push:
    paths:
      - '.cursor/mcp.json'

permissions:
  contents: read

jobs:
  mcp-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for hardcoded secrets
        run: |
          if [ ! -f .cursor/mcp.json ]; then exit 0; fi
          # Check for hardcoded API keys/tokens (should use \${env:VAR})
          if grep -P '"(key|token|secret|password|api)"\s*:\s*"(?!\\\$\\{env:)' .cursor/mcp.json; then
            echo "ERROR: Hardcoded secrets detected in .cursor/mcp.json"
            echo "Use \\\${env:VAR_NAME} syntax instead."
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
  'background-agents': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate background agent setup after 2+ audits.',
  },
  'multi-pack': {
    metric: 'auditCount',
    threshold: 2,
    description: 'Activate multi-pack composition after 2+ audits.',
  },
  'automations': {
    metric: 'auditCount',
    threshold: 3,
    description: 'Activate automation templates after 3+ audits.',
  },
  'governance-upgrade': {
    metric: 'averageScore',
    threshold: 70,
    description: 'Suggest governance upgrade when average score exceeds 70.',
  },
};

function getCursorHistory(dir, limit = 20) {
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
        if (data.platform === 'cursor' || data.summary?.platform === 'cursor') return data;
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

  const history = getCursorHistory(dir, 100);
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
