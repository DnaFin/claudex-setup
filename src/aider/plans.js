/**
 * Aider Proposal Families — proposal bundles for Aider setup improvements
 *
 * Simpler than IDE-based platforms since Aider has:
 * - No hooks, MCP, skills, or agents to configure
 * - Config: .aider.conf.yml, .env, conventions, .gitignore, .aiderignore
 */

const path = require('path');
const { version } = require('../../package.json');
const { audit } = require('../audit');
const { analyzeProject } = require('../analyze');
const { buildAiderSetupFiles } = require('./setup');
const { getAiderMcpPreflight } = require('./mcp-packs');

function maturityFromScore(score) {
  if (score >= 81) return 'mature';
  if (score >= 61) return 'solid';
  if (score >= 41) return 'developing';
  if (score >= 21) return 'weak';
  return 'raw';
}

function triggerMatchesFile(result, filePath) {
  if (filePath === '.aider.conf.yml') {
    return result.file === '.aider.conf.yml' || ['config', 'model-config', 'git-safety', 'advanced-config'].includes(result.category);
  }
  if (filePath === 'CONVENTIONS.md') {
    return result.file === 'CONVENTIONS.md' || result.category === 'conventions' || result.category === 'quality';
  }
  if (filePath === '.env') {
    return result.file === '.env' || result.category === 'model-config';
  }
  if (filePath === '.gitignore') {
    return result.file === '.gitignore' || result.category === 'security';
  }
  if (filePath === '.aiderignore') {
    return result.file === '.aiderignore' || result.category === 'architecture';
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

const PROPOSAL_FAMILIES = {
  '.aider.conf.yml': {
    id: 'aider-conf-yml',
    label: 'Aider Configuration',
    surface: '.aider.conf.yml',
    reason: 'Core Aider config — model selection, git safety, verification loop.',
    overwriteDefault: false,
  },
  'CONVENTIONS.md': {
    id: 'aider-conventions',
    label: 'Aider Conventions',
    surface: 'CONVENTIONS.md',
    reason: 'Project conventions that Aider reads via --read (no auto-discovery).',
    overwriteDefault: false,
  },
  '.env': {
    id: 'aider-env',
    label: 'Environment Config',
    surface: '.env',
    reason: 'API keys and model configuration via environment variables.',
    overwriteDefault: false,
  },
  '.aiderignore': {
    id: 'aider-aiderignore',
    label: 'Aider Ignore',
    surface: '.aiderignore',
    reason: 'File exclusion to keep Aider focused on relevant code.',
    overwriteDefault: false,
  },
  '.gitignore': {
    id: 'aider-gitignore',
    label: 'Git Ignore Additions',
    surface: '.gitignore',
    reason: 'Exclude .aider* artifacts and .env from git.',
    overwriteDefault: false,
  },
};

function buildProposalsFromAudit(auditResult, setupFiles, domainPackGuidance) {
  const proposals = [];

  for (const file of setupFiles) {
    const family = PROPOSAL_FAMILIES[file.path];
    if (!family) continue;

    const triggers = auditResult.results
      .filter(r => !r.passed && triggerMatchesFile(r, file.path))
      .map(r => ({ id: r.id, name: r.name, impact: r.impact }));

    if (triggers.length === 0) continue;

    const packContext = domainPackGuidance
      .filter(pack => {
        if (!pack.recommendedSurfaces || pack.recommendedSurfaces.length === 0) return true;
        return pack.recommendedSurfaces.some(s => file.path === s || file.path.startsWith(s));
      })
      .map(pack => ({
        key: pack.key,
        label: pack.label,
        why: pack.matchReasons[0] || pack.useWhen,
      }));

    proposals.push({
      id: family.id,
      label: family.label,
      surface: family.surface,
      reason: family.reason,
      triggers,
      packContext,
      content: file.content,
      overwriteDefault: family.overwriteDefault,
    });
  }

  return proposals;
}

/**
 * Build a full Aider proposal bundle.
 */
function buildAiderProposalBundle(options = {}) {
  const dir = options.dir || process.cwd();
  const auditResult = options.auditResult;
  const analysisReport = options.analysisReport;

  if (!auditResult || !analysisReport) {
    throw new Error('buildAiderProposalBundle requires auditResult and analysisReport');
  }

  const domainPackGuidance = buildDomainPackGuidance(analysisReport);
  const setupFiles = options.setupFiles || [];
  const mcpPreflight = getAiderMcpPreflight();
  const proposals = buildProposalsFromAudit(auditResult, setupFiles, domainPackGuidance);

  return {
    nerviqVersion: version,
    createdAt: new Date().toISOString(),
    platform: 'aider',
    directory: dir,
    projectSummary: {
      name: path.basename(dir),
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
      'Aider has no native MCP — use /web and editor extensions.',
      'Git is the ONLY undo mechanism — ensure auto-commits is true.',
    ]),
    mcpPreflightWarnings: mcpPreflight.warnings,
    proposals,
  };
}

module.exports = {
  buildAiderProposalBundle,
};
