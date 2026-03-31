const DOMAIN_PACKS = [
  {
    key: 'baseline-general',
    label: 'Baseline General',
    useWhen: 'General repos that need a pragmatic Claude baseline without domain-specific assumptions.',
    recommendedModules: ['CLAUDE.md baseline', 'verification', 'safe-write profile'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['discover next actions', 'starter-safe improvement', 'governed rollout'],
  },
  {
    key: 'backend-api',
    label: 'Backend API',
    useWhen: 'Service, API, or backend-heavy repos with routes, services, jobs, or data access.',
    recommendedModules: ['verification', 'security workflow', 'commands', 'rules'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['test + build verification', 'security review workflow', 'safe apply on existing config'],
  },
  {
    key: 'frontend-ui',
    label: 'Frontend UI',
    useWhen: 'React, Next.js, Vue, Angular, or Svelte repos with components and UI-heavy workflows.',
    recommendedModules: ['frontend rules', 'design guidance', 'commands', 'benchmark'],
    recommendedMcpPacks: ['context7-docs', 'next-devtools'],
    benchmarkFocus: ['build checks', 'component workflow quality', 'framework-aware starter output'],
  },
  {
    key: 'data-pipeline',
    label: 'Data Pipeline',
    useWhen: 'Repos with workers, DAGs, marts, ETL jobs, migrations, or analytics-heavy workflows.',
    recommendedModules: ['verification', 'rules', 'agents', 'benchmark'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['pipeline safety', 'repeatable task flows', 'state-aware review artifacts'],
  },
  {
    key: 'infra-platform',
    label: 'Infra Platform',
    useWhen: 'Terraform, Docker, Kubernetes, Wrangler, or deployment-oriented repos.',
    recommendedModules: ['ci-devops', 'commands', 'governance', 'benchmark'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['release safety', 'policy-controlled rollout', 'infra verification loops'],
  },
  {
    key: 'oss-library',
    label: 'OSS Library',
    useWhen: 'Public packages or contributor-heavy repos that need a lighter governance footprint.',
    recommendedModules: ['suggest-only profile', 'light rules', 'commands', 'README-aligned CLAUDE.md'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['low-footprint adoption', 'manual review friendliness', 'contributor-safe defaults'],
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    useWhen: 'Repos with CI, permissions, hooks, and a need for auditable change controls.',
    recommendedModules: ['governance', 'activity artifacts', 'rollback manifests', 'benchmark evidence'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['policy-aware rollout', 'approval flow readiness', 'benchmark export quality'],
  },
  {
    key: 'monorepo',
    label: 'Monorepo',
    useWhen: 'Nx, Turborepo, Lerna, or workspace-based repos with multiple packages sharing a root.',
    recommendedModules: ['path-specific rules', 'commands per package', 'governance', 'agents'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['package-scoped rule coverage', 'cross-package safety', 'workspace-aware starter output'],
  },
  {
    key: 'mobile',
    label: 'Mobile App',
    useWhen: 'React Native, Flutter, Swift, or Kotlin repos with mobile-specific build and release workflows.',
    recommendedModules: ['verification', 'commands', 'rules', 'agents'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['build verification', 'platform-specific rules', 'release workflow quality'],
  },
  {
    key: 'regulated-lite',
    label: 'Regulated Lite',
    useWhen: 'Repos in regulated environments (fintech, health, legal) that need auditability without full enterprise governance overhead.',
    recommendedModules: ['governance', 'activity artifacts', 'suggest-only profile', 'audit logging'],
    recommendedMcpPacks: ['context7-docs'],
    benchmarkFocus: ['audit trail completeness', 'change traceability', 'policy compliance readiness'],
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

function detectDomainPacks(ctx, stacks, assets = null) {
  const stackKeys = new Set((stacks || []).map(stack => stack.key));
  const pkg = ctx.jsonFile('package.json') || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const matches = [];

  function addMatch(key, reasons) {
    const pack = DOMAIN_PACKS.find(item => item.key === key);
    if (!pack) return;
    matches.push({
      ...pack,
      matchReasons: reasons.filter(Boolean).slice(0, 3),
    });
  }

  const hasFrontend = stackKeys.has('react') || stackKeys.has('nextjs') || stackKeys.has('vue') ||
    stackKeys.has('angular') || stackKeys.has('svelte') || ctx.hasDir('components') || ctx.hasDir('app') || ctx.hasDir('pages');
  const hasBackend = stackKeys.has('node') || stackKeys.has('python') || stackKeys.has('django') ||
    stackKeys.has('fastapi') || stackKeys.has('go') || stackKeys.has('rust') || stackKeys.has('java') ||
    ctx.hasDir('api') || ctx.hasDir('routes') || ctx.hasDir('services') || ctx.hasDir('controllers');
  const hasData = ctx.hasDir('dags') || ctx.hasDir('jobs') || ctx.hasDir('workers') ||
    ctx.hasDir('models') || ctx.hasDir('migrations') || ctx.hasDir('db') ||
    deps.dbt || deps['apache-airflow'] || deps.pandas || deps.polars || deps.duckdb;
  const hasInfra = stackKeys.has('docker') || stackKeys.has('terraform') || stackKeys.has('kubernetes') ||
    ctx.files.includes('wrangler.toml') || ctx.files.includes('serverless.yml') || ctx.files.includes('serverless.yaml') ||
    ctx.files.includes('cdk.json') || ctx.hasDir('infra') || ctx.hasDir('deploy') || ctx.hasDir('helm');
  const isOss = !!ctx.fileContent('LICENSE') && !!ctx.fileContent('CONTRIBUTING.md') && pkg.private !== true;
  const isEnterpriseGoverned = !!(assets && assets.permissions && assets.permissions.hasDenyRules) &&
    !!(assets && assets.files && assets.files.settings) && ctx.hasDir('.github/workflows');

  if (hasBackend) {
    addMatch('backend-api', [
      'Detected backend stack or service directories.',
      ctx.hasDir('api') ? 'API-facing structure detected.' : null,
      ctx.hasDir('services') ? 'Service-layer directories detected.' : null,
    ]);
  }

  if (hasFrontend) {
    addMatch('frontend-ui', [
      'Detected frontend stack or UI directories.',
      ctx.hasDir('components') ? 'Component directories detected.' : null,
      stackKeys.has('nextjs') ? 'Next.js stack detected.' : null,
    ]);
  }

  if (hasData) {
    addMatch('data-pipeline', [
      'Detected worker, jobs, models, or analytics-style structure.',
      ctx.hasDir('jobs') ? 'Job/pipeline directories detected.' : null,
      ctx.hasDir('migrations') ? 'Migration flow detected.' : null,
    ]);
  }

  if (hasInfra) {
    addMatch('infra-platform', [
      'Detected deployment or infrastructure signals.',
      ctx.files.includes('wrangler.toml') ? 'Wrangler deployment config detected.' : null,
      ctx.hasDir('deploy') ? 'Deployment directory detected.' : null,
    ]);
  }

  if (isOss) {
    addMatch('oss-library', [
      'License and contribution guidance suggest an open-source repo.',
      pkg.private === false ? 'package.json is not marked private.' : null,
    ]);
  }

  if (isEnterpriseGoverned) {
    addMatch('enterprise-governed', [
      'Settings, deny rules, and CI indicate a governed team workflow.',
      'Repo already has policy-aware Claude assets.',
    ]);
  }

  // Monorepo detection
  const isMonorepo = ctx.files.includes('nx.json') || ctx.files.includes('turbo.json') ||
    ctx.files.includes('lerna.json') || ctx.hasDir('packages') ||
    (pkg.workspaces && (Array.isArray(pkg.workspaces) ? pkg.workspaces.length > 0 : true));
  if (isMonorepo) {
    addMatch('monorepo', [
      'Detected monorepo or workspace configuration.',
      ctx.files.includes('nx.json') ? 'Nx workspace detected.' : null,
      ctx.files.includes('turbo.json') ? 'Turborepo detected.' : null,
      ctx.hasDir('packages') ? 'Packages directory detected.' : null,
    ]);
  }

  // Mobile detection
  const isMobile = deps['react-native'] || deps.expo || deps.flutter ||
    ctx.files.includes('Podfile') || ctx.files.includes('build.gradle') ||
    ctx.files.includes('build.gradle.kts') || ctx.hasDir('ios') || ctx.hasDir('android');
  if (isMobile) {
    addMatch('mobile', [
      'Detected mobile app structure or dependencies.',
      deps['react-native'] ? 'React Native detected.' : null,
      ctx.hasDir('ios') ? 'iOS directory detected.' : null,
      ctx.hasDir('android') ? 'Android directory detected.' : null,
    ]);
  }

  // Regulated-lite detection
  const isRegulated = ctx.files.includes('SECURITY.md') ||
    ctx.files.includes('COMPLIANCE.md') || ctx.hasDir('compliance') ||
    ctx.hasDir('audit') || ctx.hasDir('policies') ||
    (pkg.keywords && pkg.keywords.some(k => ['hipaa', 'fintech', 'compliance', 'regulated', 'sox', 'pci'].includes(k)));
  if (isRegulated && !isEnterpriseGoverned) {
    addMatch('regulated-lite', [
      'Detected compliance or regulatory signals without full enterprise governance.',
      ctx.files.includes('SECURITY.md') ? 'SECURITY.md present.' : null,
      ctx.hasDir('compliance') ? 'Compliance directory detected.' : null,
    ]);
  }

  const deduped = uniqueByKey(matches);
  if (deduped.length === 0) {
    return [{
      ...DOMAIN_PACKS.find(item => item.key === 'baseline-general'),
      matchReasons: ['No stronger domain signal detected yet.'],
    }];
  }
  return deduped;
}

module.exports = {
  DOMAIN_PACKS,
  detectDomainPacks,
};
