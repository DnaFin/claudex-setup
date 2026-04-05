const DEPRECATION_NOTICE_CATALOG = [
  {
    feature: 'legacy-claude-api-patterns',
    message: 'Legacy Claude prompt patterns are deprecated in v1.x audits.',
    removedIn: '2.0.0',
    alternative: 'Use current Messages API conventions and modern CLAUDE.md patterns.',
    match: /human_prompt|assistant_prompt|deprecated api patterns/i,
  },
  {
    feature: 'legacy-codex-config',
    message: 'Deprecated Codex config and workflow patterns are flagged in v1.x.',
    removedIn: '2.0.0',
    alternative: 'Use the current Codex config schema and current workflow notes.',
    match: /deprecated codex|approval_policy|full_auto_error_mode|send_to_server|removed from the official codex config schema/i,
  },
  {
    feature: 'legacy-gemini-flags',
    message: 'Deprecated Gemini flags and config keys are flagged in v1.x.',
    removedIn: '2.0.0',
    alternative: 'Use current Gemini CLI settings, policy files, and output flags.',
    match: /deprecated gemini|--json|--allowed-tools|sandbox_mode|max_tokens|mcp_servers/i,
  },
  {
    feature: 'legacy-cursor-rule-surface',
    message: 'Legacy Cursor rule surfaces are deprecated in agent-mode audits.',
    removedIn: '2.0.0',
    alternative: 'Use `.cursor/rules/*.mdc` instead of `.cursorrules` for modern Cursor flows.',
    match: /\.cursorrules|legacy cursor/i,
  },
  {
    feature: 'legacy-windsurf-rule-surface',
    message: 'Legacy Windsurf rule surfaces are deprecated in modern Cascade flows.',
    removedIn: '2.0.0',
    alternative: 'Use `.windsurf/rules/*.md` instead of `.windsurfrules` for modern Windsurf flows.',
    match: /\.windsurfrules|legacy windsurf/i,
  },
];

function parseVersion(version) {
  const match = String(version || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index++) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function deprecationWarnings(version) {
  return DEPRECATION_NOTICE_CATALOG.filter((notice) => compareVersions(version, '1.0.0') >= 0 && compareVersions(version, notice.removedIn) < 0)
    .map(({ match, ...notice }) => ({ ...notice }));
}

function detectDeprecationWarnings(results, version) {
  const notices = deprecationWarnings(version);
  const haystack = Array.isArray(results) ? results.filter((item) => item && item.passed === false) : [];
  const matched = [];

  for (const notice of DEPRECATION_NOTICE_CATALOG) {
    if (compareVersions(version, '1.0.0') < 0 || compareVersions(version, notice.removedIn) >= 0) {
      continue;
    }

    const hit = haystack.find((item) => notice.match.test(`${item.key || ''}\n${item.name || ''}\n${item.fix || ''}`));
    if (hit) {
      matched.push({
        feature: notice.feature,
        message: notice.message,
        removedIn: notice.removedIn,
        alternative: hit.fix || notice.alternative,
      });
    }
  }

  if (matched.length > 0) {
    return matched;
  }

  return haystack
    .filter((item) => /deprecated|legacy|removed/i.test(`${item.name || ''}\n${item.fix || ''}`))
    .slice(0, 5)
    .map((item) => ({
      feature: item.key,
      message: item.name,
      removedIn: '2.0.0',
      alternative: item.fix,
    }));
}

module.exports = {
  deprecationWarnings,
  detectDeprecationWarnings,
};
