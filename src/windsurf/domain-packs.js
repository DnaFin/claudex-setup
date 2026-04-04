/**
 * Windsurf Domain Packs — 16 domain packs with Windsurf detection.
 *
 * Adapted from Cursor pattern with Windsurf-specific surfaces:
 * - .windsurf/rules/*.md (Markdown + YAML frontmatter, NOT MDC)
 * - .windsurf/mcp.json (with team whitelist)
 * - .windsurf/workflows/*.md (slash commands)
 * - .windsurf/memories/ (team-syncable)
 * - .cascadeignore (gitignore for Cascade)
 * - No background agents (unlike Cursor)
 */

const WINDSURF_DOMAIN_PACKS = [
  {
    key: 'baseline-general',
    label: 'Baseline General',
    useWhen: 'General repos that need a safe, reviewable baseline before deeper specialization.',
    adoption: 'Safe default when no stronger domain signal dominates the repo.',
    recommendedModules: ['.windsurf/rules/ baseline', '.windsurf/mcp.json baseline', 'Workflows starter'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-mcp'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json'],
    benchmarkFocus: ['starter-safe improvement', 'reviewable trust posture'],
  },
  {
    key: 'backend-api',
    label: 'Backend API',
    useWhen: 'Service, API, or backend-heavy repos with routes, services, jobs, schemas, or data access.',
    adoption: 'Recommended when Cascade agents need stronger verification and review structure.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Backend verification rules', 'CI / review workflow starter'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-ci-review'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json', '.github/workflows/'],
    benchmarkFocus: ['test + build verification', 'reviewable API changes', 'safe rollout posture'],
  },
  {
    key: 'frontend-ui',
    label: 'Frontend UI',
    useWhen: 'React, Next.js, Vue, Angular, or Svelte repos with UI-heavy workflows.',
    adoption: 'Recommended when Cascade agents need better component and build guidance.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Frontend review rules', 'Cascade UI guide'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json'],
    benchmarkFocus: ['build verification', 'component-safe edits', 'Cascade multi-file awareness'],
  },
  {
    key: 'data-pipeline',
    label: 'Data Pipeline',
    useWhen: 'Repos with workers, DAGs, ETL jobs, migrations, or analytics-heavy workflows.',
    adoption: 'Recommended when Cascade agents need pipeline-safe verification.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Pipeline verification rules'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json'],
    benchmarkFocus: ['pipeline safety', 'repeatable task flows', 'state-aware review'],
  },
  {
    key: 'infra-platform',
    label: 'Infra Platform',
    useWhen: 'Terraform, Docker, Kubernetes, serverless, or deployment-oriented repos.',
    adoption: 'Recommended when Cascade changes need stronger guardrails and infra-aware verification.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Infra review rules', 'Cascadeignore config'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-ci-review'],
    recommendedSurfaces: ['.windsurf/rules/', '.cascadeignore', '.github/workflows/'],
    benchmarkFocus: ['release safety', 'infra verification', 'reviewable operational changes'],
  },
  {
    key: 'oss-library',
    label: 'OSS Library',
    useWhen: 'Public packages or contributor-heavy repos that need lighter governance.',
    adoption: 'Recommended for open-source repos where Cascade should suggest, not auto-apply.',
    recommendedModules: ['.windsurf/rules/ baseline'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/'],
    benchmarkFocus: ['low-footprint adoption', 'contributor-safe defaults', 'manual review friendliness'],
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    useWhen: 'Repos with CI, policy files, security posture, or auditable team workflows.',
    adoption: 'Recommended for teams that need explicit approvals, review expectations, and governance.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Governance rollout kit', 'Enterprise policy rules', 'Team memories'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-enterprise', 'windsurf-ci-review'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/memories/', '.github/workflows/'],
    benchmarkFocus: ['policy-aware rollout', 'approval posture', 'repeatable governance evidence'],
  },
  {
    key: 'monorepo',
    label: 'Monorepo',
    useWhen: 'Workspace-based repos with multiple packages sharing a root.',
    adoption: 'Recommended when glob-scoped Auto rules and workspace boundaries matter.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Auto rules per package', 'Workflows'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-mcp'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json', '.windsurf/workflows/'],
    benchmarkFocus: ['workspace-safe edits', 'package-scoped rules', 'cross-package drift control'],
  },
  {
    key: 'mobile',
    label: 'Mobile',
    useWhen: 'React Native, Flutter, Swift, or Kotlin repos with mobile-specific workflows.',
    adoption: 'Recommended when Cascade needs mobile build awareness and platform-specific verification.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Mobile verification rules'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json'],
    benchmarkFocus: ['mobile build safety', 'platform-specific verification', 'reviewable native changes'],
  },
  {
    key: 'regulated-lite',
    label: 'Regulated Lite',
    useWhen: 'Repos with basic compliance needs — activity artifacts, rollback manifests, and audit trail.',
    adoption: 'Recommended for regulated-adjacent repos that need governance without full enterprise overhead.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Cascadeignore for sensitive files'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-enterprise'],
    recommendedSurfaces: ['.windsurf/rules/'],
    benchmarkFocus: ['compliance posture', 'cascadeignore coverage', 'rollback readiness'],
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    useWhen: 'Shopify, Stripe, or payment-heavy repos with transaction safety needs.',
    adoption: 'Recommended when Cascade changes touch payment flows, cart logic, or sensitive data.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Security review rules'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-ci-review'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json', '.github/workflows/'],
    benchmarkFocus: ['transaction safety', 'payment flow review', 'PII-safe changes'],
  },
  {
    key: 'ai-ml',
    label: 'AI / ML',
    useWhen: 'Repos with ML pipelines, model training, RAG, or LLM integration workflows.',
    adoption: 'Recommended when Cascade needs model-aware verification and experiment tracking.',
    recommendedModules: ['.windsurf/rules/ baseline', 'ML verification rules'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json'],
    benchmarkFocus: ['model safety', 'experiment reproducibility', 'data pipeline review'],
  },
  {
    key: 'devops-cicd',
    label: 'DevOps / CI-CD',
    useWhen: 'Repos focused on CI/CD pipelines, deployment automation, and infrastructure-as-code.',
    adoption: 'Recommended when Cascade manages CI workflows, deployment scripts, or release processes.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Workflow automation rules'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-ci-review'],
    recommendedSurfaces: ['.windsurf/rules/', '.github/workflows/'],
    benchmarkFocus: ['deployment safety', 'CI pipeline review', 'workflow trigger safety'],
  },
  {
    key: 'design-system',
    label: 'Design System',
    useWhen: 'Component libraries, Storybook repos, or design token systems.',
    adoption: 'Recommended when Cascade edits shared UI components with downstream consumers.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Component review rules'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json'],
    benchmarkFocus: ['component safety', 'visual regression awareness', 'Cascade multi-file tracking'],
  },
  {
    key: 'docs-content',
    label: 'Docs / Content',
    useWhen: 'Documentation repos, blogs, or content-heavy sites with editorial workflows.',
    adoption: 'Recommended when Cascade edits prose, docs, or content with editorial review needs.',
    recommendedModules: ['.windsurf/rules/ baseline'],
    recommendedProposalFamilies: ['windsurf-rules'],
    recommendedSurfaces: ['.windsurf/rules/'],
    benchmarkFocus: ['content quality', 'editorial review', 'link and reference integrity'],
  },
  {
    key: 'security-focused',
    label: 'Security Focused',
    useWhen: 'Repos with strong security posture needs — secret management, auth, encryption.',
    adoption: 'Recommended for security-critical repos where every Cascade change needs security review.',
    recommendedModules: ['.windsurf/rules/ baseline', 'Security review rules', 'Cascadeignore for secrets'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-enterprise'],
    recommendedSurfaces: ['.windsurf/rules/', '.cascadeignore'],
    benchmarkFocus: ['secret protection', 'cascadeignore enforcement', 'security review coverage'],
  },
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

function detectWindsurfDomainPacks(ctx, stacks = [], assets = {}) {
  const stackKeys = new Set((stacks || []).map((stack) => stack.key));
  const pkg = ctx.jsonFile ? (ctx.jsonFile('package.json') || {}) : {};
  const deps = ctx.projectDependencies ? ctx.projectDependencies() : {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const matches = [];

  function addMatch(key, reasons) {
    const pack = WINDSURF_DOMAIN_PACKS.find((item) => item.key === key);
    if (!pack) return;
    matches.push({ ...pack, matchReasons: reasons.filter(Boolean).slice(0, 3) });
  }

  const hasFrontend = stackKeys.has('react') || stackKeys.has('nextjs') || stackKeys.has('vue') ||
    stackKeys.has('angular') || stackKeys.has('svelte') ||
    ctx.hasDir('components') || ctx.hasDir('pages') ||
    (ctx.hasDir('app') && (deps.next || deps.react || deps.vue || deps['@angular/core'] || deps.svelte));

  const hasBackend = stackKeys.has('python') || stackKeys.has('django') || stackKeys.has('fastapi') ||
    stackKeys.has('go') || stackKeys.has('rust') || stackKeys.has('java') ||
    ctx.hasDir('api') || ctx.hasDir('routes') || ctx.hasDir('services') || ctx.hasDir('controllers') ||
    ctx.hasDir('workers') || ctx.hasDir('jobs');

  const hasInfra = stackKeys.has('docker') || stackKeys.has('terraform') || stackKeys.has('kubernetes') ||
    ctx.files.includes('wrangler.toml') || ctx.files.includes('serverless.yml') || ctx.files.includes('serverless.yaml') ||
    ctx.files.includes('cdk.json') || ctx.hasDir('infra') || ctx.hasDir('deploy') || ctx.hasDir('helm');

  const isMonorepo = ctx.files.includes('nx.json') || ctx.files.includes('turbo.json') ||
    ctx.files.includes('lerna.json') || ctx.files.includes('pnpm-workspace.yaml') ||
    ctx.hasDir('packages') ||
    (pkg.workspaces && (Array.isArray(pkg.workspaces) ? pkg.workspaces.length > 0 : true));

  const hasCi = ctx.hasDir('.github/workflows');
  const hasPolicyFiles = Boolean(ctx.fileContent('SECURITY.md') || ctx.fileContent('CODEOWNERS')) ||
    ctx.hasDir('compliance') || ctx.hasDir('policies') || ctx.hasDir('audit');
  const hasWindsurfRules = ctx.windsurfRules ? ctx.windsurfRules().length > 0 : ctx.hasDir('.windsurf/rules');
  const isEnterpriseGoverned = (hasCi && hasPolicyFiles) || (hasWindsurfRules && hasPolicyFiles);

  if (hasBackend) {
    addMatch('backend-api', [
      'Detected backend stack or service-oriented directories for Cascade agents.',
      ctx.hasDir('api') ? 'API-facing structure detected.' : null,
      ctx.hasDir('services') ? 'Service-layer directories detected.' : null,
    ]);
  }

  if (hasFrontend) {
    addMatch('frontend-ui', [
      'Detected UI-heavy frontend stack or component directories.',
      stackKeys.has('nextjs') ? 'Next.js stack detected.' : null,
      ctx.hasDir('components') ? 'Component directories detected.' : null,
    ]);
  }

  if (isEnterpriseGoverned) {
    addMatch('enterprise-governed', [
      'Detected team-governed rollout signals such as CI, policies, or explicit trust posture.',
      hasCi ? 'GitHub workflow automation detected.' : null,
      hasPolicyFiles ? 'Security/compliance policy files detected.' : null,
    ]);
  }

  if (isMonorepo) {
    addMatch('monorepo', [
      'Detected workspace or multi-package repository structure.',
      ctx.files.includes('pnpm-workspace.yaml') ? 'pnpm workspace detected.' : null,
      ctx.hasDir('packages') ? 'Packages directory detected.' : null,
    ]);
  }

  if (hasInfra) {
    addMatch('infra-platform', [
      'Detected infrastructure or deployment-oriented repo signals.',
      ctx.files.includes('wrangler.toml') ? 'Wrangler config detected.' : null,
      ctx.hasDir('infra') ? 'Infrastructure directory detected.' : null,
    ]);
  }

  const hasDataPipeline = ctx.hasDir('dags') || ctx.hasDir('etl') || ctx.hasDir('pipelines') ||
    ctx.hasDir('marts') || ctx.hasDir('migrations') ||
    deps.airflow || deps.prefect || deps.dagster || deps.dbt;
  if (hasDataPipeline) {
    addMatch('data-pipeline', ['Detected data pipeline or ETL-oriented repo signals.', ctx.hasDir('dags') ? 'DAG directory detected.' : null]);
  }

  const isOss = ctx.files.includes('LICENSE') && ctx.files.includes('CONTRIBUTING.md');
  if (isOss && !isEnterpriseGoverned) {
    addMatch('oss-library', ['Detected open-source library signals (LICENSE + CONTRIBUTING.md).']);
  }

  const isMobile = stackKeys.has('react-native') || stackKeys.has('flutter') ||
    stackKeys.has('swift') || stackKeys.has('kotlin') ||
    deps['react-native'] || deps.flutter || ctx.files.includes('Podfile') ||
    ctx.files.includes('build.gradle') || ctx.hasDir('ios') || ctx.hasDir('android');
  if (isMobile) {
    addMatch('mobile', ['Detected mobile development signals.', ctx.hasDir('ios') ? 'iOS directory detected.' : null, ctx.hasDir('android') ? 'Android directory detected.' : null]);
  }

  const isRegulated = hasPolicyFiles && !isEnterpriseGoverned;
  if (isRegulated) {
    addMatch('regulated-lite', ['Detected compliance-adjacent signals without full enterprise governance.']);
  }

  const isEcommerce = deps.stripe || deps['@stripe/stripe-js'] ||
    deps.shopify || deps['@shopify/shopify-api'] ||
    ctx.hasDir('checkout') || ctx.hasDir('cart') || ctx.hasDir('payments');
  if (isEcommerce) {
    addMatch('ecommerce', ['Detected e-commerce or payment-related signals.', deps.stripe ? 'Stripe dependency detected.' : null]);
  }

  const isAiMl = deps.tensorflow || deps.torch || deps.pytorch || deps.transformers ||
    deps.langchain || deps['@langchain/core'] || deps.openai || deps.anthropic ||
    ctx.hasDir('models') || ctx.hasDir('training') || ctx.hasDir('rag') ||
    ctx.files.includes('model.py') || ctx.files.includes('train.py');
  if (isAiMl) {
    addMatch('ai-ml', ['Detected AI/ML or model training signals.', ctx.hasDir('models') ? 'Models directory detected.' : null]);
  }

  const isDevops = hasCi && hasInfra && !isEnterpriseGoverned;
  if (isDevops) {
    addMatch('devops-cicd', ['Detected DevOps/CI-CD focus with both CI workflows and infrastructure.']);
  }

  const isDesignSystem = ctx.hasDir('stories') || ctx.hasDir('storybook') ||
    deps['@storybook/react'] || deps['@storybook/vue3'] ||
    ctx.files.includes('.storybook');
  if (isDesignSystem) {
    addMatch('design-system', ['Detected design system or component library signals.', ctx.hasDir('stories') ? 'Storybook stories detected.' : null]);
  }

  const isDocsContent = ctx.hasDir('docs') && !hasBackend && !hasFrontend &&
    (ctx.files.includes('mkdocs.yml') || ctx.files.includes('docusaurus.config.js') ||
     ctx.files.includes('_config.yml') || ctx.files.includes('hugo.toml'));
  if (isDocsContent) {
    addMatch('docs-content', ['Detected documentation or content-focused repo.']);
  }

  const isSecurityFocused = ctx.hasDir('security') ||
    deps['helmet'] || deps['csurf'] || deps['bcrypt'] ||
    (hasPolicyFiles && ctx.fileContent('SECURITY.md'));
  if (isSecurityFocused) {
    addMatch('security-focused', ['Detected security-focused repo signals.', ctx.fileContent('SECURITY.md') ? 'SECURITY.md present.' : null]);
  }

  if (matches.length === 0) {
    addMatch('baseline-general', [
      'No stronger platform-specific domain dominated, so a safe general Windsurf baseline is the best starting point.',
      hasWindsurfRules
        ? 'The repo already has Windsurf surfaces, but they are not yet specialized by domain.'
        : 'The repo needs a first Windsurf baseline before specialization.',
    ]);
  }

  return uniqueByKey(matches);
}

module.exports = {
  WINDSURF_DOMAIN_PACKS,
  detectWindsurfDomainPacks,
};
