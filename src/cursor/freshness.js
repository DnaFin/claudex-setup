/**
 * Cursor Freshness Operationalization
 *
 * Release gates, recurring probes, propagation checklists,
 * and staleness blocking for Cursor surfaces.
 *
 * P0 sources from docs.cursor.com, propagation for rule format changes.
 */

const { version } = require('../../package.json');

/**
 * P0 sources that must be fresh before any Cursor release claim.
 */
const P0_SOURCES = [
  {
    key: 'cursor-rules-docs',
    label: 'Cursor Rules Documentation',
    url: 'https://docs.cursor.com/context/rules-for-ai',
    stalenessThresholdDays: 30,
    verifiedAt: null,
  },
  {
    key: 'cursor-mdc-format',
    label: 'MDC Format Documentation',
    url: 'https://docs.cursor.com/context/rules-for-ai#rule-types',
    stalenessThresholdDays: 30,
    verifiedAt: null,
  },
  {
    key: 'cursor-mcp-docs',
    label: 'Cursor MCP Documentation',
    url: 'https://docs.cursor.com/context/model-context-protocol',
    stalenessThresholdDays: 30,
    verifiedAt: null,
  },
  {
    key: 'cursor-background-agents',
    label: 'Background Agents Documentation',
    url: 'https://docs.cursor.com/background-agent',
    stalenessThresholdDays: 14,
    verifiedAt: null,
  },
  {
    key: 'cursor-automations',
    label: 'Automations Documentation',
    url: 'https://docs.cursor.com/automations',
    stalenessThresholdDays: 14,
    verifiedAt: null,
  },
  {
    key: 'cursor-bugbot',
    label: 'BugBot Documentation',
    url: 'https://docs.cursor.com/bugbot',
    stalenessThresholdDays: 30,
    verifiedAt: null,
  },
  {
    key: 'cursor-privacy-mode',
    label: 'Cursor Privacy Mode Documentation',
    url: 'https://docs.cursor.com/account/privacy',
    stalenessThresholdDays: 30,
    verifiedAt: null,
  },
  {
    key: 'cursor-changelog',
    label: 'Cursor Changelog',
    url: 'https://changelog.cursor.com',
    stalenessThresholdDays: 14,
    verifiedAt: null,
  },
  {
    key: 'cursor-security',
    label: 'Cursor Security Documentation',
    url: 'https://docs.cursor.com/account/security',
    stalenessThresholdDays: 30,
    verifiedAt: null,
  },
];

/**
 * Propagation checklist: when a Cursor source changes, these must update.
 */
const PROPAGATION_CHECKLIST = [
  {
    trigger: 'MDC rule format change (new frontmatter fields, type behavior change)',
    targets: [
      'src/cursor/config-parser.js — update VALID_MDC_FIELDS, detectRuleType, parseSimpleYaml',
      'src/cursor/techniques.js — update rule validation checks (CU-A01..CU-A09)',
      'src/cursor/context.js — update cursorRules() parsing and type detection',
      'src/cursor/setup.js — update rule template generation',
    ],
  },
  {
    trigger: 'Background agent behavior change (environment.json format, VM config)',
    targets: [
      'src/cursor/techniques.js — update background agent checks (CU-G01..CU-G05)',
      'src/cursor/setup.js — update environment.json template',
      'src/cursor/governance.js — update background-agent permission profile',
    ],
  },
  {
    trigger: 'Automation trigger format or behavior change',
    targets: [
      'src/cursor/techniques.js — update automation checks (CU-H01..CU-H05)',
      'src/cursor/context.js — update automationsConfig() parsing',
      'src/cursor/governance.js — update automation permission profile and caveats',
    ],
  },
  {
    trigger: 'MCP configuration format change in .cursor/mcp.json',
    targets: [
      'src/cursor/mcp-packs.js — update pack JSON projections and merge logic',
      'src/cursor/techniques.js — update MCP checks (CU-E01..CU-E05)',
      'src/cursor/context.js — update mcpConfig() parsing',
      'src/cursor/config-parser.js — update validateMcpEnvVars',
    ],
  },
  {
    trigger: 'MCP tool limit change (currently ~40)',
    targets: [
      'src/cursor/techniques.js — update CU-B02 threshold',
      'src/cursor/governance.js — update mcp-tool-limit caveat',
      'src/cursor/mcp-packs.js — update recommendation logic',
    ],
  },
  {
    trigger: 'BugBot feature update or autofix behavior change',
    targets: [
      'src/cursor/techniques.js — update BugBot checks (CU-J01..CU-J04)',
      'src/cursor/setup.js — update BugBot guide template',
      'src/cursor/governance.js — update bugbot-review hook',
    ],
  },
  {
    trigger: 'Privacy Mode or security model change',
    targets: [
      'src/cursor/techniques.js — update trust checks (CU-C01..CU-C09)',
      'src/cursor/governance.js — update caveats and permission profiles',
      'src/cursor/deep-review.js — update trust class detection',
    ],
  },
  {
    trigger: 'Design Mode feature update',
    targets: [
      'src/cursor/setup.js — update Design Mode guide template',
      'src/cursor/techniques.js — update CU-L01 modern features check',
    ],
  },
];

/**
 * Release gate: check if all P0 sources are within staleness threshold.
 */
function checkReleaseGate(sourceVerifications = {}) {
  const now = new Date();
  const results = P0_SOURCES.map(source => {
    const verifiedAt = sourceVerifications[source.key]
      ? new Date(sourceVerifications[source.key])
      : source.verifiedAt ? new Date(source.verifiedAt) : null;

    if (!verifiedAt) {
      return { ...source, status: 'unverified', daysStale: null };
    }

    const daysSince = Math.floor((now - verifiedAt) / (1000 * 60 * 60 * 24));
    const isStale = daysSince > source.stalenessThresholdDays;

    return { ...source, verifiedAt: verifiedAt.toISOString(), daysStale: daysSince, status: isStale ? 'stale' : 'fresh' };
  });

  return {
    ready: results.every(r => r.status === 'fresh'),
    stale: results.filter(r => r.status === 'stale' || r.status === 'unverified'),
    fresh: results.filter(r => r.status === 'fresh'),
    results,
  };
}

function formatReleaseGate(gateResult) {
  const lines = [
    `Cursor Freshness Gate (nerviq v${version})`,
    '═══════════════════════════════════════',
    '',
    `Status: ${gateResult.ready ? 'READY' : 'BLOCKED'}`,
    `Fresh: ${gateResult.fresh.length}/${gateResult.results.length}`,
    '',
  ];

  for (const result of gateResult.results) {
    const icon = result.status === 'fresh' ? '✓' : result.status === 'stale' ? '✗' : '?';
    const age = result.daysStale !== null ? ` (${result.daysStale}d ago)` : ' (unverified)';
    lines.push(`  ${icon} ${result.label}${age} — threshold: ${result.stalenessThresholdDays}d`);
  }

  if (!gateResult.ready) {
    lines.push('', 'Action required: verify stale/unverified sources before claiming release freshness.');
  }

  return lines.join('\n');
}

function getPropagationTargets(triggerKeyword) {
  const keyword = triggerKeyword.toLowerCase();
  return PROPAGATION_CHECKLIST.filter(item => item.trigger.toLowerCase().includes(keyword));
}

module.exports = {
  P0_SOURCES,
  PROPAGATION_CHECKLIST,
  checkReleaseGate,
  formatReleaseGate,
  getPropagationTargets,
};
