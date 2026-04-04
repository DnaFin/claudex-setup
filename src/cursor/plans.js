/**
 * Cursor Proposal Bundle — 9 proposal families.
 *
 * cursor-rules, cursor-mcp, cursor-environment, cursor-automations,
 * cursor-bugbot, cursor-legacy-migration, cursor-ci-review,
 * cursor-design-mode, cursor-enterprise
 */

const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildCursorSetupFiles } = require('./setup');
const { getCursorMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath.startsWith('.cursor/rules/')) {
    return result.file === '.cursor/rules/' || result.category === 'rules' ||
           result.category === 'instructions-quality' || result.category === 'quality-deep';
  }
  if (filePath === '.cursor/mcp.json' || filePath.includes('MCP')) {
    return result.category === 'mcp';
  }
  if (filePath === '.cursor/environment.json') {
    return result.category === 'background-agents';
  }
  if (filePath.includes('automations')) {
    return result.category === 'automations';
  }
  if (filePath.includes('cursor-review')) {
    return result.category === 'cross-surface';
  }
  if (filePath.includes('bugbot')) {
    return result.category === 'bugbot';
  }
  if (filePath.includes('design-mode')) {
    return result.category === 'quality-deep';
  }
  if (filePath.includes('migration')) {
    return result.id === 'CU-A02' || result.id === 'CU-L02';
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
  '.cursor/rules/core.mdc': {
    id: 'cursor-rules',
    title: 'Create Cursor core rules (.mdc)',
    module: 'rules',
    risk: 'low',
    confidence: 'high',
  },
  '.cursor/mcp.json': {
    id: 'cursor-mcp',
    title: 'Create Cursor MCP configuration',
    module: 'mcp',
    risk: 'medium',
    confidence: 'high',
  },
  '.cursor/environment.json': {
    id: 'cursor-environment',
    title: 'Create Cursor background agent environment config',
    module: 'environment',
    risk: 'medium',
    confidence: 'medium',
  },
  '.cursor/rules/migration-guide.mdc': {
    id: 'cursor-legacy-migration',
    title: 'Create legacy .cursorrules migration guide',
    module: 'legacy-migration',
    risk: 'low',
    confidence: 'high',
  },
  '.github/workflows/cursor-review.yml': {
    id: 'cursor-ci-review',
    title: 'Create Cursor CI review workflow',
    module: 'ci',
    risk: 'medium',
    confidence: 'medium',
  },
  '.cursor/rules/bugbot-guide.mdc': {
    id: 'cursor-bugbot',
    title: 'Create BugBot configuration guide',
    module: 'bugbot',
    risk: 'low',
    confidence: 'medium',
  },
  '.cursor/rules/design-mode-guide.mdc': {
    id: 'cursor-design-mode',
    title: 'Create Design Mode usage guide',
    module: 'design-mode',
    risk: 'low',
    confidence: 'medium',
  },
  '.cursor/rules/typescript.mdc': {
    id: 'cursor-rules',
    title: 'Create Cursor TypeScript Auto Attached rule',
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
    id: 'cursor-unknown',
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

async function buildCursorProposalBundle(options) {
  const auditResult = await audit({ ...options, platform: 'cursor', silent: true });
  const analysisReport = await analyzeProject({ ...options, platform: 'cursor', mode: 'suggest-only' });
  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const { files } = buildCursorSetupFiles(options);
  const proposals = files.map((file) => proposalForFile(file, auditResult, domainPackGuidance));

  // MCP preflight
  const mcpProposal = proposals.find(p => p.id === 'cursor-mcp');
  let mcpPreflightWarnings = [];
  if (mcpProposal) {
    const mcpFile = files.find(f => f.family === 'cursor-mcp');
    if (mcpFile && mcpFile.content) {
      let detectedKeys = [];
      try {
        const parsed = JSON.parse(mcpFile.content);
        detectedKeys = Object.keys(parsed.mcpServers || parsed);
      } catch {
        const keyMatches = mcpFile.content.match(/"([^"]+)"\s*:/g) || [];
        detectedKeys = keyMatches.map(m => m.replace(/[":]/g, '').trim());
      }
      mcpPreflightWarnings = getCursorMcpPreflight(detectedKeys)
        .filter(p => !p.safe)
        .map(p => ({ key: p.key, label: p.label, warning: p.warning }));
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: `nerviq@${version}`,
    createdAt: new Date().toISOString(),
    platform: 'cursor',
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
  buildCursorProposalBundle,
};
