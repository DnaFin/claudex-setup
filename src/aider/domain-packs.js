/**
 * Aider Domain Packs — 16 domain packs adapted for Aider
 *
 * Aider domain packs are simpler than IDE-based platforms since:
 * - No hooks, MCP, or agent config
 * - All recommendations map to .aider.conf.yml, .env, conventions, .gitignore
 * - Git is the only safety mechanism
 */

const { buildAdditionalDomainPacks, detectAdditionalDomainPacks } = require('../domain-pack-expansion');

const BASE_AIDER_DOMAIN_PACKS = [
  {
    key: 'baseline-general',
    label: 'Baseline General',
    useWhen: 'General repos that need a safe Aider baseline before deeper specialization.',
    adoption: 'Safe default when no stronger domain signal dominates the repo.',
    recommendedModules: ['.aider.conf.yml baseline', 'Convention file starter', '.gitignore additions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.gitignore'],
    benchmarkFocus: ['starter-safe config', 'git safety posture'],
  },
  {
    key: 'backend-api',
    label: 'Backend API',
    useWhen: 'Service, API, or backend repos with routes, services, jobs, schemas, or data access.',
    adoption: 'Recommended when Aider needs test and lint verification loops around backend changes.',
    recommendedModules: ['.aider.conf.yml baseline', 'Convention file with API patterns', 'Test/lint auto-fix loop'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions', 'aider-ci'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.github/workflows/'],
    benchmarkFocus: ['test verification', 'lint auto-fix', 'safe API changes'],
  },
  {
    key: 'frontend-ui',
    label: 'Frontend UI',
    useWhen: 'React, Next.js, Vue, Angular, or Svelte repos with UI-heavy workflows.',
    adoption: 'Recommended when Aider needs build verification and component-safe conventions.',
    recommendedModules: ['.aider.conf.yml baseline', 'Frontend conventions', 'Build/lint auto-fix'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions', 'aider-ci'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.github/workflows/'],
    benchmarkFocus: ['build verification', 'component-safe edits', 'lint auto-fix'],
  },
  {
    key: 'enterprise-governed',
    label: 'Enterprise Governed',
    useWhen: 'Repos with CI, policy files, or auditable workflows that need stronger governance.',
    adoption: 'Recommended for teams that need explicit review expectations and commit traceability.',
    recommendedModules: ['.aider.conf.yml with traceability', 'Convention file with governance', 'CI workflow'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions', 'aider-ci'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.github/workflows/'],
    benchmarkFocus: ['commit traceability', 'review posture', 'governance evidence'],
  },
  {
    key: 'monorepo',
    label: 'Monorepo',
    useWhen: 'Workspace-based repos with multiple packages sharing a root.',
    adoption: 'Recommended when subtree-only and .aiderignore matter for scoped work.',
    recommendedModules: ['.aider.conf.yml with subtree', '.aiderignore', 'Convention file'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', '.aiderignore', 'CONVENTIONS.md'],
    benchmarkFocus: ['subtree-safe edits', 'package-scoped context', 'map-tokens tuning'],
  },
  {
    key: 'infra-platform',
    label: 'Infra Platform',
    useWhen: 'Terraform, Docker, Kubernetes, serverless, or deployment-oriented repos.',
    adoption: 'Recommended when Aider changes need infra-aware conventions and careful review.',
    recommendedModules: ['.aider.conf.yml baseline', 'Infra conventions', 'CI workflow'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions', 'aider-ci'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.github/workflows/'],
    benchmarkFocus: ['infra safety', 'plan/apply conventions', 'reviewable changes'],
  },
  {
    key: 'data-pipeline',
    label: 'Data Pipeline',
    useWhen: 'Repos with workers, DAGs, ETL jobs, migrations, or analytics workflows.',
    adoption: 'Recommended when Aider needs pipeline-safe conventions and state awareness.',
    recommendedModules: ['.aider.conf.yml baseline', 'Pipeline conventions', 'Test auto-fix'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md'],
    benchmarkFocus: ['pipeline safety', 'migration conventions', 'state-aware review'],
  },
  {
    key: 'oss-library',
    label: 'OSS Library',
    useWhen: 'Public packages or contributor-heavy repos that need lighter governance.',
    adoption: 'Recommended for open-source repos where Aider should follow contributor standards.',
    recommendedModules: ['.aider.conf.yml baseline', 'OSS conventions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md'],
    benchmarkFocus: ['contributor standards', 'test coverage', 'clean commits'],
  },
  {
    key: 'ml-ai',
    label: 'ML / AI',
    useWhen: 'Machine learning, deep learning, or AI/NLP repos with notebooks, models, and experiment tracking.',
    adoption: 'Recommended when Aider works on model code and needs experiment-safe patterns.',
    recommendedModules: ['.aider.conf.yml baseline', 'ML conventions', '.aiderignore for data/models'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.aiderignore'],
    benchmarkFocus: ['experiment safety', 'notebook conventions', 'data file exclusion'],
  },
  {
    key: 'mobile',
    label: 'Mobile',
    useWhen: 'React Native, Flutter, Swift, or Kotlin mobile repos.',
    adoption: 'Recommended when Aider needs mobile build and platform-specific conventions.',
    recommendedModules: ['.aider.conf.yml baseline', 'Mobile conventions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md'],
    benchmarkFocus: ['build verification', 'platform conventions', 'asset management'],
  },
  {
    key: 'security-focused',
    label: 'Security Focused',
    useWhen: 'Security tools, audit repos, or security-sensitive codebases.',
    adoption: 'Recommended when Aider changes need extra security review and guardrails.',
    recommendedModules: ['.aider.conf.yml with review posture', 'Security conventions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md'],
    benchmarkFocus: ['secret exclusion', 'review posture', 'security conventions'],
  },
  {
    key: 'docs-content',
    label: 'Docs / Content',
    useWhen: 'Documentation sites, technical writing, or content-heavy repos.',
    adoption: 'Recommended when Aider is used for documentation and content editing.',
    recommendedModules: ['.aider.conf.yml baseline', 'Content conventions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md'],
    benchmarkFocus: ['content quality', 'style consistency', 'build verification'],
  },
  {
    key: 'embedded-iot',
    label: 'Embedded / IoT',
    useWhen: 'C, C++, Rust embedded, or IoT firmware repos.',
    adoption: 'Recommended when Aider needs hardware-aware conventions and build verification.',
    recommendedModules: ['.aider.conf.yml baseline', 'Embedded conventions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md'],
    benchmarkFocus: ['build verification', 'memory safety', 'hardware conventions'],
  },
  {
    key: 'game-dev',
    label: 'Game Development',
    useWhen: 'Unity, Unreal, Godot, or custom game engine repos.',
    adoption: 'Recommended when Aider needs engine-aware conventions and asset exclusion.',
    recommendedModules: ['.aider.conf.yml baseline', 'Game dev conventions', '.aiderignore for assets'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.aiderignore'],
    benchmarkFocus: ['asset exclusion', 'engine conventions', 'build verification'],
  },
  {
    key: 'devops-ci',
    label: 'DevOps / CI',
    useWhen: 'CI/CD-focused repos with pipeline definitions, deployment scripts, and automation.',
    adoption: 'Recommended when Aider modifies CI pipelines and deployment configurations.',
    recommendedModules: ['.aider.conf.yml baseline', 'DevOps conventions'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions', 'aider-ci'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.github/workflows/'],
    benchmarkFocus: ['pipeline safety', 'deployment conventions', 'rollback awareness'],
  },
  {
    key: 'research-notebook',
    label: 'Research / Notebook',
    useWhen: 'Jupyter-heavy research repos with experiments and data analysis.',
    adoption: 'Recommended when Aider works alongside notebooks and needs experiment tracking.',
    recommendedModules: ['.aider.conf.yml baseline', 'Research conventions', '.aiderignore for data'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.aiderignore'],
    benchmarkFocus: ['data exclusion', 'experiment conventions', 'reproducibility'],
  },
];

const AIDER_DOMAIN_PACKS = [
  ...BASE_AIDER_DOMAIN_PACKS,
  ...buildAdditionalDomainPacks('aider', {
    existingKeys: new Set(BASE_AIDER_DOMAIN_PACKS.map((pack) => pack.key)),
  }),
];

function uniqueByKey(matches) {
  const seen = new Set();
  return matches.filter(m => {
    if (seen.has(m.key)) return false;
    seen.add(m.key);
    return true;
  });
}

function detectAiderDomainPacks(ctx) {
  const matches = [];
  const pkg = typeof ctx.jsonFile === 'function' ? (ctx.jsonFile('package.json') || {}) : {};
  const deps = ctx.allDependencies ? ctx.allDependencies() : {};
  const files = ctx.files || [];
  const stackKeys = new Set();

  function addMatch(key, reasons) {
    const pack = AIDER_DOMAIN_PACKS.find(p => p.key === key);
    if (pack) {
      matches.push({ ...pack, matchReasons: reasons.filter(Boolean) });
    }
  }

  // Backend API
  const isBackend = deps['express'] || deps['fastify'] || deps['koa'] || deps['hapi'] ||
    deps['django'] || deps['flask'] || deps['fastapi'] || deps['gin-gonic'] ||
    files.some(f => /routes\/|controllers\/|services\/|api\//i.test(f));
  if (isBackend) {
    addMatch('backend-api', ['Detected backend/API framework or route structure.']);
  }

  // Frontend UI
  const isFrontend = deps['react'] || deps['vue'] || deps['@angular/core'] || deps['svelte'] ||
    deps['next'] || deps['nuxt'] ||
    files.some(f => /components\/|pages\/|app\//i.test(f));
  if (isFrontend) {
    addMatch('frontend-ui', ['Detected frontend framework or component structure.']);
  }

  // Monorepo
  const isMonorepo = Boolean(ctx.fileContent('pnpm-workspace.yaml')) ||
    Boolean(ctx.fileContent('lerna.json')) ||
    files.some(f => /packages\/|apps\//i.test(f));
  if (isMonorepo) {
    addMatch('monorepo', ['Detected workspace or monorepo structure.']);
  }

  // Infra
  const isInfra = files.some(f => /\.tf$|Dockerfile|docker-compose|k8s\/|kubernetes\/|serverless\.yml/i.test(f));
  if (isInfra) {
    addMatch('infra-platform', ['Detected infrastructure or deployment files.']);
  }

  // Data Pipeline
  const isData = deps['apache-airflow'] || deps['dagster'] || deps['prefect'] || deps['dbt'] ||
    files.some(f => /dags\/|migrations\/|etl\//i.test(f));
  if (isData) {
    addMatch('data-pipeline', ['Detected data pipeline or ETL signals.']);
  }

  // ML / AI
  const isML = deps['torch'] || deps['tensorflow'] || deps['transformers'] || deps['scikit-learn'] ||
    deps['keras'] || files.some(f => /models\/|notebooks\/|\.ipynb/i.test(f));
  if (isML) {
    addMatch('ml-ai', ['Detected ML/AI framework or model files.']);
  }

  // Mobile
  const isMobile = deps['react-native'] || deps['flutter'] ||
    files.some(f => /\.swift$|\.kt$|\.xcodeproj|android\/|ios\//i.test(f));
  if (isMobile) {
    addMatch('mobile', ['Detected mobile development signals.']);
  }

  // Enterprise
  const hasPolicyFiles = Boolean(ctx.fileContent('SECURITY.md')) ||
    Boolean(ctx.fileContent('CODEOWNERS'));
  if (hasPolicyFiles) {
    addMatch('enterprise-governed', ['Detected governance or policy files.']);
  }

  // Docs
  const isDocs = deps['docusaurus'] || deps['vuepress'] || deps['mkdocs'] || deps['sphinx'] ||
    files.some(f => /docs\/|\.mdx$/i.test(f));
  if (isDocs) {
    addMatch('docs-content', ['Detected documentation-focused repo.']);
  }

  // Security
  const isSecurity = files.some(f => /security\//i.test(f)) || deps['helmet'] || deps['bcrypt'];
  if (isSecurity) {
    addMatch('security-focused', ['Detected security-focused repo signals.']);
  }

  const hasCi = Boolean(ctx.fileContent('.github/workflows')) || files.some((file) => /^\.github\/workflows\//.test(file));

  detectAdditionalDomainPacks({
    ctx,
    pkg,
    deps,
    stackKeys,
    addMatch,
    hasBackend: isBackend,
    hasFrontend: isFrontend,
    hasInfra: isInfra,
    hasCi,
    isEnterpriseGoverned: hasPolicyFiles,
  });

  if (matches.length === 0) {
    addMatch('baseline-general', [
      'No stronger domain signal detected — safe general Aider baseline is the best starting point.',
    ]);
  }

  return uniqueByKey(matches);
}

module.exports = {
  AIDER_DOMAIN_PACKS,
  detectAiderDomainPacks,
};
