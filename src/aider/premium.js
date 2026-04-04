/**
 * Aider Premium Operator UX
 *
 * Three subsystems:
 * 1. Multi-Pack Composition Engine — merge domain packs with dedup and conflict resolution
 * 2. CI Template Library — GitHub Actions workflow templates for Aider automation
 * 3. Adoption Signal Gate — activate features based on local usage telemetry
 */

const path = require('path');
const { AIDER_DOMAIN_PACKS } = require('./domain-packs');
const { AIDER_MCP_PACKS } = require('./mcp-packs');
const { getAiderHistory } = require('./activity');

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
  return AIDER_DOMAIN_PACKS.find(p => p.key === key) || null;
}

function lookupMcpPack(key) {
  return AIDER_MCP_PACKS.find(p => p.key === key) || null;
}

/**
 * Compose domain packs into a unified, deduplicated, ordered result.
 */
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
    if (!pack) {
      warnings.push(`Domain pack "${key}" not found, skipped.`);
      continue;
    }
    rawDomainPacks.push(pack);
  }

  // Order by dependency
  rawDomainPacks.sort((a, b) => {
    const orderA = PACK_DEPENDENCY_ORDER.indexOf(a.key);
    const orderB = PACK_DEPENDENCY_ORDER.indexOf(b.key);
    return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
  });

  // Deduplicate recommended modules
  const seenModules = new Set();
  const mergedModules = [];
  for (const pack of rawDomainPacks) {
    for (const mod of pack.recommendedModules || []) {
      if (!seenModules.has(mod)) {
        seenModules.add(mod);
        mergedModules.push(mod);
      }
    }
  }

  // Deduplicate recommended surfaces
  const seenSurfaces = new Set();
  const mergedSurfaces = [];
  for (const pack of rawDomainPacks) {
    for (const surface of pack.recommendedSurfaces || []) {
      if (!seenSurfaces.has(surface)) {
        seenSurfaces.add(surface);
        mergedSurfaces.push(surface);
      }
    }
  }

  // Deduplicate proposal families
  const seenFamilies = new Set();
  const mergedFamilies = [];
  for (const pack of rawDomainPacks) {
    for (const family of pack.recommendedProposalFamilies || []) {
      if (!seenFamilies.has(family)) {
        seenFamilies.add(family);
        mergedFamilies.push(family);
      }
    }
  }

  // MCP packs (minimal for Aider)
  const resolvedMcpPacks = mcpPackKeys
    .map(key => lookupMcpPack(key))
    .filter(Boolean);

  // Size check
  const estimatedSize = mergedModules.join('\n').length + mergedSurfaces.join('\n').length;
  if (estimatedSize > sizeBudget) {
    warnings.push(`Combined content (~${estimatedSize} chars) exceeds budget of ${sizeBudget}.`);
  }

  return {
    domainPacks: rawDomainPacks.map(p => p.key),
    mcpPacks: resolvedMcpPacks.map(p => p.key),
    mergedModules,
    mergedSurfaces,
    mergedFamilies,
    warnings,
    estimatedSize,
    withinBudget: estimatedSize <= sizeBudget,
  };
}

// ---------------------------------------------------------------------------
// 2. CI Template Library
// ---------------------------------------------------------------------------

