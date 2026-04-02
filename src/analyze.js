/**
 * Project scanner + recommendation layer for augment and suggest-only modes.
 * Produces a structured repo-aware analysis without writing files.
 */

const path = require('path');
const { audit } = require('./audit');
const { ProjectContext } = require('./context');
const { STACKS } = require('./techniques');
const { detectDomainPacks } = require('./domain-packs');
const { recommendMcpPacks } = require('./mcp-packs');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
};

function c(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTomlSection(content, sectionName) {
  const pattern = new RegExp(`\\[${escapeRegex(sectionName)}\\]([\\s\\S]*?)(?:\\n\\s*\\[|$)`);
  const match = content.match(pattern);
  return match ? match[1] : null;
}

function extractTomlValue(sectionContent, key) {
  if (!sectionContent) return null;
  const pattern = new RegExp(`^\\s*${escapeRegex(key)}\\s*=\\s*["']([^"']+)["']`, 'm');
  const match = sectionContent.match(pattern);
  return match ? match[1].trim() : null;
}

function detectProjectMetadata(ctx) {
  const pkg = ctx.jsonFile('package.json');
  if (pkg && (pkg.name || pkg.description)) {
    return {
      name: pkg.name || path.basename(ctx.dir),
      description: pkg.description || '',
    };
  }

  const pyproject = ctx.fileContent('pyproject.toml') || '';
  if (pyproject) {
    const projectSection = extractTomlSection(pyproject, 'project');
    const poetrySection = extractTomlSection(pyproject, 'tool.poetry');
    const name = extractTomlValue(projectSection, 'name') ||
      extractTomlValue(poetrySection, 'name');
    const description = extractTomlValue(projectSection, 'description') ||
      extractTomlValue(poetrySection, 'description');

    if (name || description) {
      return {
        name: name || path.basename(ctx.dir),
        description: description || '',
      };
    }
  }

  return {
    name: path.basename(ctx.dir),
    description: '',
  };
}

function detectMainDirs(ctx) {
  const candidates = [
    'src', 'lib', 'app', 'pages', 'components', 'api', 'routes', 'utils', 'helpers',
    'services', 'models', 'controllers', 'views', 'public', 'assets', 'config', 'tests',
    'test', '__tests__', 'spec', 'scripts', 'prisma', 'db', 'middleware', 'hooks',
    'agents', 'chains', 'workers', 'jobs', 'dags', 'macros', 'migrations',
    'src/components', 'src/app', 'src/pages', 'src/api', 'src/lib', 'src/hooks',
    'src/utils', 'src/services', 'src/models', 'src/middleware', 'src/agents',
    'src/chains', 'src/workers', 'src/jobs', 'src/app/api', 'app/api',
    'models/staging', 'models/marts'
  ];

  const dirs = [];
  for (const dir of candidates) {
    if (ctx.hasDir(dir)) {
      dirs.push(dir);
    }
  }
  return dirs;
}

function collectClaudeAssets(ctx) {
  const sharedSettings = ctx.jsonFile('.claude/settings.json');
  const localSettings = ctx.jsonFile('.claude/settings.local.json');
  const settings = sharedSettings || localSettings || null;

  const assetFiles = {
    claudeMd: ctx.fileContent('CLAUDE.md') ? 'CLAUDE.md' : (ctx.fileContent('.claude/CLAUDE.md') ? '.claude/CLAUDE.md' : null),
    settings: sharedSettings ? '.claude/settings.json' : (localSettings ? '.claude/settings.local.json' : null),
    commands: ctx.hasDir('.claude/commands') ? ctx.dirFiles('.claude/commands') : [],
    rules: ctx.hasDir('.claude/rules') ? ctx.dirFiles('.claude/rules') : [],
    hooks: ctx.hasDir('.claude/hooks') ? ctx.dirFiles('.claude/hooks') : [],
    agents: ctx.hasDir('.claude/agents') ? ctx.dirFiles('.claude/agents') : [],
    skills: ctx.hasDir('.claude/skills') ? ctx.dirFiles('.claude/skills') : [],
  };

  return {
    files: assetFiles,
    counts: {
      commands: assetFiles.commands.length,
      rules: assetFiles.rules.length,
      hooks: assetFiles.hooks.length,
      agents: assetFiles.agents.length,
      skills: assetFiles.skills.length,
      mcpServers: settings && settings.mcpServers ? Object.keys(settings.mcpServers).length : 0,
    },
    permissions: settings && settings.permissions ? {
      defaultMode: settings.permissions.defaultMode || null,
      hasDenyRules: Array.isArray(settings.permissions.deny) && settings.permissions.deny.length > 0,
    } : null,
    settingsSource: assetFiles.settings,
  };
}

function detectMaturity(assets) {
  let score = 0;
  if (assets.files.claudeMd) score += 2;
  if (assets.files.settings) score += 1;
  if (assets.counts.rules > 0) score += 1;
  if (assets.counts.commands > 0) score += 1;
  if (assets.counts.hooks > 0) score += 1;
  if (assets.counts.agents > 0) score += 1;
  if (assets.counts.skills > 0) score += 1;

  if (score === 0) return 'none';
  if (score <= 2) return 'starter';
  if (score <= 5) return 'developing';
  return 'mature';
}

function riskFromImpact(impact) {
  if (impact === 'critical') return 'high';
  if (impact === 'high') return 'medium';
  return 'low';
}

function moduleFromCategory(category) {
  const map = {
    memory: 'CLAUDE.md',
    quality: 'verification',
    git: 'safety',
    workflow: 'commands-agents-skills',
    security: 'permissions',
    automation: 'hooks',
    design: 'design-rules',
    devops: 'ci-devops',
    hygiene: 'project-hygiene',
    performance: 'context-management',
    tools: 'mcp-tools',
    prompting: 'prompt-structure',
    features: 'modern-claude-features',
    'quality-deep': 'quality-deep',
  };
  return map[category] || category;
}

const STRENGTH_REASONS = {
  claudeMd: 'Foundation of Claude workflow. Every session benefits from this.',
  mermaidArchitecture: 'Architecture diagram saves 73% tokens vs prose — high-value asset.',
  verificationLoop: 'Claude can self-verify, catching errors before human review.',
  hooks: 'Automated enforcement (100% vs 80% from instructions alone).',
  hooksInSettings: 'Hook registration in settings ensures consistent automation.',
  preToolUseHook: 'Pre-execution validation adds a safety layer.',
  postToolUseHook: 'Post-execution automation catches issues immediately.',
  sessionStartHook: 'Session initialization ensures consistent starting state.',
  customCommands: 'Reusable workflows encoded as one-liner commands.',
  settingsPermissions: 'Explicit permissions prevent accidental dangerous operations.',
  permissionDeny: 'Deny rules block risky operations at the system level.',
  pathRules: 'Scoped rules ensure different code areas get appropriate guidance.',
  fewShotExamples: 'Code examples guide Claude to match your conventions.',
  constraintBlocks: 'XML constraint blocks improve rule adherence by 40%.',
  xmlTags: 'Structured prompt sections improve consistency.',
  context7Mcp: 'Real-time docs eliminate version-mismatch hallucinations.',
  mcpServers: 'External tool integration extends Claude capabilities.',
  compactionAwareness: 'Context management keeps sessions efficient.',
  agents: 'Specialized agents delegate complex tasks effectively.',
  noSecretsInClaude: 'No secrets in config — good security hygiene.',
  gitIgnoreEnv: 'Environment files are properly excluded from git.',
};

function toStrengths(results) {
  return results
    .filter(r => r.passed === true)
    .sort((a, b) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return (order[b.impact] || 0) - (order[a.impact] || 0);
    })
    .slice(0, 8)
    .map(r => ({
      key: r.key,
      name: r.name,
      category: r.category,
      why: STRENGTH_REASONS[r.key] || `Already configured and working: ${r.name}.`,
    }));
}

