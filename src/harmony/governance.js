/**
 * H8. Harmony Governance - Cross-Platform Policy Enforcement
 *
 * Evaluates cross-platform governance posture: minimum trust levels,
 * required instruction coverage, MCP alignment, and per-platform compliance.
 *
 * Zero external dependencies - imports from sibling/parent modules only.
 */

// ─── Required canonical sections every platform should cover ──────────────────

const REQUIRED_INSTRUCTION_SECTIONS = [
  { key: 'role', label: 'Role / Identity', description: 'Define who the AI assistant is in this project.' },
  { key: 'commands', label: 'Verification Commands', description: 'Test, lint, and build commands the AI should use.' },
  { key: 'language', label: 'Language Preference', description: 'Communication language for the AI.' },
  { key: 'permissions', label: 'Permission Boundaries', description: 'What the AI is allowed and denied to do.' },
  { key: 'context', label: 'Project Context', description: 'Architecture, stack, and codebase overview.' },
  { key: 'safety', label: 'Safety / Secret Protection', description: 'Rules for handling secrets and sensitive files.' },
];

// ─── Trust posture definitions ────────────────────────────────────────────────

const TRUST_LEVELS = {
  strict: {
    level: 1,
    label: 'Strict',
    description: 'Read-only or suggest-only. No file writes without approval.',
    minPermissions: ['deny-write', 'deny-destructive'],
  },
  guarded: {
    level: 2,
    label: 'Guarded',
    description: 'Safe writes with explicit deny rules and hook enforcement.',
    minPermissions: ['deny-destructive', 'secret-protection'],
  },
  standard: {
    level: 3,
    label: 'Standard',
    description: 'Accept-edits with common-sense deny rules.',
    minPermissions: ['secret-protection'],
  },
  permissive: {
    level: 4,
    label: 'Permissive',
    description: 'Broad autonomy with minimal restrictions.',
    minPermissions: [],
  },
  unrestricted: {
    level: 5,
    label: 'Unrestricted',
    description: 'Full bypass, only for internal research.',
    minPermissions: [],
  },
};

// ─── Platform trust detection ─────────────────────────────────────────────────

/**
 * Infer trust level from a platform's audit/governance data.
 */
function inferTrustLevel(platformGovernance) {
  if (!platformGovernance) return TRUST_LEVELS.unrestricted;

  const { hasPermissions, hasDenyRules, hasSecretProtection, defaultMode } = platformGovernance;

  if (defaultMode === 'plan' || defaultMode === 'read-only') return TRUST_LEVELS.strict;
  if (hasDenyRules && hasSecretProtection) return TRUST_LEVELS.guarded;
  if (hasPermissions || hasSecretProtection) return TRUST_LEVELS.standard;
  if (hasPermissions) return TRUST_LEVELS.permissive;
  return TRUST_LEVELS.unrestricted;
}

// ─── Governance evaluation ────────────────────────────────────────────────────

/**
 * Evaluate instruction coverage for a single platform.
 */
function evaluateInstructionCoverage(platformSections) {
  const covered = [];
  const missing = [];

  for (const required of REQUIRED_INSTRUCTION_SECTIONS) {
    const found = (platformSections || []).some(s => {
      const key = s.key || s;
      return key === required.key || key.includes(required.key);
    });
    if (found) {
      covered.push(required);
    } else {
      missing.push(required);
    }
  }

  return {
    total: REQUIRED_INSTRUCTION_SECTIONS.length,
    covered: covered.length,
    missing: missing.length,
    coveredSections: covered,
    missingSections: missing,
    percentage: Math.round((covered.length / REQUIRED_INSTRUCTION_SECTIONS.length) * 100),
  };
}

/**
 * Evaluate MCP server alignment across platforms.
 */
function evaluateMcpAlignment(platformAudits) {
  const mcpByPlatform = {};
  const allServers = new Set();

  for (const audit of (platformAudits || [])) {
    const servers = audit.mcpServers || [];
    mcpByPlatform[audit.platform] = new Set(servers);
    for (const s of servers) allServers.add(s);
  }

  const alignment = [];
  for (const server of allServers) {
    const presentIn = [];
    const missingFrom = [];

    for (const audit of (platformAudits || [])) {
      if (mcpByPlatform[audit.platform] && mcpByPlatform[audit.platform].has(server)) {
        presentIn.push(audit.platform);
      } else {
        missingFrom.push(audit.platform);
      }
    }

    alignment.push({
      server,
      presentIn,
      missingFrom,
      aligned: missingFrom.length === 0,
    });
  }

  return {
    totalServers: allServers.size,
    fullyAligned: alignment.filter(a => a.aligned).length,
    misaligned: alignment.filter(a => !a.aligned).length,
    servers: alignment,
  };
}

/**
 * Get the complete harmony governance summary.
 *
 * @param {Object|null} canonicalModel - The canonical model from canon.js
 * @param {Array} [platformAudits] - Array of per-platform audit results with governance data
 * @returns {Object} Full governance summary
 */
