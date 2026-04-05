/**
 * Harmony Drift Detection Engine
 *
 * Compares configurations ACROSS platforms and finds inconsistencies
 * in instructions, trust posture, MCP servers, rules, and coverage.
 *
 * Drift types:
 *   instruction-drift  — different platforms say different things
 *   trust-drift        — sandbox/approval modes differ across platforms
 *   mcp-drift          — MCP servers not aligned across platforms
 *   rule-drift         — rule coverage differs between platforms
 *   coverage-gap       — platform missing instructions entirely
 *
 * Severity: critical, high, medium, low
 */

const SEVERITY_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

// ─── Trust level risk mapping ───────────────────────────────────────────────

const TRUST_RISK = {
  'bypass': 4,
  'full-auto': 4,
  'unrestricted': 4,
  'no-sandbox': 3,
  'standard': 2,
  'safe-write': 2,
  'default': 1,
  'locked-down': 0,
  'unknown': 1,
};

// ─── Drift detectors ───────────────────────────────────────────────────────

/**
 * Detect trust posture drift across platforms.
 * Critical if risk gap >= 2 levels between any two platforms.
 */
function detectTrustDrift(model) {
  const drifts = [];
  const platforms = Object.keys(model.trustPosture);

  if (platforms.length < 2) return drifts;

  const riskLevels = {};
  for (const p of platforms) {
    riskLevels[p] = TRUST_RISK[model.trustPosture[p]] ?? 1;
  }

  const maxRisk = Math.max(...Object.values(riskLevels));
  const minRisk = Math.min(...Object.values(riskLevels));
  const gap = maxRisk - minRisk;

  if (gap === 0) return drifts;

  const highRiskPlatforms = platforms.filter(p => riskLevels[p] === maxRisk);
  const lowRiskPlatforms = platforms.filter(p => riskLevels[p] === minRisk);

  let severity = 'low';
  if (gap >= 3) severity = 'critical';
  else if (gap >= 2) severity = 'high';
  else if (gap >= 1) severity = 'medium';

  drifts.push({
    type: 'trust-drift',
    severity,
    platforms,
    description: `Trust posture gap of ${gap} levels: ` +
      `${highRiskPlatforms.map(p => `${p}=${model.trustPosture[p]}`).join(', ')} vs ` +
      `${lowRiskPlatforms.map(p => `${p}=${model.trustPosture[p]}`).join(', ')}`,
    recommendation: `Align trust posture across platforms. Consider raising ${lowRiskPlatforms.join(', ')} ` +
      `or tightening ${highRiskPlatforms.join(', ')} to reduce risk surface.`,
  });

  return drifts;
}

/**
 * Detect MCP server drift — servers present on some platforms but not others.
 */
function detectMcpDrift(model) {
  const drifts = [];
  const allPlatforms = model.activePlatforms.map(p => p.platform);
  const mcpCapablePlatforms = allPlatforms.filter(p =>
    p === 'claude' || p === 'gemini' || p === 'copilot' || p === 'cursor' || p === 'windsurf' || p === 'opencode'
  );

  if (mcpCapablePlatforms.length < 2) return drifts;

  for (const [name, server] of Object.entries(model.mcpServers)) {
    const present = server.platforms.filter(p => mcpCapablePlatforms.includes(p));
    const missing = mcpCapablePlatforms.filter(p => !server.platforms.includes(p));

    if (missing.length > 0 && present.length > 0) {
      drifts.push({
        type: 'mcp-drift',
        severity: missing.length >= 2 ? 'high' : 'medium',
        platforms: [...present, ...missing],
        description: `MCP server "${name}" is configured on ${present.join(', ')} but missing from ${missing.join(', ')}`,
        recommendation: `Add "${name}" to ${missing.join(', ')} MCP configuration to ensure consistent tool access.`,
      });
    }
  }

  // Check for platforms with zero MCP servers when others have some
  const serverCounts = {};
  for (const p of mcpCapablePlatforms) {
    const detail = model.platformDetails[p];
    serverCounts[p] = detail ? detail.mcpServers.length : 0;
  }

  const withServers = mcpCapablePlatforms.filter(p => serverCounts[p] > 0);
  const withoutServers = mcpCapablePlatforms.filter(p => serverCounts[p] === 0);

  if (withServers.length > 0 && withoutServers.length > 0) {
    drifts.push({
      type: 'mcp-drift',
      severity: 'medium',
      platforms: [...withServers, ...withoutServers],
      description: `MCP servers configured on ${withServers.join(', ')} (${withServers.map(p => serverCounts[p]).join(', ')} servers) ` +
        `but ${withoutServers.join(', ')} have none`,
      recommendation: `Consider adding MCP servers to ${withoutServers.join(', ')} for consistent tool access.`,
    });
  }

  return drifts;
}