const GAP_REASONS = {
  noBypassPermissions: 'bypassPermissions skips all safety checks. Use explicit allow rules for control without risk.',
  secretsProtection: 'Without deny rules for .env, Claude can read secrets and potentially expose them in outputs.',
  testCommand: 'Without a test command, Claude cannot verify its changes work before you review them.',
  lintCommand: 'Without a lint command, Claude may produce inconsistently formatted code.',
  buildCommand: 'Without a build command, Claude cannot catch compilation errors early.',
  ciPipeline: 'CI ensures every change is automatically tested. Without it, bugs reach main branch faster.',
  securityReview: 'Claude Code has built-in OWASP Top 10 scanning. Not using it leaves vulnerabilities undetected.',
  skills: 'Skills encode domain expertise as reusable components. Without them, you repeat context every session.',
  multipleAgents: 'Multiple agents enable parallel specialized work (security review + code writing simultaneously).',
  multipleMcpServers: 'More MCP servers give Claude access to more external context (docs, databases, APIs).',
  roleDefinition: 'A role definition helps Claude calibrate response depth and technical level.',
  importSyntax: '@import keeps CLAUDE.md lean while still providing deep instructions in focused modules.',
};

function toGaps(results) {
  return results
    .filter(r => r.passed === false)
    .sort((a, b) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return (order[b.impact] || 0) - (order[a.impact] || 0);
    })
    .slice(0, 8)
    .map(r => ({
      key: r.key,
      name: r.name,
      impact: r.impact,
      category: r.category,
      fix: r.fix,
      why: GAP_REASONS[r.key] || r.fix,
    }));
}

