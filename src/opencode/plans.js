/**
 * OpenCode Plans — Proposal families for OpenCode setup
 *
 * Families: opencode-agents-md, opencode-config, opencode-permissions,
 *           opencode-plugins, opencode-skills, opencode-mcp, opencode-ci
 */

const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildOpenCodeSetupFiles } = require('./setup');
const { getOpenCodeMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath === 'AGENTS.md') {
    return result.file === 'AGENTS.md' || result.category === 'instructions' || result.category === 'quality-deep';
  }
  if (filePath === 'opencode.json') {
    return result.file === 'opencode.json' || ['config', 'permissions', 'plugins', 'mcp', 'agents'].includes(result.category);
  }
  if (filePath === '.opencode/plugins/README.md') {
    return result.category === 'plugins';
  }
  if (filePath === '.opencode/commands/README.md') {
    return result.category === 'skills' || result.category === 'commands';
  }
  if (filePath === 'opencode.json (MCP append)') {
    return result.category === 'mcp';
  }
  if (filePath === '.github/workflows/opencode-review.yml') {
    return result.category === 'ci';
  }
  return result.file === filePath;
}

function uniqueValues(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function buildDomainPackGuidance(report) {
  return (report.recommendedDomainPacks || []).map((pack) => ({
    key: pack.key,
    label: pack.label,
    useWhen: pack.useWhen,
    matchReasons: pack.matchReasons || [],
    recommendedModules: pack.recommendedModules || [],
    recommendedProposalFamilies: pack.recommendedProposalFamilies || [],
    recommendedSurfaces: pack.recommendedSurfaces || [],
    benchmarkFocus: pack.benchmarkFocus || [],
  }));
}

function selectPackContext(filePath, domainPackGuidance = []) {
  return domainPackGuidance
    .filter((pack) => {
      if (!Array.isArray(pack.recommendedSurfaces) || pack.recommendedSurfaces.length === 0) return true;
      return pack.recommendedSurfaces.some((surface) => filePath === surface || filePath.startsWith(surface));
    })
    .map((pack) => ({
      key: pack.key,
      label: pack.label,
      why: pack.matchReasons[0] || pack.useWhen,
      recommendedModules: (pack.recommendedModules || []).slice(0, 3),
      recommendedProposalFamilies: (pack.recommendedProposalFamilies || []).slice(0, 3),
      benchmarkFocus: (pack.benchmarkFocus || []).slice(0, 2),
    }));
}

const PROPOSAL_FAMILIES = {
  'AGENTS.md': {
    id: 'opencode-agents-md',
    title: 'Create OpenCode AGENTS.md baseline',
    module: 'instructions',
    risk: 'low',
    confidence: 'high',
  },
  'opencode.json': {
    id: 'opencode-config',
    title: 'Create OpenCode config baseline',
    module: 'config',
    risk: 'medium',
    confidence: 'high',
  },
  '.opencode/plugins/README.md': {
    id: 'opencode-plugins',
    title: 'Create OpenCode plugins starter',
    module: 'plugins',
    risk: 'low',
    confidence: 'high',
  },
  '.opencode/commands/README.md': {
    id: 'opencode-skills',
    title: 'Create OpenCode commands/skills starter',
    module: 'skills',
    risk: 'low',
    confidence: 'high',
  },
  'opencode.json (MCP append)': {
    id: 'opencode-mcp',
    title: 'Add recommended MCP packs to OpenCode config',
    module: 'mcp',
    risk: 'medium',
    confidence: 'high',
  },
  '.github/workflows/opencode-review.yml': {
    id: 'opencode-ci',
    title: 'Create OpenCode CI review workflow',
    module: 'ci',
    risk: 'medium',
    confidence: 'medium',
  },
};

function resolveProposalFamily(file) {
  const familyFromFile = file.family
    ? Object.values(PROPOSAL_FAMILIES).find(f => f.id === file.family)
    : null;
  return familyFromFile || PROPOSAL_FAMILIES[file.path] || {
    id: 'opencode-unknown',
    title: `Create ${file.path}`,
    module: 'unknown',
    risk: 'medium',
    confidence: 'low',
  };
}

function proposalForFile(file, auditResult, domainPackGuidance = []) {
  const triggers = auditResult.results
    .filter((result) => result.passed === false && triggerMatchesFile(result, file.path))
    .sort((a, b) => {
      const weight = { critical: 3, high: 2, medium: 1, low: 0 };
      return (weight[b.impact] || 0) - (weight[a.impact] || 0);
    })
    .slice(0, 6)
    .map((result) => ({ key: result.key, name: result.name, impact: result.impact, fix: result.fix }));

  const packContext = selectPackContext(file.path, domainPackGuidance);
  const familyMeta = resolveProposalFamily(file);

  return {
    id: familyMeta.id,
    title: familyMeta.title,
    module: familyMeta.module,
    risk: familyMeta.risk,
    confidence: familyMeta.confidence,
    triggers,
    rationale: uniqueValues([
      ...triggers.map((item) => item.fix),
      ...packContext.map((item) => `Supports ${item.label} rollout guidance: ${item.why}`),
    ]),
    packContext,
    files: [{
      path: file.path,
      action: file.action,
      currentState: file.currentState,
      proposedState: file.proposedState,
      content: file.content,
      preview: file.content.split('\n').slice(0, 12).join('\n'),
      diffPreview: [
        '--- missing',
        `+++ ${file.path}`,
        ...file.content.split('\n').slice(0, 12).map((line) => `+${line}`),
      ].join('\n'),
    }],
    readyToApply: true,
  };
}

async function buildOpenCodeProposalBundle(options) {
  const auditResult = await audit({ ...options, platform: 'opencode', silent: true });
  const analysisReport = await analyzeProject({ ...options, platform: 'opencode', mode: 'suggest-only' });
  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const { files } = buildOpenCodeSetupFiles(options);
  const proposals = files.map((file) => proposalForFile(file, auditResult, domainPackGuidance));

  // MCP preflight warnings
  const mcpProposal = proposals.find(p => p.id === 'opencode-mcp');
  let mcpPreflightWarnings = [];
  if (mcpProposal) {
    const mcpFile = files.find(f => f.family === 'opencode-mcp');
    if (mcpFile && mcpFile.content) {
      const packKeyMatches = mcpFile.content.match(/"(\w[\w-]*)"\s*:/g) || [];
      const detectedKeys = packKeyMatches.map(m => m.replace(/"/g, '').replace(':', '').trim());
      mcpPreflightWarnings = getOpenCodeMcpPreflight(detectedKeys)
        .filter(p => !p.safe)
        .map(p => ({ key: p.key, label: p.label, warning: p.warning }));
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: `nerviq@${version}`,
    createdAt: new Date().toISOString(),
    platform: 'opencode',
    directory: options.dir,
    projectSummary: {
      name: path.basename(options.dir),
      score: auditResult.score,
      organicScore: auditResult.organicScore,
      maturity: maturityFromScore(auditResult.score),
      domains: analysisReport.projectSummary.domains || [],
    },
    strengthsPreserved: auditResult.results
      .filter((item) => item.passed === true)
      .slice(0, 5)
      .map((item) => item.name),
    topNextActions: auditResult.topNextActions,
    recommendedDomainPacks: domainPackGuidance,
    proposalFamilies: [...new Set(proposals.map(p => p.id))],
    optionalModules: analysisReport.optionalModules || [],
    riskNotes: uniqueValues([
      ...(analysisReport.riskNotes || []),
      ...((auditResult.platformCaveats || []).map((item) => item.message)),
    ]),
    mcpPreflightWarnings,
    proposals,
  };
}

module.exports = {
  buildOpenCodeProposalBundle,
};