/**
 * Detect rule drift — platforms with rules configured vs those without.
 */
function detectRuleDrift(model) {
  const drifts = [];
  const allPlatforms = model.activePlatforms.map(p => p.platform);

  // Platforms that support rules: claude (.claude/rules), copilot (.github/instructions), cursor (.cursor/rules)
  const ruleCapable = allPlatforms.filter(p =>
    p === 'claude' || p === 'copilot' || p === 'cursor' || p === 'windsurf'
  );

  if (ruleCapable.length < 2) return drifts;

  const ruleCounts = {};
  for (const p of ruleCapable) {
    ruleCounts[p] = model.activePlatforms.find(ap => ap.platform === p)?.ruleCount || 0;
  }

  const withRules = ruleCapable.filter(p => ruleCounts[p] > 0);
  const withoutRules = ruleCapable.filter(p => ruleCounts[p] === 0);

  if (withRules.length > 0 && withoutRules.length > 0) {
    drifts.push({
      type: 'rule-drift',
      severity: 'medium',
      platforms: [...withRules, ...withoutRules],
      description: `Rules configured on ${withRules.map(p => `${p} (${ruleCounts[p]})`).join(', ')} ` +
        `but missing from ${withoutRules.join(', ')}`,
      recommendation: `Add equivalent rules to ${withoutRules.join(', ')} to maintain consistent behavior constraints.`,
    });
  }

  // Check for large rule count gaps
  const maxRules = Math.max(...Object.values(ruleCounts));
  const minRules = Math.min(...Object.values(ruleCounts));

  if (maxRules > 0 && minRules > 0 && maxRules > minRules * 3) {
    const richPlatform = ruleCapable.find(p => ruleCounts[p] === maxRules);
    const sparPlatform = ruleCapable.find(p => ruleCounts[p] === minRules);
    drifts.push({
      type: 'rule-drift',
      severity: 'low',
      platforms: [richPlatform, sparPlatform],
      description: `Large rule count gap: ${richPlatform} has ${maxRules} rules vs ${sparPlatform} with ${minRules}`,
      recommendation: `Review whether ${sparPlatform} is missing important rules that ${richPlatform} enforces.`,
    });
  }

  return drifts;
}

/**
 * Detect instruction coverage gaps — platforms with no instruction files at all.
 */
function detectCoverageGaps(model) {
  const drifts = [];
  const allPlatforms = model.activePlatforms;

  for (const ap of allPlatforms) {
    const detail = model.platformDetails[ap.platform];
    if (!detail) continue;

    if (detail.instructionFiles.length === 0 || !detail.instructionContent.trim()) {
      drifts.push({
        type: 'coverage-gap',
        severity: 'high',
        platforms: [ap.platform],
        description: `${ap.label} is detected but has no instruction content`,
        recommendation: `Create instruction file for ${ap.label} to ensure consistent agent behavior.`,
      });
    }

    if (detail.configFiles.length === 0) {
      drifts.push({
        type: 'coverage-gap',
        severity: 'medium',
        platforms: [ap.platform],
        description: `${ap.label} has no configuration file`,
        recommendation: `Add configuration for ${ap.label} to explicitly set trust and behavior parameters.`,
      });
    }
  }

  return drifts;
}

/**
 * Detect instruction drift — key instruction patterns present in some but not all platforms.
 */
function detectInstructionDrift(model) {
  const drifts = [];
  const platforms = model.activePlatforms.map(p => p.platform);

  if (platforms.length < 2) return drifts;

  // Check for common instruction patterns that should be shared
  const patterns = [
    { name: 'test command', regex: /(?:test|pytest|jest|vitest|npm\s+test)/i, severity: 'high' },
    { name: 'lint command', regex: /(?:lint|eslint|ruff|pylint)/i, severity: 'medium' },
    { name: 'build command', regex: /(?:build|compile|tsc|webpack|vite build)/i, severity: 'medium' },
    { name: 'architecture diagram', regex: /(?:mermaid|graph\s+TD|flowchart)/i, severity: 'low' },
    { name: 'security instructions', regex: /(?:\.env|secrets?|credential|NEVER.*push|deny.*read)/i, severity: 'high' },
    { name: 'language preference', regex: /(?:hebrew|english|language|speak|respond in)/i, severity: 'low' },
  ];

  for (const pattern of patterns) {
    const has = [];
    const hasNot = [];

    for (const p of platforms) {
      const detail = model.platformDetails[p];
      if (!detail) continue;
      const content = detail.instructionContent || '';
      if (pattern.regex.test(content)) {
        has.push(p);
      } else {
        hasNot.push(p);
      }
    }

    if (has.length > 0 && hasNot.length > 0) {
      drifts.push({
        type: 'instruction-drift',
        severity: pattern.severity,
        platforms: [...has, ...hasNot],
        description: `"${pattern.name}" found in ${has.join(', ')} but missing from ${hasNot.join(', ')}`,
        recommendation: `Add ${pattern.name} instructions to ${hasNot.join(', ')} for consistent behavior.`,
      });
    }
  }

  return drifts;
}