function toRecommendations(auditResult) {
  const failed = auditResult.results
    .filter(r => r.passed === false)
    .sort((a, b) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return (order[b.impact] || 0) - (order[a.impact] || 0);
    });

  return failed.slice(0, 10).map((r, index) => ({
    priority: index + 1,
    key: r.key,
    name: r.name,
    impact: r.impact,
    module: moduleFromCategory(r.category),
    risk: riskFromImpact(r.impact),
    why: r.fix,
  }));
}

function buildOptionalModules(stacks, assets) {
  const stackKeys = stacks.map(s => s.key);
  const modules = [];

  if (!assets.files.claudeMd) modules.push('CLAUDE.md baseline');
  if (assets.counts.commands === 0) modules.push('Slash commands');
  if (assets.counts.hooks === 0) modules.push('Hooks automation');
  if (!assets.permissions || !assets.permissions.hasDenyRules) modules.push('Permission safety profile');
  if (assets.counts.rules === 0) modules.push('Path-specific rules');
  if (stackKeys.some(k => ['react', 'nextjs', 'vue', 'angular', 'svelte'].includes(k))) modules.push('Frontend pack');
  if (stackKeys.some(k => ['node', 'python', 'django', 'fastapi', 'go', 'rust', 'java'].includes(k))) modules.push('Backend pack');
  if (stackKeys.some(k => ['docker', 'terraform', 'kubernetes'].includes(k))) modules.push('DevOps pack');
  if (assets.counts.agents === 0) modules.push('Specialized agents');

  return [...new Set(modules)].slice(0, 8);
}

function buildRiskNotes(auditResult, assets, maturity) {
  const notes = [];
  if (!assets.files.claudeMd) notes.push('No CLAUDE.md exists yet, so Claude has no persistent project-specific guidance.');
  if (assets.permissions && assets.permissions.defaultMode === 'bypassPermissions') {
    notes.push('Current settings use bypassPermissions, which is risky for broader team adoption.');
  }
  if (!assets.permissions || !assets.permissions.hasDenyRules) {
    notes.push('Permissions lack deny rules, so secret access and destructive commands are not strongly guarded.');
  }
  if (maturity === 'mature') {
    notes.push('This repo already has meaningful Claude assets, so augment mode should preserve existing structure instead of overwriting it.');
  }
  if (auditResult.results.some(r => r.key === 'ciPipeline' && r.passed === false)) {
    notes.push('Without CI enforcement, readiness can drift after setup.');
  }
  return notes.slice(0, 5);
}

function buildRolloutOrder(report) {
  const steps = [];
  if (!report.existingClaudeAssets.claudeMd) steps.push('Create a project-specific CLAUDE.md baseline');
  if (report.gapsIdentified.some(g => g.category === 'security')) steps.push('Add safe settings and deny rules');
  if (report.gapsIdentified.some(g => g.category === 'automation')) steps.push('Add hooks and automate verification');
  if (report.gapsIdentified.some(g => g.category === 'workflow')) steps.push('Add commands, rules, and specialization modules');
  if (report.gapsIdentified.some(g => g.category === 'devops')) steps.push('Connect CI threshold enforcement');
  if (steps.length === 0) steps.push('Tighten quality-deep items and preserve the current setup');
  return steps;
}

