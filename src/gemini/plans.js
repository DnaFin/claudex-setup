const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildGeminiSetupFiles } = require('./setup');
const { getGeminiMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath === 'GEMINI.md') {
    return result.file === 'GEMINI.md' || result.category === 'instructions' || result.category === 'review' || result.category === 'quality-deep';
  }
  if (filePath === '.gemini/settings.json') {
    return result.file === '.gemini/settings.json' || ['config', 'trust', 'hooks', 'mcp', 'agents', 'automation', 'local'].includes(result.category);
  }
  if (filePath === '.gemini/settings.json (hooks append)') {
    return result.category === 'hooks';
  }
  if (filePath === '.gemini/commands/README.md') {
    return result.category === 'commands';
  }
  if (filePath === '.gemini/agents/README.md') {
    return result.category === 'agents';
  }
  if (filePath === '.gemini/skills/README.md') {
    return result.category === 'skills';
  }
  if (filePath === '.gemini/policy/README.md') {
    return result.category === 'policy';
  }
  if (filePath === '.gemini/settings.json (MCP append)') {
    return result.category === 'mcp';
  }
  if (filePath === '.github/workflows/gemini-review.yml') {
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
  'GEMINI.md': {
    id: 'gemini-md',
    title: 'Create Gemini CLI GEMINI.md baseline',
    module: 'instructions',
    risk: 'low',
    confidence: 'high',
  },
  '.gemini/settings.json': {
    id: 'gemini-settings',
    title: 'Create Gemini CLI settings.json baseline',
    module: 'config',
    risk: 'medium',
    confidence: 'high',
  },
  '.gemini/settings.json (hooks append)': {
    id: 'gemini-hooks',
    title: 'Add Gemini CLI hooks scaffold to settings.json',
    module: 'hooks',
    risk: 'medium',
    confidence: 'medium',
  },
  '.gemini/commands/README.md': {
    id: 'gemini-commands',
    title: 'Create Gemini CLI commands starter',
    module: 'commands',
    risk: 'low',
    confidence: 'high',
  },
  '.gemini/agents/README.md': {
    id: 'gemini-agents',
    title: 'Create Gemini CLI agents starter',
    module: 'agents',
    risk: 'low',
    confidence: 'medium',
  },
  '.gemini/skills/README.md': {
    id: 'gemini-skills',
    title: 'Create Gemini CLI skills starter',
    module: 'skills',
    risk: 'low',
    confidence: 'high',
  },
  '.gemini/policy/README.md': {
    id: 'gemini-policy',
    title: 'Create Gemini CLI policy starter',
    module: 'policy',
    risk: 'low',
    confidence: 'high',
  },
  '.gemini/settings.json (MCP append)': {
    id: 'gemini-mcp',
    title: 'Add recommended MCP packs to Gemini CLI settings',
    module: 'mcp',
    risk: 'medium',
    confidence: 'high',
  },
  '.github/workflows/gemini-review.yml': {
    id: 'gemini-ci-review',
    title: 'Create Gemini CLI CI review workflow',
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
    id: 'gemini-unknown',
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

async function buildGeminiProposalBundle(options) {
  const auditResult = await audit({ ...options, platform: 'gemini', silent: true });
  const analysisReport = await analyzeProject({ ...options, platform: 'gemini', mode: 'suggest-only' });
  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const { files } = buildGeminiSetupFiles(options);
  const proposals = files.map((file) => proposalForFile(file, auditResult, domainPackGuidance));

  // MCP preflight warnings for any MCP proposals
  const mcpProposal = proposals.find(p => p.id === 'gemini-mcp');
  let mcpPreflightWarnings = [];
  if (mcpProposal) {
    const mcpFile = files.find(f => f.family === 'gemini-mcp');
    if (mcpFile && mcpFile.content) {
      // Parse JSON content to extract server keys
      let detectedKeys = [];
      try {
        const parsed = JSON.parse(mcpFile.content);
        detectedKeys = Object.keys(parsed);
      } catch {
        // Fallback: try regex for serverName patterns
        const keyMatches = mcpFile.content.match(/"([^"]+)"\s*:/g) || [];
        detectedKeys = keyMatches.map(m => m.replace(/[":]/g, '').trim());
      }
      mcpPreflightWarnings = getGeminiMcpPreflight(detectedKeys)
        .filter(p => !p.safe)
        .map(p => ({ key: p.key, label: p.label, warning: p.warning }));
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: `nerviq@${version}`,
    createdAt: new Date().toISOString(),
    platform: 'gemini',
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
  buildGeminiProposalBundle,
};