function getHarmonyGovernanceSummary(canonicalModel, platformAudits) {
  const audits = platformAudits || [];

  // 1. Minimum trust posture (lowest acceptable across all platforms)
  const trustLevels = audits.map(audit => ({
    platform: audit.platform,
    trust: inferTrustLevel(audit.governance),
  }));

  const lowestTrust = trustLevels.length > 0
    ? trustLevels.reduce((min, curr) =>
        curr.trust.level < min.trust.level ? curr : min
      )
    : null;

  const minimumTrustPosture = {
    level: lowestTrust ? lowestTrust.trust : TRUST_LEVELS.unrestricted,
    lowestPlatform: lowestTrust ? lowestTrust.platform : null,
    perPlatform: trustLevels.map(t => ({
      platform: t.platform,
      level: t.trust.label,
      levelNumber: t.trust.level,
      description: t.trust.description,
    })),
  };

  // 2. Required instruction coverage per platform
  const instructionCoverage = {
    required: REQUIRED_INSTRUCTION_SECTIONS,
    perPlatform: audits.map(audit => ({
      platform: audit.platform,
      ...evaluateInstructionCoverage(audit.sections),
    })),
  };

  // 3. MCP alignment
  const mcpAlignment = evaluateMcpAlignment(audits);

  // 4. Compliance: per-platform governance status
  const platformCompliance = audits.map(audit => {
    const coverage = evaluateInstructionCoverage(audit.sections);
    const trust = inferTrustLevel(audit.governance);
    const gaps = [];

    if (coverage.missing > 0) {
      gaps.push(`Missing ${coverage.missing} required instruction section(s): ${coverage.missingSections.map(s => s.key).join(', ')}`);
    }

    if (trust.level >= 4) {
      gaps.push(`Trust level "${trust.label}" is too permissive for production use`);
    }

    if (audit.governance && !audit.governance.hasSecretProtection) {
      gaps.push('No secret protection configured');
    }

    if (audit.governance && !audit.governance.hasDenyRules) {
      gaps.push('No deny rules configured');
    }

    return {
      platform: audit.platform,
      compliant: gaps.length === 0,
      score: audit.score || 0,
      trustLevel: trust.label,
      coveragePercent: coverage.percentage,
      gaps,
    };
  });

  return {
    minimumTrustPosture,
    instructionCoverage,
    mcpAlignment,
    platformCompliance,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Report formatting ────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[36m',
};
const col = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

/**
 * Format the governance summary as a human-readable console report.
 */
function formatHarmonyGovernanceReport(summary, options) {
  if (options && options.json) {
    return JSON.stringify(summary, null, 2);
  }

  const lines = [];

  lines.push('');
  lines.push(col('  Harmony Governance Report', 'bold'));
  lines.push(col('  ═══════════════════════════════════════', 'dim'));
  lines.push('');

  // Trust posture
  lines.push(col('  Trust Posture', 'bold'));
  for (const entry of summary.minimumTrustPosture.perPlatform) {
    const trustColor = entry.levelNumber <= 2 ? 'green' : entry.levelNumber <= 3 ? 'yellow' : 'red';
    lines.push(`    ${entry.platform}: ${col(entry.level, trustColor)} — ${entry.description}`);
  }
  if (summary.minimumTrustPosture.lowestPlatform) {
    lines.push(`    ${col('Minimum:', 'dim')} ${summary.minimumTrustPosture.level.label} (${summary.minimumTrustPosture.lowestPlatform})`);
  }
  lines.push('');

  // Instruction coverage
  lines.push(col('  Instruction Coverage', 'bold'));
  for (const entry of summary.instructionCoverage.perPlatform) {
    const pctColor = entry.percentage >= 80 ? 'green' : entry.percentage >= 50 ? 'yellow' : 'red';
    lines.push(`    ${entry.platform}: ${col(`${entry.percentage}%`, pctColor)} (${entry.covered}/${entry.total})`);
    if (entry.missingSections.length > 0) {
      lines.push(`      ${col('Missing:', 'dim')} ${entry.missingSections.map(s => s.key).join(', ')}`);
    }
  }
  lines.push('');

  // MCP alignment
  lines.push(col('  MCP Alignment', 'bold'));
  lines.push(`    Total servers: ${summary.mcpAlignment.totalServers}`);
  lines.push(`    Fully aligned: ${col(String(summary.mcpAlignment.fullyAligned), 'green')}`);
  lines.push(`    Misaligned: ${col(String(summary.mcpAlignment.misaligned), summary.mcpAlignment.misaligned > 0 ? 'yellow' : 'green')}`);
  for (const server of summary.mcpAlignment.servers) {
    if (!server.aligned) {
      lines.push(`      ${col(server.server, 'yellow')}: missing from ${server.missingFrom.join(', ')}`);
    }
  }
  lines.push('');

  // Platform compliance
  lines.push(col('  Platform Compliance', 'bold'));
  for (const entry of summary.platformCompliance) {
    const status = entry.compliant
      ? col('COMPLIANT', 'green')
      : col('NON-COMPLIANT', 'red');
    lines.push(`    ${entry.platform}: ${status} (score: ${entry.score}, trust: ${entry.trustLevel}, coverage: ${entry.coveragePercent}%)`);
    for (const gap of entry.gaps) {
      lines.push(`      ${col('GAP:', 'yellow')} ${gap}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  getHarmonyGovernanceSummary,
  formatHarmonyGovernanceReport,
  inferTrustLevel,
  evaluateInstructionCoverage,
  evaluateMcpAlignment,
  TRUST_LEVELS,
  REQUIRED_INSTRUCTION_SECTIONS,
};