async function analyzeProject(options) {
  const mode = options.mode || 'augment';
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const auditResult = await audit({ ...options, silent: true });
  const assets = collectClaudeAssets(ctx);
  const metadata = detectProjectMetadata(ctx);
  const maturity = detectMaturity(assets);
  const mainDirs = detectMainDirs(ctx);
  const recommendedDomainPacks = detectDomainPacks(ctx, stacks, assets);
  const recommendedMcpPacks = recommendMcpPacks(stacks, recommendedDomainPacks, { ctx, assets });

  const report = {
    mode,
    writeBehavior: 'No files are written in this mode.',
    projectSummary: {
      name: metadata.name,
      description: metadata.description,
      directory: options.dir,
      stacks: stacks.map(s => s.label),
      domains: recommendedDomainPacks.map(pack => pack.label),
      maturity,
      score: auditResult.score,
      organicScore: auditResult.organicScore,
      checkCount: auditResult.checkCount,
    },
    detectedArchitecture: {
      repoType: stacks.length > 0 ? 'stack-detected repo' : 'generic repo',
      mainDirectories: mainDirs,
      stackSignals: stacks.map(s => s.key),
    },
    existingClaudeAssets: {
      claudeMd: assets.files.claudeMd,
      settings: assets.settingsSource,
      commands: assets.files.commands,
      rules: assets.files.rules,
      hooks: assets.files.hooks,
      agents: assets.files.agents,
      skills: assets.files.skills,
      mcpServers: assets.counts.mcpServers,
    },
    strengthsPreserved: toStrengths(auditResult.results),
    gapsIdentified: toGaps(auditResult.results),
    topNextActions: auditResult.topNextActions || auditResult.quickWins,
    recommendedImprovements: toRecommendations(auditResult),
    recommendedDomainPacks,
    recommendedMcpPacks,
    riskNotes: buildRiskNotes(auditResult, assets, maturity),
    optionalModules: buildOptionalModules(stacks, assets),
  };

  report.suggestedRolloutOrder = buildRolloutOrder(report);
  return report;
}