const CI_TEMPLATES = {
  'aider-lint-test': {
    key: 'aider-lint-test',
    label: 'Lint & Test on PR',
    description: 'Run lint and test checks on Aider-generated PRs.',
    template: `name: Aider PR Checks
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
`,
  },

  'aider-auto-pr': {
    key: 'aider-auto-pr',
    label: 'Aider Auto PR',
    description: 'Run Aider in CI to generate PRs from issues.',
    template: `name: Aider Auto PR
on:
  issues:
    types: [labeled]

jobs:
  aider-fix:
    if: contains(github.event.label.name, 'aider')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Aider
        run: pip install aider-chat
      - name: Run Aider
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          aider --yes --message "Fix issue #\${{ github.event.issue.number }}: \${{ github.event.issue.title }}"
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: "aider: Fix #\${{ github.event.issue.number }}"
          branch: aider/fix-\${{ github.event.issue.number }}
          commit-message: "aider: address issue #\${{ github.event.issue.number }}"
`,
  },

  'aider-review-gate': {
    key: 'aider-review-gate',
    label: 'Aider Review Gate',
    description: 'Require reviews on AI-authored PRs (detected by commit prefix).',
    template: `name: Aider Review Gate
on:
  pull_request:
    branches: [main]

jobs:
  check-ai-authored:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Check for AI commits
        id: ai-check
        run: |
          AI_COMMITS=\$(git log --format='%s' origin/main..HEAD | grep -c '^aider:' || true)
          echo "ai_commits=\$AI_COMMITS" >> \$GITHUB_OUTPUT
      - name: Require review for AI commits
        if: steps.ai-check.outputs.ai_commits > 0
        run: |
          echo "This PR contains \${{ steps.ai-check.outputs.ai_commits }} AI-authored commit(s)."
          echo "Manual review required before merge."
`,
  },

  'aider-audit': {
    key: 'aider-audit',
    label: 'Aider Setup Audit',
    description: 'Run nerviq audit on Aider config in CI.',
    template: `name: Aider Config Audit
on:
  push:
    paths:
      - '.aider.conf.yml'
      - 'CONVENTIONS.md'
      - '.aiderignore'
  pull_request:
    paths:
      - '.aider.conf.yml'
      - 'CONVENTIONS.md'
      - '.aiderignore'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Aider Audit
        run: npx nerviq --platform aider --ci
`,
  },

  'aider-scheduled': {
    key: 'aider-scheduled',
    label: 'Scheduled Aider Tasks',
    description: 'Run Aider on a schedule for maintenance tasks.',
    template: `name: Scheduled Aider Maintenance
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6am UTC

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Aider
        run: pip install aider-chat
      - name: Run maintenance
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          aider --yes --message "Run weekly dependency update and lint fixes"
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: "aider: Weekly maintenance"
          branch: aider/weekly-maintenance
`,
  },
};

function getCiTemplate(key) {
  return CI_TEMPLATES[key] || null;
}

// ---------------------------------------------------------------------------
// 3. Adoption Signal Gate
// ---------------------------------------------------------------------------

const GATE_THRESHOLDS = {
  'deep-review': {
    threshold: 3,
    description: 'Activate deep review after 3 audit snapshots.',
    metric: 'snapshotCount',
  },
  'ci-templates': {
    threshold: 5,
    description: 'Suggest CI templates after 5 audits with score > 50.',
    metric: 'qualifyingAudits',
  },
  'composition': {
    threshold: 2,
    description: 'Enable pack composition after using 2+ domain packs.',
    metric: 'domainPackCount',
  },
  'trend-export': {
    threshold: 5,
    description: 'Enable trend export after 5 snapshots.',
    metric: 'snapshotCount',
  },
};

function checkAdoptionGate(dir, gateKey) {
  const gate = GATE_THRESHOLDS[gateKey];
  if (!gate) return { activated: false, current: 0, threshold: 0, gate: gateKey, description: 'Unknown gate' };

  const history = getAiderHistory(dir, 50);
  let current = 0;

  switch (gate.metric) {
    case 'snapshotCount':
      current = history.length;
      break;
    case 'qualifyingAudits':
      current = history.filter(e => (e.summary?.score ?? 0) > 50).length;
      break;
    case 'domainPackCount': {
      const packs = new Set();
      for (const entry of history) {
        for (const pack of (entry.summary?.domainPacks || [])) {
          packs.add(pack);
        }
      }
      current = packs.size;
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
  GATE_THRESHOLDS,
  PACK_DEPENDENCY_ORDER,
  PACK_SPECIFICITY,
  DEFAULT_SIZE_BUDGET,
};