// ─── Main detection function ────────────────────────────────────────────────

/**
 * Detect all types of drift across platforms in a canonical model.
 *
 * @param {object} canonicalModel - Output of buildCanonicalModel()
 * @returns {object} { drifts, summary, harmonyScore }
 */
function detectDrift(canonicalModel) {
  const drifts = [
    ...detectInstructionDrift(canonicalModel),
    ...detectTrustDrift(canonicalModel),
    ...detectMcpDrift(canonicalModel),
    ...detectRuleDrift(canonicalModel),
    ...detectCoverageGaps(canonicalModel),
  ];

  // Sort by severity (critical first)
  drifts.sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0));

  // Summary counts
  const summary = {
    total: drifts.length,
    critical: drifts.filter(d => d.severity === 'critical').length,
    high: drifts.filter(d => d.severity === 'high').length,
    medium: drifts.filter(d => d.severity === 'medium').length,
    low: drifts.filter(d => d.severity === 'low').length,
  };

  // Harmony score: start at 100, deduct per drift
  const deductions = {
    critical: 20,
    high: 12,
    medium: 5,
    low: 2,
  };

  let harmonyScore = 100;
  for (const drift of drifts) {
    harmonyScore -= deductions[drift.severity] || 2;
  }
  harmonyScore = Math.max(0, Math.min(100, harmonyScore));

  return {
    drifts,
    summary,
    harmonyScore,
  };
}

// ─── Report formatter ───────────────────────────────────────────────────────

const SEVERITY_ICONS = {
  critical: '\u2718',  // ✘
  high: '!',
  medium: '~',
  low: '-',
};

const SEVERITY_COLORS = {
  critical: 'red',
  high: 'yellow',
  medium: 'blue',
  low: 'dim',
};

/**
 * Format a drift report for console output.
 *
 * @param {object} driftResult - Output of detectDrift()
 * @param {object} [options] - { color: true, verbose: false }
 * @returns {string} Formatted report
 */
function formatDriftReport(driftResult, options = {}) {
  const { color = true, verbose = false } = options;
  const c = color ? colorize : (text) => text;
  const lines = [];

  lines.push('');
  lines.push(c('  Harmony Drift Report', 'bold'));
  lines.push(c('  ' + '='.repeat(40), 'dim'));
  lines.push('');

  // Score
  const score = driftResult.harmonyScore;
  const scoreColor = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
  lines.push(`  Harmony Score: ${c(String(score) + '/100', scoreColor)}`);
  lines.push('');

  // Summary
  const s = driftResult.summary;
  if (s.total === 0) {
    lines.push(c('  No drift detected. All platforms are aligned.', 'green'));
  } else {
    lines.push(`  Drift items: ${s.total} total`);
    if (s.critical > 0) lines.push(c(`    Critical: ${s.critical}`, 'red'));
    if (s.high > 0) lines.push(c(`    High:     ${s.high}`, 'yellow'));
    if (s.medium > 0) lines.push(c(`    Medium:   ${s.medium}`, 'blue'));
    if (s.low > 0) lines.push(c(`    Low:      ${s.low}`, 'dim'));
  }

  lines.push('');

  // Individual drifts
  for (const drift of driftResult.drifts) {
    const icon = SEVERITY_ICONS[drift.severity] || '-';
    const dColor = SEVERITY_COLORS[drift.severity] || 'dim';

    lines.push(c(`  ${icon} [${drift.severity.toUpperCase()}] ${drift.type}`, dColor));
    lines.push(`    ${drift.description}`);
    if (verbose && drift.recommendation) {
      lines.push(c(`    Recommendation: ${drift.recommendation}`, 'dim'));
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  detectDrift,
  formatDriftReport,
};
