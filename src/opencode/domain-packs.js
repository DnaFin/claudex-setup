/**
 * OpenCode Domain Packs — 16 domain packs
 *
 * Matches the Codex 16-pack standard adapted for OpenCode's
 * JSONC config, AGENTS.md, permission engine, and plugin system.
 */

const { buildAdditionalDomainPacks, detectAdditionalDomainPacks } = require('../domain-pack-expansion');

const BASE_OPENCODE_DOMAIN_PACKS = [
  {
    key: 'baseline-general',
    label: 'Baseline General',
    useWhen: 'General OpenCode repos that need a safe, reviewable baseline before deeper specialization.',
    adoption: 'Safe default when no stronger domain signal dominates the repo.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Permission baseline'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['starter-safe improvement', 'reviewable permission posture'],
  },
  {
    key: 'backend-api',
    label: 'Backend API',
    useWhen: 'Service, API, or backend-heavy repos with routes, services, jobs, schemas, or data access.',
    adoption: 'Recommended when OpenCode needs stronger verification and review structure around backend changes.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Backend verification guide', 'CI / review workflow starter'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config', 'opencode-ci'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json', '.github/workflows/'],
    benchmarkFocus: ['test + build verification', 'reviewable API changes', 'safe rollout posture'],
  },
  {
    key: 'frontend-ui',
    label: 'Frontend UI',
    useWhen: 'React, Next.js, Vue, Angular, or Svelte repos with UI-heavy workflows and component work.',
    adoption: 'Recommended when OpenCode needs better component, build, and review guidance.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Frontend review workflow', 'CI / review workflow starter'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config', 'opencode-ci'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json', '.github/workflows/'],
    benchmarkFocus: ['build verification', 'component-safe edits', 'reviewable UI changes'],
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    useWhen: 'Repos with CI, policy files, security posture, or auditable team workflows that need stronger OpenCode governance.',
    adoption: 'Recommended for teams that need explicit approvals, review expectations, and durable rollout evidence.',
    recommendedModules: ['OpenCode config baseline', 'Permission baseline', 'Plugin governance', 'Review workflow starter'],
    recommendedProposalFamilies: ['opencode-config', 'opencode-permissions', 'opencode-ci'],
    recommendedSurfaces: ['opencode.json', '.github/workflows/'],
    benchmarkFocus: ['policy-aware rollout', 'permission posture', 'repeatable governance evidence'],
  },
  {
    key: 'monorepo',
    label: 'Monorepo',
    useWhen: 'Workspace-based repos with multiple packages sharing a root and a need for scoped OpenCode behavior.',
    adoption: 'Recommended when path-aware permissions and workspace review boundaries matter.',
    recommendedModules: ['AGENTS.md baseline', 'Permission baseline', 'Workspace-aware permissions'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-permissions'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['workspace-safe edits', 'package-scoped review', 'cross-package drift control'],
  },
  {
    key: 'infra-platform',
    label: 'Infra Platform',
    useWhen: 'Terraform, Docker, Kubernetes, serverless, or deployment-oriented repos with operational blast radius.',
    adoption: 'Recommended when OpenCode changes need stronger permission guardrails and infra-aware verification.',
    recommendedModules: ['OpenCode config baseline', 'Permission baseline', 'Infra review workflow', 'CI / review workflow starter'],
    recommendedProposalFamilies: ['opencode-config', 'opencode-permissions', 'opencode-ci'],
    recommendedSurfaces: ['opencode.json', '.github/workflows/'],
    benchmarkFocus: ['release safety', 'infra verification', 'reviewable operational changes'],
  },
  {
    key: 'data-pipeline',
    label: 'Data Pipeline',
    useWhen: 'Repos with workers, DAGs, ETL jobs, migrations, or analytics-heavy workflows.',
    adoption: 'Recommended when OpenCode needs pipeline-safe verification and state-aware review.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Pipeline verification guide'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config', 'opencode-ci'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json', '.github/workflows/'],
    benchmarkFocus: ['pipeline safety', 'repeatable task flows', 'state-aware review'],
  },
  {
    key: 'oss-library',
    label: 'OSS Library',
    useWhen: 'Public packages or contributor-heavy repos that need lighter governance.',
    adoption: 'Recommended for open-source repos where OpenCode should suggest, not auto-apply.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['low-footprint adoption', 'contributor-safe defaults', 'manual review friendliness'],
  },
  {
    key: 'mobile',
    label: 'Mobile',
    useWhen: 'React Native, Flutter, Swift, or Kotlin repos with mobile-specific build and test workflows.',
    adoption: 'Recommended when OpenCode needs mobile build awareness and platform-specific verification.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Mobile verification guide'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['mobile build safety', 'platform-specific verification', 'reviewable native changes'],
  },
  {
    key: 'regulated-lite',
    label: 'Regulated Lite',
    useWhen: 'Repos with basic compliance needs — activity artifacts, rollback manifests, and audit trail.',
    adoption: 'Recommended for regulated-adjacent repos that need governance without full enterprise overhead.',
    recommendedModules: ['OpenCode config baseline', 'Permission baseline', 'Governance rollout kit'],
    recommendedProposalFamilies: ['opencode-config', 'opencode-permissions'],
    recommendedSurfaces: ['opencode.json'],
    benchmarkFocus: ['compliance posture', 'activity artifact coverage', 'rollback readiness'],
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    useWhen: 'Shopify, Stripe, or payment-heavy repos with transaction safety needs.',
    adoption: 'Recommended when OpenCode changes touch payment flows, cart logic, or sensitive data.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Security permission profile'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config', 'opencode-ci'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json', '.github/workflows/'],
    benchmarkFocus: ['transaction safety', 'payment flow review', 'PII-safe changes'],
  },
  {
    key: 'ai-ml',
    label: 'AI / ML',
    useWhen: 'Repos with ML pipelines, model training, RAG, or LLM integration workflows.',
    adoption: 'Recommended when OpenCode needs model-aware verification and experiment tracking.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'ML verification guide'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['model safety', 'experiment reproducibility', 'data pipeline review'],
  },
  {
    key: 'devops-cicd',
    label: 'DevOps / CI-CD',
    useWhen: 'Repos focused on CI/CD pipelines, deployment automation, and infrastructure-as-code.',
    adoption: 'Recommended when OpenCode manages CI workflows, deployment scripts, or release processes.',
    recommendedModules: ['OpenCode config baseline', 'Permission baseline', 'CI / review workflow starter'],
    recommendedProposalFamilies: ['opencode-config', 'opencode-permissions', 'opencode-ci'],
    recommendedSurfaces: ['opencode.json', '.github/workflows/'],
    benchmarkFocus: ['deployment safety', 'CI pipeline review', 'release gate coverage'],
  },
  {
    key: 'design-system',
    label: 'Design System',
    useWhen: 'Component libraries, Storybook repos, or design token systems.',
    adoption: 'Recommended when OpenCode edits shared UI components with downstream consumers.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline', 'Component review workflow'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['component safety', 'visual regression awareness', 'cross-consumer impact'],
  },
  {
    key: 'docs-content',
    label: 'Docs / Content',
    useWhen: 'Documentation repos, blogs, or content-heavy sites with editorial workflows.',
    adoption: 'Recommended when OpenCode edits prose, docs, or content with editorial review needs.',
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json'],
    benchmarkFocus: ['content quality', 'editorial review', 'link and reference integrity'],
  },
  {
    key: 'security-focused',
    label: 'Security Focused',
    useWhen: 'Repos with strong security posture needs — secret management, auth, encryption.',
    adoption: 'Recommended for security-critical repos where every OpenCode change needs security review.',
    recommendedModules: ['OpenCode config baseline', 'Permission baseline', 'Security permission profile'],
    recommendedProposalFamilies: ['opencode-config', 'opencode-permissions', 'opencode-ci'],
    recommendedSurfaces: ['opencode.json', '.github/workflows/'],
    benchmarkFocus: ['secret protection', 'auth flow safety', 'security review coverage'],
  },
];

