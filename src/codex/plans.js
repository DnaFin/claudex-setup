const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildCodexSetupFiles } = require('./setup');
const { getCodexMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath === 'AGENTS.md') {
    return result.file === 'AGENTS.md' || result.category === 'instructions' || result.category === 'review' || result.category === 'quality-deep';
  }
  if (filePath === '.codex/config.toml') {
    return result.file === '.codex/config.toml' || ['config', 'trust', 'hooks', 'mcp', 'agents', 'automation', 'local'].includes(result.category);
  }
  if (filePath === '.codex/rules/README.md') {
    return result.category === 'rules';
  }
  if (filePath === '.codex/hooks.json') {
    return result.category === 'hooks';
  }
  if (filePath === '.agents/skills/README.md') {
    return result.category === 'skills';
  }
  if (filePath === '.codex/agents/README.md') {
    return result.category === 'agents';
  }
  if (filePath === '.codex/config.toml (MCP append)') {
    return result.category === 'mcp';
  }
  if (filePath === '.github/workflows/codex-review.yml') {
    return result.category === 'automation' || result.category === 'review';
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
      if (!Array.isArray(pack.recommendedSurfaces) || pack.recommendedSurfaces.length === 0) {
        return true;
      }
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
    id: 'codex-agents-md',
    title: 'Create Codex AGENTS.md baseline',
    module: 'instructions',
    risk: 'low',
    confidence: 'high',
  },
  '.codex/config.toml': {
    id: 'codex-config',
    title: 'Create Codex config baseline',
    module: 'config',
    risk: 'medium',
    confidence: 'high',
  },
  '.codex/rules/README.md': {
    id: 'codex-rules',
    title: 'Create Codex rules starter',
    module: 'rules',
    risk: 'low',
    confidence: 'high',
  },
  '.codex/hooks.json': {
    id: 'codex-hooks',
    title: 'Create Codex hooks scaffold',
    module: 'hooks',
    risk: 'medium',
    confidence: 'medium',
  },
  '.agents/skills/README.md': {
    id: 'codex-skills',
    title: 'Create Codex skills starter',
    module: 'skills',
    risk: 'low',
    confidence: 'high',
  },
  '.codex/agents/README.md': {
    id: 'codex-subagents',
    title: 'Create Codex custom agents starter',
    module: 'agents',
    risk: 'low',
    confidence: 'medium',
  },
  '.codex/config.toml (MCP append)': {
    id: 'codex-mcp',
    title: 'Add recommended MCP packs to Codex config',
    module: 'mcp',
    risk: 'medium',
    confidence: 'high',
  },
  '.github/workflows/codex-review.yml': {
    id: 'codex-ci-review',
    title: 'Create Codex CI review workflow',
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
    id: 'codex-unknown',
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
    .map((result) => ({
      key: result.key,
      name: result.name,
      impact: result.impact,
      fix: result.fix,
    }));
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
        `--- missing`,
        `+++ ${file.path}`,
        ...file.content.split('\n').slice(0, 12).map((line) => `+${line}`),
      ].join('\n'),
    }],
    readyToApply: true,
  };
}

async function buildCodexProposalBundle(options) {
  const auditResult = await audit({ ...options, platform: 'codex', silent: true });
  const analysisReport = await analyzeProject({ ...options, platform: 'codex', mode: 'suggest-only' });
  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const { files } = buildCodexSetupFiles(options);
  const proposals = files.map((file) => proposalForFile(file, auditResult, domainPackGuidance));

  // MCP preflight warnings for any MCP proposals
  const mcpProposal = proposals.find(p => p.id === 'codex-mcp');
  let mcpPreflightWarnings = [];
  if (mcpProposal) {
    const mcpFile = files.find(f => f.family === 'codex-mcp');
    if (mcpFile && mcpFile.content) {
      const packKeyMatches = mcpFile.content.match(/\[mcp_servers\.([^\]]+)\]/g) || [];
      const detectedKeys = packKeyMatches.map(m => m.replace('[mcp_servers.', '').replace(']', ''));
      mcpPreflightWarnings = getCodexMcpPreflight(detectedKeys)
        .filter(p => !p.safe)
        .map(p => ({ key: p.key, label: p.label, warning: p.warning }));
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: `nerviq@${version}`,
    createdAt: new Date().toISOString(),
    platform: 'codex',
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
  buildCodexProposalBundle,
};
