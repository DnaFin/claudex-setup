/**
 * Copilot Proposal Bundle — 9 proposal families.
 *
 * copilot-instructions, copilot-scoped-instructions, copilot-prompts,
 * copilot-vscode-settings, copilot-mcp, copilot-cloud-setup,
 * copilot-content-exclusions, copilot-extensions, copilot-ci-review
 */

const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildCopilotSetupFiles } = require('./setup');
const { getCopilotMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath === '.github/copilot-instructions.md') {
    return result.file === '.github/copilot-instructions.md' || result.category === 'instructions' || result.category === 'quality-deep';
  }
  if (filePath === '.vscode/settings.json') {
    return result.file === '.vscode/settings.json' || ['config', 'trust', 'extensions'].includes(result.category);
  }
  if (filePath === '.vscode/mcp.json' || filePath.includes('MCP')) {
    return result.category === 'mcp';
  }
  if (filePath.includes('instructions/')) {
    return result.category === 'instructions' && result.id && result.id.includes('A06');
  }
  if (filePath.includes('prompts/')) {
    return result.category === 'prompt-files';
  }
  if (filePath.includes('copilot-setup-steps')) {
    return result.category === 'cloud-agent';
  }
  if (filePath.includes('copilot-review')) {
    return result.category === 'ci-automation';
  }
  if (filePath.includes('CONTENT-EXCLUSIONS') || filePath.includes('content-exclusions')) {
    return result.category === 'trust' && (result.id === 'CP-C01' || result.id === 'CP-C02');
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
  '.github/copilot-instructions.md': {
    id: 'copilot-instructions',
    title: 'Create Copilot copilot-instructions.md baseline',
    module: 'instructions',
    risk: 'low',
    confidence: 'high',
  },
  '.github/instructions/typescript.instructions.md': {
    id: 'copilot-scoped-instructions',
    title: 'Create Copilot scoped instruction starters',
    module: 'scoped-instructions',
    risk: 'low',
    confidence: 'medium',
  },
  '.github/prompts/review.prompt.md': {
    id: 'copilot-prompts',
    title: 'Create Copilot prompt template starters',
    module: 'prompts',
    risk: 'low',
    confidence: 'high',
  },
  '.vscode/settings.json': {
    id: 'copilot-vscode-settings',
    title: 'Create Copilot VS Code settings baseline',
    module: 'config',
    risk: 'medium',
    confidence: 'high',
  },
  '.vscode/mcp.json': {
    id: 'copilot-mcp',
    title: 'Create Copilot MCP configuration',
    module: 'mcp',
    risk: 'medium',
    confidence: 'high',
  },
  '.github/workflows/copilot-setup-steps.yml': {
    id: 'copilot-cloud-setup',
    title: 'Create Copilot cloud agent setup workflow',
    module: 'cloud-setup',
    risk: 'medium',
    confidence: 'medium',
  },
  '.github/COPILOT-CONTENT-EXCLUSIONS.md': {
    id: 'copilot-content-exclusions',
    title: 'Create Copilot content exclusions guide',
    module: 'content-exclusions',
    risk: 'low',
    confidence: 'high',
  },
  '.github/workflows/copilot-review.yml': {
    id: 'copilot-ci-review',
    title: 'Create Copilot CI review workflow',
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
    id: 'copilot-unknown',
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

async function buildCopilotProposalBundle(options) {
  const auditResult = await audit({ ...options, platform: 'copilot', silent: true });
  const analysisReport = await analyzeProject({ ...options, platform: 'copilot', mode: 'suggest-only' });
  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const { files } = buildCopilotSetupFiles(options);
  const proposals = files.map((file) => proposalForFile(file, auditResult, domainPackGuidance));

  // MCP preflight
  const mcpProposal = proposals.find(p => p.id === 'copilot-mcp');
  let mcpPreflightWarnings = [];
  if (mcpProposal) {
    const mcpFile = files.find(f => f.family === 'copilot-mcp');
    if (mcpFile && mcpFile.content) {
      let detectedKeys = [];
      try {
        const parsed = JSON.parse(mcpFile.content);
        detectedKeys = Object.keys(parsed.servers || parsed);
      } catch {
        const keyMatches = mcpFile.content.match(/"([^"]+)"\s*:/g) || [];
        detectedKeys = keyMatches.map(m => m.replace(/[":]/g, '').trim());
      }
      mcpPreflightWarnings = getCopilotMcpPreflight(detectedKeys)
        .filter(p => !p.safe)
        .map(p => ({ key: p.key, label: p.label, warning: p.warning }));
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: `nerviq@${version}`,
    createdAt: new Date().toISOString(),
    platform: 'copilot',
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
  buildCopilotProposalBundle,
};
