/**
 * Windsurf Proposal Bundle — 9 proposal families.
 *
 * windsurf-rules, windsurf-mcp, windsurf-cascadeignore, windsurf-workflows,
 * windsurf-memories, windsurf-legacy-migration, windsurf-ci-review,
 * windsurf-cascade-guide, windsurf-enterprise
 */

const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildWindsurfSetupFiles } = require('./setup');
const { getWindsurfMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath.startsWith('.windsurf/rules/')) {
    return result.file === '.windsurf/rules/' || result.category === 'rules' ||
           result.category === 'instructions-quality' || result.category === 'quality-deep';
  }
  if (filePath === '.windsurf/mcp.json' || filePath.includes('MCP')) {
    return result.category === 'mcp';
  }
  if (filePath === '.cascadeignore') {
    return result.category === 'cascadeignore' || result.category === 'trust';
  }
  if (filePath.includes('workflows')) {
    return result.category === 'workflows';
  }
  if (filePath.includes('memories')) {
    return result.category === 'memories';
  }
  if (filePath.includes('windsurf-review')) {
    return result.category === 'cross-surface';
  }
  if (filePath.includes('cascade-guide')) {
    return result.category === 'cascade-agent';
  }
  if (filePath.includes('migration')) {
    return result.id === 'WS-A02' || result.id === 'WS-L02';
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
  '.windsurf/rules/core.md': {
    id: 'windsurf-rules',
    title: 'Create Windsurf core rules (.md)',
    module: 'rules',
    risk: 'low',
    confidence: 'high',
  },
  '.windsurf/mcp.json': {
    id: 'windsurf-mcp',
    title: 'Create Windsurf MCP configuration',
    module: 'mcp',
    risk: 'medium',
    confidence: 'high',
  },
  '.cascadeignore': {
    id: 'windsurf-cascadeignore',
    title: 'Create .cascadeignore for sensitive file exclusion',
    module: 'cascadeignore',
    risk: 'low',
    confidence: 'high',
  },
  '.windsurf/rules/migration-guide.md': {
    id: 'windsurf-legacy-migration',
    title: 'Create legacy .windsurfrules migration guide',
    module: 'legacy-migration',
    risk: 'low',
    confidence: 'high',
  },
  '.github/workflows/windsurf-review.yml': {
    id: 'windsurf-ci-review',
    title: 'Create Windsurf CI review workflow',
    module: 'ci',
    risk: 'medium',
    confidence: 'medium',
  },
  '.windsurf/rules/cascade-guide.md': {
    id: 'windsurf-cascade-guide',
    title: 'Create Cascade agent usage guide',
    module: 'cascade-guide',
    risk: 'low',
    confidence: 'medium',
  },
  '.windsurf/rules/typescript.md': {
    id: 'windsurf-rules',
    title: 'Create Windsurf TypeScript Auto rule',
    module: 'rules',
    risk: 'low',
    confidence: 'high',
  },
};

function resolveProposalFamily(file) {
  const familyFromFile = file.family
    ? Object.values(PROPOSAL_FAMILIES).find(f => f.id === file.family)
    : null;
  return familyFromFile || PROPOSAL_FAMILIES[file.path] || {
    id: 'windsurf-unknown',
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
      diffPreview: [`--- missing`, `+++ ${file.path}`, ...file.content.split('\n').slice(0, 12).map((line) => `+${line}`)].join('\n'),
    }],
    readyToApply: true,
  };
}

async function buildWindsurfProposalBundle(options) {
  const auditResult = await audit({ ...options, platform: 'windsurf', silent: true });
  const analysisReport = await analyzeProject({ ...options, platform: 'windsurf', mode: 'suggest-only' });
  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const { files } = buildWindsurfSetupFiles(options);
  const proposals = files.map((file) => proposalForFile(file, auditResult, domainPackGuidance));

  // MCP preflight
  const mcpProposal = proposals.find(p => p.id === 'windsurf-mcp');
  let mcpPreflightWarnings = [];
  if (mcpProposal) {
    const mcpFile = files.find(f => f.family === 'windsurf-mcp');
    if (mcpFile && mcpFile.content) {
      let detectedKeys = [];
      try {
        const parsed = JSON.parse(mcpFile.content);
        detectedKeys = Object.keys(parsed.mcpServers || parsed);
      } catch {
        const keyMatches = mcpFile.content.match(/"([^"]+)"\s*:/g) || [];
        detectedKeys = keyMatches.map(m => m.replace(/[":]/g, '').trim());
      }
      mcpPreflightWarnings = getWindsurfMcpPreflight(detectedKeys)
        .filter(p => !p.safe)
        .map(p => ({ key: p.key, label: p.label, warning: p.warning }));
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: `nerviq@${version}`,
    createdAt: new Date().toISOString(),
    platform: 'windsurf',
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
  buildWindsurfProposalBundle,
};