const OPENCODE_DOMAIN_PACKS = [
  ...BASE_OPENCODE_DOMAIN_PACKS,
  ...buildAdditionalDomainPacks('opencode', {
    existingKeys: new Set(BASE_OPENCODE_DOMAIN_PACKS.map((pack) => pack.key)),
  }),
];

function uniqueByKey(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    result.push(item);
  }
  return result;
}

function detectOpenCodeDomainPacks(ctx, stacks = []) {
  const stackKeys = new Set((stacks || []).map((stack) => stack.key));
  const pkg = ctx.jsonFile ? (ctx.jsonFile('package.json') || {}) : {};
  const deps = ctx.projectDependencies ? ctx.projectDependencies() : {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const matches = [];

  function addMatch(key, reasons) {
    const pack = OPENCODE_DOMAIN_PACKS.find((item) => item.key === key);
    if (!pack) return;
    matches.push({ ...pack, matchReasons: reasons.filter(Boolean).slice(0, 3) });
  }

  const hasFrontend = stackKeys.has('react') || stackKeys.has('nextjs') || stackKeys.has('vue') ||
    stackKeys.has('angular') || stackKeys.has('svelte') ||
    ctx.hasDir('components') || ctx.hasDir('pages');

  const hasBackend = stackKeys.has('python') || stackKeys.has('django') || stackKeys.has('fastapi') ||
    stackKeys.has('go') || stackKeys.has('rust') || stackKeys.has('java') ||
    ctx.hasDir('api') || ctx.hasDir('routes') || ctx.hasDir('services');

  const hasInfra = stackKeys.has('docker') || stackKeys.has('terraform') || stackKeys.has('kubernetes') ||
    ctx.hasDir('infra') || ctx.hasDir('deploy');

  const isMonorepo = ctx.files.includes('nx.json') || ctx.files.includes('turbo.json') ||
    ctx.files.includes('lerna.json') || ctx.files.includes('pnpm-workspace.yaml') ||
    ctx.hasDir('packages');

  const hasCi = (typeof ctx.workflowFiles === 'function' ? ctx.workflowFiles().length : 0) > 0;
  const hasPolicyFiles = Boolean(ctx.fileContent('SECURITY.md') || ctx.fileContent('CODEOWNERS'));

  // Always include baseline
  addMatch('baseline-general', ['Default baseline for all OpenCode repos.']);

  if (hasBackend) {
    addMatch('backend-api', ['Detected backend stack or service-oriented directories.']);
  }
  if (hasFrontend) {
    addMatch('frontend-ui', ['Detected frontend stack or component directories.']);
  }
  if (hasInfra) {
    addMatch('infra-platform', ['Detected infrastructure configuration or deployment files.']);
  }
  if (isMonorepo) {
    addMatch('monorepo', ['Detected monorepo workspace configuration.']);
  }
  if (hasCi && hasPolicyFiles) {
    addMatch('enterprise-governed', ['Detected CI workflows and policy files.']);
  }

  detectAdditionalDomainPacks({
    ctx,
    pkg,
    deps,
    stackKeys,
    addMatch,
    hasBackend,
    hasFrontend,
    hasInfra,
    hasCi,
    isEnterpriseGoverned: hasCi && hasPolicyFiles,
  });

  return uniqueByKey(matches);
}

module.exports = {
  OPENCODE_DOMAIN_PACKS,
  detectOpenCodeDomainPacks,
};
