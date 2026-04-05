const PACK_BLUEPRINTS = [
  {
    key: 'blockchain',
    label: 'Blockchain',
    useWhen: 'Repos with smart contracts, wallet logic, chain integrations, or on-chain deployment tooling.',
    adoption: 'Recommended when contract review, deployment safety, and chain-specific build workflows are core to the repo.',
    recommendedModules: ['Contract review guide', 'Wallet and secret safety', 'Deployment verification'],
    benchmarkFocus: ['contract-aware verification', 'wallet and secret safety', 'deployment review'],
  },
  {
    key: 'realtime',
    label: 'Realtime',
    useWhen: 'Repos centered on websockets, live collaboration, presence, or push-driven event flows.',
    adoption: 'Recommended when event delivery, connection lifecycle, and concurrency behavior matter as much as CRUD flows.',
    recommendedModules: ['Event flow guide', 'Connection lifecycle checks', 'Delivery and retry posture'],
    benchmarkFocus: ['live event safety', 'connection lifecycle review', 'delivery resilience'],
  },
  {
    key: 'graphql',
    label: 'GraphQL',
    useWhen: 'Repos with GraphQL schemas, resolvers, or GraphQL-first clients and services.',
    adoption: 'Recommended when schema contracts and resolver changes need stronger review and verification loops.',
    recommendedModules: ['Schema contract guide', 'Resolver verification', 'Client-server contract checks'],
    benchmarkFocus: ['schema safety', 'resolver correctness', 'contract review'],
  },
  {
    key: 'serverless',
    label: 'Serverless',
    useWhen: 'Repos built around functions, lambdas, edge handlers, or platform-managed deployment surfaces.',
    adoption: 'Recommended when deployment packaging, environment isolation, and runtime constraints drive the workflow.',
    recommendedModules: ['Function deployment guide', 'Cold-start aware verification', 'Environment isolation checklist'],
    benchmarkFocus: ['deployment safety', 'runtime fit', 'environment isolation'],
  },
  {
    key: 'microservices',
    label: 'Microservices',
    useWhen: 'Repos coordinating several services, contracts, or inter-service boundaries across a shared system.',
    adoption: 'Recommended when service boundaries, orchestration, and contract compatibility need stronger guardrails.',
    recommendedModules: ['Service boundary guide', 'Contract and proto review', 'Multi-service orchestration checks'],
    benchmarkFocus: ['service-boundary safety', 'contract review', 'multi-service coordination'],
  },
  {
    key: 'cli-tool',
    label: 'CLI Tool',
    useWhen: 'Repos whose primary product surface is a terminal command, scaffolder, or developer-facing CLI.',
    adoption: 'Recommended when command UX, flags, help text, and packaging are part of the product contract.',
    recommendedModules: ['CLI UX guide', 'Flag and help contract', 'Distribution checklist'],
    benchmarkFocus: ['command UX quality', 'flag safety', 'distribution readiness'],
  },
  {
    key: 'browser-ext',
    label: 'Browser Extension',
    useWhen: 'Repos shipping browser extensions, add-ons, or extension-like surfaces with manifest-driven permissions.',
    adoption: 'Recommended when manifest review, permission minimization, and cross-browser packaging are central concerns.',
    recommendedModules: ['Extension manifest guide', 'Permission review', 'Store packaging checklist'],
    benchmarkFocus: ['manifest safety', 'permission posture', 'store packaging readiness'],
  },
  {
    key: 'desktop',
    label: 'Desktop App',
    useWhen: 'Repos shipping desktop software through Electron, Tauri, or similar native-shell frameworks.',
    adoption: 'Recommended when native bridges, packaging, and OS-specific release workflows shape the repo.',
    recommendedModules: ['Desktop packaging guide', 'Native bridge safety', 'Cross-platform release checks'],
    benchmarkFocus: ['native-surface safety', 'packaging quality', 'cross-platform release readiness'],
  },
  {
    key: 'game-dev',
    label: 'Game Development',
    useWhen: 'Repos focused on gameplay loops, rendering, scenes, or asset-heavy interactive experiences.',
    adoption: 'Recommended when performance, asset pipelines, and engine-specific workflows dominate the repo.',
    recommendedModules: ['Asset pipeline guide', 'Render loop safety', 'Performance regression checks'],
    benchmarkFocus: ['render-loop safety', 'asset pipeline quality', 'performance regressions'],
  },
  {
    key: 'data-viz',
    label: 'Data Visualization',
    useWhen: 'Repos centered on charts, dashboards, visual analytics, or data-heavy rendering surfaces.',
    adoption: 'Recommended when chart correctness, data transforms, and rendering fidelity are core product risks.',
    recommendedModules: ['Chart correctness guide', 'Dataset transformation review', 'Render performance checks'],
    benchmarkFocus: ['visual correctness', 'data-transform review', 'render performance'],
  },
  {
    key: 'cms',
    label: 'CMS',
    useWhen: 'Repos driven by structured content, headless CMS models, authoring flows, or publishing pipelines.',
    adoption: 'Recommended when content modeling, preview, and publish behavior need stronger workflow guidance.',
    recommendedModules: ['Content model guide', 'Authoring workflow review', 'Preview and publish checks'],
    benchmarkFocus: ['content-model safety', 'authoring workflow quality', 'publish readiness'],
  },
  {
    key: 'testing-framework',
    label: 'Testing Framework',
    useWhen: 'Repos where the main engineering loop is defined by a first-class test runner and CI test discipline.',
    adoption: 'Recommended when test ergonomics, coverage, and CI parity are foundational to the repo workflow.',
    recommendedModules: ['Test runner baseline', 'Coverage and flake control', 'CI test parity'],
    benchmarkFocus: ['test-loop quality', 'coverage posture', 'CI parity'],
  },
  {
    key: 'devtools',
    label: 'Developer Tools',
    useWhen: 'Repos building plugins, editor extensions, bundler plugins, or other developer-facing tooling.',
    adoption: 'Recommended when extension APIs, integration contracts, and distribution workflows matter to product quality.',
    recommendedModules: ['Developer-tool integration guide', 'Extension/plugin API review', 'Distribution checks'],
    benchmarkFocus: ['integration safety', 'API compatibility', 'distribution readiness'],
  },
  {
    key: 'auth-service',
    label: 'Auth Service',
    useWhen: 'Repos centered on authentication, identity, session issuance, or user access management.',
    adoption: 'Recommended when auth boundaries, token handling, and identity-provider integrations are primary concerns.',
    recommendedModules: ['Auth boundary guide', 'Session/token review', 'Identity-provider integration checks'],
    benchmarkFocus: ['auth-boundary safety', 'session and token review', 'identity-provider fit'],
  },
  {
    key: 'payments',
    label: 'Payments',
    useWhen: 'Repos where billing, subscriptions, checkout, or payment-provider integrations are the core workflow.',
    adoption: 'Recommended when money movement, webhooks, and retry semantics are product-critical.',
    recommendedModules: ['Payment flow guide', 'Webhook and retry review', 'Financial safety checks'],
    benchmarkFocus: ['payment-flow safety', 'webhook correctness', 'financial guardrails'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    useWhen: 'Repos whose product flows depend on email, SMS, push, or multi-channel user notifications.',
    adoption: 'Recommended when delivery channels, templates, and retry policies drive the system behavior.',
    recommendedModules: ['Delivery channel guide', 'Template lifecycle review', 'Retry and rate-limit checks'],
    benchmarkFocus: ['delivery reliability', 'template quality', 'retry posture'],
  },
  {
    key: 'search',
    label: 'Search',
    useWhen: 'Repos built around search indexing, query relevance, or external search infrastructure.',
    adoption: 'Recommended when indexing, ranking, and synchronization between source data and search need stronger review.',
    recommendedModules: ['Indexing guide', 'Query relevance review', 'Sync and backfill checks'],
    benchmarkFocus: ['indexing safety', 'relevance quality', 'sync correctness'],
  },
  {
    key: 'queue-worker',
    label: 'Queue Worker',
    useWhen: 'Repos organized around job queues, background workers, retries, or asynchronous orchestration.',
    adoption: 'Recommended when idempotency, retries, and worker operational safety define the workflow.',
    recommendedModules: ['Queue processing guide', 'Retry and idempotency review', 'Worker scaling checks'],
    benchmarkFocus: ['job safety', 'retry correctness', 'worker scalability'],
  },
  {
    key: 'observability',
    label: 'Observability',
    useWhen: 'Repos where logs, traces, metrics, or platform telemetry are a first-class operating surface.',
    adoption: 'Recommended when log quality, telemetry coverage, and alertability are central to production readiness.',
    recommendedModules: ['Logging and telemetry guide', 'Error-tracing review', 'Alertability checks'],
    benchmarkFocus: ['telemetry coverage', 'traceability', 'alert readiness'],
  },
  {
    key: 'i18n',
    label: 'Internationalization',
    useWhen: 'Repos with locale files, translation workflows, or runtime language switching as a product feature.',
    adoption: 'Recommended when fallback behavior, message keys, and translation coverage shape the user experience.',
    recommendedModules: ['Locale and message guide', 'Fallback coverage', 'Translation workflow checks'],
    benchmarkFocus: ['translation coverage', 'fallback safety', 'message-key consistency'],
  },
  {
    key: 'static-site',
    label: 'Static Site',
    useWhen: 'Repos generating static documentation, marketing, blog, or content-first sites.',
    adoption: 'Recommended when content builds, routing, and publishing pipelines dominate the workflow.',
    recommendedModules: ['Content build guide', 'Template and routing review', 'Publish pipeline checks'],
    benchmarkFocus: ['build correctness', 'routing safety', 'publish readiness'],
  },
  {
    key: 'api-gateway',
    label: 'API Gateway',
    useWhen: 'Repos built around gateway routing, proxying, traffic policy, or service aggregation layers.',
    adoption: 'Recommended when upstream contracts, routing rules, and auth policy at the edge are major concerns.',
    recommendedModules: ['Gateway routing guide', 'Policy and auth review', 'Upstream contract checks'],
    benchmarkFocus: ['routing safety', 'policy correctness', 'upstream compatibility'],
  },
  {
    key: 'ml-ops',
    label: 'ML Ops',
    useWhen: 'Repos focused on experiment tracking, data lineage, model artifacts, or promotion workflows.',
    adoption: 'Recommended when model lifecycle and experiment traceability matter as much as the model code itself.',
    recommendedModules: ['Experiment tracking guide', 'Artifact lifecycle review', 'Model promotion checks'],
    benchmarkFocus: ['artifact traceability', 'experiment hygiene', 'promotion safety'],
  },
  {
    key: 'embedded-iot',
    label: 'Embedded / IoT',
    useWhen: 'Repos integrating with hardware devices, MQTT-like messaging, or embedded runtime constraints.',
    adoption: 'Recommended when device messaging, firmware safety, and hardware integration dominate the repo.',
    recommendedModules: ['Hardware integration guide', 'Device messaging review', 'Firmware safety checks'],
    benchmarkFocus: ['device-surface safety', 'messaging reliability', 'firmware guardrails'],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    useWhen: 'Repos handling HIPAA compliance, HL7/FHIR integrations, PHI data, or medical records workflows.',
    adoption: 'Recommended when patient data protection, regulatory compliance, and clinical data standards are central concerns.',
    recommendedModules: ['HIPAA compliance guide', 'PHI data handling review', 'Clinical data safety checks'],
    benchmarkFocus: ['HIPAA compliance posture', 'PHI protection', 'clinical data standards'],
  },
  {
    key: 'fintech',
    label: 'Fintech',
    useWhen: 'Repos with PCI-DSS requirements, KYC/AML workflows, transaction processing, or financial regulation compliance.',
    adoption: 'Recommended when financial data safety, regulatory compliance, and transaction integrity are core concerns.',
    recommendedModules: ['PCI-DSS compliance guide', 'Transaction safety review', 'KYC/AML workflow checks'],
    benchmarkFocus: ['PCI compliance posture', 'transaction integrity', 'regulatory readiness'],
  },
  {
    key: 'gaming',
    label: 'Gaming',
    useWhen: 'Repos with ECS patterns, asset pipelines, multiplayer networking, or game loop architectures.',
    adoption: 'Recommended when game loop performance, asset management, and multiplayer synchronization drive the workflow.',
    recommendedModules: ['Game loop optimization guide', 'Asset pipeline review', 'Multiplayer safety checks'],
    benchmarkFocus: ['game-loop performance', 'asset pipeline quality', 'multiplayer synchronization'],
  },
  {
    key: 'iot',
    label: 'IoT',
    useWhen: 'Repos centered on MQTT messaging, edge computing, OTA firmware updates, or sensor data ingestion.',
    adoption: 'Recommended when device communication protocols, edge processing, and sensor data pipelines are primary concerns.',
    recommendedModules: ['MQTT integration guide', 'Edge computing review', 'OTA update safety checks'],
    benchmarkFocus: ['device messaging reliability', 'edge processing safety', 'OTA update integrity'],
  },
  {
    key: 'streaming',
    label: 'Streaming',
    useWhen: 'Repos handling video/audio codecs, CDN integration, adaptive bitrate streaming, or transcoding pipelines.',
    adoption: 'Recommended when media delivery quality, codec management, and CDN configuration are central to the product.',
    recommendedModules: ['Media delivery guide', 'Codec and transcoding review', 'CDN configuration checks'],
    benchmarkFocus: ['media delivery quality', 'transcoding safety', 'CDN configuration'],
  },
  {
    key: 'robotics',
    label: 'Robotics',
    useWhen: 'Repos with ROS integration, sensor fusion, real-time control constraints, or actuator management.',
    adoption: 'Recommended when real-time safety, sensor data fusion, and hardware control are foundational to the repo.',
    recommendedModules: ['Real-time control guide', 'Sensor fusion review', 'Actuator safety checks'],
    benchmarkFocus: ['real-time constraint safety', 'sensor fusion quality', 'actuator control integrity'],
  },
  {
    key: 'ar-vr',
    label: 'AR / VR',
    useWhen: 'Repos focused on 3D rendering, spatial computing, XR frameworks, or immersive experience development.',
    adoption: 'Recommended when 3D rendering performance, spatial interaction, and XR platform integration drive the workflow.',
    recommendedModules: ['3D rendering guide', 'Spatial computing review', 'XR framework checks'],
    benchmarkFocus: ['rendering performance', 'spatial interaction quality', 'XR platform compatibility'],
  },
  {
    key: 'climate-tech',
    label: 'Climate Tech',
    useWhen: 'Repos handling carbon tracking, energy modeling, ESG reporting, or environmental data workflows.',
    adoption: 'Recommended when emissions data accuracy, energy modeling, and ESG compliance are central concerns.',
    recommendedModules: ['Carbon tracking guide', 'Energy modeling review', 'ESG reporting checks'],
    benchmarkFocus: ['emissions data accuracy', 'energy model quality', 'ESG compliance readiness'],
  },
  {
    key: 'govtech',
    label: 'GovTech',
    useWhen: 'Repos requiring accessibility compliance, internationalization, audit trails, or government service standards.',
    adoption: 'Recommended when accessibility, audit traceability, and regulatory compliance are mandatory product requirements.',
    recommendedModules: ['Accessibility compliance guide', 'Audit trail review', 'Government standards checks'],
    benchmarkFocus: ['accessibility compliance', 'audit trail completeness', 'regulatory standards'],
  },
  {
    key: 'edtech',
    label: 'EdTech',
    useWhen: 'Repos with LMS integration, assessment engines, progress tracking, or educational content delivery.',
    adoption: 'Recommended when learning management, student progress tracking, and assessment integrity are core product concerns.',
    recommendedModules: ['LMS integration guide', 'Assessment engine review', 'Progress tracking checks'],
    benchmarkFocus: ['LMS integration quality', 'assessment integrity', 'progress tracking accuracy'],
  },
  {
    key: 'martech',
    label: 'MarTech',
    useWhen: 'Repos handling analytics pipelines, A/B testing frameworks, personalization engines, or marketing automation.',
    adoption: 'Recommended when analytics accuracy, experiment integrity, and personalization workflows drive the product.',
    recommendedModules: ['Analytics pipeline guide', 'A/B testing review', 'Personalization safety checks'],
    benchmarkFocus: ['analytics accuracy', 'experiment integrity', 'personalization quality'],
  },
  {
    key: 'proptech',
    label: 'PropTech',
    useWhen: 'Repos handling property data, geospatial analysis, building management systems, or real estate workflows.',
    adoption: 'Recommended when property data accuracy, geospatial processing, and building system integration are central.',
    recommendedModules: ['Property data guide', 'Geospatial processing review', 'Building systems checks'],
    benchmarkFocus: ['property data accuracy', 'geospatial quality', 'building system integration'],
  },
  {
    key: 'legaltech',
    label: 'LegalTech',
    useWhen: 'Repos focused on document automation, compliance management, e-discovery, or legal workflow tooling.',
    adoption: 'Recommended when document accuracy, compliance tracking, and legal data handling are primary concerns.',
    recommendedModules: ['Document automation guide', 'Compliance workflow review', 'E-discovery safety checks'],
    benchmarkFocus: ['document accuracy', 'compliance tracking', 'legal data handling'],
  },
  {
    key: 'agritech',
    label: 'AgriTech',
    useWhen: 'Repos handling agricultural sensor data, crop modeling, supply chain tracking, or farm management systems.',
    adoption: 'Recommended when sensor data processing, crop analytics, and supply chain traceability are core concerns.',
    recommendedModules: ['Sensor data pipeline guide', 'Crop modeling review', 'Supply chain tracking checks'],
    benchmarkFocus: ['sensor data quality', 'crop model accuracy', 'supply chain traceability'],
  },
  {
    key: 'biotech',
    label: 'BioTech',
    useWhen: 'Repos with bioinformatics pipelines, lab automation systems, or regulatory submission workflows.',
    adoption: 'Recommended when biological data processing, lab workflow automation, and regulatory compliance drive the repo.',
    recommendedModules: ['Bioinformatics pipeline guide', 'Lab automation review', 'Regulatory compliance checks'],
    benchmarkFocus: ['bioinformatics accuracy', 'lab automation safety', 'regulatory compliance'],
  },
  {
    key: 'cybersecurity',
    label: 'Cybersecurity',
    useWhen: 'Repos focused on threat detection, SIEM integration, incident response, or security operations tooling.',
    adoption: 'Recommended when threat detection accuracy, incident response workflows, and security telemetry are central.',
    recommendedModules: ['Threat detection guide', 'SIEM integration review', 'Incident response checks'],
    benchmarkFocus: ['threat detection quality', 'SIEM integration', 'incident response readiness'],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    useWhen: 'Repos handling route optimization, fleet management, shipment tracking, or warehouse management systems.',
    adoption: 'Recommended when routing accuracy, fleet coordination, and tracking reliability are core product concerns.',
    recommendedModules: ['Route optimization guide', 'Fleet management review', 'Tracking system checks'],
    benchmarkFocus: ['routing accuracy', 'fleet coordination', 'tracking reliability'],
  },
  {
    key: 'media',
    label: 'Media',
    useWhen: 'Repos with CMS-driven publishing, digital asset management, content delivery pipelines, or editorial workflows.',
    adoption: 'Recommended when content management, asset lifecycle, and delivery pipelines are central to the product.',
    recommendedModules: ['Content management guide', 'Digital asset review', 'Content delivery checks'],
    benchmarkFocus: ['content management quality', 'asset lifecycle safety', 'delivery pipeline reliability'],
  },
  {
    key: 'social',
    label: 'Social',
    useWhen: 'Repos with feed algorithms, content moderation, real-time messaging, or social graph management.',
    adoption: 'Recommended when feed quality, moderation safety, and messaging reliability are core product concerns.',
    recommendedModules: ['Feed algorithm guide', 'Content moderation review', 'Messaging safety checks'],
    benchmarkFocus: ['feed algorithm quality', 'moderation effectiveness', 'messaging reliability'],
  },
  {
    key: 'travel',
    label: 'Travel',
    useWhen: 'Repos with booking engines, GDS integration, dynamic pricing, or travel inventory management.',
    adoption: 'Recommended when booking reliability, pricing accuracy, and GDS integration are primary concerns.',
    recommendedModules: ['Booking engine guide', 'GDS integration review', 'Pricing safety checks'],
    benchmarkFocus: ['booking reliability', 'GDS integration quality', 'pricing accuracy'],
  },
  {
    key: 'insurance',
    label: 'Insurance',
    useWhen: 'Repos handling claims processing, risk modeling, underwriting workflows, or policy management systems.',
    adoption: 'Recommended when claims accuracy, risk model integrity, and underwriting workflow safety are core concerns.',
    recommendedModules: ['Claims processing guide', 'Risk modeling review', 'Underwriting safety checks'],
    benchmarkFocus: ['claims processing accuracy', 'risk model integrity', 'underwriting safety'],
  },
  {
    key: 'energy',
    label: 'Energy',
    useWhen: 'Repos handling grid management, smart metering, renewable energy systems, or energy trading platforms.',
    adoption: 'Recommended when grid reliability, metering accuracy, and energy system integration are central concerns.',
    recommendedModules: ['Grid management guide', 'Smart metering review', 'Energy system checks'],
    benchmarkFocus: ['grid reliability', 'metering accuracy', 'energy system integration'],
  },
];

const PLATFORM_DEFAULTS = {
  claude: {
    recommendedModules: ['CLAUDE.md baseline'],
    recommendedProposalFamilies: ['claude-md', 'commands', 'rules'],
    recommendedSurfaces: ['CLAUDE.md', '.claude/settings.json', '.github/workflows/'],
    recommendedMcpPacks: ['context7-docs'],
  },
  codex: {
    recommendedModules: ['AGENTS.md baseline', 'Codex config baseline'],
    recommendedProposalFamilies: ['codex-agents-md', 'codex-config', 'codex-ci-review'],
    recommendedSurfaces: ['AGENTS.md', '.codex/config.toml', '.github/workflows/'],
  },
  gemini: {
    recommendedModules: ['GEMINI.md baseline', 'Gemini settings baseline'],
    recommendedProposalFamilies: ['gemini-md', 'gemini-settings', 'gemini-hooks'],
    recommendedSurfaces: ['GEMINI.md', '.gemini/settings.json', '.github/workflows/'],
  },
  copilot: {
    recommendedModules: ['copilot-instructions baseline', 'VS Code settings baseline'],
    recommendedProposalFamilies: ['copilot-instructions', 'copilot-vscode-settings', 'copilot-ci-review'],
    recommendedSurfaces: ['.github/copilot-instructions.md', '.vscode/settings.json', '.github/workflows/'],
  },
  cursor: {
    recommendedModules: ['.cursor/rules baseline', 'Cursor MCP baseline'],
    recommendedProposalFamilies: ['cursor-rules', 'cursor-mcp', 'cursor-ci-review'],
    recommendedSurfaces: ['.cursor/rules/', '.cursor/mcp.json', '.github/workflows/'],
  },
  windsurf: {
    recommendedModules: ['.windsurf/rules baseline', 'Windsurf MCP baseline'],
    recommendedProposalFamilies: ['windsurf-rules', 'windsurf-mcp', 'windsurf-ci-review'],
    recommendedSurfaces: ['.windsurf/rules/', '.windsurf/mcp.json', '.github/workflows/'],
  },
  aider: {
    recommendedModules: ['.aider.conf.yml baseline', 'Convention file starter'],
    recommendedProposalFamilies: ['aider-conf-yml', 'aider-conventions', 'aider-ci'],
    recommendedSurfaces: ['.aider.conf.yml', 'CONVENTIONS.md', '.github/workflows/'],
  },
  opencode: {
    recommendedModules: ['AGENTS.md baseline', 'OpenCode config baseline'],
    recommendedProposalFamilies: ['opencode-agents-md', 'opencode-config', 'opencode-ci'],
    recommendedSurfaces: ['AGENTS.md', 'opencode.json', '.github/workflows/'],
  },
};

function depMapKeys(deps) {
  return Object.keys(deps || {}).map((key) => key.toLowerCase());
}

function hasDependency(depKeys, matchers) {
  return depKeys.some((key) => matchers.some((matcher) => {
    if (typeof matcher === 'string') return key === matcher.toLowerCase();
    return matcher.test(key);
  }));
}

function hasAnyFile(files, pattern) {
  return files.some((file) => pattern.test(file));
}

function getFileContent(ctx, filePath) {
  return typeof ctx.fileContent === 'function' ? (ctx.fileContent(filePath) || '') : '';
}

function countComposeServices(content) {
  if (!content || !/^\s*services\s*:\s*$/m.test(content)) return 0;
  const lines = content.split(/\r?\n/);
  let inServices = false;
  let count = 0;

  for (const line of lines) {
    if (!inServices) {
      if (/^\s*services\s*:\s*$/.test(line)) {
        inServices = true;
      }
      continue;
    }

    if (!line.trim()) continue;
    if (/^\S/.test(line)) break;
    if (/^\s{2}[A-Za-z0-9_.-]+\s*:\s*$/.test(line)) count += 1;
  }

  return count;
}

function getManifestInfo(ctx, files) {
  const manifestPath = files.find((file) => /(^|\/)manifest\.json$/i.test(file));
  if (!manifestPath) return { path: null, content: '' };
  return { path: manifestPath, content: getFileContent(ctx, manifestPath) };
}

function getComposeInfo(ctx, files) {
  const composePath = files.find((file) => /(^|\/)(docker-compose|compose)\.ya?ml$/i.test(file));
  if (!composePath) return { path: null, services: 0 };
  const content = getFileContent(ctx, composePath);
  return { path: composePath, services: countComposeServices(content) };
}

function buildAdditionalDomainPacks(platform, options = {}) {
  const defaults = PLATFORM_DEFAULTS[platform];
  if (!defaults) {
    throw new Error(`Unknown domain-pack expansion platform '${platform}'`);
  }

  const existingKeys = options.existingKeys || new Set();

  return PACK_BLUEPRINTS
    .filter((pack) => !existingKeys.has(pack.key))
    .map((pack) => ({
      key: pack.key,
      label: pack.label,
      useWhen: pack.useWhen,
      adoption: pack.adoption,
      recommendedModules: [...defaults.recommendedModules, ...pack.recommendedModules.slice(0, 2)],
      recommendedProposalFamilies: defaults.recommendedProposalFamilies.slice(0, 3),
      recommendedSurfaces: defaults.recommendedSurfaces.slice(0, 3),
      benchmarkFocus: pack.benchmarkFocus.slice(0, 3),
      ...(defaults.recommendedMcpPacks ? { recommendedMcpPacks: defaults.recommendedMcpPacks.slice(0, 3) } : {}),
    }));
}

function detectAdditionalDomainPacks(options) {
  const {
    ctx,
    pkg = {},
    deps = {},
    stackKeys = new Set(),
    addMatch,
    hasBackend = false,
    hasFrontend = false,
    hasInfra = false,
    hasCi = false,
  } = options;

  const files = Array.isArray(ctx.files) ? ctx.files : [];
  const depKeys = depMapKeys(deps);
  const pkgBin = pkg && pkg.bin;
  const hasBinField = typeof pkgBin === 'string' || (pkgBin && typeof pkgBin === 'object' && Object.keys(pkgBin).length > 0);
  const manifest = getManifestInfo(ctx, files);
  const compose = getComposeInfo(ctx, files);
  const vercelConfig = getFileContent(ctx, 'vercel.json');

  if (
    hasAnyFile(files, /(^|\/)(hardhat\.config\.(js|ts)|truffle-config\.js|foundry\.toml)$/i) ||
    hasAnyFile(files, /\.sol$/i) ||
    hasDependency(depKeys, [/^hardhat$/i, /^truffle$/i, /^ethers$/i, /^viem$/i, /^@openzeppelin\//i])
  ) {
    addMatch('blockchain', [
      hasAnyFile(files, /\.sol$/i) ? 'Smart-contract source files detected.' : 'Blockchain toolchain files detected.',
      hasAnyFile(files, /foundry\.toml$/i) ? 'Foundry config detected.' : null,
      hasDependency(depKeys, [/^hardhat$/i]) ? 'Hardhat dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^socket\.io$/i, /^socket\.io-client$/i, /^ws$/i, /^ably/i, /^pusher/i])) {
    addMatch('realtime', [
      'Realtime communication dependencies detected.',
      hasDependency(depKeys, [/^socket\.io$/i, /^socket\.io-client$/i]) ? 'Socket.IO dependency detected.' : null,
      hasDependency(depKeys, [/^ws$/i]) ? 'WebSocket dependency detected.' : null,
    ]);
  }

  if (
    hasAnyFile(files, /(^|\/)(schema\.graphql|schema\.gql|.*\.graphqlrc(\.(json|ya?ml))?)$/i) ||
    hasDependency(depKeys, [/^graphql$/i, /^@apollo\//i, /^apollo-/i, /^urql$/i, /^relay/i])
  ) {
    addMatch('graphql', [
      hasAnyFile(files, /\.graphql$/i) ? 'GraphQL schema files detected.' : 'GraphQL tooling detected.',
      hasAnyFile(files, /\.graphqlrc/i) ? '.graphqlrc detected.' : null,
      hasDependency(depKeys, [/^@apollo\//i, /^apollo-/i]) ? 'Apollo dependency detected.' : null,
    ]);
  }

  if (
    hasAnyFile(files, /(^|\/)(serverless\.ya?ml|sam\.ya?ml)$/i) ||
    /"functions"\s*:\s*\{/i.test(vercelConfig) ||
    (hasInfra && hasAnyFile(files, /vercel\.json$/i))
  ) {
    addMatch('serverless', [
      hasAnyFile(files, /serverless\.ya?ml$/i) ? 'Serverless framework config detected.' : 'Function deployment config detected.',
      hasAnyFile(files, /sam\.ya?ml$/i) ? 'AWS SAM config detected.' : null,
      /"functions"\s*:\s*\{/i.test(vercelConfig) ? 'Vercel functions config detected.' : null,
    ]);
  }

  if (compose.services >= 3 || hasAnyFile(files, /\.proto$/i)) {
    addMatch('microservices', [
      compose.services >= 3 ? `Compose file defines ${compose.services} services.` : 'Protocol buffer contracts detected.',
      hasAnyFile(files, /\.proto$/i) ? 'Proto files detected.' : null,
      compose.path ? `${compose.path} detected.` : null,
    ]);
  }

  if (hasBinField && hasDependency(depKeys, [/^commander$/i, /^yargs$/i, /^oclif/i, /^cac$/i])) {
    addMatch('cli-tool', [
      'CLI bin entry and command-parser dependencies detected.',
      hasDependency(depKeys, [/^commander$/i]) ? 'Commander dependency detected.' : null,
      hasDependency(depKeys, [/^yargs$/i]) ? 'Yargs dependency detected.' : null,
    ]);
  }

  if (manifest.path && /browser_specific_settings/i.test(manifest.content)) {
    addMatch('browser-ext', [
      'Browser extension manifest detected.',
      `${manifest.path} contains browser_specific_settings.`,
      null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^electron$/i, /^electron-builder$/i, /^@tauri-apps\//i, /^tauri$/i]) ||
    files.includes('tauri.conf.json') ||
    ctx.hasDir('src-tauri')
  ) {
    addMatch('desktop', [
      'Desktop application framework signals detected.',
      ctx.hasDir('src-tauri') ? 'src-tauri directory detected.' : null,
      hasDependency(depKeys, [/^electron$/i]) ? 'Electron dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^phaser$/i, /^three$/i, /^three\.js$/i, /^pixi\.js$/i, /^@pixi\//i])) {
    addMatch('game-dev', [
      'Game-development rendering dependencies detected.',
      hasDependency(depKeys, [/^phaser$/i]) ? 'Phaser dependency detected.' : null,
      hasDependency(depKeys, [/^three$/i, /^three\.js$/i]) ? 'Three.js dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^d3/i, /^chart\.js$/i, /^plotly/i, /^recharts$/i, /^visx/i])) {
    addMatch('data-viz', [
      'Data-visualization dependencies detected.',
      hasDependency(depKeys, [/^d3/i]) ? 'D3 dependency detected.' : null,
      hasDependency(depKeys, [/^chart\.js$/i]) ? 'Chart.js dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^strapi/i, /^contentful$/i, /^contentful-/i, /^sanity$/i, /^@sanity\//i])) {
    addMatch('cms', [
      'CMS or content-platform dependencies detected.',
      hasDependency(depKeys, [/^strapi/i]) ? 'Strapi dependency detected.' : null,
      hasDependency(depKeys, [/^contentful/i]) ? 'Contentful dependency detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^jest$/i, /^vitest$/i, /^@playwright\/test$/i, /^playwright$/i]) ||
    hasAnyFile(files, /(^|\/)(jest\.config|vitest\.config|playwright\.config)\./i)
  ) {
    addMatch('testing-framework', [
      'Primary test-framework signals detected.',
      hasDependency(depKeys, [/^jest$/i]) ? 'Jest dependency detected.' : null,
      hasDependency(depKeys, [/^vitest$/i]) ? 'Vitest dependency detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^vscode$/i, /^@types\/vscode$/i, /^webpack$/i, /^rollup$/i]) &&
    (pkg.engines && pkg.engines.vscode || hasAnyFile(files, /(^|\/)(extension\.(ts|js)|webpack\..*plugin\.(ts|js))$/i))
  ) {
    addMatch('devtools', [
      'Developer-tooling integration signals detected.',
      pkg.engines && pkg.engines.vscode ? 'VS Code extension engine declared.' : null,
      hasAnyFile(files, /extension\.(ts|js)$/i) ? 'Extension entrypoint detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^passport$/i, /^passport-/i, /^auth0$/i, /^@auth0\//i, /^@clerk\//i, /^clerk$/i])) {
    addMatch('auth-service', [
      'Authentication-platform dependencies detected.',
      hasDependency(depKeys, [/^passport$/i, /^passport-/i]) ? 'Passport dependency detected.' : null,
      hasDependency(depKeys, [/^@clerk\//i, /^clerk$/i]) ? 'Clerk dependency detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^stripe$/i, /^@stripe\//i, /^paypal$/i, /^@paypal\//i, /^braintree$/i]) ||
    ctx.hasDir('payments')
  ) {
    addMatch('payments', [
      'Payment-platform signals detected.',
      hasDependency(depKeys, [/^stripe$/i, /^@stripe\//i]) ? 'Stripe dependency detected.' : null,
      hasDependency(depKeys, [/^paypal$/i, /^@paypal\//i]) ? 'PayPal dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^@sendgrid\//i, /^nodemailer$/i, /^ses$/i, /^@aws-sdk\/client-ses$/i, /^twilio$/i])) {
    addMatch('notifications', [
      'Notification-channel dependencies detected.',
      hasDependency(depKeys, [/^@sendgrid\//i]) ? 'SendGrid dependency detected.' : null,
      hasDependency(depKeys, [/^twilio$/i]) ? 'Twilio dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^@elastic\/elasticsearch$/i, /^elasticsearch$/i, /^algoliasearch$/i, /^meilisearch$/i])) {
    addMatch('search', [
      'Search-platform dependencies detected.',
      hasDependency(depKeys, [/^@elastic\/elasticsearch$/i, /^elasticsearch$/i]) ? 'Elasticsearch dependency detected.' : null,
      hasDependency(depKeys, [/^algoliasearch$/i]) ? 'Algolia dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^bull$/i, /^bullmq$/i, /^amqplib$/i, /^rabbitmq$/i, /^@aws-sdk\/client-sqs$/i, /^sqs-consumer$/i])) {
    addMatch('queue-worker', [
      'Queue or worker dependencies detected.',
      hasDependency(depKeys, [/^bull$/i, /^bullmq$/i]) ? 'Bull/BullMQ dependency detected.' : null,
      hasDependency(depKeys, [/^amqplib$/i, /^rabbitmq$/i]) ? 'RabbitMQ dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^winston$/i, /^pino$/i, /^datadog$/i, /^dd-trace$/i, /^@datadog\//i])) {
    addMatch('observability', [
      'Observability dependencies detected.',
      hasDependency(depKeys, [/^winston$/i]) ? 'Winston dependency detected.' : null,
      hasDependency(depKeys, [/^pino$/i]) ? 'Pino dependency detected.' : null,
    ]);
  }

  if (hasDependency(depKeys, [/^i18next$/i, /^react-intl$/i, /^formatjs$/i, /^next-intl$/i]) || ctx.hasDir('locales')) {
    addMatch('i18n', [
      'Internationalization signals detected.',
      ctx.hasDir('locales') ? 'Locales directory detected.' : null,
      hasDependency(depKeys, [/^i18next$/i]) ? 'i18next dependency detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^gatsby$/i, /^@11ty\/eleventy$/i, /^hugo-bin$/i, /^jekyll$/i]) ||
    hasAnyFile(files, /(^|\/)(hugo\.toml|_config\.yml|_config\.yaml|gatsby-config\.(js|ts)|eleventy\.config\.(js|cjs|mjs))$/i)
  ) {
    addMatch('static-site', [
      'Static-site generator signals detected.',
      hasDependency(depKeys, [/^gatsby$/i]) ? 'Gatsby dependency detected.' : null,
      hasAnyFile(files, /(^|\/)(hugo\.toml|_config\.yml|_config\.yaml)$/i) ? 'Static-site config detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^kong$/i, /^express-gateway$/i]) ||
    hasAnyFile(files, /(^|\/)(kong\.ya?ml|gateway\.config\.(json|ya?ml))$/i)
  ) {
    addMatch('api-gateway', [
      'API-gateway signals detected.',
      hasDependency(depKeys, [/^express-gateway$/i]) ? 'express-gateway dependency detected.' : null,
      hasAnyFile(files, /kong\.ya?ml$/i) ? 'Kong config detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^mlflow$/i, /^wandb$/i, /^dvc$/i]) ||
    hasAnyFile(files, /(^|\/)(dvc\.yaml|dvc\.yml|mlruns\/|wandb\/)/i)
  ) {
    addMatch('ml-ops', [
      'ML Ops tracking or artifact signals detected.',
      hasDependency(depKeys, [/^mlflow$/i]) ? 'MLflow dependency detected.' : null,
      hasDependency(depKeys, [/^wandb$/i]) ? 'Weights & Biases dependency detected.' : null,
    ]);
  }

  if (
    hasDependency(depKeys, [/^johnny-five$/i, /^mqtt$/i, /^particle-/i, /^particle$/i]) ||
    hasAnyFile(files, /\.ino$/i)
  ) {
    addMatch('embedded-iot', [
      'Embedded or device-integration signals detected.',
      hasDependency(depKeys, [/^mqtt$/i]) ? 'MQTT dependency detected.' : null,
      hasDependency(depKeys, [/^johnny-five$/i]) ? 'Johnny-Five dependency detected.' : null,
    ]);
  }

  // Healthcare detection
  if (
    hasDependency(depKeys, [/^fhir/i, /^hl7/i, /^@medplum\//i, /^hapi-fhir/i]) ||
    ctx.hasDir('hipaa') || ctx.hasDir('phi') || ctx.hasDir('medical') || ctx.hasDir('patients') ||
    hasAnyFile(files, /(^|\/)(hipaa|fhir|hl7)/i)
  ) {
    addMatch('healthcare', [
      'Healthcare or clinical data signals detected.',
      hasDependency(depKeys, [/^fhir/i, /^hl7/i]) ? 'FHIR/HL7 dependency detected.' : null,
      ctx.hasDir('patients') ? 'Patients directory detected.' : null,
    ]);
  }

  // Fintech detection
  if (
    hasDependency(depKeys, [/^plaid$/i, /^@plaid\//i, /^dwolla$/i, /^alpaca/i, /^polygon\.io/i]) ||
    ctx.hasDir('kyc') || ctx.hasDir('aml') || ctx.hasDir('transactions') ||
    (pkg.keywords && pkg.keywords.some(k => ['fintech', 'pci-dss', 'kyc', 'aml'].includes(k)))
  ) {
    addMatch('fintech', [
      'Fintech or financial compliance signals detected.',
      hasDependency(depKeys, [/^plaid$/i, /^@plaid\//i]) ? 'Plaid dependency detected.' : null,
      ctx.hasDir('transactions') ? 'Transactions directory detected.' : null,
    ]);
  }

  // Gaming detection
  if (
    hasDependency(depKeys, [/^unity/i, /^godot/i, /^kaboom/i, /^excalibur/i, /^playcanvas/i, /^babylonjs/i, /^@babylonjs\//i]) ||
    ctx.hasDir('sprites') || ctx.hasDir('assets/sprites') || ctx.hasDir('scenes') ||
    hasAnyFile(files, /(^|\/)(game\.config|game\.json|\.gdproject|\.uproject)/i)
  ) {
    addMatch('gaming', [
      'Game development signals detected.',
      ctx.hasDir('sprites') ? 'Sprites directory detected.' : null,
      ctx.hasDir('scenes') ? 'Scenes directory detected.' : null,
    ]);
  }

  // IoT detection
  if (
    hasDependency(depKeys, [/^mqtt$/i, /^async-mqtt$/i, /^aws-iot-device-sdk/i, /^azure-iot/i, /^node-red/i]) ||
    ctx.hasDir('sensors') || ctx.hasDir('devices') || ctx.hasDir('firmware') ||
    hasAnyFile(files, /(^|\/)(mosquitto\.conf|iot|sensors)/i)
  ) {
    addMatch('iot', [
      'IoT or sensor data signals detected.',
      hasDependency(depKeys, [/^mqtt$/i, /^async-mqtt$/i]) ? 'MQTT dependency detected.' : null,
      ctx.hasDir('sensors') ? 'Sensors directory detected.' : null,
    ]);
  }

  // Streaming detection
  if (
    hasDependency(depKeys, [/^fluent-ffmpeg$/i, /^hls\.js$/i, /^dash\.js$/i, /^shaka-player$/i, /^video\.js$/i, /^mux/i, /^@mux\//i, /^cloudinary/i]) ||
    ctx.hasDir('transcode') || ctx.hasDir('streams') ||
    hasAnyFile(files, /(^|\/)(ffmpeg|transcode|hls|dash)/i)
  ) {
    addMatch('streaming', [
      'Media streaming signals detected.',
      hasDependency(depKeys, [/^fluent-ffmpeg$/i]) ? 'FFmpeg dependency detected.' : null,
      hasDependency(depKeys, [/^hls\.js$/i, /^dash\.js$/i]) ? 'Adaptive bitrate streaming dependency detected.' : null,
    ]);
  }

  // Robotics detection
  if (
    hasDependency(depKeys, [/^rosnodejs$/i, /^rclnodejs$/i, /^roslib$/i, /^ros2/i]) ||
    ctx.hasDir('ros') || ctx.hasDir('catkin_ws') || ctx.hasDir('robot') ||
    hasAnyFile(files, /(^|\/)(CMakeLists\.txt|package\.xml|\.launch)/i) && ctx.hasDir('src')
  ) {
    addMatch('robotics', [
      'Robotics or ROS signals detected.',
      hasDependency(depKeys, [/^rosnodejs$/i, /^rclnodejs$/i]) ? 'ROS dependency detected.' : null,
      ctx.hasDir('catkin_ws') ? 'Catkin workspace detected.' : null,
    ]);
  }

  // AR/VR detection
  if (
    hasDependency(depKeys, [/^aframe$/i, /^@react-three\/xr$/i, /^webxr/i, /^@babylonjs\/core$/i, /^ar\.js$/i, /^mind-ar/i, /^8thwall/i]) ||
    ctx.hasDir('xr') || ctx.hasDir('vr') || ctx.hasDir('ar') ||
    hasAnyFile(files, /(^|\/)(.xr|spatial|immersive)/i)
  ) {
    addMatch('ar-vr', [
      'AR/VR or spatial computing signals detected.',
      hasDependency(depKeys, [/^aframe$/i]) ? 'A-Frame dependency detected.' : null,
      hasDependency(depKeys, [/^@react-three\/xr$/i]) ? 'React Three XR dependency detected.' : null,
    ]);
  }

  // Climate Tech detection
  if (
    hasDependency(depKeys, [/^carbon/i, /^climatiq/i, /^patch-node$/i, /^@cloverly\//i]) ||
    ctx.hasDir('emissions') || ctx.hasDir('carbon') || ctx.hasDir('esg') ||
    (pkg.keywords && pkg.keywords.some(k => ['carbon', 'climate', 'esg', 'sustainability', 'emissions'].includes(k)))
  ) {
    addMatch('climate-tech', [
      'Climate tech or sustainability signals detected.',
      ctx.hasDir('emissions') ? 'Emissions directory detected.' : null,
      ctx.hasDir('esg') ? 'ESG directory detected.' : null,
    ]);
  }

  // GovTech detection
  if (
    hasDependency(depKeys, [/^pa11y$/i, /^axe-core$/i, /^@axe-core\//i, /^react-aria/i, /^@react-aria\//i]) ||
    ctx.hasDir('audit-logs') || ctx.hasDir('accessibility') ||
    (pkg.keywords && pkg.keywords.some(k => ['government', 'govtech', 'a11y', 'wcag', 'section508'].includes(k)))
  ) {
    addMatch('govtech', [
      'Government technology or accessibility compliance signals detected.',
      hasDependency(depKeys, [/^axe-core$/i, /^@axe-core\//i]) ? 'Axe accessibility dependency detected.' : null,
      ctx.hasDir('audit-logs') ? 'Audit logs directory detected.' : null,
    ]);
  }

  // EdTech detection
  if (
    hasDependency(depKeys, [/^scorm/i, /^xapi/i, /^lti/i, /^@canvas\//i]) ||
    ctx.hasDir('courses') || ctx.hasDir('assessments') || ctx.hasDir('curriculum') || ctx.hasDir('lms') ||
    (pkg.keywords && pkg.keywords.some(k => ['edtech', 'lms', 'elearning', 'assessment'].includes(k)))
  ) {
    addMatch('edtech', [
      'EdTech or learning management signals detected.',
      ctx.hasDir('courses') ? 'Courses directory detected.' : null,
      ctx.hasDir('assessments') ? 'Assessments directory detected.' : null,
    ]);
  }

  // MarTech detection
  if (
    hasDependency(depKeys, [/^@segment\//i, /^segment/i, /^mixpanel$/i, /^amplitude/i, /^optimizely/i, /^@optimizely\//i, /^launchdarkly/i, /^@launchdarkly\//i]) ||
    ctx.hasDir('analytics') || ctx.hasDir('experiments') || ctx.hasDir('personalization') ||
    hasAnyFile(files, /(^|\/)(segment|analytics|ab-test)/i)
  ) {
    addMatch('martech', [
      'Marketing technology or analytics signals detected.',
      hasDependency(depKeys, [/^@segment\//i, /^segment/i]) ? 'Segment dependency detected.' : null,
      hasDependency(depKeys, [/^optimizely/i, /^@optimizely\//i]) ? 'Optimizely dependency detected.' : null,
    ]);
  }

  // PropTech detection
  if (
    hasDependency(depKeys, [/^turf$/i, /^@turf\//i, /^mapbox/i, /^@mapbox\//i, /^leaflet$/i, /^openlayers/i]) ||
    ctx.hasDir('properties') || ctx.hasDir('geospatial') || ctx.hasDir('buildings') ||
    (pkg.keywords && pkg.keywords.some(k => ['proptech', 'real-estate', 'geospatial', 'property'].includes(k)))
  ) {
    addMatch('proptech', [
      'Property technology or geospatial signals detected.',
      hasDependency(depKeys, [/^@turf\//i, /^turf$/i]) ? 'Turf.js geospatial dependency detected.' : null,
      hasDependency(depKeys, [/^mapbox/i, /^@mapbox\//i]) ? 'Mapbox dependency detected.' : null,
    ]);
  }

  // LegalTech detection
  if (
    hasDependency(depKeys, [/^docusign/i, /^@docusign\//i, /^docassemble/i, /^clio/i]) ||
    ctx.hasDir('contracts') || ctx.hasDir('legal') || ctx.hasDir('compliance') || ctx.hasDir('discovery') ||
    (pkg.keywords && pkg.keywords.some(k => ['legaltech', 'legal', 'compliance', 'e-discovery', 'ediscovery'].includes(k)))
  ) {
    addMatch('legaltech', [
      'Legal technology or compliance signals detected.',
      hasDependency(depKeys, [/^docusign/i, /^@docusign\//i]) ? 'DocuSign dependency detected.' : null,
      ctx.hasDir('contracts') ? 'Contracts directory detected.' : null,
    ]);
  }

  // AgriTech detection
  if (
    hasDependency(depKeys, [/^agworld/i, /^farmos/i, /^cropsar/i]) ||
    ctx.hasDir('crops') || ctx.hasDir('farm') || ctx.hasDir('agriculture') || ctx.hasDir('harvest') ||
    (pkg.keywords && pkg.keywords.some(k => ['agritech', 'agriculture', 'farming', 'crop', 'precision-agriculture'].includes(k)))
  ) {
    addMatch('agritech', [
      'Agricultural technology signals detected.',
      ctx.hasDir('crops') ? 'Crops directory detected.' : null,
      ctx.hasDir('farm') ? 'Farm directory detected.' : null,
    ]);
  }

  // BioTech detection
  if (
    hasDependency(depKeys, [/^bionode/i, /^bioinformatics/i, /^@biom3\//i, /^openbabel/i]) ||
    ctx.hasDir('bioinformatics') || ctx.hasDir('lab') || ctx.hasDir('sequences') || ctx.hasDir('genomics') ||
    hasAnyFile(files, /(^|\/)(\.fasta|\.fastq|\.vcf|\.bam|\.sam)/i)
  ) {
    addMatch('biotech', [
      'Biotech or bioinformatics signals detected.',
      ctx.hasDir('genomics') ? 'Genomics directory detected.' : null,
      hasAnyFile(files, /(\.fasta|\.fastq|\.vcf)/i) ? 'Bioinformatics data files detected.' : null,
    ]);
  }

  // Cybersecurity detection
  if (
    hasDependency(depKeys, [/^snort/i, /^suricata/i, /^zeek/i, /^wazuh/i, /^elastic-siem/i, /^splunk/i, /^@elastic\/elasticsearch$/i]) ||
    ctx.hasDir('threats') || ctx.hasDir('incidents') || ctx.hasDir('siem') || ctx.hasDir('detection-rules') ||
    (pkg.keywords && pkg.keywords.some(k => ['cybersecurity', 'siem', 'threat-detection', 'incident-response'].includes(k)))
  ) {
    addMatch('cybersecurity', [
      'Cybersecurity or threat detection signals detected.',
      ctx.hasDir('detection-rules') ? 'Detection rules directory detected.' : null,
      ctx.hasDir('incidents') ? 'Incidents directory detected.' : null,
    ]);
  }

  // Logistics detection
  if (
    hasDependency(depKeys, [/^graphhopper/i, /^osrm/i, /^mapbox-directions/i, /^@googlemaps\//i]) ||
    ctx.hasDir('routes') || ctx.hasDir('fleet') || ctx.hasDir('shipments') || ctx.hasDir('warehouse') ||
    (pkg.keywords && pkg.keywords.some(k => ['logistics', 'fleet', 'routing', 'shipment', 'warehouse'].includes(k)))
  ) {
    addMatch('logistics', [
      'Logistics or fleet management signals detected.',
      ctx.hasDir('fleet') ? 'Fleet directory detected.' : null,
      ctx.hasDir('shipments') ? 'Shipments directory detected.' : null,
    ]);
  }

  // Media detection
  if (
    hasDependency(depKeys, [/^keystonejs/i, /^@keystonejs\//i, /^ghost/i, /^@tryghost\//i, /^wordpress/i, /^tinymce/i]) ||
    ctx.hasDir('editorial') || ctx.hasDir('dam') || ctx.hasDir('assets/media') || ctx.hasDir('publications') ||
    (pkg.keywords && pkg.keywords.some(k => ['media', 'publishing', 'editorial', 'digital-asset'].includes(k)))
  ) {
    addMatch('media', [
      'Media or digital publishing signals detected.',
      hasDependency(depKeys, [/^keystonejs/i, /^@keystonejs\//i]) ? 'KeystoneJS CMS detected.' : null,
      ctx.hasDir('editorial') ? 'Editorial directory detected.' : null,
    ]);
  }

  // Social detection
  if (
    hasDependency(depKeys, [/^stream-chat/i, /^@stream-io\//i, /^getstream/i, /^socket\.io$/i, /^perspective-api/i]) ||
    ctx.hasDir('feed') || ctx.hasDir('moderation') || ctx.hasDir('messaging') || ctx.hasDir('social') ||
    (pkg.keywords && pkg.keywords.some(k => ['social', 'feed', 'moderation', 'messaging', 'community'].includes(k)))
  ) {
    addMatch('social', [
      'Social platform signals detected.',
      ctx.hasDir('feed') ? 'Feed directory detected.' : null,
      ctx.hasDir('moderation') ? 'Moderation directory detected.' : null,
    ]);
  }

  // Travel detection
  if (
    hasDependency(depKeys, [/^amadeus/i, /^sabre/i, /^travelport/i, /^booking/i, /^skyscanner/i]) ||
    ctx.hasDir('bookings') || ctx.hasDir('reservations') || ctx.hasDir('itineraries') || ctx.hasDir('pricing') ||
    (pkg.keywords && pkg.keywords.some(k => ['travel', 'booking', 'gds', 'hospitality', 'reservation'].includes(k)))
  ) {
    addMatch('travel', [
      'Travel or booking platform signals detected.',
      hasDependency(depKeys, [/^amadeus/i]) ? 'Amadeus GDS dependency detected.' : null,
      ctx.hasDir('bookings') ? 'Bookings directory detected.' : null,
    ]);
  }

  // Insurance detection
  if (
    hasDependency(depKeys, [/^guidewire/i, /^duck-creek/i, /^actuarial/i, /^socotra/i]) ||
    ctx.hasDir('claims') || ctx.hasDir('underwriting') || ctx.hasDir('policies') || ctx.hasDir('risk-models') ||
    (pkg.keywords && pkg.keywords.some(k => ['insurance', 'insurtech', 'claims', 'underwriting', 'actuarial'].includes(k)))
  ) {
    addMatch('insurance', [
      'Insurance or risk management signals detected.',
      ctx.hasDir('claims') ? 'Claims directory detected.' : null,
      ctx.hasDir('underwriting') ? 'Underwriting directory detected.' : null,
    ]);
  }

  // Energy detection
  if (
    hasDependency(depKeys, [/^openadr/i, /^green-button/i, /^iec61850/i, /^modbus/i, /^opc-ua/i]) ||
    ctx.hasDir('grid') || ctx.hasDir('metering') || ctx.hasDir('energy') || ctx.hasDir('renewables') ||
    (pkg.keywords && pkg.keywords.some(k => ['energy', 'smart-grid', 'metering', 'renewable', 'utility'].includes(k)))
  ) {
    addMatch('energy', [
      'Energy or grid management signals detected.',
      ctx.hasDir('grid') ? 'Grid directory detected.' : null,
      ctx.hasDir('metering') ? 'Metering directory detected.' : null,
    ]);
  }
}

module.exports = {
  PACK_BLUEPRINTS,
  buildAdditionalDomainPacks,
  detectAdditionalDomainPacks,
};