function printAnalysis(report, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const modeLabel = report.mode === 'suggest-only' ? 'suggest-only' : report.mode;
  console.log('');
  console.log(c(`  claudex-setup ${modeLabel}`, 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log(c(`  ${report.writeBehavior}`, 'dim'));
  console.log('');

  console.log(c('  Project Summary', 'blue'));
  console.log(`  ${report.projectSummary.name}${report.projectSummary.description ? ` — ${report.projectSummary.description}` : ''}`);
  console.log(c(`  Stack: ${report.projectSummary.stacks.join(', ') || 'Unknown'}`, 'dim'));
  console.log(c(`  Domain packs: ${report.projectSummary.domains.join(', ') || 'Baseline General'}`, 'dim'));
  console.log(c(`  Maturity: ${report.projectSummary.maturity} | Score: ${report.projectSummary.score}/100 | Organic: ${report.projectSummary.organicScore}/100`, 'dim'));
  console.log('');

  console.log(c('  Detected Architecture', 'blue'));
  console.log(c(`  Main directories: ${report.detectedArchitecture.mainDirectories.join(', ') || 'No strong structure detected yet'}`, 'dim'));
  console.log('');

  console.log(c('  Existing Claude Assets', 'blue'));
  console.log(c(`  CLAUDE.md: ${report.existingClaudeAssets.claudeMd || 'missing'}`, 'dim'));
  console.log(c(`  Settings: ${report.existingClaudeAssets.settings || 'missing'}`, 'dim'));
  console.log(c(`  Commands: ${report.existingClaudeAssets.commands.length} | Rules: ${report.existingClaudeAssets.rules.length} | Hooks: ${report.existingClaudeAssets.hooks.length} | Agents: ${report.existingClaudeAssets.agents.length} | Skills: ${report.existingClaudeAssets.skills.length}`, 'dim'));
  console.log('');

  if (report.strengthsPreserved.length > 0) {
    console.log(c('  Strengths Preserved', 'green'));
    for (const item of report.strengthsPreserved) {
      console.log(`  ${c('✓', 'green')} ${item.name}`);
      if (item.why) {
        console.log(c(`    ${item.why}`, 'dim'));
      }
    }
    console.log('');
  }

  if (report.gapsIdentified.length > 0) {
    console.log(c('  Gaps Identified', 'yellow'));
    for (const item of report.gapsIdentified.slice(0, 5)) {
      console.log(`  - [${item.impact}] ${item.name}`);
      console.log(c(`    ${item.fix}`, 'dim'));
    }
    console.log('');
  }

  if (report.topNextActions.length > 0) {
    console.log(c('  Top 5 Next Actions', 'magenta'));
    report.topNextActions.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}`);
      console.log(c(`     Why: ${item.why || item.fix}`, 'dim'));
      if (Array.isArray(item.signals) && item.signals.length > 0) {
        console.log(c(`     Trace: ${item.signals.join(' | ')}`, 'dim'));
      }
      if (item.risk || item.confidence) {
        console.log(c(`     Risk: ${item.risk || 'low'} | Confidence: ${item.confidence || 'medium'}`, 'dim'));
      }
      console.log(c(`     Fix: ${item.fix}`, 'dim'));
    });
    console.log('');
  }

  if (report.recommendedDomainPacks.length > 0) {
    console.log(c('  Recommended Domain Packs', 'blue'));
    for (const pack of report.recommendedDomainPacks) {
      console.log(`  - ${pack.label}`);
      console.log(c(`    ${pack.useWhen}`, 'dim'));
    }
    console.log('');
  }

  if (report.recommendedMcpPacks.length > 0) {
    console.log(c('  Recommended MCP Packs', 'blue'));
    for (const pack of report.recommendedMcpPacks) {
      console.log(`  - ${pack.label}`);
      console.log(c(`    ${pack.adoption}`, 'dim'));
    }
    console.log('');
  }

  if (report.riskNotes.length > 0) {
    console.log(c('  Risk Notes', 'red'));
    for (const note of report.riskNotes) {
      console.log(`  - ${note}`);
    }
    console.log('');
  }

  if (report.optionalModules.length > 0) {
    console.log(c('  Optional Modules', 'blue'));
    console.log(c(`  ${report.optionalModules.join(' | ')}`, 'dim'));
    console.log('');
  }

  if (report.suggestedRolloutOrder.length > 0) {
    console.log(c('  Suggested Rollout Order', 'blue'));
    report.suggestedRolloutOrder.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
    console.log('');
  }
}

function exportMarkdown(report) {
  const lines = [];
  lines.push(`# Claudex Setup Analysis Report`);
  lines.push(`## ${report.mode === 'suggest-only' ? 'Suggest-Only' : 'Augment'} Mode`);
  lines.push('');
  lines.push(`**Project:** ${report.projectSummary.name}${report.projectSummary.description ? ` — ${report.projectSummary.description}` : ''}`);
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Score:** ${report.projectSummary.score}/100 | **Organic:** ${report.projectSummary.organicScore}/100`);
  lines.push(`**Stacks:** ${report.projectSummary.stacks.join(', ') || 'None detected'}`);
  lines.push(`**Domain Packs:** ${report.projectSummary.domains.join(', ') || 'Baseline General'}`);
  lines.push(`**Maturity:** ${report.projectSummary.maturity}`);
  lines.push('');

  if (report.strengthsPreserved.length > 0) {
    lines.push('## Strengths Preserved');
    lines.push('');
    for (const item of report.strengthsPreserved) {
      lines.push(`- **${item.name}** — ${item.why || 'Already configured.'}`);
    }
    lines.push('');
  }

  if (report.gapsIdentified.length > 0) {
    lines.push('## Gaps Identified');
    lines.push('');
    lines.push('| Gap | Impact | Fix |');
    lines.push('|-----|--------|-----|');
    for (const item of report.gapsIdentified) {
      lines.push(`| ${item.name} | ${item.impact} | ${item.fix} |`);
    }
    lines.push('');
  }

  if (report.topNextActions.length > 0) {
    lines.push('## Top Next Actions');
    lines.push('');
    report.topNextActions.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. **${item.name}**`);
      lines.push(`   - Why: ${item.why || item.fix}`);
      if (Array.isArray(item.signals) && item.signals.length > 0) {
        lines.push(`   - Trace: ${item.signals.join(' | ')}`);
      }
      if (item.risk || item.confidence) {
        lines.push(`   - Risk / Confidence: ${item.risk || 'low'} / ${item.confidence || 'medium'}`);
      }
      lines.push(`   - Fix: ${item.fix}`);
    });
    lines.push('');
  }

  if (report.recommendedDomainPacks.length > 0) {
    lines.push('## Recommended Domain Packs');
    lines.push('');
    for (const pack of report.recommendedDomainPacks) {
      lines.push(`- **${pack.label}**: ${pack.useWhen}`);
    }
    lines.push('');
  }

  if (report.recommendedMcpPacks.length > 0) {
    lines.push('## Recommended MCP Packs');
    lines.push('');
    for (const pack of report.recommendedMcpPacks) {
      lines.push(`- **${pack.label}**: ${pack.useWhen}`);
    }
    lines.push('');
  }

  if (report.riskNotes.length > 0) {
    lines.push('## Risk Notes');
    lines.push('');
    for (const note of report.riskNotes) {
      lines.push(`- ⚠️ ${note}`);
    }
    lines.push('');
  }

  if (report.suggestedRolloutOrder.length > 0) {
    lines.push('## Suggested Rollout Order');
    lines.push('');
    report.suggestedRolloutOrder.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated by claudex-setup v${require('../package.json').version}*`);
  return lines.join('\n');
}

module.exports = { analyzeProject, printAnalysis, exportMarkdown };
